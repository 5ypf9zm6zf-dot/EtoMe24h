import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import OpenAI from 'openai';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const MAX_BODY_BYTES = 48 * 1024;
const MAX_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_OUTPUT_TOKENS = 400;
const REQUESTS_PER_MINUTE = 8;
const REQUESTS_PER_DAY = 80;
const RATE_LIMIT_SCRIPT = `
local minuteCount = redis.call('INCR', KEYS[1])
if minuteCount == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
local dayCount = redis.call('INCR', KEYS[2])
if dayCount == 1 then redis.call('EXPIRE', KEYS[2], ARGV[2]) end
return { minuteCount, dayCount }
`;

const memoryBuckets = new Map();

function getClientKey(request) {
  // Vercel supplies x-real-ip from the edge. If unavailable, use the
  // right-most address added by the nearest trusted proxy, never the left-most
  // client-controlled X-Forwarded-For entry.
  const realIp = request.headers.get('x-real-ip')?.trim();
  const forwarded = request.headers.get('x-forwarded-for');
  const forwardedCandidates = forwarded?.split(',').map((value) => value.trim()).filter(Boolean) || [];
  const candidate = realIp || forwardedCandidates.at(-1) || '';
  const ip = isIP(candidate) ? candidate : 'unknown';
  return createHash('sha256').update(ip).digest('hex');
}

function checkMemoryLimit(clientKey, now) {
  const minuteBucket = Math.floor(now / 60_000);
  const dayBucket = Math.floor(now / 86_400_000);
  const minuteKey = `${clientKey}:m:${minuteBucket}`;
  const dayKey = `${clientKey}:d:${dayBucket}`;

  const minuteCount = (memoryBuckets.get(minuteKey) || 0) + 1;
  const dayCount = (memoryBuckets.get(dayKey) || 0) + 1;
  memoryBuckets.set(minuteKey, minuteCount);
  memoryBuckets.set(dayKey, dayCount);

  if (memoryBuckets.size > 5000) {
    for (const key of memoryBuckets.keys()) {
      const bucket = Number(key.slice(key.lastIndexOf(':') + 1));
      if (
        (key.includes(':m:') && bucket < minuteBucket - 120) ||
        (key.includes(':d:') && bucket < dayBucket - 2)
      ) {
        memoryBuckets.delete(key);
      }
    }
    // Keep the fallback bounded even during a burst of unique client keys.
    while (memoryBuckets.size > 5000) {
      memoryBuckets.delete(memoryBuckets.keys().next().value);
    }
  }

  return {
    allowed: minuteCount <= REQUESTS_PER_MINUTE && dayCount <= REQUESTS_PER_DAY,
    retryAfter: minuteCount > REQUESTS_PER_MINUTE ? 60 : 86_400,
  };
}

async function checkRateLimit(clientKey) {
  const now = Date.now();
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (redisUrl && redisToken) {
    try {
      const minuteBucket = Math.floor(now / 60_000);
      const dayBucket = Math.floor(now / 86_400_000);
      const response = await fetch(redisUrl.replace(/\/+$/, ''), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${redisToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          'EVAL',
          RATE_LIMIT_SCRIPT,
          '2',
          `etome:chat:${clientKey}:m:${minuteBucket}`,
          `etome:chat:${clientKey}:d:${dayBucket}`,
          '60',
          '86400',
        ]),
        cache: 'no-store',
        signal: AbortSignal.timeout(3000),
      });

      if (!response.ok) throw new Error('Rate limiter request failed');
      const payload = await response.json();
      const counts = payload?.result;
      if (!Array.isArray(counts) || counts.length !== 2) throw new Error('Invalid rate limiter response');

      const minuteCount = Number(counts[0]);
      const dayCount = Number(counts[1]);
      if (![minuteCount, dayCount].every((count) => Number.isSafeInteger(count) && count > 0)) {
        throw new Error('Invalid rate limiter counts');
      }
      return {
        allowed: minuteCount <= REQUESTS_PER_MINUTE && dayCount <= REQUESTS_PER_DAY,
        retryAfter: minuteCount > REQUESTS_PER_MINUTE ? 60 : 86_400,
      };
    } catch (error) {
      // Never bypass configured shared limits during an outage.
      console.error('EtoMe rate limiter unavailable:', error?.name || 'Error');
      return { unavailable: true };
    }
  }

  // A partially configured shared limiter must never silently fall back.
  if (redisUrl || redisToken) return { unavailable: true };

  // In-memory limits cannot protect spend across production instances.
  if (process.env.VERCEL_ENV === 'production') return { unavailable: true };

  // Local/Preview only: best-effort fallback when Redis is not configured.
  return checkMemoryLimit(clientKey, now);
}

async function readJsonBody(request) {
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return { error: 'too_large' };
  }

  if (!request.body) return { error: 'invalid' };

  const reader = request.body.getReader();
  const chunks = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_BODY_BYTES) {
        await reader.cancel();
        return { error: 'too_large' };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return { value: JSON.parse(new TextDecoder().decode(body)) };
  } catch {
    return { error: 'invalid' };
  }
}

function json(body, options = {}) {
  return NextResponse.json(body, {
    ...options,
    headers: { ...options.headers, 'Cache-Control': 'no-store' },
  });
}

export async function POST(request) {
  try {
    // Browser requests must come from this deployment; this is not bot auth.
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) {
      return json({ reply: 'Zahtjev nije dopušten.' }, { status: 403 });
    }
    if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
      return json({ reply: 'Očekuje se JSON zahtjev.' }, { status: 415 });
    }
    const parsed = await readJsonBody(request);
    if (parsed.error === 'too_large') {
      return json({ reply: 'Poruka je prevelika. Skrati je i pokušaj ponovno.' }, { status: 413 });
    }
    if (parsed.error || !parsed.value || typeof parsed.value !== 'object') {
      return json({ reply: 'Zahtjev nije valjan. Pokušaj ponovno.' }, { status: 400 });
    }

    const messages = parsed.value.messages;
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
      return json({ reply: 'Pošalji poruku pa pokušaj ponovno.' }, { status: 400 });
    }

    if (messages.some((message) =>
      !message || (message.role !== 'user' && message.role !== 'assistant') ||
      typeof message.content !== 'string' || !message.content.trim() ||
      message.content.length > MAX_MESSAGE_LENGTH
    ) || !messages.some((message) => message.role === 'user')) {
      return json({ reply: 'Poruke nisu valjane. Skrati ih i pokušaj ponovno.' }, { status: 400 });
    }
    const safeMessages = messages.map(({ role, content }) => ({ role, content: content.trim() }));

    const limit = await checkRateLimit(getClientKey(request));
    if (limit.unavailable) {
      return json({ reply: 'AI asistent trenutačno nije dostupan. Javite nam se putem kontakta.' }, { status: 503 });
    }
    if (!limit.allowed) {
      return json(
        { reply: 'Poslali ste previše poruka u kratkom vremenu. Pokušajte ponovno malo kasnije.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return json(
        { reply: 'AI asistent trenutačno nije dostupan. Možete nam se javiti izravno putem kontakta.' },
        { status: 503 }
      );
    }

    const client = new OpenAI({ apiKey, timeout: 20_000, maxRetries: 0 });
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-5-mini',
      instructions:
        'Ti si EtoMe AI asistent. Odgovaraj na hrvatskom, jasno, kratko i korisno. Pomaži korisnicima oko EtoMe usluga i općih pitanja. Ne izmišljaj cijene, termine ili dostupnost.',
      input: safeMessages,
      max_output_tokens: MAX_OUTPUT_TOKENS,
    });

    // An empty/incomplete provider result is not a successful AI answer.
    if (!response.output_text?.trim()) {
      console.error('EtoMe AI request failed:', JSON.stringify({ category: 'empty_output' }));
      return json({ reply: 'AI nije uspio dovršiti odgovor. Pokušaj ponovno.' }, { status: 502 });
    }
    return json({ reply: response.output_text });
  } catch (error) {
    // SDK errors may all be named Error. Log only allow-listed diagnostics,
    // never provider messages, request bodies, headers or credential values.
    const upstreamStatus = Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599
      ? error.status : undefined;
    const timeout = error instanceof OpenAI.APIConnectionTimeoutError;
    const connection = error instanceof OpenAI.APIConnectionError;
    const category = timeout ? 'timeout'
      : upstreamStatus === 401 || upstreamStatus === 403 ? 'provider_auth'
      : upstreamStatus === 429 ? 'provider_quota_or_rate_limit'
      : upstreamStatus ? 'provider_http'
      : connection ? 'provider_connection' : 'internal';
    console.error('EtoMe AI request failed:', JSON.stringify({ category, upstreamStatus }));
    const status = timeout ? 504
      : category === 'provider_auth' || upstreamStatus === 429 ? 503
      : upstreamStatus || connection ? 502 : 500;
    return json({ reply: 'AI asistent trenutačno nije dostupan. Pokušaj ponovno kasnije.' }, { status });
  }
}
