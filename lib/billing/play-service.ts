import type { BillingCredential, BillingJob, BillingMode, BillingProviderEvidence, PurchaseReservation } from './types.ts';
import { createGooglePushVerifier, createPlayClient, parsePlayNotification, playAccountId, playDigest, PlayError, validPlayPurchaseToken, verifyPlayProduct, verifyPlaySubscription, type GoogleAccessToken } from './play.ts';

export interface PlayServiceBackend { rpc<T>(name: string, parameters: Record<string, unknown>, accessToken?: string): Promise<T> }
type Binding = { parentId: string | null; reservationId?: string | null; subscriptionId?: string; obfuscatedAccountId?: string; deleted?: boolean; mode?: BillingMode; credentialRevision?: number };
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

/** Server/Edge-only orchestration. Gates guard starts in the reservation RPC;
 * verification, restore, RTDN and stop-renewal jobs deliberately remain active.
 */
export function createPlayBillingService(options: {
  backend: PlayServiceBackend; accessToken: (credential: BillingCredential) => GoogleAccessToken; fetcher?: typeof fetch; now?: () => number;
}) {
  const { backend } = options, now = options.now ?? Date.now;
  const config = (mode: BillingMode, revision?: number) => backend.rpc<BillingCredential>('get_billing_provider_config', { p_provider: 'play', p_mode: mode, p_credential_revision: revision ?? null });
  async function recordProof(credential: BillingCredential, proof: Record<string, unknown>) {
    if (Object.entries(proof).every(([key, value]) => credential.verification?.[key] === value)) return;
    return backend.rpc('record_billing_provider_test', { p_credential_revision: credential.revision, p_result: { ...credential.verification, mode: credential.mode, ...proof } });
  }
  async function verifyPurchase(input: { token: string; parentId?: string; reservationId?: string; mode: BillingMode; credentialRevision?: number; eventId?: string; allowDeleted?: boolean }) {
    if (!validPlayPurchaseToken(input.token)) throw new PlayError('invalid_play_purchase_token');
    const tokenHash = await playDigest(input.token);
    let binding = await backend.rpc<Binding | null>('get_billing_play_binding', { p_purchase_token_hash: tokenHash, p_obfuscated_account_id: null });
    if (binding?.deleted && !input.allowDeleted) throw new PlayError('play_account_deleted');
    if (binding?.parentId && input.parentId && binding.parentId !== input.parentId) throw new PlayError('play_purchase_owner_mismatch');
    const credential = await config(binding?.mode ?? input.mode, binding?.credentialRevision ?? input.credentialRevision);
    const client = createPlayClient(options.accessToken(credential), options.fetcher);
    const verificationStartedAt = now();
    const raw = await client.getSubscription(credential.config.play.packageName, input.token);
    let linked: Binding | null = null;
    if (object(raw) && validPlayPurchaseToken(raw.linkedPurchaseToken)) {
      linked = await backend.rpc<Binding | null>('get_billing_play_binding', { p_purchase_token_hash: await playDigest(raw.linkedPurchaseToken), p_obfuscated_account_id: null });
      if (linked?.deleted && !input.allowDeleted || linked?.parentId && input.parentId && linked.parentId !== input.parentId) throw new PlayError('play_purchase_owner_mismatch');
    }
    const parentId = input.parentId ?? binding?.parentId ?? linked?.parentId;
    const verified = await verifyPlaySubscription(raw, { settings: credential.config.play, token: input.token, mode: credential.mode,
      ...(parentId ? { expectedAccountId: await playAccountId(parentId) } : binding?.obfuscatedAccountId ? { expectedAccountId: binding.obfuscatedAccountId } : {}),
      ...(linked?.parentId ? { knownLinkedAccountId: await playAccountId(linked.parentId) } : binding?.obfuscatedAccountId ? { knownLinkedAccountId: binding.obfuscatedAccountId } : {}), now: verificationStartedAt });
    if (!binding) binding = await backend.rpc<Binding | null>('get_billing_play_binding', { p_purchase_token_hash: tokenHash, p_obfuscated_account_id: verified.obfuscatedAccountId });
    if (binding?.deleted && !input.allowDeleted || !binding?.parentId && !parentId && !(input.allowDeleted && binding?.subscriptionId)
      || binding?.parentId && verified.obfuscatedAccountId !== await playAccountId(binding.parentId)) throw new PlayError('play_purchase_owner_unbound');
    let reservation: PurchaseReservation | null = null;
    const reservationId = input.reservationId ?? binding?.reservationId ?? undefined;
    if (reservationId && !(input.allowDeleted && binding?.deleted && binding.subscriptionId)) {
      // A paid purchase must still be reconciled after its start reservation
      // expired or a gate was paused. Do not re-open or create a checkout here.
      reservation = await backend.rpc<PurchaseReservation | null>('get_billing_play_reservation', { p_reservation_id: reservationId, p_parent_id: binding?.parentId ?? parentId });
      if (!reservation || reservation.provider !== 'play' || reservation.environment !== credential.environment || reservation.mode !== credential.mode
        || reservation.period !== verified.period || reservation.parentId !== (binding?.parentId ?? parentId)) throw new PlayError('play_reservation_mismatch');
    }
    const eventId = input.eventId ?? `verify:${crypto.randomUUID()}`;
    const evidence: BillingProviderEvidence = { ...verified, eventId, environment: credential.environment,
      credentialRevision: credential.revision, ...(reservationId ? { reservationId } : {}), ...(binding?.subscriptionId ? { subscriptionId: binding.subscriptionId } : {}) };
    const result = await backend.rpc<{ applied: boolean; duplicate: boolean; subscriptionId?: string }>('apply_billing_provider_evidence', { p_evidence: evidence });
    // The DB queues the durable acknowledgement before this best-effort fast
    // path. A transient Google failure never loses the purchase or its retry.
    if (verified.acknowledgementRequired && result.applied) {
      try {
        await client.acknowledge(credential.config.play.packageName, verified.productId, input.token);
        const confirmationStartedAt = now();
        const confirmed = await verifyPlaySubscription(await client.getSubscription(credential.config.play.packageName, input.token), {
          settings: credential.config.play, token: input.token, mode: credential.mode, expectedAccountId: verified.obfuscatedAccountId, now: confirmationStartedAt,
        });
        if (confirmed.acknowledged) {
          await backend.rpc('apply_billing_provider_evidence', { p_evidence: { ...confirmed, eventId: `${eventId}:ack`, environment: credential.environment, credentialRevision: credential.revision, ...(reservationId ? { reservationId } : {}), ...(binding?.subscriptionId ? { subscriptionId: binding.subscriptionId } : {}) } });
          if (credential.mode === 'test' && credential.environment === 'staging') await recordProof(credential, { serverVerificationVerified: true }).catch(() => {});
        }
      } catch { /* The service-only acknowledgement job owns the retry. */ }
    }
    if (verified.acknowledged && ['active', 'grace', 'cancelled'].includes(verified.state) && credential.mode === 'test' && credential.environment === 'staging') await recordProof(credential, { serverVerificationVerified: true }).catch(() => {});
    return { ...result, state: verified.state, paidUntil: verified.periodEnd, acknowledgementPending: verified.acknowledgementRequired === true };
  }
  return {
    verifyPurchase,
    /** Production readiness only: a license-tester purchase is checked with the
     * live server identity, acknowledged, and returned as proof. This path never
     * calls purchase evidence, payment or entitlement RPCs.
     */
    async verifyLicenseProof(input: { token: string; credential: BillingCredential; expectedAccountId: string }) {
      const { credential } = input;
      if (credential.provider !== 'play' || credential.environment !== 'production' || credential.mode !== 'live'
        || !/^[a-f0-9]{64}$/u.test(input.expectedAccountId) || !validPlayPurchaseToken(input.token)) throw new PlayError('invalid_play_license_proof');
      const client = createPlayClient(options.accessToken(credential), options.fetcher), settings = credential.config.play;
      const startedAt = now();
      let verified = await verifyPlaySubscription(await client.getSubscription(settings.packageName, input.token), {
        settings, token: input.token, mode: 'test', expectedAccountId: input.expectedAccountId, now: startedAt,
      });
      if (!credential.config.prices[verified.period].enabled || !['active', 'grace', 'cancelled'].includes(verified.state) || verified.amountCents !== credential.config.prices[verified.period].amountCents || verified.currency !== 'EUR') throw new PlayError('invalid_play_license_proof_purchase');
      if (verified.acknowledgementRequired) {
        await client.acknowledge(settings.packageName, verified.productId, input.token);
        const confirmationStartedAt = now();
        verified = await verifyPlaySubscription(await client.getSubscription(settings.packageName, input.token), {
          settings, token: input.token, mode: 'test', expectedAccountId: input.expectedAccountId, now: confirmationStartedAt,
        });
      }
      if (!verified.acknowledged || !['active', 'grace', 'cancelled'].includes(verified.state)
        || verified.amountCents !== credential.config.prices[verified.period].amountCents || verified.currency !== 'EUR') throw new PlayError('play_license_proof_not_confirmed');
      return { sandbox: true, acknowledged: true, verifiedAt: verified.verifiedAt, tokenHash: verified.tokenHash,
        ownerBinding: verified.obfuscatedAccountId, packageName: settings.packageName, productId: verified.productId, basePlanId: verified.basePlanId,
        period: verified.period, amountCents: verified.amountCents, currency: 'EUR' };
    },
    async testConnection(credential: BillingCredential) {
      const client = createPlayClient(options.accessToken(credential), options.fetcher), settings = credential.config.play;
      const enabled = (['month', 'year'] as const).filter(period => credential.config.prices[period].enabled);
      if (!enabled.length) throw new PlayError('play_no_enabled_period');
      const products = await Promise.all(enabled.map(async period => {
        const productId = period === 'month' ? settings.monthlyProductId : settings.yearlyProductId, basePlanId = period === 'month' ? settings.monthlyBasePlanId : settings.yearlyBasePlanId;
        const verified = verifyPlayProduct(await client.getProduct(settings.packageName, productId), productId, basePlanId, period);
        if (verified.amountCents !== credential.config.prices[period].amountCents) throw new PlayError('play_price_mismatch');
        return verified;
      }));
      return { mode: credential.mode, productsVerified: true, salesStatus: products.every(value => value.salesStatus === 'active') ? 'active' : products.every(value => value.salesStatus === 'inactive') ? 'inactive' : 'mixed',
        // Only a real authoritative test purchase and an authenticated RTDN
        // delivery can establish these independent operational proofs.
        serverVerificationVerified: false, rtdnVerified: false, products,
      };
    },
    async acceptNotification(input: { authorization: string | null; body: unknown; mode: BillingMode }) {
      const credential = await config(input.mode), settings = credential.config.play;
      const verify = createGooglePushVerifier({ audience: settings.rtdnAudience, serviceAccount: settings.rtdnServiceAccount,
        subscription: settings.pubsubSubscription, fetcher: options.fetcher, now });
      await verify(input.authorization);
      const notification = parsePlayNotification(input.body, { packageName: settings.packageName, subscription: settings.pubsubSubscription });
      return backend.rpc('record_billing_provider_event', { p_provider: 'play', p_event_id: notification.eventId, p_payload: {
        ...notification.payload, mode: credential.mode, environment: credential.environment, credentialRevision: credential.revision,
        authenticated: true,
      } });
    },
    async handleJob(job: BillingJob): Promise<Record<string, unknown>> {
      try {
      if (job.provider !== 'play' || !job.kind.startsWith('play_')) throw new PlayError('invalid_play_job');
      let credential = await config(job.mode, job.credentialRevision ?? undefined);
      if (job.kind === 'play_verify' && job.payload.test === true && job.payload.authenticated === true) {
        await recordProof(credential, { rtdnVerified: true });
        const result = { providerConfirmed: true, status: 'rtdn_test_confirmed' };
        const completed = await backend.rpc<{ completed: boolean }>('complete_billing_job', { p_job_id: job.id, p_lease_token: job.leaseToken, p_result: result });
        if (!completed.completed) throw new PlayError('play_job_lease_lost', true);
        return result;
      }
      let binding: Binding | null = null;
      if (validPlayPurchaseToken(job.payload.purchaseToken)) {
        binding = await backend.rpc<Binding | null>('get_billing_play_binding', { p_purchase_token_hash: await playDigest(job.payload.purchaseToken), p_obfuscated_account_id: null });
        if (binding?.credentialRevision) credential = await config(binding.mode ?? job.mode, binding.credentialRevision);
      }
      if (credential.environment !== job.environment) throw new PlayError('play_environment_mismatch');
      const client = createPlayClient(options.accessToken(credential), options.fetcher), settings = credential.config.play;
      if (job.kind === 'play_sales_pause') {
        const plans = ([[settings.monthlyProductId, settings.monthlyBasePlanId, 'month'], [settings.yearlyProductId, settings.yearlyBasePlanId, 'year']] as const).filter(([productId, basePlanId]) => productId && basePlanId);
        if (!plans.length) throw new PlayError('play_no_configured_products');
        for (const [productId, basePlanId, period] of plans) {
          const before = verifyPlayProduct(await client.getProduct(settings.packageName, productId), productId, basePlanId, period);
          if (before.salesStatus !== 'inactive') await client.deactivateBasePlan(settings.packageName, productId, basePlanId);
          const after = verifyPlayProduct(await client.getProduct(settings.packageName, productId), productId, basePlanId, period);
          if (after.salesStatus !== 'inactive') throw new PlayError('play_sales_stop_not_confirmed', true, true);
        }
        const result = { salesStatus: 'inactive', providerConfirmed: true, renewalsUnaffected: true };
        const completed = await backend.rpc<{ completed: boolean }>('complete_billing_job', { p_job_id: job.id, p_lease_token: job.leaseToken, p_result: result });
        if (!completed.completed) throw new PlayError('play_job_lease_lost', true);
        return result;
      }
      const token = job.payload.purchaseToken;
      if (!validPlayPurchaseToken(token)) throw new PlayError('invalid_play_job_token');
      const verificationStartedAt = now();
      const raw = await client.getSubscription(settings.packageName, token);
      const boundAccountId = binding?.parentId ? await playAccountId(binding.parentId) : binding?.obfuscatedAccountId;
      const verified = await verifyPlaySubscription(raw, { settings, token, mode: credential.mode, now: verificationStartedAt,
        ...(boundAccountId ? { expectedAccountId: boundAccountId, knownLinkedAccountId: boundAccountId } : {}) });
      if (job.kind === 'play_acknowledge') {
        if (verified.acknowledgementRequired) await client.acknowledge(settings.packageName, verified.productId, token);
      } else if (job.kind === 'play_cancel') {
        if (verified.autoRenew) await client.cancel(settings.packageName, token, job.payload.developerStop === true || ['phaseout', 'payment_not_required', 'account_deletion', 'renewal_stopped', 'duplicate'].includes(String(job.payload.reason)));
      } else if (job.kind === 'play_revoke') {
        if (!['expired', 'revoked', 'refunded'].includes(verified.state)) await client.revoke(settings.packageName, token, job.payload.refund === 'full' ? 'full' : 'prorated');
      } else if (!['play_verify', 'play_reconcile'].includes(job.kind)) throw new PlayError('invalid_play_job');
      const result = await verifyPurchase({ token, mode: job.mode, credentialRevision: credential.revision, eventId: `${job.idempotencyKey}:${job.attempt}`, allowDeleted: true,
        ...(typeof job.payload.reservationId === 'string' ? { reservationId: job.payload.reservationId } : {}) });
      const confirmationStartedAt = now();
      const confirmed = await verifyPlaySubscription(await client.getSubscription(settings.packageName, token), { settings, token, mode: credential.mode, now: confirmationStartedAt,
        expectedAccountId: verified.obfuscatedAccountId, knownLinkedAccountId: verified.obfuscatedAccountId });
      if (job.kind === 'play_acknowledge' && !confirmed.acknowledged && ['active', 'grace', 'cancelled'].includes(confirmed.state)) throw new PlayError('play_acknowledgement_not_confirmed', true, true);
      if (job.kind === 'play_cancel' && confirmed.autoRenew) throw new PlayError('play_renewal_stop_not_confirmed', true, true);
      if (job.kind === 'play_revoke' && !['expired', 'revoked', 'refunded'].includes(confirmed.state)) throw new PlayError('play_revocation_not_confirmed', true, true);
      const outcome = { ...result, autoRenew: confirmed.autoRenew, acknowledged: confirmed.acknowledged, providerConfirmed: true,
        ...(job.kind === 'play_cancel' ? { cancellationConfirmed: !confirmed.autoRenew } : {}),
        ...(job.kind === 'play_revoke' ? { refundConfirmed: true } : {}),
      };
      const completed = await backend.rpc<{ completed: boolean }>('complete_billing_job', { p_job_id: job.id, p_lease_token: job.leaseToken, p_result: outcome });
      if (!completed.completed) throw new PlayError('play_job_lease_lost', true);
      return outcome;
      } catch (error) {
        await backend.rpc('fail_billing_job', { p_job_id: job.id, p_lease_token: job.leaseToken, p_error_code: error instanceof PlayError ? error.code : 'play_processing_failed', p_uncertain: error instanceof PlayError && error.uncertain });
        throw error;
      }
    },
  };
}
