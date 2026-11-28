const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = () => import('../app/chat-response.mjs');

test('client accepts only successful nonempty AI replies', async () => {
  const { requestChatReply } = await load();
  const history = [{ role: 'user', content: 'Odgovori na hrvatskom.' }];
  const result = await requestChatReply(history, async (url, options) => {
    assert.equal(url, '/api/chat');
    assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body).messages, history);
    return Response.json({ reply: '  Dobar dan!  ' });
  });
  assert.deepEqual(result, { reply: 'Dobar dan!' });
  assert.equal(history.length, 1);
});
for (const status of [400, 413, 429, 502, 503, 504]) {
  test(`client HTTP ${status} is an error, never an assistant reply`, async () => {
    const { requestChatReply } = await load();
    const result = await requestChatReply([], async () => Response.json({ reply: 'UNTRUSTED-provider-body' }, { status }));
    assert.equal(result.reply, undefined);
    assert.ok(result.error);
    assert.doesNotMatch(result.error, /UNTRUSTED/);
    if (status === 429) assert.match(result.error, /previše poruka/);
  });
}
for (const reply of ['', '   ', null, 123, {}, undefined]) {
  test(`client rejects invalid HTTP 200 reply ${JSON.stringify(reply)}`, async () => {
    const { requestChatReply } = await load();
    const result = await requestChatReply([], async () => Response.json({ reply }));
    assert.equal(result.reply, undefined);
    assert.ok(result.error);
  });
}
test('client invalid JSON and network failures never become answers', async () => {
  const { requestChatReply } = await load();
  for (const send of [async () => new Response('invalid json'), async () => { throw Error('UNTRUSTED-transport'); }]) {
    const result = await requestChatReply([], send);
    assert.equal(result.reply, undefined);
    assert.ok(result.error);
    assert.doesNotMatch(result.error, /UNTRUSTED/);
  }
});
