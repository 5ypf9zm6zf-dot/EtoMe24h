import { createHash } from 'node:crypto';
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
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = request.headers.get('x-real-ip') || forwarded?.split(',')[0]?.trim() || 'unknown';
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
      });

      if (!response.ok) throw new Error('Rate limiter request failed');
      const payload = await response.json();
      const counts = payload?.result;
      if (!Array.isArray(counts) || counts.length !== 2) throw new Error('Invalid rate limiter response');

      const minuteCount = Number(counts[0]);
      const dayCount = Number(counts[1]);
      return {
        allowed: minuteCount <= REQUESTS_PER_MINUTE && dayCount <= REQUESTS_PER_DAY,
        retryAfter: minuteCount > REQUESTS_PER_MINUTE ? 60 : 86_400,
      };
    } catch (error) {
      // A temporary Redis outage must not take the public chat offline.
      console.error('EtoMe rate limiter fallback:', error?.name || 'Error');
    }
  }

  // Best-effort per-instance fallback when Redis is not configured or unavailable.
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

export async function POST(request) {
  try {
    const parsed = await readJsonBody(request);
    if (parsed.error === 'too_large') {
      return NextResponse.json({ reply: 'Poruka je prevelika. Skrati je i pokušaj ponovno.' }, { status: 413 });
    }
    if (parsed.error || !parsed.value || typeof parsed.value !== 'object') {
      return NextResponse.json({ reply: 'Zahtjev nije valjan. Pokušaj ponovno.' }, { status: 400 });
    }

    const messages = parsed.value.messages;
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
      return NextResponse.json({ reply: 'Pošalji poruku pa pokušaj ponovno.' }, { status: 400 });
    }

    const safeMessages = messages
      .filter((message) =>
        (message?.role === 'user' || message?.role === 'assistant') &&
        typeof message?.content === 'string'
      )
      .map((message) => ({
        role: message.role,
        content: message.content.trim().slice(0, MAX_MESSAGE_LENGTH),
      }))
      .filter((message) => message.content.length > 0);

    if (safeMessages.length === 0 || !safeMessages.some((message) => message.role === 'user')) {
      return NextResponse.json({ reply: 'Nisam dobio valjanu korisničku poruku.' }, { status: 400 });
    }

    const limit = await checkRateLimit(getClientKey(request));
    if (!limit.allowed) {
      return NextResponse.json(
        { reply: 'Poslali ste previše poruka u kratkom vremenu. Pokušajte ponovno malo kasnije.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
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

    return NextResponse.json({
      reply: response.output_text || 'Trenutno nemam odgovor. Pokušaj ponovno.',
    });
  } catch (error) {
    console.error('EtoMe AI request failed:', error?.name || 'Error');
    return NextResponse.json(
      { reply: 'Došlo je do greške. Pokušaj ponovno.' },
      { status: 500 }
    );
  }
}
