import type { BillingCredential } from './types.ts';
import { assertMollieMetadata, createMollieClient, MOLLIE_ORIGINS, MOLLIE_RETRY_WINDOW_MS, MollieError, type MollieMetadata, type MolliePayment } from './mollie.ts';
import type { BillingProviderBackend } from './mollie-service.ts';

export interface MollieTrial {
  id: string; credentialRevision: number; environment: 'staging' | 'production'; mode: 'test';
  firstAttemptAt: string | null; customerId: string | null; paymentId: string | null;
  callbackVerified: boolean; webhookVerified: boolean;
}
export type MollieTrialDependencies = { backend: BillingProviderBackend; fetch?: typeof fetch; now?: () => Date; accessToken?: string };
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
function trialMetadata(trial: MollieTrial): MollieMetadata { return { fabelpadContractId: `trial:${trial.id}`, fabelpadOperationId: trial.id }; }
async function load(trial: MollieTrial, deps: MollieTrialDependencies) {
  if (!uuid(trial.id) || trial.mode !== 'test' || !Number.isSafeInteger(trial.credentialRevision) || trial.credentialRevision < 1) throw new MollieError('configuration_invalid');
  const credential = await deps.backend.rpc<BillingCredential>('get_billing_provider_config', { p_provider: 'mollie', p_mode: 'test', p_credential_revision: trial.credentialRevision });
  if (credential.provider !== 'mollie' || credential.mode !== 'test' || credential.environment !== trial.environment || credential.revision !== trial.credentialRevision) throw new MollieError('provider_binding_mismatch');
  return { credential, client: createMollieClient(credential, { fetch: deps.fetch }) };
}
function allowMutation(trial: MollieTrial, deps: MollieTrialDependencies) {
  const timestamp = (deps.now?.() ?? new Date()).getTime(), first = trial.firstAttemptAt === null ? timestamp : Date.parse(trial.firstAttemptAt);
  if (!Number.isFinite(first) || timestamp < first || timestamp - first >= MOLLIE_RETRY_WINDOW_MS) throw new MollieError('reconciliation_incomplete');
}
async function recordTrial(trialId: string, result: Record<string, unknown>, deps: MollieTrialDependencies) {
  const saved = await deps.backend.rpc<{ saved: boolean }>('record_billing_mollie_trial', { p_trial_id: trialId, p_result: result });
  if (!saved || saved.saved !== true) throw new MollieError('provider_unavailable', null, true);
}
function verify(payment: MolliePayment, trial: MollieTrial) {
  if (payment.mode !== 'test' || payment.customerId !== trial.customerId || payment.amountCents !== 499 || payment.sequenceType !== 'first' || payment.subscriptionId || payment.refundedCents || payment.chargedBackCents) throw new MollieError('provider_binding_mismatch');
  assertMollieMetadata(payment.metadata, trialMetadata(trial));
}
/** Explicit admin test action only. The authenticated preparation RPC requires
 * the current DB admin role and fresh auth; sales gates are neither read nor
 * changed. It uses a TEST key and creates no subscription or family right. */
export async function startMollieTrial(input: { credentialRevision: number; requestId: string }, deps: MollieTrialDependencies) {
  if (!deps.accessToken || !uuid(input.requestId) || !Number.isSafeInteger(input.credentialRevision) || input.credentialRevision < 1) throw new MollieError('configuration_invalid');
  let trial = await deps.backend.rpc<MollieTrial>('prepare_billing_mollie_trial', { p_credential_revision: input.credentialRevision, p_request_id: input.requestId }, deps.accessToken);
  if (trial.credentialRevision !== input.credentialRevision) throw new MollieError('provider_binding_mismatch');
  const { credential, client } = await load(trial, deps), meta = trialMetadata(trial);
  const probe = await client.probe(credential.config.mollie.firstMethods, 499); if (!probe.recurringReady || !probe.firstMethods.length) throw new MollieError('configuration_invalid');
  let customerId = trial.customerId;
  if (!customerId) {
    const matches = await client.findCustomers(meta); if (matches.length > 1) throw new MollieError('reconciliation_incomplete');
    customerId = matches[0]?.id ?? null;
    if (!customerId) { allowMutation(trial, deps); customerId = (await client.createCustomer(meta, `${trial.id}:trial-customer`)).id; }
    await recordTrial(trial.id, { customerId }, deps);
    trial = { ...trial, customerId };
  } else { const customer = await client.getCustomer(customerId); assertMollieMetadata(customer.metadata, meta); }
  let payment = trial.paymentId ? await client.getPayment(trial.paymentId) : null;
  if (!payment) {
    const matches = (await client.listCustomerPayments(customerId)).filter(value => value.metadata.fabelpadContractId === meta.fabelpadContractId && value.metadata.fabelpadOperationId === meta.fabelpadOperationId);
    if (matches.length > 1) throw new MollieError('reconciliation_incomplete'); payment = matches[0] ?? null;
  }
  if (!payment) {
    allowMutation(trial, deps); const origin = MOLLIE_ORIGINS[trial.environment];
    payment = await client.createFirstPayment({ customerId, amountCents: 499, methods: probe.firstMethods, description: 'Fabelpad afgeschermde beheertest — geen abonnement', redirectUrl: `${origin}/profiel/abonnement/mollie-proef?trial=${trial.id}`, webhookUrl: `${origin}/api/billing/mollie/webhook?credential=${credential.revision}`, metadata: meta }, `${trial.id}:trial-payment`);
  }
  verify(payment, trial);
  await recordTrial(trial.id, { customerId, paymentId: payment.id, checkoutUrl: payment.checkoutUrl }, deps);
  return { trialId: trial.id, checkoutUrl: payment.checkoutUrl, mode: 'test' as const, amountCents: 499, subscriptionCreated: false, entitlementGranted: false };
}
/** Callback route requires the admin's current session in the HTTP layer. A
 * webhook is only a signal; both routes retrieve and verify the test payment.
 * An open/failed test never proves the callback or webhook payment roundtrip. */
export async function verifyMollieTrial(trialId: string, source: 'callback' | 'webhook', deps: MollieTrialDependencies) {
  if (!uuid(trialId) || !['callback', 'webhook'].includes(source)) throw new MollieError('configuration_invalid');
  const trial = await deps.backend.rpc<MollieTrial | null>('get_billing_mollie_trial', { p_trial_id: trialId, p_payment_id: null });
  if (!trial || !trial.paymentId || !trial.customerId) throw new MollieError('provider_binding_mismatch');
  const { client } = await load(trial, deps), payment = await client.getPayment(trial.paymentId); verify(payment, trial);
  let mandateValid = false;
  if (payment.status === 'paid') {
    if (payment.mandateId) mandateValid = (await client.getMandate(trial.customerId, payment.mandateId)).status === 'valid';
    else mandateValid = (await client.listMandates(trial.customerId)).filter(value => value.status === 'valid').length === 1;
  }
  const confirmed = payment.status === 'paid' && mandateValid;
  if (confirmed) await recordTrial(trial.id, { paymentPaid: true, ...(source === 'callback' ? { callbackVerified: true } : { webhookVerified: true }) }, deps);
  return { matched: true, trialId: trial.id, mode: 'test' as const, paymentStatus: payment.status, confirmed, callbackVerified: trial.callbackVerified || (confirmed && source === 'callback'), webhookVerified: trial.webhookVerified || (confirmed && source === 'webhook'), entitlementGranted: false };
}
export async function verifyMollieTrialWebhook(paymentId: string, credentialRevision: number, deps: MollieTrialDependencies) {
  if (!/^tr_[A-Za-z0-9]{4,100}$/u.test(paymentId) || !Number.isSafeInteger(credentialRevision)) throw new MollieError('configuration_invalid');
  let trial = await deps.backend.rpc<MollieTrial | null>('get_billing_mollie_trial', { p_trial_id: null, p_payment_id: paymentId });
  if (!trial) {
    // A webhook can arrive after provider acceptance but before our payment-ID
    // write. Recover the existing trial through authoritative metadata only.
    const credential = await deps.backend.rpc<BillingCredential>('get_billing_provider_config', { p_provider: 'mollie', p_mode: null, p_credential_revision: credentialRevision });
    const payment = await createMollieClient(credential, { fetch: deps.fetch }).getPayment(paymentId);
    const marker = payment.metadata.fabelpadContractId;
    if (!marker.startsWith('trial:') || !uuid(marker.slice(6))) return { matched: false };
    trial = await deps.backend.rpc<MollieTrial | null>('get_billing_mollie_trial', { p_trial_id: marker.slice(6), p_payment_id: null });
    if (!trial || trial.credentialRevision !== credentialRevision) throw new MollieError('provider_binding_mismatch');
    verify(payment, trial);
    await recordTrial(trial.id, { paymentId: payment.id, checkoutUrl: payment.checkoutUrl }, deps);
  }
  if (trial.credentialRevision !== credentialRevision) throw new MollieError('provider_binding_mismatch');
  return verifyMollieTrial(trial.id, 'webhook', deps);
}
