import test from 'node:test';
import assert from 'node:assert/strict';
import { createMollieClient, MollieError, MOLLIE_RETRY_WINDOW_MS, safeMollieCheckout } from '../../lib/billing/mollie.ts';
import { executeMollieBillingJob, processMollieBillingJob, reconcileMolliePayment, mollieCalendarPeriod, mollieProrataRefund } from '../../lib/billing/mollie-service.ts';

const reservationId = '11111111-1111-4111-8111-111111111111', contractId = reservationId;
const jobId = '22222222-2222-4222-8222-222222222222', leaseToken = '33333333-3333-4333-8333-333333333333';
const secret = 'test_SyntheticOnlyNeverARealMollieKey';
const metadata = { fabelpadContractId: contractId, fabelpadOperationId: jobId, fabelpadAttemptId: reservationId };
const fixedNow = () => new Date('2026-11-23T12:00:00Z');
const credential = () => ({ revision: 2, provider: 'mollie', environment: 'staging', mode: 'test', apiKey: secret, profileId: 'pfl_synthetic', settingsRevision: 4, config: { mollie: { firstMethods: ['ideal'], description: 'Fabelpad Gezin' } } });
const job = (changes = {}) => ({ id: jobId, kind: 'mollie_first_payment', provider: 'mollie', idempotencyKey: jobId, firstAttemptAt: '2026-11-23T11:59:00Z', providerId: null, payload: { reservationId }, settingsRevision: 4, credentialRevision: 2, environment: 'staging', mode: 'test', attempt: 1, leaseToken, ...changes });
const context = (changes = {}) => ({ reservationId, contractId, customerId: 'cst_synthetic', providerSubscriptionId: null, paymentId: null, credentialRevision: 2, settingsRevision: 4, environment: 'staging', mode: 'test', amountCents: 499, period: 'month', periodStart: '2026-11-23T12:00:00Z', periodEnd: '2026-12-23T12:00:00Z', autoRenew: true, deleted: false, metadata, ...changes });
const payment = (changes = {}) => ({ resource: 'payment', id: 'tr_synthetic', mode: 'test', profileId: 'pfl_synthetic', customerId: 'cst_synthetic', sequenceType: 'first', status: 'open', amount: { currency: 'EUR', value: '4.99' }, metadata, _links: { checkout: { href: 'https://www.mollie.com/checkout/select-method/synthetic' } }, ...changes });
const subscription = (changes = {}) => ({ resource: 'subscription', id: 'sub_synthetic', mode: 'test', profileId: 'pfl_synthetic', customerId: 'cst_synthetic', mandateId: 'mdt_synthetic', status: 'active', amount: { currency: 'EUR', value: '4.99' }, interval: '1 month', startDate: '2026-12-24', metadata, ...changes });
const refund = (changes = {}) => ({ id: 're_synthetic', mode: 'test', paymentId: 'tr_synthetic', amount: { currency: 'EUR', value: '2.00' }, status: 'pending', metadata, ...changes });
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/hal+json' } });
const embedded = (field, values) => ({ _embedded: { [field]: values }, _links: { next: null } });
function transport(handlers) {
  const calls = [];
  const fetcher = async (url, options) => {
    const path = new URL(url).pathname, method = options.method ?? 'GET'; calls.push({ url, path, ...options });
    assert.equal(new URL(url).origin, 'https://api.mollie.com'); assert.equal(options.redirect, 'error');
    const handler = handlers[`${method} ${path}`]; assert.ok(handler, `Unexpected provider operation: ${method} ${path}`);
    return typeof handler === 'function' ? handler(options, calls) : json(handler);
  };
  return { fetcher, calls };
}
function backend(ctx = context(), overrides = {}) {
  const calls = [];
  return { calls, async rpc(name, params = {}) {
    calls.push({ name, params });
    if (Object.hasOwn(overrides, name)) return typeof overrides[name] === 'function' ? overrides[name](params) : overrides[name];
    if (name === 'get_billing_mollie_job_context' || name === 'get_billing_mollie_binding') return ctx;
    if (name === 'get_billing_provider_config') return credential();
    if (name === 'recheck_billing_purchase') return { id: reservationId, provider: 'mollie', currency: 'EUR', amountCents: 499 };
    if (name === 'record_billing_mollie_customer' || name === 'recheck_billing_renewal') return true;
    if (name === 'apply_billing_provider_evidence') return { applied: true, duplicate: false };
    if (name === 'complete_billing_job') return { completed: true };
    if (name === 'fail_billing_job') return { updated: true };
    throw new Error('Unexpected internal operation');
  } };
}

test('connection test uses Profile and first/recurring Methods GETs without a transaction', async () => {
  const upstream = transport({ 'GET /v2/profiles/me': { id: 'pfl_synthetic' }, 'GET /v2/methods': options => {
    assert.equal(options.body, undefined); return json(embedded('methods', new URL(upstream.calls.at(-1).url).searchParams.get('sequenceType') === 'first' ? [{ id: 'ideal' }, { id: 'wero' }] : [{ id: 'directdebit' }]));
  } });
  const result = await createMollieClient(credential(), { fetch: upstream.fetcher }).probe(['ideal', 'wero']);
  assert.deepEqual(result.firstMethods, ['ideal']); assert.equal(result.recurringReady, true);
  for (const field of ['transactionPerformed', 'callbackEndToEndVerified', 'webhookEndToEndVerified', 'chargePermissionVerified']) assert.equal(result[field], false);
  assert.ok(upstream.calls.every(call => call.method === 'GET' && !call.url.includes(secret)));
});
test('mode/profile/amount/customer/metadata mismatches never become verified payments', async () => {
  for (const changes of [{ mode: 'live' }, { profileId: 'pfl_other' }, { customerId: null }, { amount: { currency: 'USD', value: '4.99' } }, { metadata: { fabelpadContractId: secret } }, { status: 'paid', paidAt: null }]) {
    const upstream = transport({ 'GET /v2/payments/tr_synthetic': payment(changes) });
    await assert.rejects(createMollieClient(credential(), { fetch: upstream.fetcher }).getPayment('tr_synthetic'), MollieError);
  }
  assert.throws(() => createMollieClient({ ...credential(), environment: 'staging', mode: 'live', apiKey: 'live_SyntheticOnlyNeverARealMollieKey' }), MollieError);
});
test('Checkout redirects accept only fixed HTTPS Mollie checkout hosts and paths', () => {
  assert.equal(safeMollieCheckout('https://www.mollie.com/checkout/select-method/a'), 'https://www.mollie.com/checkout/select-method/a');
  for (const url of ['http://www.mollie.com/checkout/a', 'https://www.mollie.com.attacker.test/checkout/a', 'https://attacker@www.mollie.com/checkout/a', 'https://www.mollie.com:444/checkout/a', 'https://www.mollie.com/other', 'https://checkout.mollie.com/checkout/a#secret']) assert.throws(() => safeMollieCheckout(url), MollieError);
});
test('provider transport failures discard bodies and preserve uncertain mutation outcome', async () => {
  for (const fetcher of [async () => { throw new Error(secret); }, async () => new Response(secret, { status: 503 }), async () => new Response(secret, { status: 201 })]) {
    const client = createMollieClient(credential(), { fetch: fetcher });
    await assert.rejects(client.createCustomer(metadata, jobId), error => error instanceof MollieError && error.uncertain && !error.message.includes(secret));
  }
});
test('paginated reconciliation never follows an arbitrary provider link with a credential', async () => {
  const upstream = transport({ 'GET /v2/customers': { ...embedded('customers', []), _links: { next: { href: 'https://attacker.test/v2/customers?from=123' } } } });
  await assert.rejects(createMollieClient(credential(), { fetch: upstream.fetcher }).findCustomers(metadata), MollieError);
  assert.equal(upstream.calls.length, 1);
});
test('first checkout rechecks the gate immediately before POST and keeps the exact frozen quote', async () => {
  const db = backend(), upstream = transport({
    'GET /v2/customers/cst_synthetic': { id: 'cst_synthetic', mode: 'test', metadata },
    'GET /v2/customers/cst_synthetic/payments': embedded('payments', []),
    'GET /v2/profiles/me': { id: 'pfl_synthetic' },
    'GET /v2/methods': options => json(embedded('methods', new URL(upstream.calls.at(-1).url).searchParams.get('sequenceType') === 'first' ? [{ id: 'ideal' }] : [{ id: 'directdebit' }])),
    'POST /v2/payments': options => {
      const body = JSON.parse(options.body); assert.equal(body.sequenceType, 'first'); assert.deepEqual(body.amount, { currency: 'EUR', value: '4.99' }); assert.equal(body.profileId, undefined); assert.equal(body.testmode, undefined); assert.match(body.webhookUrl, /credential=2$/u);
      assert.equal(db.calls.at(-1).name, 'recheck_billing_purchase'); return json(payment(), 201);
    },
  });
  assert.deepEqual(await processMollieBillingJob(job(), { backend: db, fetch: upstream.fetcher, now: fixedNow }), { completed: true, deferred: false });
  assert.equal(db.calls.filter(call => call.name === 'recheck_billing_purchase').length, 2);
  assert.equal(db.calls.at(-1).name, 'complete_billing_job'); assert.equal(db.calls.at(-1).params.p_result.paymentId, 'tr_synthetic');
  assert.equal(upstream.calls.find(call => call.method === 'POST').headers['Idempotency-Key'], `${jobId}:first`);
});
test('gate switched off after method checks prevents a new payment even from a reserved checkout', async () => {
  let rechecks = 0; const db = backend(context(), { recheck_billing_purchase: () => { if (++rechecks === 2) throw new Error('sales_paused'); return { id: reservationId, provider: 'mollie', currency: 'EUR', amountCents: 499 }; } });
  const upstream = transport({ 'GET /v2/customers/cst_synthetic': { id: 'cst_synthetic', mode: 'test', metadata }, 'GET /v2/customers/cst_synthetic/payments': embedded('payments', []), 'GET /v2/profiles/me': { id: 'pfl_synthetic' }, 'GET /v2/methods': () => json(embedded('methods', [{ id: 'ideal' }, { id: 'directdebit' }])) });
  await processMollieBillingJob(job(), { backend: db, fetch: upstream.fetcher, now: fixedNow });
  assert.equal(upstream.calls.some(call => call.method === 'POST'), false); assert.equal(db.calls.at(-1).name, 'fail_billing_job');
});
test('lost first-payment response is marked uncertain; a retry reconciles an existing provider payment', async () => {
  const db = backend(), upstream = transport({ 'GET /v2/customers/cst_synthetic': { id: 'cst_synthetic', mode: 'test', metadata }, 'GET /v2/customers/cst_synthetic/payments': embedded('payments', [payment()]) });
  const result = await executeMollieBillingJob(job({ attempt: 9, firstAttemptAt: '2026-11-20T12:00:00Z' }), { backend: db, fetch: upstream.fetcher, now: fixedNow });
  assert.equal(result.paymentId, 'tr_synthetic'); assert.equal(upstream.calls.some(call => call.method === 'POST'), false);
});
test('no retry outside Mollie one-hour cache creates a second customer or payment', async () => {
  assert.equal(MOLLIE_RETRY_WINDOW_MS, 55 * 60 * 1000);
  for (const customerId of ['cst_synthetic', null]) {
    const db = backend(context({ customerId })), upstream = transport({ 'GET /v2/customers/cst_synthetic': { id: 'cst_synthetic', mode: 'test', metadata }, 'GET /v2/customers/cst_synthetic/payments': embedded('payments', []), 'GET /v2/customers': embedded('customers', []) });
    const result = await processMollieBillingJob(job({ attempt: 2, firstAttemptAt: '2026-11-23T10:00:00Z' }), { backend: db, fetch: upstream.fetcher, now: fixedNow });
    assert.equal(result.deferred, true); assert.equal(upstream.calls.some(call => call.method === 'POST'), false); assert.equal(db.calls.at(-1).params.p_uncertain, true);
  }
});
test('duplicate matching provider payments require reconciliation and never a third payment', async () => {
  const db = backend(), upstream = transport({ 'GET /v2/customers/cst_synthetic': { id: 'cst_synthetic', mode: 'test', metadata }, 'GET /v2/customers/cst_synthetic/payments': embedded('payments', [payment(), payment({ id: 'tr_secondpayment' })]) });
  await assert.rejects(executeMollieBillingJob(job(), { backend: db, fetch: upstream.fetcher, now: fixedNow }), error => error.code === 'reconciliation_incomplete'); assert.equal(upstream.calls.some(call => call.method === 'POST'), false);
});
test('webhook reconciliation retrieves current provider status under its immutable old credential', async () => {
  const db = backend(context({ paymentId: 'tr_synthetic' })), upstream = transport({ 'GET /v2/payments/tr_synthetic': payment({ status: 'paid', paidAt: '2026-11-24T08:15:00Z', mandateId: 'mdt_synthetic', amountRefunded: { currency: 'EUR', value: '1.00' } }) });
  await reconcileMolliePayment('tr_synthetic', 2, { backend: db, fetch: upstream.fetcher, now: fixedNow });
  assert.equal(db.calls[0].params.p_credential_revision, 2); assert.equal(upstream.calls[0].headers.Authorization, `Bearer ${secret}`);
  const evidence = db.calls.at(-1).params.p_evidence; assert.equal(evidence.state, 'active'); assert.equal(evidence.refundedCents, 100); assert.equal(evidence.periodStart, '2026-11-24T08:15:00.000Z'); assert.equal(evidence.periodEnd, '2026-12-24T08:15:00.000Z');
});
test('provider snapshot ordering uses the time before network verification begins', async () => {
  let observed = new Date('2026-11-23T12:00:00Z');
  const db = backend(context({ paymentId: 'tr_synthetic' })), upstream = transport({ 'GET /v2/payments/tr_synthetic': () => {
    observed = new Date('2026-11-23T12:00:05Z'); return json(payment({ status: 'paid', paidAt: '2026-11-23T12:00:00Z' }));
  } });
  await reconcileMolliePayment('tr_synthetic', 2, { backend: db, fetch: upstream.fetcher, now: () => observed });
  assert.equal(db.calls.at(-1).params.p_evidence.verifiedAt, '2026-11-23T12:00:00.000Z');
});
test('webhooks cannot transfer a customer, grant an amount mismatch or resurrect a missing binding', async () => {
  for (const ctx of [null, context({ customerId: 'cst_someoneelse' }), context({ amountCents: 3999 })]) {
    const db = backend(ctx), upstream = transport({ 'GET /v2/payments/tr_synthetic': payment({ status: 'paid', paidAt: '2026-11-23T12:00:00Z' }) });
    await assert.rejects(reconcileMolliePayment('tr_synthetic', 2, { backend: db, fetch: upstream.fetcher, now: fixedNow }), MollieError);
    assert.equal(db.calls.some(call => call.name === 'apply_billing_provider_evidence'), false);
  }
});
test('authoritative chargebacks revoke access even while the payment status remains paid', async () => {
  const db = backend(), upstream = transport({ 'GET /v2/payments/tr_synthetic': payment({ status: 'paid', paidAt: '2026-11-23T12:00:00Z', amountChargedBack: { currency: 'EUR', value: '4.99' } }) });
  await reconcileMolliePayment('tr_synthetic', 2, { backend: db, fetch: upstream.fetcher, now: fixedNow });
  assert.equal(db.calls.at(-1).params.p_evidence.state, 'revoked'); assert.equal(db.calls.at(-1).params.p_evidence.autoRenew, false);
});
test('subscription requires paid first period and valid exact-customer mandate before scheduling its next unpaid period', async () => {
  const ctx = context({ paymentId: 'tr_synthetic', renewalPlan: { amountCents: 499, startDate: '2026-12-24', metadata } });
  for (const mandateStatus of ['valid', 'pending', 'invalid']) {
    const db = backend(ctx), upstream = transport({ 'GET /v2/payments/tr_synthetic': payment({ status: 'paid', paidAt: '2026-11-23T12:00:00Z', mandateId: 'mdt_synthetic' }), 'GET /v2/customers/cst_synthetic/mandates/mdt_synthetic': { id: 'mdt_synthetic', customerId: 'cst_synthetic', mode: 'test', status: mandateStatus, method: 'directdebit' }, 'GET /v2/customers/cst_synthetic/subscriptions': embedded('subscriptions', []), 'POST /v2/customers/cst_synthetic/subscriptions': options => { assert.equal(JSON.parse(options.body).startDate, '2026-12-24'); assert.equal(db.calls.at(-1).name, 'recheck_billing_renewal'); return json(subscription(), 201); } });
    if (mandateStatus === 'valid') { const result = await executeMollieBillingJob(job({ kind: 'mollie_create_subscription' }), { backend: db, fetch: upstream.fetcher, now: fixedNow }); assert.equal(result.renewalConfirmed, true); }
    else { await assert.rejects(executeMollieBillingJob(job({ kind: 'mollie_create_subscription' }), { backend: db, fetch: upstream.fetcher, now: fixedNow }), MollieError); assert.equal(upstream.calls.some(call => call.method === 'POST'), false); }
  }
});
test('coupon renewal segments send bounded times and preserve the next segment agreement', async () => {
  const ctx = context({ paymentId: 'tr_synthetic', renewalPlan: { amountCents: 200, startDate: '2026-12-24', times: 2, metadata } });
  const db = backend(ctx), upstream = transport({ 'GET /v2/payments/tr_synthetic': payment({ status: 'paid', paidAt: '2026-11-23T12:00:00Z', mandateId: 'mdt_synthetic' }), 'GET /v2/customers/cst_synthetic/mandates/mdt_synthetic': { id: 'mdt_synthetic', customerId: 'cst_synthetic', mode: 'test', status: 'valid', method: 'directdebit' }, 'GET /v2/customers/cst_synthetic/subscriptions': embedded('subscriptions', []), 'POST /v2/customers/cst_synthetic/subscriptions': options => { const body = JSON.parse(options.body); assert.equal(body.times, 2); assert.equal(body.amount.value, '2.00'); return json(subscription({ amount: { currency: 'EUR', value: '2.00' } }), 201); } });
  await executeMollieBillingJob(job({ kind: 'mollie_create_subscription' }), { backend: db, fetch: upstream.fetcher, now: fixedNow });
});
test('cancellation confirms provider GET and preserves paid-until while sale channels may be off', async () => {
  let canceled = false; const db = backend(context({ providerSubscriptionId: 'sub_synthetic' }));
  const upstream = transport({ 'GET /v2/customers/cst_synthetic/subscriptions/sub_synthetic': () => json(subscription({ status: canceled ? 'canceled' : 'active' })), 'DELETE /v2/customers/cst_synthetic/subscriptions/sub_synthetic': () => { canceled = true; return json(subscription({ status: 'canceled' })); } });
  const result = await executeMollieBillingJob(job({ kind: 'mollie_cancel' }), { backend: db, fetch: upstream.fetcher, now: fixedNow });
  assert.equal(result.cancellationConfirmed, true); assert.equal(result.paidUntil, '2026-12-23T12:00:00Z'); assert.equal(db.calls.some(call => call.name === 'recheck_billing_purchase'), false); assert.deepEqual(upstream.calls.map(call => call.method), ['GET', 'DELETE', 'GET']);
});
test('cancellation before a subscription receipt reconciles only this agreement and confirms each provider stop', async () => {
  let canceled = false; const db = backend(context());
  const upstream = transport({
    'GET /v2/customers/cst_synthetic/subscriptions': embedded('subscriptions', [subscription(), subscription({ id: 'sub_unrelated', metadata: { ...metadata, fabelpadContractId: jobId } })]),
    'DELETE /v2/customers/cst_synthetic/subscriptions/sub_synthetic': () => { canceled = true; return json(subscription({ status: 'canceled' })); },
    'GET /v2/customers/cst_synthetic/subscriptions/sub_synthetic': () => json(subscription({ status: canceled ? 'canceled' : 'active' })),
  });
  const result = await executeMollieBillingJob(job({ kind: 'mollie_cancel' }), { backend: db, fetch: upstream.fetcher, now: fixedNow });
  assert.equal(result.cancellationConfirmed, true); assert.equal(canceled, true); assert.equal(upstream.calls.some(call => call.path.includes('sub_unrelated')), false);
});
test('stopping an open first Checkout confirms an authoritative absence of subscriptions', async () => {
  const db = backend(context()), upstream = transport({ 'GET /v2/customers/cst_synthetic/subscriptions': embedded('subscriptions', []) });
  const result = await executeMollieBillingJob(job({ kind: 'mollie_cancel' }), { backend: db, fetch: upstream.fetcher, now: fixedNow });
  assert.equal(result.cancellationConfirmed, true); assert.equal(result.status, 'no_subscription'); assert.equal(upstream.calls.some(call => call.method !== 'GET'), false);
});
test('refund timeout after provider acceptance is reconciled by metadata beyond the idempotency window', async () => {
  const db = backend(context({ paymentId: 'tr_synthetic', refund: { amountCents: 200, reason: 'withdrawal', metadata } }));
  const upstream = transport({ 'GET /v2/payments/tr_synthetic': payment({ status: 'paid', paidAt: '2026-11-23T12:00:00Z' }), 'GET /v2/payments/tr_synthetic/refunds': embedded('refunds', [refund()]) });
  const result = await executeMollieBillingJob(job({ kind: 'mollie_refund', attempt: 4, firstAttemptAt: '2026-11-22T12:00:00Z' }), { backend: db, fetch: upstream.fetcher, now: fixedNow });
  assert.equal(result.refundConfirmed, false); assert.equal(result.reconcileRequired, true); assert.equal(upstream.calls.some(call => call.method === 'POST'), false);
});
test('new refund uses official original-payment route and is confirmed only after refund status', async () => {
  const db = backend(context({ paymentId: 'tr_synthetic', refund: { amountCents: 200, reason: 'access_loss', metadata } }));
  let refunded = false;
  const upstream = transport({ 'GET /v2/payments/tr_synthetic': () => json(payment({ status: 'paid', paidAt: '2026-11-23T12:00:00Z', amountRefunded: { currency: 'EUR', value: refunded ? '2.00' : '0.00' } })), 'GET /v2/payments/tr_synthetic/refunds': embedded('refunds', []), 'POST /v2/payments/tr_synthetic/refunds': options => { assert.equal(JSON.parse(options.body).amount.value, '2.00'); refunded = true; return json(refund({ status: 'refunded' }), 201); } });
  const result = await executeMollieBillingJob(job({ kind: 'mollie_refund' }), { backend: db, fetch: upstream.fetcher, now: fixedNow }); assert.equal(result.refundConfirmed, true); assert.equal(result.paymentRefundedCents, 200);
});
test('refund reconciliation returns the official cumulative total for an older immutable invoice', async () => {
  const db = backend(context({ paymentId: 'tr_synthetic', providerSubscriptionId: 'sub_currentsegment', refund: { amountCents: 200, reason: 'access_loss', metadata } }));
  const upstream = transport({ 'GET /v2/payments/tr_synthetic': payment({ sequenceType: 'recurring', subscriptionId: 'sub_previoussegment', status: 'paid', paidAt: '2026-10-23T12:00:00Z', amountRefunded: { currency: 'EUR', value: '3.00' } }), 'GET /v2/payments/tr_synthetic/refunds': embedded('refunds', [refund({ status: 'refunded' })]) });
  const result = await executeMollieBillingJob(job({ kind: 'mollie_refund' }), { backend: db, fetch: upstream.fetcher, now: fixedNow });
  assert.equal(result.refundConfirmed, true); assert.equal(result.paymentRefundedCents, 300); assert.equal(upstream.calls.some(call => call.method !== 'GET'), false);
});
test('refunded operation without aggregate payment confirmation remains pending', async () => {
  const db = backend(context({ paymentId: 'tr_synthetic', refund: { amountCents: 200, reason: 'withdrawal', metadata } }));
  const upstream = transport({ 'GET /v2/payments/tr_synthetic': payment({ status: 'paid', paidAt: '2026-11-23T12:00:00Z' }), 'GET /v2/payments/tr_synthetic/refunds': embedded('refunds', [refund({ status: 'refunded' })]) });
  const result = await executeMollieBillingJob(job({ kind: 'mollie_refund' }), { backend: db, fetch: upstream.fetcher, now: fixedNow });
  assert.equal(result.refundConfirmed, false); assert.equal(result.reconcileRequired, true);
});
test('financial computation clamps calendar periods and prorates exact prepaid rights', () => {
  assert.deepEqual(mollieCalendarPeriod('2028-01-31T12:00:00Z', 'month'), { periodStart: '2028-01-31T12:00:00.000Z', periodEnd: '2028-02-29T12:00:00.000Z' });
  assert.equal(mollieCalendarPeriod('2028-02-29T12:00:00Z', 'year').periodEnd, '2029-02-28T12:00:00.000Z');
  assert.equal(mollieProrataRefund(3999, '2026-01-01', '2027-01-01', '2026-01-01'), 3999); assert.equal(mollieProrataRefund(499, '2026-11-01', '2026-12-01', '2026-11-16'), 250); assert.equal(mollieProrataRefund(499, '2026-11-01', '2026-12-01', '2026-12-02'), 0);
});
test('a lost DB completion cannot be reported as provider success or leak diagnostics', async () => {
  const db = backend(context({ providerSubscriptionId: 'sub_synthetic' }), { complete_billing_job: () => { throw new Error(secret); } });
  const upstream = transport({ 'GET /v2/customers/cst_synthetic/subscriptions/sub_synthetic': subscription({ status: 'canceled' }) });
  assert.deepEqual(await processMollieBillingJob(job({ kind: 'mollie_cancel' }), { backend: db, fetch: upstream.fetcher, now: fixedNow }), { completed: false, deferred: true });
  assert.equal(db.calls.at(-1).params.p_uncertain, true); assert.equal(JSON.stringify(db.calls).includes(secret), false);
});
test('key rotation cannot silently switch an old obligation to the newest credential revision', async () => {
  const db = backend(context({ providerSubscriptionId: 'sub_synthetic' }), { get_billing_provider_config: { ...credential(), revision: 3, apiKey: 'test_AnotherSyntheticNeverARealKey' } });
  let requests = 0;
  await assert.rejects(executeMollieBillingJob(job({ kind: 'mollie_cancel' }), { backend: db, fetch: async () => { requests++; throw new Error(); }, now: fixedNow }), error => error.code === 'provider_binding_mismatch');
  assert.equal(requests, 0); assert.equal(db.calls[1].params.p_credential_revision, 2);
});
test('manual provider refunds are recognized without requiring app metadata or exposing private fields', async () => {
  const upstream = transport({ 'GET /v2/payments/tr_synthetic/refunds': embedded('refunds', [refund({ metadata: null, description: 'private provider description' })]) });
  const result = await createMollieClient(credential(), { fetch: upstream.fetcher }).listRefunds('tr_synthetic');
  assert.equal(result[0].metadata, null); assert.equal(JSON.stringify(result).includes('private provider description'), false);
});
test('missing or ambiguous valid mandate cannot create a subscription', async () => {
  for (const mandates of [[], [{ id: 'mdt_first', customerId: 'cst_synthetic', mode: 'test', status: 'valid', method: 'directdebit' }, { id: 'mdt_second', customerId: 'cst_synthetic', mode: 'test', status: 'valid', method: 'directdebit' }]]) {
    const db = backend(context({ paymentId: 'tr_synthetic', renewalPlan: { amountCents: 499, startDate: '2026-12-24', metadata } }));
    const upstream = transport({ 'GET /v2/payments/tr_synthetic': payment({ status: 'paid', paidAt: '2026-11-23T12:00:00Z' }), 'GET /v2/customers/cst_synthetic/mandates': embedded('mandates', mandates) });
    await assert.rejects(executeMollieBillingJob(job({ kind: 'mollie_create_subscription' }), { backend: db, fetch: upstream.fetcher, now: fixedNow }), MollieError);
    assert.equal(upstream.calls.some(call => call.method === 'POST'), false);
  }
});
test('ordinary scheduled reconciliation reads current payments and subscription with sale channels paused', async () => {
  const db = backend(context({ providerSubscriptionId: 'sub_synthetic' }));
  const upstream = transport({
    'GET /v2/customers/cst_synthetic/payments': embedded('payments', [payment({ status: 'paid', paidAt: '2026-11-23T12:00:00Z' })]),
    'GET /v2/payments/tr_synthetic': payment({ status: 'paid', paidAt: '2026-11-23T12:00:00Z' }),
    'GET /v2/customers/cst_synthetic/subscriptions/sub_synthetic': subscription({ status: 'completed' }),
  });
  const result = await executeMollieBillingJob(job({ kind: 'mollie_reconcile', payload: { reservationId, subscriptionId: contractId } }), { backend: db, fetch: upstream.fetcher, now: fixedNow });
  assert.equal(result.reconciledPayments, 1); assert.equal(result.renewalSegmentCompleted, true); assert.equal(result.historicalScanComplete, true);
  assert.equal(db.calls.some(call => call.name === 'recheck_billing_purchase'), false); assert.equal(upstream.calls.some(call => call.method !== 'GET'), false);
});
test('uncertain operation reconciliation reuses the original key/time and resolves a recorded refund without POST', async () => {
  const db = backend(context({ paymentId: 'tr_synthetic', refund: { amountCents: 200, reason: 'withdrawal', metadata }, reconcile: { kind: 'mollie_refund', idempotencyKey: 'original-refund-operation', firstAttemptAt: '2026-11-20T12:00:00Z' } }));
  const upstream = transport({ 'GET /v2/payments/tr_synthetic': payment({ status: 'paid', paidAt: '2026-11-23T12:00:00Z', amountRefunded: { currency: 'EUR', value: '2.00' } }), 'GET /v2/payments/tr_synthetic/refunds': embedded('refunds', [refund({ status: 'refunded' })]) });
  const result = await executeMollieBillingJob(job({ kind: 'mollie_reconcile', payload: { uncertainJobId: reservationId } }), { backend: db, fetch: upstream.fetcher, now: fixedNow });
  assert.equal(result.refundConfirmed, true); assert.equal(upstream.calls.some(call => call.method !== 'GET'), false);
});
