import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileSource } from '../source-test-loader.mjs';

const temporary = await mkdtemp(join(tmpdir(), 'fabelpad-play-proof-edge-'));
after(() => rm(temporary, { recursive: true, force: true }));
const { createBillingHandler } = await import(await compileSource(new URL('../../lib/billing/edge-handler.ts', import.meta.url), temporary));
const { BillingRequestError, createBillingBackend } = await import(await compileSource(new URL('../../lib/billing/backend.ts', import.meta.url), temporary));
const { defaultBillingSettings } = await import(await compileSource(new URL('../../lib/billing/settings.ts', import.meta.url), temporary));
const environment = { SUPABASE_URL: 'https://aptprpkosqctwrzeetgs.supabase.co', FABELPAD_APP_ORIGIN: 'https://fabelpad.nl', FABELPAD_ENVIRONMENT: 'production' };
const parentId = '11111111-1111-4111-8111-111111111111', proofId = '22222222-2222-4222-8222-222222222222';
const access = 'synthetic-only-administrator-session', purchaseToken = 'synthetic-only-license-purchase-token', ownerBinding = 'a'.repeat(64);
const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const pem = ['-----BEGIN PRIVATE KEY-----', Buffer.from(await crypto.subtle.exportKey('pkcs8', pair.privateKey)).toString('base64').match(/.{1,64}/g).join('\n'), '-----END PRIVATE KEY-----'].join('\n');
const settings = () => ({ ...defaultBillingSettings('production'), play: { ...defaultBillingSettings('production').play, monthlyProductId: 'family', monthlyBasePlanId: 'monthly', yearlyProductId: 'family', yearlyBasePlanId: 'annual' } });
const ticket = () => ({ id: proofId, parentId, credentialRevision: 9, settingsRevision: 17, environment: 'production', mode: 'live', expiresAt: new Date(Date.now() + 240_000).toISOString(), obfuscatedAccountId: ownerBinding, settings: settings() });
// The credential predates both its successful product probe and harmless gate
// changes. Its immutable settings revision is legitimately older than a ticket.
const credential = () => ({ revision: 9, provider: 'play', environment: 'production', mode: 'live', settingsRevision: 13, profileId: '', config: settings(), apiKey: JSON.stringify({ type: 'service_account', client_email: 'proof@fabelpad.iam.gserviceaccount.com', private_key: pem, token_uri: 'https://oauth2.googleapis.com/token' }) });
const purchase = (acknowledged = true) => ({ subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE', acknowledgementState: acknowledged ? 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED' : 'ACKNOWLEDGEMENT_STATE_PENDING', testPurchase: {}, startTime: new Date(Date.now() - 60_000).toISOString(), externalAccountIdentifiers: { obfuscatedExternalAccountId: ownerBinding }, lineItems: [{ productId: 'family', expiryTime: new Date(Date.now() + 86400_000).toISOString(), offerDetails: { basePlanId: 'monthly' }, autoRenewingPlan: { autoRenewEnabled: true, recurringPrice: { currencyCode: 'EUR', units: '4', nanos: 990_000_000 } } }] });
const request = (body, authenticated = true) => new Request('https://project.supabase.co/functions/v1/billing', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: `Bearer ${access}` } : {}) }, body: JSON.stringify({ action: 'playProof', ...body }) });
function fixture(options = {}) {
  const calls = [], provider = []; let acknowledged = options.pending !== true;
  const backend = {
    async authenticate(value) { calls.push({ name: 'authenticate', value }); return options.anonymous ? null : { id: parentId, email: 'proof@example.test' }; },
    async publicRpc() { throw new Error('A proof does not need a public sales offer'); },
    async rpc(name, args = {}, token) {
      calls.push({ name, args, token });
      if (name === 'authorize_billing_admin') { if (options.denied) throw new BillingRequestError(options.denied === 428 ? 'fresh_auth_required' : 'billing_forbidden', options.denied); return { authorized: true }; }
      if (name === 'prepare_billing_play_license_proof') return options.prepared ?? { id: proofId, credentialRevision: 9, settingsRevision: 17, environment: 'production', mode: 'live', expiresAt: ticket().expiresAt, obfuscatedAccountId: ownerBinding };
      if (name === 'get_billing_play_license_proof') return Object.hasOwn(options, 'ticket') ? options.ticket : ticket();
      if (name === 'get_billing_provider_config') return options.credential ?? credential();
      if (name === 'record_billing_play_license_proof') { if (options.recordError) throw options.recordError; return options.result ?? { saved: true, credentialRevision: 9, serverVerificationVerified: true }; }
      throw new Error(`Unexpected proof operation: ${name}`);
    },
  };
  const fetcher = async (url, init) => {
    provider.push({ url, method: init.method, body: init.body });
    assert.equal(init.redirect, 'error');
    if (url === 'https://oauth2.googleapis.com/token') return Response.json({ access_token: 'synthetic-only-provider-access', expires_in: 3600 });
    assert.equal(new URL(url).origin, 'https://androidpublisher.googleapis.com');
    if (url.endsWith(':acknowledge')) { acknowledged = true; return new Response(null, { status: 204 }); }
    assert.match(url, /\/applications\/nl\.fabelpad\.app\/purchases\/subscriptionsv2\/tokens\/synthetic-only-license-purchase-token$/u);
    return Response.json(options.purchase ?? purchase(acknowledged));
  };
  return { calls, provider, handler: createBillingHandler({ ...environment, ...options.environment }, { backend, fetch: fetcher, tick: async () => { throw new Error('A proof must not execute the commercial queue'); } }) };
}
const confirm = { proofId, purchaseToken };

test('production proof preparation and verification require current Auth and fresh administrator authorization', async () => {
  for (const body of [{ credentialRevision: 9 }, confirm]) {
    const anonymous = fixture({ anonymous: true }); assert.equal((await anonymous.handler(request(body))).status, 401); assert.equal(anonymous.provider.length, 0);
    const absent = fixture(); assert.equal((await absent.handler(request(body, false))).status, 401); assert.equal(absent.calls.length, 0);
    for (const status of [403, 428]) {
      const denied = fixture({ denied: status }); assert.equal((await denied.handler(request(body))).status, status);
      assert.deepEqual(denied.calls.map(call => call.name), ['authenticate', 'authorize_billing_admin']); assert.deepEqual(denied.calls[1].args, { p_fresh: true }); assert.equal(denied.calls[1].token, access); assert.equal(denied.provider.length, 0);
    }
  }
});
test('production proof routes are unavailable in staging and reject caller evidence or settings', async () => {
  const staging = { SUPABASE_URL: 'https://tlwfpivafcokcjyjwgmq.supabase.co', FABELPAD_APP_ORIGIN: 'https://staging.fabelpad.nl', FABELPAD_ENVIRONMENT: 'staging' };
  for (const body of [{ credentialRevision: 9 }, confirm]) { const app = fixture({ environment: staging }); assert.equal((await app.handler(request(body))).status, 422); assert.deepEqual(app.calls.map(call => call.name), ['authenticate']); }
  for (const extra of [{ mode: 'test' }, { parentId }, { sandbox: true }, { settings: settings() }, { amountCents: 1 }, { credentialRevision: 9 }]) {
    const app = fixture(); assert.equal((await app.handler(request({ ...confirm, ...extra }))).status, 422); assert.equal(app.provider.length, 0); assert.equal(app.calls.some(call => call.name.startsWith('get_')), false);
  }
});
test('preparation forwards the administrator credential to its isolated RPC and returns proof-only state', async () => {
  const app = fixture(); const response = await app.handler(request({ credentialRevision: 9 })); assert.equal(response.status, 200); const result = await response.json();
  assert.equal(result.proofOnly, true); assert.equal(result.id, proofId); assert.equal(result.entitlement, undefined); assert.equal(result.gates, undefined);
  assert.deepEqual(app.calls.map(call => call.name), ['authenticate', 'authorize_billing_admin', 'prepare_billing_play_license_proof']); assert.equal(app.calls.at(-1).token, access); assert.deepEqual(app.calls.at(-1).args, { p_credential_revision: 9 }); assert.equal(app.provider.length, 0);
});
test('a legitimate proof accepts newer ticket revisions while pinning original credentials and exact frozen offer', async () => {
  const app = fixture({ pending: true }); const response = await app.handler(request(confirm)); assert.equal(response.status, 200, JSON.stringify({calls:app.calls.map(c=>c.name),provider:app.provider.map(c=>c.method)})); assert.deepEqual(await response.json(), { saved: true, credentialRevision: 9, serverVerificationVerified: true });
  assert.deepEqual(app.calls.map(call => call.name), ['authenticate', 'authorize_billing_admin', 'get_billing_play_license_proof', 'get_billing_provider_config', 'record_billing_play_license_proof']);
  const config = app.calls.find(call => call.name === 'get_billing_provider_config'); assert.deepEqual(config.args, { p_provider: 'play', p_mode: 'live', p_credential_revision: 9 }); assert.equal(config.token, undefined);
  const recorded = app.calls.at(-1); assert.equal(recorded.args.p_proof_id, proofId); assert.equal(recorded.args.p_proof.sandbox, true); assert.equal(recorded.args.p_proof.acknowledged, true); assert.equal(recorded.args.p_proof.amountCents, 499); assert.equal(recorded.args.p_proof.ownerBinding, ownerBinding); assert.equal(recorded.token, undefined); assert.equal(JSON.stringify(recorded.args).includes(purchaseToken), false);
  assert.deepEqual(app.provider.map(call => call.method), ['POST', 'GET', 'POST', 'GET']);
});
test('missing, foreign, expired or malformed proof tickets fail before any secret or provider lookup', async () => {
  for (const value of [null, { ...ticket(), id: parentId }, { ...ticket(), parentId: proofId }, { ...ticket(), expiresAt: new Date(Date.now() - 1).toISOString() }, { ...ticket(), expiresAt: 'not-a-date' }, { ...ticket(), mode: 'test' }, { ...ticket(), environment: 'staging' }]) {
    const app = fixture({ ticket: value }); assert.equal((await app.handler(request(confirm))).status, 403); assert.equal(app.calls.some(call => call.name === 'get_billing_provider_config'), false); assert.equal(app.provider.length, 0);
  }
});
test('wrong credentials, products, price or period availability cannot certify a frozen ticket', async () => {
  const wrongProduct = credential(); wrongProduct.config.play.monthlyBasePlanId = 'other';
  const wrongPrice = credential(); wrongPrice.config.prices.month.amountCents = 599;
  const disabled = credential(); disabled.config.prices.month.enabled = false;
  const reordered = credential(); reordered.config.play = Object.fromEntries(Object.entries(reordered.config.play).reverse());
  for (const value of [{ ...credential(), revision: 10 }, { ...credential(), provider: 'mollie' }, { ...credential(), mode: 'test' }, { ...credential(), environment: 'staging' }, wrongProduct, wrongPrice, disabled]) {
    const app = fixture({ credential: value }); assert.equal((await app.handler(request(confirm))).status, 403); assert.equal(app.provider.length, 0); assert.equal(app.calls.some(call => call.name === 'record_billing_play_license_proof'), false);
  }
  const semantic = fixture({ credential: reordered }); assert.equal((await semantic.handler(request(confirm))).status, 200);
});
test('a genuine live charge is never accepted as sandbox proof and no commercial evidence RPC is called', async () => {
  const live = purchase(); delete live.testPurchase; const app = fixture({ purchase: live }); assert.equal((await app.handler(request(confirm))).status, 503);
  assert.equal(app.calls.some(call => call.name === 'record_billing_play_license_proof' || call.name === 'apply_billing_provider_evidence' || call.name === 'set_billing_gate'), false); assert.equal(app.provider.some(call => call.url.endsWith(':acknowledge')), false);
});
test('recording conflicts or unexpected secret responses cannot be returned as a successful readiness proof', async () => {
  for (const options of [{ result: { saved: false } }, { result: { saved: true, nested: { purchaseToken } } }, { recordError: new Error(purchaseToken) }]) {
    const app = fixture(options); const response = await app.handler(request(confirm)); assert.ok([409, 503].includes(response.status)); assert.equal(JSON.stringify(await response.json()).includes(purchaseToken), false);
  }
});
test('proof preparation is user-only and private proof getters and recorders are service-only backend operations', async () => {
  const calls = [], backend = createBillingBackend({ ...environment, SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-only', SUPABASE_ANON_KEY: 'synthetic-anon-only' }, async (url, init) => { calls.push({ url, init }); return Response.json({ saved: true }); });
  await backend.rpc('prepare_billing_play_license_proof', {}, access); assert.equal(calls.at(-1).init.headers.Authorization, `Bearer ${access}`);
  for (const name of ['get_billing_play_license_proof', 'record_billing_play_license_proof']) { await backend.rpc(name, {}); assert.equal(calls.at(-1).init.headers.Authorization, 'Bearer synthetic-service-only'); await assert.rejects(backend.rpc(name, {}, access), error => error.status === 403); await assert.rejects(backend.publicRpc(name), error => error.status === 403); }
  const before = calls.length; await assert.rejects(backend.rpc('prepare_billing_play_license_proof', {}), error => error.status === 403); assert.equal(calls.length, before);
});
