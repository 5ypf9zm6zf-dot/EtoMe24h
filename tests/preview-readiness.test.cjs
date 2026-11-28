const { test } = require('node:test');
const assert = require('node:assert/strict');
const { checkModels, checkRedis } = require('../scripts/preview-readiness.cjs');
const env = { VERCEL_ENV: 'preview', OPENAI_API_KEY: 'fixture-only', KV_REST_API_URL: 'https://redis.test', KV_REST_API_TOKEN: 'fixture-only' };


const probeValues = new Map();
function fakeBasic(cmd, args) {
  if (cmd === 'PING') return Response.json({ result: 'PONG' });
  if (!args[0]?.endsWith(':probe')) return null;
  if (cmd === 'SET') { probeValues.set(args[0], args[1]); return Response.json({ result: 'OK' }); }
  if (cmd === 'GET') return Response.json({ result: probeValues.get(args[0]) ?? null });
  if (cmd === 'DEL') return Response.json({ result: Number(probeValues.delete(args[0])) });
  return null;
}

test('readiness refuses Production and unspecified environments before network access', async () => {
  for (const VERCEL_ENV of ['production', 'development', undefined]) {
    await assert.rejects(checkModels({ ...env, VERCEL_ENV }), /preview_required/);
    await assert.rejects(checkRedis({ ...env, VERCEL_ENV }), /preview_required/);
  }
});
test('model list checks account visibility without generating text or switching models', async () => {
  const client = { models: { async *list() { yield { id: 'gpt-5-nano' }; yield { id: 'gpt-6-luna' }; } } };
  const result = await checkModels({ ...env, OPENAI_MODEL: 'not-visible' }, client);
  assert.deepEqual(result.catalogVisible.map(model => model.id), ['gpt-5-nano', 'gpt-6-luna']);
  assert.equal(result.configuredVisible, false);
  assert.equal(result.inferenceVerified, false);
  assert.equal(result.catalogVisible[0].deprecated, true);
});
test('redacted and missing secrets cannot be used as credentials', async () => {
  for (const OPENAI_API_KEY of ['', '[SENSITIVE]']) await assert.rejects(checkModels({ ...env, OPENAI_API_KEY }), /secret_unavailable/);
  for (const KV_REST_API_TOKEN of ['', '[SENSITIVE]']) await assert.rejects(checkRedis({ ...env, KV_REST_API_TOKEN }), /pair_unavailable/);
});
test('partial direct Redis pair never mixes with Marketplace credentials', async () => {
  await assert.rejects(checkRedis({ ...env, UPSTASH_REDIS_REST_URL: 'https://other.test' }), /pair_unavailable/);
});
test('Redis smoke verifies exact limiter Lua, concurrent counters, TTL, day boundary and cleanup with FAKE transport', async () => {
  const counts = new Map(); let cleanup = false, evals = 0;
  const result = await checkRedis(env, async (url, options) => {
    assert.equal(url, 'https://redis.test');
    assert.equal(options.headers.Authorization, 'Bearer fixture-only');
    assert.equal(options.cache, 'no-store');
    const [cmd, ...args] = JSON.parse(options.body);
    let value;
    if (cmd === 'PING') value = 'PONG';
    else if (cmd === 'GET') value = counts.get(args[0]) ?? null;
    else if (cmd === 'EVAL') {
      evals++;
      assert.match(args[0], /redis.call\('EXPIRE', KEYS\[2\], ARGV\[2\]\)/);
      assert.equal(args[1], '2'); assert.deepEqual(args.slice(-2), ['60', '86400']);
      value = args.slice(2, 4).map(key => {
        assert.match(key, /^etome:readiness:preview:[a-f0-9-]+:[md]$/);
        const n = (counts.get(key) || 0) + 1; counts.set(key, n); return n;
      });
    } else if (cmd === 'TTL') value = args[0].endsWith(':m') ? 60 : 86400;
    else if (cmd === 'SET') { counts.set(args[0], args[0].endsWith(':probe') ? args[1] : Number(args[1])); value = 'OK'; }
    else if (cmd === 'DEL') { if (!args[0].endsWith(':probe')) cleanup = true; value = args.filter(key => counts.delete(key)).length; }
    else assert.fail('unexpected Redis command');
    return Response.json({ result: value });
  });
  assert.equal(evals, 10); assert.equal(cleanup, true); assert.equal(counts.size, 0);
  assert.equal(result.ping, true); assert.equal(result.setGetDelete, true);
  assert.equal(result.atomicCounters, true); assert.equal(result.deployedRouteVerified, false);
});
test('Redis smoke rejects invalid TTL and still cleans its isolated keys', async () => {
  let n = 0, cleaned = false;
  await assert.rejects(checkRedis(env, async (_, options) => {
    const [cmd, ...args] = JSON.parse(options.body);
    const basic = fakeBasic(cmd, args);
    if (basic) return basic;
    if (cmd === 'DEL') { cleaned = true; return Response.json({ result: 2 }); }
    return Response.json({ result: cmd === 'EVAL' ? [++n, n] : -1 });
  }));
  assert.equal(cleaned, true);
});
test('Redis smoke rejects malformed replies and HTTP failures, including failed cleanup', async () => {
  for (const response of [() => Response.json({ error: 'fixture-only' }), () => new Response('', { status: 503 }), () => Response.json({ result: [true, 1] })]) {
    await assert.rejects(checkRedis(env, async () => response()));
  }
});
test('Redis smoke refuses insecure or credential-bearing URL before making requests', async () => {
  for (const KV_REST_API_URL of ['http://redis.test', 'redis://redis.test', 'https://secret@redis.test', 'https://redis.test?token=x']) {
    await assert.rejects(checkRedis({ ...env, KV_REST_API_URL }), /redis_https_required/);
  }
});
test('Redis cleanup waits for all parallel writes after an early failure', async () => {
  let started = 0, finished = 0, cleanup = false;
  await assert.rejects(checkRedis(env, async (_, options) => {
    const [cmd, ...args] = JSON.parse(options.body);
    const basic = fakeBasic(cmd, args);
    if (basic) return basic;
    if (cmd === 'DEL') { assert.equal(finished, 8); cleanup = true; return Response.json({ result: 2 }); }
    if (++started === 1) throw Error('fixture failure');
    await new Promise(resolve => setTimeout(resolve, 10));
    finished++; return Response.json({ result: [finished, finished] });
  }));
  assert.equal(cleanup, true);
});

// Explicit basic command proof is separate from the Lua limiter checks.
test('Redis readiness requires PING and SET/GET/DEL round-trip, never a mock success flag', async () => {
  const calls = [];
  let stored;
  await assert.rejects(checkRedis(env, async (_, options) => {
    const [cmd, ...args] = JSON.parse(options.body);
    calls.push(cmd);
    if (cmd === 'PING') return Response.json({ result: 'PONG' });
    if (cmd === 'SET') { stored = args[1]; return Response.json({ result: 'OK' }); }
    if (cmd === 'GET') return Response.json({ result: stored + '-wrong' });
    if (cmd === 'DEL') return Response.json({ result: 1 });
    throw Error('limiter reached before basic checks');
  }));
  assert.deepEqual(calls, ['PING', 'SET', 'GET', 'DEL']);
});

test('bad PING stops before writes', async () => {
  const calls = [];
  await assert.rejects(checkRedis(env, async (_, options) => {
    calls.push(JSON.parse(options.body)[0]);
    return Response.json({ result: 'NOT-PONG' });
  }));
  assert.deepEqual(calls, ['PING']);
});
test('basic Redis cleanup and deleted-key verification cannot report false success', async () => {
  for (const failure of ['delete', 'read-after-delete']) {
    let deleted = false;
    let stored;
    await assert.rejects(checkRedis(env, async (_, options) => {
      const [cmd, ...args] = JSON.parse(options.body);
      if (cmd === 'PING') return Response.json({ result: 'PONG' });
      if (cmd === 'SET') { stored = args[1]; return Response.json({ result: 'OK' }); }
      if (cmd === 'GET') return Response.json({ result: stored });
      if (cmd === 'DEL') { deleted = true; return Response.json({ result: failure === 'delete' ? 0 : 1 }); }
      throw Error('must not reach limiter');
    }));
    assert.equal(deleted, true);
  }
});
