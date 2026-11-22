import assert from 'node:assert/strict';
import { test } from 'node:test';
import { boundedSupabaseFetch, validateConfiguration, verifyAdminOtp, verifyConfiguredHook } from './verify-otp.mjs';
const config = { environment: 'staging', ref: 'tlwfpivafcokcjyjwgmq', origin: 'https://staging.fabelpad.nl', url: 'https://tlwfpivafcokcjyjwgmq.supabase.co', key: 'sb_publishable_synthetic_12345678' };
const payload = { variables: [{ name: 'FABELPAD_APP_ORIGIN', value: config.origin }, { name: 'FABELPAD_DATA_MODE', value: 'supabase' }, { name: 'NEXT_PUBLIC_SUPABASE_URL', value: config.url }, { name: 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', value: config.key }] };
function provider(change = {}) {
  const calls = [], user = { id: 'synthetic-user', email: 'info@dgwebservices.nl', email_confirmed_at: '2026-11-22', is_anonymous: false, ...change.user };
  return { calls, auth: {
    signInWithOtp: async data => { calls.push(['request', data]); return { error: change.sendError }; },
    verifyOtp: async data => { calls.push(['verify', data]); return { error: change.verifyError, data: { session: change.session === false ? null : {} } }; },
    getUser: async () => ({ data: { user }, error: null }),
    signOut: async data => { calls.push(['signout', data]); return { error: change.signoutError }; },
  }, from: table => { assert.equal(table, 'content_admins'); return { select: () => ({ eq: (field, id) => { assert.equal(field, 'user_id'); assert.equal(id, user.id); return { maybeSingle: async () => ({ data: change.noRole ? null : { user_id: user.id, grant_source: 'bootstrap_email' } }) }; } }) }; },
  rpc: async name => { assert.equal(name, 'get_content_catalog'); return { data: Array(13).fill({}) }; } };
}
test('OTP verifier refuses cross-environment, extra and missing GitHub configuration', () => {
  assert.equal(validateConfiguration('staging', payload).ref, config.ref);
  assert.throws(() => validateConfiguration('production', payload));
  assert.throws(() => validateConfiguration('staging', { variables: payload.variables.slice(1) }));
  assert.throws(() => validateConfiguration('staging', { variables: [...payload.variables, { name: 'OTHER', value: 'x' }] }));
});
test('preflight never sends an OTP when the hook is unconfigured or inaccessible', async () => {
  for (const status of [200, 404, 503]) await assert.rejects(verifyConfiguredHook(config, async () => new Response('{}', { status })));
  await verifyConfiguredHook(config, async (url, init) => { assert.equal(url, `${config.url}/functions/v1/auth-email`); assert.equal(init.body, '{}'); return new Response('{}', { status: 401 }); });
});
test('SDK requests stay on the selected project with bounded time and no redirects', async () => {
  let calls = 0;
  const fetcher = boundedSupabaseFetch(config, async (_url, options) => { calls++; assert.equal(options.redirect, 'error'); assert(options.signal instanceof AbortSignal); return new Response('{}'); });
  await fetcher(`${config.url}/auth/v1/otp`, { method: 'POST' });
  await assert.rejects(fetcher('https://other.example.invalid/auth/v1/verify'));
  await assert.rejects(fetcher(`${config.url}/functions/v1/other`));
  assert.equal(calls, 1);
});
test('standalone verification creates only requested admin, verifies server identity/role and signs out local session', async () => {
  const client = provider();
  const proof = await verifyAdminOtp(client, config, async () => '123456', () => new Date('2026-11-22T14:00:00Z'));
  assert.equal(proof.adminVerified, true); assert.equal(proof.emailOtpVerified, true); assert.equal(proof.sessionSignedOut, true);
  assert.deepEqual(client.calls[0], ['request', { email: 'info@dgwebservices.nl', options: { shouldCreateUser: true } }]);
  assert.deepEqual(client.calls.at(-1), ['signout', { scope: 'local' }]);
  const output = JSON.stringify(proof); for (const secret of ['12345678', 'info@', 'synthetic-user', config.key]) assert.equal(output.includes(secret), false);
});
test('wrong/unconfirmed/anonymous identity or missing role cannot produce proof and cleanup is attempted', async () => {
  for (const change of [{ user: { email: 'other@example.invalid' } }, { user: { email_confirmed_at: null } }, { user: { is_anonymous: true } }, { noRole: true }]) {
    const client = provider(change); await assert.rejects(verifyAdminOtp(client, config, async () => '123456'));
    assert.deepEqual(client.calls.at(-1), ['signout', { scope: 'local' }]);
  }
});
test('invalid OTP, provider exceptions and failed cleanup remain sanitized', async () => {
  const client = provider(); await assert.rejects(verifyAdminOtp(client, config, async () => 'invalid-secret'), error => !error.message.includes('invalid-secret'));
  assert.equal(client.calls.some(([name]) => name === 'verify'), false);
  const errorClient = provider({ verifyError: new Error('secret-response-body'), signoutError: new Error('secret-token') });
  await assert.rejects(verifyAdminOtp(errorClient, config, async () => '123456'), error => !/secret-token|secret-response-body|12345678/u.test(error.message));
});
