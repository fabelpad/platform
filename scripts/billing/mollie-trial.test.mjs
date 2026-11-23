import test from 'node:test';
import assert from 'node:assert/strict';
import { startMollieTrial, verifyMollieTrial, verifyMollieTrialWebhook } from '../../lib/billing/mollie-trial.ts';

const trialId = '11111111-1111-4111-8111-111111111111', requestId = '22222222-2222-4222-8222-222222222222';
const secret = 'test_SyntheticOnlyNeverARealMollieKey';
const metadata = { fabelpadContractId: `trial:${trialId}`, fabelpadOperationId: trialId };
const trial = (changes = {}) => ({ id: trialId, credentialRevision: 2, environment: 'production', mode: 'test', firstAttemptAt: '2026-11-23T11:59:00Z', customerId: 'cst_synthetic', paymentId: 'tr_synthetic', callbackVerified: false, webhookVerified: false, ...changes });
const credential = (changes = {}) => ({ revision: 2, provider: 'mollie', environment: 'production', mode: 'test', apiKey: secret, profileId: 'pfl_synthetic', settingsRevision: 4, config: { mollie: { firstMethods: ['ideal'], description: 'Fabelpad Gezin' } }, ...changes });
const payment = (changes = {}) => ({ id: 'tr_synthetic', mode: 'test', profileId: 'pfl_synthetic', customerId: 'cst_synthetic', sequenceType: 'first', status: 'paid', amount: { currency: 'EUR', value: '4.99' }, metadata, paidAt: '2026-11-23T12:00:00Z', mandateId: 'mdt_synthetic', _links: { checkout: { href: 'https://www.mollie.com/checkout/select-method/trial' } }, ...changes });
const json = value => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/hal+json' } });
const embedded = (field, values) => ({ _embedded: { [field]: values }, _links: { next: null } });
function dependencies(ctx = trial(), overrides = {}) {
  const calls = [], requests = [];
  return { calls, requests, accessToken: 'synthetic-admin-jwt', now: () => new Date('2026-11-23T12:00:00Z'),
    backend: { async rpc(name, params, accessToken) {
      calls.push({ name, params, accessToken });
      if (Object.hasOwn(overrides, name)) return typeof overrides[name] === 'function' ? overrides[name](params) : overrides[name];
      if (name === 'prepare_billing_mollie_trial' || name === 'get_billing_mollie_trial') return ctx;
      if (name === 'get_billing_provider_config') return credential();
      if (name === 'record_billing_mollie_trial') return { saved: true };
      throw new Error('Unexpected internal trial operation');
    } },
    fetch: async (url, options) => {
      requests.push({ url, ...options }); const path = new URL(url).pathname;
      if (overrides.fetch) return overrides.fetch(url, options);
      assert.equal(options.method, 'GET');
      if (path === '/v2/profiles/me') return json({ id: 'pfl_synthetic' });
      if (path === '/v2/methods') return json(embedded('methods', new URL(url).searchParams.get('sequenceType') === 'first' ? [{ id: 'ideal' }] : [{ id: 'directdebit' }]));
      if (path === '/v2/customers/cst_synthetic') return json({ id: 'cst_synthetic', mode: 'test', metadata });
      if (path === '/v2/payments/tr_synthetic') return json(payment());
      if (path === '/v2/customers/cst_synthetic/mandates/mdt_synthetic') return json({ id: 'mdt_synthetic', mode: 'test', customerId: 'cst_synthetic', method: 'directdebit', status: 'valid' });
      throw new Error('Unexpected provider trial operation');
    },
  };
}
test('explicit trial start requires an authenticated preparation and never creates rights/subscriptions', async () => {
  const deps = dependencies(); const result = await startMollieTrial({ credentialRevision: 2, requestId }, deps);
  assert.equal(deps.calls[0].name, 'prepare_billing_mollie_trial'); assert.equal(deps.calls[0].accessToken, deps.accessToken);
  assert.equal(result.mode, 'test'); assert.equal(result.entitlementGranted, false); assert.equal(result.subscriptionCreated, false);
  assert.ok(deps.calls.every(call => !/entitlement|apply_billing_provider_evidence|set_billing_gate/u.test(call.name)));
  assert.equal(deps.requests.some(call => call.method !== 'GET'), false);
  await assert.rejects(startMollieTrial({ credentialRevision: 2, requestId }, { ...deps, accessToken: undefined }));
});
test('production admin trial rejects a live key before any Mollie call', async () => {
  const deps = dependencies(trial(), { get_billing_provider_config: credential({ mode: 'live', apiKey: 'live_SyntheticOnlyNeverARealMollieKey' }) });
  await assert.rejects(startMollieTrial({ credentialRevision: 2, requestId }, deps), error => error.code === 'provider_binding_mismatch'); assert.equal(deps.requests.length, 0);
});
test('paid trial callback and webhook receipts are recorded separately after a valid mandate GET', async () => {
  for (const source of ['callback', 'webhook']) {
    const deps = dependencies(), result = await verifyMollieTrial(trialId, source, deps);
    assert.equal(result.confirmed, true); assert.equal(result.callbackVerified, source === 'callback'); assert.equal(result.webhookVerified, source === 'webhook');
    const receipt = deps.calls.at(-1); assert.equal(receipt.name, 'record_billing_mollie_trial'); assert.equal(receipt.params.p_result.paymentPaid, true); assert.equal(receipt.params.p_result[`${source}Verified`], true);
    assert.equal(deps.requests.at(-1).url, 'https://api.mollie.com/v2/customers/cst_synthetic/mandates/mdt_synthetic');
  }
});
test('open/failed test payments cannot establish callback/webhook proof', async () => {
  for (const status of ['open', 'failed', 'expired']) {
    const deps = dependencies(trial(), { fetch: () => json(payment({ status, paidAt: null })) });
    assert.equal((await verifyMollieTrial(trialId, 'webhook', deps)).confirmed, false);
    assert.equal(deps.calls.some(call => call.name === 'record_billing_mollie_trial'), false);
  }
});
test('trial proof rejects wrong customer, amount, metadata, mode or invalid mandate', async () => {
  for (const changes of [{ customerId: 'cst_someoneelse' }, { amount: { currency: 'EUR', value: '0.01' } }, { metadata: { ...metadata, fabelpadOperationId: requestId } }, { mode: 'live' }]) {
    const deps = dependencies(trial(), { fetch: () => json(payment(changes)) });
    await assert.rejects(verifyMollieTrial(trialId, 'callback', deps)); assert.equal(deps.calls.some(call => call.name === 'record_billing_mollie_trial'), false);
  }
  const deps = dependencies(trial(), { fetch: url => json(url.includes('/mandates/') ? { id: 'mdt_synthetic', mode: 'test', customerId: 'cst_synthetic', method: 'directdebit', status: 'invalid' } : payment()) });
  assert.equal((await verifyMollieTrial(trialId, 'webhook', deps)).confirmed, false);
});
test('trial webhook revision cannot select a different stored credential', async () => {
  const deps = dependencies(); await assert.rejects(verifyMollieTrialWebhook('tr_synthetic', 99, deps), error => error.code === 'provider_binding_mismatch'); assert.equal(deps.requests.length, 0);
});
test('lost create-payment response is recovered by provider metadata before trial receipt processing', async () => {
  let recorded = false;
  const deps = dependencies(trial({ paymentId: null }), {
    get_billing_mollie_trial: params => params.p_payment_id ? null : trial({ paymentId: recorded ? 'tr_synthetic' : null }),
    record_billing_mollie_trial: params => { if (params.p_result.paymentId) recorded = true; return { saved: true }; },
  });
  const result = await verifyMollieTrialWebhook('tr_synthetic', 2, deps); assert.equal(result.confirmed, true); assert.equal(recorded, true); assert.equal(deps.requests.some(call => call.method !== 'GET'), false);
});
