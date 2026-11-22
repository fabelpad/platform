import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHmac } from 'node:crypto';
import { compileSource } from '../source-test-loader.mjs';
const temporary = await mkdtemp(join(tmpdir(), 'fabelpad-auth-hook-tests-'));
after(() => rm(temporary, { recursive: true, force: true }));
const { createAuthEmailHandler } = await import(await compileSource(new URL('../../lib/email/auth-hook.ts', import.meta.url), temporary));
const now = 1795356000000;
const secret = Buffer.alloc(32, 42);
const environment = {
  RESEND_API_KEY: 're_synthetic_test_only', SEND_EMAIL_HOOK_SECRET: 'v1,whsec_' + secret.toString('base64'),
  FABELPAD_EMAIL_FROM: 'Fabelpad <noreply@example.test>', FABELPAD_EMAIL_REPLY_TO: 'support@fabelpad.nl',
  FABELPAD_APP_ORIGIN: 'https://fabelpad.example.test', FABELPAD_ENVIRONMENT: 'production',
};
const payload = (overrides = {}) => ({ user: { email: 'ouder@example.test', new_email: 'nieuw@example.test' }, email_data: { email_action_type: 'magiclink', site_url: environment.FABELPAD_APP_ORIGIN, token: '123456', token_hash: 'a'.repeat(64), ...overrides } });
const signature = (body, id = 'msg_synthetic_event', timestamp = Math.floor(now / 1000)) => createHmac('sha256', secret).update(`${id}.${timestamp}.${body}`).digest('base64');
function signed(body = JSON.stringify(payload()), { id = 'msg_synthetic_event', timestamp = Math.floor(now / 1000), headers = {} } = {}) {
  return new Request('https://project.example.test/functions/v1/auth-email', { method: 'POST', headers: { 'content-type': 'application/json', 'webhook-id': id, 'webhook-timestamp': String(timestamp), 'webhook-signature': 'v1,' + signature(body, id, timestamp), ...headers }, body });
}
const goodResponse = () => Response.json({ id: 'synthetic-resend-provider-id' });
const handler = (fetcher = async () => goodResponse(), changes = {}) => createAuthEmailHandler({ ...environment, ...changes }, { fetch: fetcher, now: () => now });

test('verified raw-body HMAC sends exactly one OTP and returns only an empty success object', async () => {
  let requests = 0;
  const response = await handler(async (url, options) => {
    requests++; assert.equal(url, 'https://api.resend.com/emails');
    const body = JSON.parse(options.body);
    assert.deepEqual(body.to, ['ouder@example.test']); assert.match(body.html, /123456/u);
    assert.match(body.text, /123456/u); assert.equal(body.reply_to, 'support@fabelpad.nl');
    return goodResponse();
  })(signed());
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), {}); assert.equal(requests, 1);
});
test('missing, invalid, mutated and wrong-version signatures cause zero sends', async () => {
  let requests = 0;
  const app = handler(async () => { requests++; return goodResponse(); });
  for (const headers of [{ 'webhook-signature': '' }, { 'webhook-signature': 'v1,' + 'A'.repeat(43) + '=' }, { 'webhook-signature': 'v2,' + signature(JSON.stringify(payload())) }, { 'webhook-id': '' }, { 'webhook-timestamp': 'invalid' }]) assert.equal((await app(signed(undefined, { headers }))).status, 401);
  const originalBody = JSON.stringify(payload()), changedBody = JSON.stringify(payload({ token: '654321' }));
  assert.equal((await app(signed(changedBody, { headers: { 'webhook-signature': 'v1,' + signature(originalBody) } }))).status, 401);
  assert.equal(requests, 0);
});
test('timestamp tolerance rejects past and future replays beyond five minutes', async () => {
  let requests = 0; const app = handler(async () => { requests++; return goodResponse(); });
  for (const offset of [-301, 301]) assert.equal((await app(signed(undefined, { timestamp: Math.floor(now / 1000) + offset }))).status, 401);
  assert.equal((await app(signed(undefined, { timestamp: Math.floor(now / 1000) - 300 }))).status, 200);
  assert.equal(requests, 1);
});
test('multiple signature versions allow a valid rotated v1 signature without accepting garbage', async () => {
  const body = JSON.stringify(payload());
  assert.equal((await handler()(signed(body, { headers: { 'webhook-signature': 'v0,ignored v1,' + 'A'.repeat(43) + '= v1,' + signature(body) } }))).status, 200);
  assert.equal((await handler()(signed(body, { headers: { 'webhook-signature': ('v0,ignored ').repeat(9) + 'v1,' + signature(body) } }))).status, 401);
});
test('method, type, content encoding and bounded body fail before network access', async () => {
  let requests = 0; const app = handler(async () => { requests++; return goodResponse(); });
  assert.equal((await app(new Request('https://project.example.test', { method: 'GET' }))).status, 405);
  assert.equal((await app(signed(undefined, { headers: { 'content-type': 'text/plain' } }))).status, 415);
  assert.equal((await app(signed(undefined, { headers: { 'content-encoding': 'gzip' } }))).status, 415);
  const body = JSON.stringify({ ...payload(), excess: 'a'.repeat(21 * 1024) });
  assert.equal((await app(signed(body, { headers: { 'content-length': '1' } }))).status, 400);
  assert.equal(requests, 0);
});
test('each required Edge setting fails closed without disclosing private configuration', async () => {
  let requests = 0;
  for (const name of Object.keys(environment)) {
    const response = await handler(async () => { requests++; return goodResponse(); }, { [name]: '' })(signed());
    assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /re_synthetic|123456|ouder@|webhook/u);
  }
  assert.equal(requests, 0);
});
test('a signed invalid payload, unknown action or cross-environment origin cannot send', async () => {
  let requests = 0; const app = handler(async () => { requests++; return goodResponse(); });
  for (const body of ['{', 'null', '{}', JSON.stringify(payload({ email_action_type: '__proto__' })), JSON.stringify(payload({ site_url: 'https://other.example.test' })), JSON.stringify(payload({ token: 'not-a-code' }))]) assert.equal((await app(signed(body))).status, 400);
  assert.equal(requests, 0);
});
test('retries reuse an opaque idempotency key without recipient, OTP or webhook ID', async () => {
  const keys = [];
  const app = handler(async (_, options) => { keys.push(options.headers['Idempotency-Key']); return goodResponse(); });
  await app(signed()); await app(signed()); await app(signed(undefined, { id: 'msg_different_event' }));
  assert.equal(keys[0], keys[1]); assert.notEqual(keys[0], keys[2]);
  assert.match(keys[0], /^fabelpad-auth\/[a-f0-9]{64}$/u); assert.doesNotMatch(keys[0], /ouder|123456|msg_synthetic/u);
});
test('secure email change sends concurrently with distinct stable recipient keys', async () => {
  const keys = [], recipients = []; let calls = 0; let unlock;
  const bothStarted = new Promise(resolve => { unlock = resolve; });
  const app = handler(async (_, options) => {
    keys.push(options.headers['Idempotency-Key']); recipients.push(JSON.parse(options.body).to[0]); calls++;
    if (calls === 2) unlock();
    await bothStarted; return goodResponse();
  });
  const response = await app(signed(JSON.stringify(payload({ email_action_type: 'email_change', token_new: '654321', token_hash_new: 'b'.repeat(64) }))));
  assert.equal(response.status, 200); assert.equal(keys.length, 2); assert.notEqual(keys[0], keys[1]);
  assert.deepEqual(recipients.sort(), ['nieuw@example.test', 'ouder@example.test']);
});
test('provider transient errors request retry and expose no secrets or diagnostics', async () => {
  for (const status of [429, 500, 503]) {
    const response = await handler(async () => Response.json({ message: 'private-upstream-diagnostic re_private 123456 ouder@example.test' }, { status }))(signed());
    assert.equal(response.status, 503); assert.equal(response.headers.get('retry-after'), 'true');
    assert.doesNotMatch(await response.text(), /private|123456|ouder@/u);
  }
  const timeout = await handler(async () => { throw new Error('private-diagnostic'); })(signed());
  assert.equal(timeout.status, 503);
});
test('provider permanent failure is not acknowledged as success or an automatic retry', async () => {
  const response = await handler(async () => Response.json({ message: 'not authorized' }, { status: 401 }))(signed());
  assert.equal(response.status, 502); assert.equal(response.headers.has('retry-after'), false);
});
