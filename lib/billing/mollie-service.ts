import type { BillingCredential, BillingJob, BillingProviderEvidence, PurchaseReservation } from './types.ts';
import { assertMollieMetadata, createMollieClient, MOLLIE_ORIGINS, MOLLIE_RETRY_WINDOW_MS, MollieError, type MollieClient, type MollieMetadata, type MolliePayment, type MollieRefund, type MollieSubscription } from './mollie.ts';

export type BillingProviderBackend = { rpc<T>(name: string, parameters?: Record<string, unknown>, accessToken?: string): Promise<T> };
export type MollieServiceDependencies = { backend: BillingProviderBackend; fetch?: typeof fetch; now?: () => Date };
/** This context is assembled by service-only SQL from immutable agreement,
 * reservation, job and credential rows. It is never taken from an HTTP body. */
export interface MollieJobContext {
  reservationId: string; contractId: string; customerId: string | null;
  providerSubscriptionId: string | null; paymentId: string | null; refundId?: string | null;
  credentialRevision: number; settingsRevision: number;
  environment: 'staging' | 'production'; mode: 'test' | 'live';
  amountCents: number; period: 'month' | 'year';
  periodStart: string; periodEnd: string; autoRenew: boolean; deleted: boolean;
  metadata: MollieMetadata;
  /** One bounded constant-price segment, including coupon duration. Once the
   * segment ends SQL schedules the next agreed segment; no unbounded discount. */
  renewalPlan?: { amountCents: number; startDate: string; times?: number; mandateId?: string; metadata: MollieMetadata } | null;
  refund?: { amountCents: number; reason: 'withdrawal' | 'access_loss' | 'duplicate'; metadata: MollieMetadata };
  reconcile?: { kind: 'mollie_first_payment' | 'mollie_create_subscription' | 'mollie_cancel' | 'mollie_refund'; idempotencyKey: string; firstAttemptAt: string };
}
type ExtendedEvidence = BillingProviderEvidence & { providerSubscriptionId?: string; providerStatus?: string; refundedCents?: number; chargedBackCents?: number; cancellationConfirmed?: boolean };
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
const contextValid = (context: MollieJobContext) => context && uuid(context.reservationId) && uuid(context.contractId) && Number.isSafeInteger(context.credentialRevision) && context.credentialRevision > 0 && Number.isSafeInteger(context.amountCents) && context.amountCents > 0 && ['month', 'year'].includes(context.period) && Number.isFinite(Date.parse(context.periodStart)) && Number.isFinite(Date.parse(context.periodEnd)) && Date.parse(context.periodEnd) > Date.parse(context.periodStart);
function now(deps: MollieServiceDependencies) { const value = deps.now?.() ?? new Date(); if (!Number.isFinite(value.getTime())) throw new MollieError('configuration_invalid'); return value; }
function exactCredential(credential: BillingCredential, context: MollieJobContext) {
  if (credential.provider !== 'mollie' || credential.revision !== context.credentialRevision || credential.environment !== context.environment || credential.mode !== context.mode) throw new MollieError('provider_binding_mismatch');
}
async function loadCredential(context: MollieJobContext, deps: MollieServiceDependencies) {
  const credential = await deps.backend.rpc<BillingCredential>('get_billing_provider_config', { p_provider: 'mollie', p_mode: context.mode, p_credential_revision: context.credentialRevision });
  exactCredential(credential, context); return credential;
}
function paymentMatches(payment: MolliePayment, context: MollieJobContext, renewal = false) {
  if (payment.customerId !== context.customerId || payment.amountCents !== context.amountCents || (context.paymentId && payment.id !== context.paymentId) || (renewal ? payment.subscriptionId !== context.providerSubscriptionId || payment.sequenceType !== 'recurring' : payment.sequenceType !== 'first' || payment.subscriptionId !== null)) throw new MollieError('provider_binding_mismatch');
  assertMollieMetadata(payment.metadata, context.metadata);
}
function matchingMetadata(actual: MollieMetadata | null, expected: MollieMetadata) { return actual !== null && Object.entries(expected).every(([key, value]) => actual[key as keyof MollieMetadata] === value); }
function exactlyOne<T>(matches: T[]): T | null { if (matches.length > 1) throw new MollieError('reconciliation_incomplete'); return matches[0] ?? null; }
function safeRetry(job: BillingJob, deps: MollieServiceDependencies) {
  if (job.attempt <= 1 && job.firstAttemptAt === null) return true;
  const first = typeof job.firstAttemptAt === 'string' ? Date.parse(job.firstAttemptAt) : NaN;
  return Number.isFinite(first) && now(deps).getTime() >= first && now(deps).getTime() - first < MOLLIE_RETRY_WINDOW_MS;
}
function mutationKey(job: BillingJob, suffix: string) { return `${job.idempotencyKey}:${suffix}`; }
/** Fresh server state is checked even when an old browser already reserved.
 * Actual writes run from the durable queue and recheck once more immediately
 * before opening a Checkout. Only this path starts NEW sales. */
export async function startMollieCheckout(reservationId: string, deps: MollieServiceDependencies): Promise<{ queued: true; reservationId: string }> {
  if (!uuid(reservationId)) throw new MollieError('configuration_invalid');
  const reservation = await deps.backend.rpc<PurchaseReservation>('recheck_billing_purchase', { p_reservation_id: reservationId });
  if (reservation.id !== reservationId || reservation.provider !== 'mollie' || reservation.currency !== 'EUR' || reservation.amountCents < 1) throw new MollieError('provider_binding_mismatch');
  return { queued: true, reservationId };
}
export function mollieCalendarPeriod(paidAt: string, period: 'month' | 'year') {
  const start = new Date(paidAt); if (!Number.isFinite(start.getTime()) || !['month', 'year'].includes(period)) throw new MollieError('configuration_invalid');
  const target = new Date(start); target.setUTCDate(1); target.setUTCMonth(target.getUTCMonth() + (period === 'month' ? 1 : 12));
  const last = new Date(target); last.setUTCMonth(last.getUTCMonth() + 1); last.setUTCDate(0);
  target.setUTCDate(Math.min(start.getUTCDate(), last.getUTCDate()));
  return { periodStart: start.toISOString(), periodEnd: target.toISOString() };
}
function paymentEvidence(payment: MolliePayment, context: MollieJobContext, deps: MollieServiceDependencies, verifiedAt = now(deps).toISOString()): ExtendedEvidence {
  const state = payment.chargedBackCents > 0 ? 'revoked' : payment.refundedCents >= payment.amountCents ? 'refunded' : payment.status === 'paid' ? 'active' : payment.status === 'expired' ? 'expired' : ['canceled', 'failed'].includes(payment.status) ? 'failed' : 'pending';
  const paidPeriod = payment.paidAt ? mollieCalendarPeriod(payment.paidAt, context.period) : { periodStart: context.periodStart, periodEnd: context.periodEnd };
  return { provider: 'mollie', eventId: `mollie:${payment.id}:${payment.status}:${payment.refundedCents}:${payment.chargedBackCents}`, reservationId: context.reservationId, subscriptionId: context.contractId, providerCustomerId: payment.customerId, providerPaymentId: payment.id, ...(payment.subscriptionId ? { providerSubscriptionId: payment.subscriptionId } : {}), environment: context.environment, mode: context.mode, credentialRevision: context.credentialRevision, amountCents: payment.amountCents, currency: 'EUR', profileId: payment.profileId, state, providerStatus: payment.status, refundedCents: payment.refundedCents, chargedBackCents: payment.chargedBackCents, ...paidPeriod, autoRenew: context.autoRenew && !context.deleted && payment.chargedBackCents === 0 && state !== 'refunded', verifiedAt, ...(payment.mandateId ? { mandateId: payment.mandateId } : {}), period: context.period };
}
export async function reconcileMolliePayment(paymentId: string, credentialRevision: number, deps: MollieServiceDependencies) {
  if (!/^tr_[A-Za-z0-9]{4,100}$/u.test(paymentId) || !Number.isSafeInteger(credentialRevision) || credentialRevision < 1) throw new MollieError('configuration_invalid');
  // A webhook is an unauthenticated signal. Its body is never payment evidence.
  // Fetch through the immutable callback credential, then bind the authoritative
  // metadata/subscription to an existing family record without creating accounts.
  // Order snapshots by when verification STARTED. A slow older response must
  // not acquire a newer timestamp after a fast refund/chargeback read commits.
  const verifiedAt = now(deps).toISOString();
  const credential = await deps.backend.rpc<BillingCredential>('get_billing_provider_config', { p_provider: 'mollie', p_mode: null, p_credential_revision: credentialRevision });
  if (credential.provider !== 'mollie' || credential.revision !== credentialRevision) throw new MollieError('provider_binding_mismatch');
  const client = createMollieClient(credential, { fetch: deps.fetch }); const payment = await client.getPayment(paymentId);
  const context = await deps.backend.rpc<MollieJobContext | null>('get_billing_mollie_binding', { p_payment_id: paymentId, p_provider_subscription_id: payment.subscriptionId, p_reservation_id: payment.metadata.fabelpadAttemptId ?? null });
  if (!context || !contextValid(context)) throw new MollieError('provider_binding_mismatch'); exactCredential(credential, context);
  paymentMatches(payment, context, payment.subscriptionId !== null);
  const evidence = paymentEvidence(payment, context, deps, verifiedAt);
  const applied = await deps.backend.rpc<{ applied: boolean; duplicate: boolean; subscriptionId?: string }>('apply_billing_provider_evidence', { p_evidence: evidence });
  return { ...applied, state: evidence.state, providerPaymentId: payment.id, periodEnd: context.periodEnd };
}
async function firstPayment(job: BillingJob, context: MollieJobContext, credential: BillingCredential, client: MollieClient, deps: MollieServiceDependencies) {
  const verifiedAt = now(deps).toISOString();
  if (context.deleted) throw new MollieError('provider_binding_mismatch');
  await startMollieCheckout(context.reservationId, deps);
  const customerMeta = { fabelpadContractId: context.contractId, fabelpadOperationId: context.contractId };
  let customerId = context.customerId;
  if (customerId) { const customer = await client.getCustomer(customerId); if (customer.metadata.fabelpadContractId !== context.contractId) throw new MollieError('provider_binding_mismatch'); }
  else {
    const matches = await client.findCustomers(customerMeta); customerId = exactlyOne(matches)?.id ?? null;
    if (!customerId) {
      if (!safeRetry(job, deps)) throw new MollieError('reconciliation_incomplete');
      customerId = (await client.createCustomer(customerMeta, mutationKey(job, 'customer'))).id;
    }
    if (!await deps.backend.rpc<boolean>('record_billing_mollie_customer', { p_job_id: job.id, p_lease_token: job.leaseToken, p_customer_id: customerId })) throw new MollieError('provider_unavailable', null, true);
  }
  const updated = { ...context, customerId };
  let payment: MolliePayment | null = context.paymentId ? await client.getPayment(context.paymentId) : exactlyOne((await client.listCustomerPayments(customerId)).filter(value => matchingMetadata(value.metadata, context.metadata)));
  if (!payment) {
    if (!safeRetry(job, deps)) throw new MollieError('reconciliation_incomplete');
    const probe = await client.probe(credential.config.mollie.firstMethods, context.amountCents);
    if (!probe.recurringReady || !probe.firstMethods.length) throw new MollieError('configuration_invalid');
    // Profile checks and customer reconciliation can take time; reread gates and
    // reservation revision immediately before the payment mutation.
    await startMollieCheckout(context.reservationId, deps);
    const origin = MOLLIE_ORIGINS[context.environment];
    payment = await client.createFirstPayment({ customerId, amountCents: context.amountCents, description: credential.config.mollie.description, methods: probe.firstMethods, redirectUrl: `${origin}/profiel/abonnement?betaling=${encodeURIComponent(context.reservationId)}`, webhookUrl: `${origin}/api/billing/mollie/webhook?credential=${credential.revision}`, metadata: context.metadata }, mutationKey(job, 'first'));
  }
  paymentMatches(payment, updated);
  await deps.backend.rpc('apply_billing_provider_evidence', { p_evidence: paymentEvidence(payment, updated, deps, verifiedAt) });
  return { providerId: payment.id, paymentId: payment.id, customerId, checkoutUrl: payment.checkoutUrl, status: payment.status };
}
async function createSubscription(job: BillingJob, context: MollieJobContext, credential: BillingCredential, client: MollieClient, deps: MollieServiceDependencies) {
  if (!context.customerId || !context.paymentId || !context.autoRenew || context.deleted || !context.renewalPlan) throw new MollieError('provider_binding_mismatch');
  const first = await client.getPayment(context.paymentId); paymentMatches(first, context);
  if (first.status !== 'paid' || first.chargedBackCents || first.refundedCents) throw new MollieError('provider_binding_mismatch');
  const mandate = first.mandateId ? await client.getMandate(context.customerId, first.mandateId) : exactlyOne((await client.listMandates(context.customerId)).filter(value => value.status === 'valid'));
  if (!mandate || mandate.status !== 'valid') throw new MollieError('provider_binding_mismatch');
  const plan = context.renewalPlan;
  // YYYY-MM-DD cannot express a time. Round up if the already-paid right has a
  // time component, so the next debit can never precede its expiry.
  const end = new Date(context.periodEnd), floor = new Date(end.toISOString().slice(0, 10));
  const earliest = new Date(floor.getTime() + (end.getTime() > floor.getTime() ? 86_400_000 : 0)).toISOString().slice(0, 10);
  if (plan.startDate < earliest || Date.parse(plan.startDate) < now(deps).getTime()) throw new MollieError('configuration_invalid');
  let subscription = context.providerSubscriptionId ? await client.getSubscription(context.customerId, context.providerSubscriptionId) : exactlyOne((await client.listSubscriptions(context.customerId)).filter(value => matchingMetadata(value.metadata, plan.metadata)));
  if (subscription && !matchingMetadata(subscription.metadata, plan.metadata)) {
    // A completed finite discount segment can precede a different, explicitly
    // agreed price segment. An active previous segment must never be duplicated.
    if (subscription.status !== 'completed') throw new MollieError('provider_binding_mismatch');
    subscription = exactlyOne((await client.listSubscriptions(context.customerId)).filter(value => matchingMetadata(value.metadata, plan.metadata)));
  }
  if (!subscription) {
    if (!safeRetry(job, deps)) throw new MollieError('reconciliation_incomplete');
    // SQL rechecks cancel/phaseout/deletion state immediately before scheduling;
    // a disabled SALES channel alone does not cancel existing renewal consent.
    if (!await deps.backend.rpc<boolean>('recheck_billing_renewal', { p_job_id: job.id, p_lease_token: job.leaseToken })) throw new MollieError('provider_binding_mismatch');
    subscription = await client.createSubscription({ customerId: context.customerId, mandateId: mandate.id, amountCents: plan.amountCents, period: context.period, startDate: plan.startDate, description: `${credential.config.mollie.description} ${context.contractId.slice(0, 8)}`, webhookUrl: `${MOLLIE_ORIGINS[context.environment]}/api/billing/mollie/webhook?credential=${credential.revision}`, metadata: plan.metadata, ...(plan.times ? { times: plan.times } : {}) }, mutationKey(job, 'subscription'));
  }
  if (subscription.amountCents !== plan.amountCents || subscription.startDate !== plan.startDate || !matchingMetadata(subscription.metadata, plan.metadata)) throw new MollieError('provider_binding_mismatch');
  return { providerId: subscription.id, providerSubscriptionId: subscription.id, status: subscription.status, renewalConfirmed: ['active', 'pending'].includes(subscription.status) };
}
async function cancel(job: BillingJob, context: MollieJobContext, client: MollieClient) {
  if (!context.customerId && context.providerSubscriptionId) throw new MollieError('provider_binding_mismatch');
  // Open first Checkouts can be stopped before a recurring subscription exists.
  // Reconcile any lost creation receipt instead of leaving that cancellation in
  // a permanent retry. SQL reopens the cancellation obligation if an in-flight
  // creation later returns a provider subscription ID after this absence check.
  const subscriptions = !context.customerId ? [] : context.providerSubscriptionId
    ? [await client.getSubscription(context.customerId, context.providerSubscriptionId)]
    : (await client.listSubscriptions(context.customerId)).filter(value => value.metadata.fabelpadContractId === context.metadata.fabelpadContractId);
  for (let subscription of subscriptions) {
    if (subscription.metadata.fabelpadContractId !== context.metadata.fabelpadContractId) throw new MollieError('provider_binding_mismatch');
    if (!['canceled', 'completed'].includes(subscription.status)) await client.cancelSubscription(context.customerId!, subscription.id, mutationKey(job, context.providerSubscriptionId ? 'cancel' : `cancel:${subscription.id}`));
    // GET is authoritative even after a lost DELETE response/retry. A 404 is not
    // interpreted as proof of cancellation or permission to discard obligations.
    subscription = await client.getSubscription(context.customerId!, subscription.id);
    if (subscription.metadata.fabelpadContractId !== context.metadata.fabelpadContractId || !['canceled', 'completed'].includes(subscription.status)) throw new MollieError('provider_binding_mismatch');
  }
  return { providerId: subscriptions.at(-1)?.id ?? null, status: subscriptions.length ? 'canceled' : 'no_subscription', cancellationConfirmed: true, paidUntil: context.periodEnd };
}
async function refund(job: BillingJob, context: MollieJobContext, client: MollieClient, deps: MollieServiceDependencies) {
  if (!context.paymentId || !context.customerId || !context.refund) throw new MollieError('provider_binding_mismatch');
  const payment = await client.getPayment(context.paymentId);
  // A refund belongs to this exact immutable invoice, which may precede the
  // current subscription price segment. Invoice ID/customer/amount/frozen
  // metadata are binding; the contract's current provider subscription may differ.
  const invoiceContext = { ...context, providerSubscriptionId: payment.subscriptionId };
  paymentMatches(payment, invoiceContext, payment.subscriptionId !== null);
  if (payment.status !== 'paid' || payment.chargedBackCents) throw new MollieError('provider_binding_mismatch');
  const desired = context.refund;
  if (!Number.isSafeInteger(desired.amountCents) || desired.amountCents < 1 || desired.amountCents > payment.amountCents) throw new MollieError('configuration_invalid');
  let result: MollieRefund | null = context.refundId ? await client.getRefund(payment.id, context.refundId) : exactlyOne((await client.listRefunds(payment.id)).filter(value => matchingMetadata(value.metadata, desired.metadata)));
  if (!result) {
    if (!safeRetry(job, deps) || desired.amountCents > payment.amountCents - payment.refundedCents) throw new MollieError('reconciliation_incomplete');
    result = await client.createRefund(payment.id, desired.amountCents, desired.metadata, mutationKey(job, 'refund'));
  }
  if (result.amountCents !== desired.amountCents || !matchingMetadata(result.metadata, desired.metadata)) throw new MollieError('provider_binding_mismatch');
  let paymentRefundedCents = payment.refundedCents;
  if (result.status === 'refunded') {
    const current = await client.getPayment(payment.id); paymentMatches(current, invoiceContext, current.subscriptionId !== null);
    paymentRefundedCents = current.refundedCents;
  }
  const confirmed = result.status === 'refunded' && paymentRefundedCents >= result.amountCents;
  // queued/pending/processing is an outstanding obligation, never a confirmed
  // refund. SQL keeps polling until refunded/failed/canceled is retrieved.
  return { providerId: result.id, refundId: result.id, paymentId: payment.id, status: result.status, refundConfirmed: confirmed, refundAmountCents: result.amountCents, paymentRefundedCents, reconcileRequired: !confirmed && !['failed', 'canceled'].includes(result.status) };
}
/** Execute one DB-leased job. Caller completes/fails its lease durably. Existing
 * obligations continue with gates off and their original credential revision. */
export async function executeMollieBillingJob(job: BillingJob, deps: MollieServiceDependencies): Promise<Record<string, unknown>> {
  if (job.provider !== 'mollie' || !uuid(job.id) || !uuid(job.leaseToken) || !Number.isSafeInteger(job.credentialRevision) || !job.credentialRevision) throw new MollieError('configuration_invalid');
  if (job.kind === 'mollie_reconcile' && typeof job.payload.paymentId === 'string') return reconcileMolliePayment(job.payload.paymentId, job.credentialRevision, deps);
  const context = await deps.backend.rpc<MollieJobContext>('get_billing_mollie_job_context', { p_job_id: job.id, p_lease_token: job.leaseToken });
  if (!contextValid(context) || context.credentialRevision !== job.credentialRevision || context.environment !== job.environment || context.mode !== job.mode || context.settingsRevision !== job.settingsRevision) throw new MollieError('provider_binding_mismatch');
  const credential = await loadCredential(context, deps), client = createMollieClient(credential, { fetch: deps.fetch });
  if (job.kind === 'mollie_reconcile' && context.reconcile) {
    if (!['mollie_first_payment', 'mollie_create_subscription', 'mollie_cancel', 'mollie_refund'].includes(context.reconcile.kind)) throw new MollieError('configuration_invalid');
    // Keep the current reconciliation lease but reuse the ORIGINAL operation's
    // key and time. Every operation lists/GETs provider state before a retry.
    job = { ...job, kind: context.reconcile.kind, idempotencyKey: context.reconcile.idempotencyKey, firstAttemptAt: context.reconcile.firstAttemptAt, attempt: Math.max(2, job.attempt) };
  }
  if (job.kind === 'mollie_first_payment') return firstPayment(job, context, credential, client, deps);
  if (job.kind === 'mollie_create_subscription') return createSubscription(job, context, credential, client, deps);
  if (job.kind === 'mollie_cancel') return cancel(job, context, client);
  if (job.kind === 'mollie_refund') return refund(job, context, client, deps);
  if (job.kind === 'mollie_reconcile') {
    if (!context.customerId) throw new MollieError('provider_binding_mismatch');
    const payments = (await client.listCustomerPayments(context.customerId)).filter(value => value.metadata.fabelpadContractId === context.metadata.fabelpadContractId);
    // Recent invoices cover active paid rights and dispute windows. Keep a
    // bounded scheduler tick; report explicitly when older history was omitted.
    const recent = payments.slice(0, 100).sort((left, right) => Date.parse(left.paidAt ?? '1970-01-01') - Date.parse(right.paidAt ?? '1970-01-01'));
    for (const payment of recent) await reconcileMolliePayment(payment.id, credential.revision, deps);
    const subscription = context.providerSubscriptionId ? await client.getSubscription(context.customerId, context.providerSubscriptionId) : null;
    if (subscription && subscription.metadata.fabelpadContractId !== context.metadata.fabelpadContractId) throw new MollieError('provider_binding_mismatch');
    return { providerId: subscription?.id ?? context.paymentId, status: subscription?.status ?? 'payments_reconciled', renewalSegmentCompleted: subscription?.status === 'completed', cancellationConfirmed: subscription?.status === 'canceled', reconciledPayments: recent.length, historicalScanComplete: recent.length === payments.length };
  }
  throw new MollieError('configuration_invalid');
}
/** The coordinator claims once across all providers; this helper owns its lease
 * outcome so a success is never reported before its durable result is saved. */
export async function processMollieBillingJob(job: BillingJob, deps: MollieServiceDependencies): Promise<{ completed: boolean; deferred: boolean }> {
  try {
    const result = await executeMollieBillingJob(job, deps);
    const completion = await deps.backend.rpc<{ completed: boolean }>('complete_billing_job', { p_job_id: job.id, p_lease_token: job.leaseToken, p_result: result });
    if (!completion.completed) throw new MollieError('provider_unavailable', null, true);
    return { completed: true, deferred: false };
  } catch (error) {
    const code = error instanceof MollieError ? error.code : 'provider_unavailable';
    const uncertain = error instanceof MollieError ? error.uncertain || ['reconciliation_incomplete', 'provider_binding_mismatch', 'provider_response_invalid'].includes(error.code) : true;
    await deps.backend.rpc('fail_billing_job', { p_job_id: job.id, p_lease_token: job.leaseToken, p_error_code: code, p_uncertain: uncertain });
    return { completed: false, deferred: true };
  }
}
/** Calendar rights do not have a fixed number of seconds. Proration uses the
 * frozen exact paid period and rounds in the customer's favour to a cent. */
export function mollieProrataRefund(amountCents: number, periodStart: string, periodEnd: string, accessLostAt: string): number {
  const start = Date.parse(periodStart), end = Date.parse(periodEnd), lost = Date.parse(accessLostAt);
  if (!Number.isSafeInteger(amountCents) || amountCents < 0 || ![start, end, lost].every(Number.isFinite) || end <= start) throw new MollieError('configuration_invalid');
  return Math.min(amountCents, Math.max(0, Math.ceil(amountCents * (end - Math.max(start, lost)) / (end - start))));
}
