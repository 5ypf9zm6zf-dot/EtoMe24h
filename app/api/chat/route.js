import { createHash } from 'node:crypto';
import OpenAI from 'openai';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const MAX_BODY_BYTES = 48 * 1024;
const MAX_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_OUTPUT_TOKENS = 500;
const RATE_LIMIT_SCRIPT = `
local minuteCount = redis.call('INCR', KEYS[1])
if minuteCount == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
local dayCount = redis.call('INCR', KEYS[2])
if dayCount == 1 then redis.call('EXPIRE', KEYS[2], ARGV[2]) end
return { minuteCount, dayCount }
`;

function jsonError(reply, status, extraHeaders = {}) {
  return NextResponse.json({ reply }, { status, headers: extraHeaders });
}

async function readJsonWithLimit(request) {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_BODY_BYTES) return { error: 'too_large' };
  if (!request.body) return { error: 'invalid' };

  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => {});
        return { error: 'too_large' };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  try {
    const body = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { value: JSON.parse(new TextDecoder().decode(body)) };
  } catch {
    return { error: 'invalid' };
  }
}

function getClientIp(request) {
  // Prefer Vercel's single-value client IP header.
  const vercelIp = request.headers.get('x-vercel-forwarded-for')?.trim();
  if (vercelIp) return vercelIp.slice(0, 128);

  // Vercel sanitizes X-Forwarded-For; its leftmost entry is the client IP.
  const forwarded = request.headers.get('x-forwarded-for');
  if (!forwarded) return null;
  const entries = forwarded.split(',').map((part) => part.trim()).filter(Boolean);
  return entries.length ? entries[0].slice(0, 128) : null;
}

async function enforceSharedRateLimit(request) {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const ip = getClientIp(request);

  // Fail closed: do not call the paid AI API when shared rate limiting is
  // unavailable or has not been configured.
  if (!redisUrl || !redisToken || !ip) return { allowed: false, unavailable: true };

  const ipHash = createHash('sha256').update(ip).digest('hex');
  const minuteBucket = Math.floor(Date.now() / 60_000);
  const dayBucket = Math.floor(Date.now() / 86_400_000);
  const minuteKey = `etome:chat:${ipHash}:m:${minuteBucket}`;
  const dayKey = `etome:chat:${ipHash}:d:${dayBucket}`;

  try {
    const response = await fetch(redisUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${redisToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        'EVAL',
        RATE_LIMIT_SCRIPT,
        '2',
        minuteKey,
        dayKey,
        '120',
        '172800',
      ]),
      cache: 'no-store',
      signal: AbortSignal.timeout(2500),
    });

    if (!response.ok) return { allowed: false, unavailable: true };
    const result = await response.json();
    const counts = result?.result;
    if (!Array.isArray(counts) || counts.length !== 2) {
      return { allowed: false, unavailable: true };
    }

    const minuteCount = Number(counts[0]);
    const dayCount = Number(counts[1]);
    return {
      allowed: minuteCount <= 8 && dayCount <= 80,
      unavailable: false,
      limited: minuteCount > 8 || dayCount > 80,
    };
  } catch {
    return { allowed: false, unavailable: true };
  }
}

export async function POST(request) {
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return jsonError('Zahtjev mora biti u JSON formatu.', 415);
  }

  const rateLimit = await enforceSharedRateLimit(request);
  if (rateLimit.unavailable) {
    return jsonError('AI asistent je privremeno nedostupan. Nazovi nas na 098 1947 591.', 503, {
      'Retry-After': '30',
    });
  }
  if (!rateLimit.allowed) {
    return jsonError('Previše poruka u kratkom vremenu. Pokušaj ponovno malo kasnije.', 429, {
      'Retry-After': '60',
    });
  }

  const parsed = await readJsonWithLimit(request);
  if (parsed.error === 'too_large') {
    return jsonError('Poruka je prevelika. Skrati je pa pokušaj ponovno.', 413);
  }
  if (parsed.error || !parsed.value || typeof parsed.value !== 'object') {
    return jsonError('Ne mogu pročitati poruku. Pokušaj ponovno.', 400);
  }

  const messages = Array.isArray(parsed.value.messages) ? parsed.value.messages : [];
  if (messages.length === 0 || messages.length > MAX_MESSAGES) {
    return jsonError('Pošalji poruku pa pokušaj ponovno.', 400);
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

  if (safeMessages.length === 0) {
    return jsonError('Nisam dobio valjanu poruku.', 400);
  }

  if (!process.env.OPENAI_API_KEY) {
    return jsonError('AI asistent je privremeno nedostupan. Nazovi nas na 098 1947 591.', 503);
  }

  try {
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 20_000,
      maxRetries: 1,
    });
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-5-mini',
      max_output_tokens: MAX_OUTPUT_TOKENS,
      instructions:
        'Ti si EtoMe AI asistent. Odgovaraj na hrvatskom, jasno, kratko i korisno. Pomaži korisnicima oko EtoMe usluga i općih pitanja. Ne izmišljaj cijene, termine ili dostupnost.',
      input: safeMessages,
    });

    return NextResponse.json({
      reply: response.output_text || 'Trenutno nemam odgovor. Pokušaj ponovno.',
    });
  } catch (error) {
    // Keep secrets, request payloads and provider internals out of client output.
    console.error('EtoMe AI request failed:', error?.name || 'UnknownError');
    return jsonError('Došlo je do greške. Pokušaj ponovno ili nazovi nas na 098 1947 591.', 502);
  }
}
