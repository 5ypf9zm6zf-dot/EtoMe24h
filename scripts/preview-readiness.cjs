// Operator-only checks. Not an HTTP endpoint, build hook, or automatic model switch.
const OpenAI = require('openai');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');

// Standard USD / million tokens, checked 2026-11-28 against:
// https://developers.openai.com/api/docs/pricing
// Catalog presence is NOT proof of funded inference or Croatian quality.
const candidates = [
  { id: 'gpt-5-nano', input: 0.05, output: 0.40, deprecated: true },
  { id: 'gpt-6-luna', input: 0.10, output: 0.50, deprecated: false },
  { id: 'gpt-4o-mini', input: 0.15, output: 0.60 },
  { id: 'gpt-5.4-nano', input: 0.20, output: 1.25 },
  { id: 'gpt-5-mini', input: 0.25, output: 2.00, deprecated: true },
];
function previewOnly(env) {
  if (env.VERCEL_ENV !== 'preview') throw Error('preview_required');
}
async function checkModels(env, client) {
  previewOnly(env);
  if (!env.OPENAI_API_KEY || env.OPENAI_API_KEY === '[SENSITIVE]') throw Error('openai_secret_unavailable');
  client ||= new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: 20000, maxRetries: 0, logLevel: 'off' });
  const ids = new Set();
  for await (const model of client.models.list()) ids.add(model.id);
  return {
    catalogVisible: candidates.filter(model => ids.has(model.id)),
    configuredVisible: env.OPENAI_MODEL ? ids.has(env.OPENAI_MODEL) : null,
    inferenceVerified: false,
    note: 'No inference request, model change, or Croatian quality claim. Prices are not an invoice.',
  };
}
async function checkRedis(env, fetchImpl = fetch) {
  previewOnly(env);
  const direct = env.UPSTASH_REDIS_REST_URL || env.UPSTASH_REDIS_REST_TOKEN;
  const url = direct ? env.UPSTASH_REDIS_REST_URL : env.KV_REST_API_URL;
  const token = direct ? env.UPSTASH_REDIS_REST_TOKEN : env.KV_REST_API_TOKEN;
  if (!url || !token || token === '[SENSITIVE]') throw Error('redis_pair_unavailable');
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) throw Error('redis_https_required');
  // Execute the exact route Lua, not an independently reimplemented limiter.
  const source = readFileSync(join(__dirname, '../app/api/chat/route.js'), 'utf8');
  const script = source.match(/const RATE_LIMIT_SCRIPT = `([^`]+)`;/)?.[1];
  if (!script) throw Error('limiter_script_missing');
  // Isolated disposable keys only: never touch real IP or Production counters.
  const prefix = `etome:readiness:preview:${randomUUID()}`;
  const keys = [`${prefix}:m`, `${prefix}:d`];
  async function command(args) {
    const res = await fetchImpl(url.replace(/\/+$/, ''), {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args), cache: 'no-store', signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw Error('redis_http_failed');
    const body = await res.json();
    if (body.error || !Object.hasOwn(body, 'result')) throw Error('redis_command_failed');
    return body.result;
  }
  // Prove the basic REST command path before testing Lua. Separate key, bounded
  // lifetime and targeted cleanup even on a wrong GET result. No user counters.
  const probeKey = `${prefix}:probe`;
  assert.equal(await command(['PING']), 'PONG');
  try {
    assert.equal(await command(['SET', probeKey, prefix, 'EX', '60']), 'OK');
    assert.equal(await command(['GET', probeKey]), prefix);
  } finally {
    assert.equal(await command(['DEL', probeKey]), 1);
  }
  assert.equal(await command(['GET', probeKey]), null);
  try {
    // Wait for every in-flight write before cleanup, even if one fails.
    const settled = await Promise.allSettled(Array.from({ length: 9 }, () => command(['EVAL', script, '2', ...keys, '60', '86400'])));
    assert.ok(settled.every(result => result.status === 'fulfilled'));
    const results = settled.map(result => result.value);
    for (const result of results) {
      assert.ok(Array.isArray(result) && result.length === 2 && result.every(Number.isSafeInteger));
      assert.equal(result[0], result[1]);
    }
    assert.deepEqual(results.map(result => result[0]).sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (const [index, max] of [60, 86400].entries()) {
      const ttl = await command(['TTL', keys[index]]);
      assert.ok(Number.isInteger(ttl) && ttl > 0 && ttl <= max);
    }
    // Seed only our disposable day key to check 80 -> 81 without AI calls.
    assert.equal(await command(['SET', keys[1], '80', 'EX', '86400']), 'OK');
    assert.deepEqual(await command(['EVAL', script, '2', ...keys, '60', '86400']), [10, 81]);
    return { ping: true, setGetDelete: true, atomicCounters: true, expiryPresent: true, dayThreshold: true, deployedRouteVerified: false };
  } finally {
    // TTLs also bound lifetime if connection loss prevents this cleanup.
    assert.equal(await command(['DEL', ...keys]), 2);
  }
}
async function main() {
  const mode = process.argv[2];
  try {
    if (!['models', 'redis'].includes(mode)) throw Error('choose_models_or_redis');
    console.log(JSON.stringify(await (mode === 'models' ? checkModels(process.env) : checkRedis(process.env)), null, 2));
  } catch {
    // Provider/Redis errors can contain credentials, URLs or account data.
    console.error('Preview readiness NOT verified: check Preview scope, credentials and service access. No provider details logged.');
    process.exitCode = 2;
  }
}
if (require.main === module) void main();
module.exports = { checkModels, checkRedis };
