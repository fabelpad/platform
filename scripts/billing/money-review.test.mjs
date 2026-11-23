import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { installBillingFixture } from './database-fixture.mjs';
import { mollieCalendarPeriod } from '../../lib/billing/mollie-service.ts';

// These tests execute the final migrations and public service contracts. Provider
// HTTP mocks cannot catch the cross-invoice and administrator phaseout races.
test('financial migration preserves paid periods, immutable obligations and stopped consent', async t => {
  const db = new PGlite({ extensions: { pgcrypto } });
  const admin = randomUUID(); let credentialRevision, terms, privacy;
  const owner = () => db.exec('reset role');
  const rpc = async (name, args = []) => (await db.query(`select public.${name}(${args.map((_, i) => `$${i + 1}`).join(',')}) result`, args)).rows[0].result;
  async function identity(id) {
    await owner(); await db.query('insert into auth.sessions(id,user_id) values($1,$1) on conflict do nothing', [id]);
    await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: id, session_id: id, amr: [{ method: 'otp', timestamp: Date.now() / 1000 }] })]);
    await db.exec('set role authenticated');
  }
  async function service() { await owner(); await db.query("select set_config('request.jwt.claims','{}',false)"); await db.exec('set role service_role'); }
  async function parent(id) {
    await owner(); await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,clock_timestamp())', [id, `financial-${id}@example.test`]);
    await identity(id); await rpc('complete_parent_onboarding', [terms, privacy, true, true]);
  }
  async function gate(enabled) { await identity(admin); const s = await rpc('get_billing_settings'); await rpc('set_billing_gate', [s.revision, 'paymentRequired', enabled, true]); }
  async function reserve() {
    const id = randomUUID(); await parent(id); const quote = await rpc('quote_billing_purchase', ['month']);
    const reservation = await rpc('reserve_billing_purchase', ['mollie', 'month', randomUUID(), quote.settingsRevision, quote.amountCents, quote.termsVersion, true]);
    await service(); await rpc('recheck_billing_purchase', [reservation.id]); return { id, reservation };
  }
  function evidence(reservation, changes = {}) {
    const period = mollieCalendarPeriod(new Date().toISOString(), 'month');
    return { provider: 'mollie', eventId: randomUUID(), reservationId: reservation.id, subscriptionId: reservation.id, providerCustomerId: 'cst_financial', providerPaymentId: 'tr_financial', environment: 'staging', mode: 'test', credentialRevision, amountCents: reservation.amountCents, currency: 'EUR', profileId: 'pfl_financial', state: 'active', ...period, autoRenew: true, verifiedAt: new Date().toISOString(), mandateId: 'mdt_financial', ...changes };
  }
  try {
    await installBillingFixture(db);
    terms = (await db.query("select version from private.legal_document_versions where kind='terms' order by version desc limit 1")).rows[0].version;
    privacy = (await db.query("select version from private.legal_document_versions where kind='privacy' order by version desc limit 1")).rows[0].version;
    await db.query("update private.billing_control set settings=jsonb_set(jsonb_set(settings,'{termsVersion}',to_jsonb($1::text)),'{privacyVersion}',to_jsonb($2::text))", [terms, privacy]);
    await db.exec('update private.billing_history set settings=(select settings from private.billing_control) where revision=1');
    await parent(admin); await owner(); await db.query('insert into public.content_admins(user_id) values($1)', [admin]);
    await identity(admin); let settings = await rpc('get_billing_settings'); settings.settings.mollie.expectedProfileId = 'pfl_financial';
    await rpc('save_billing_settings', [settings.revision, settings.settings]); settings = await rpc('get_billing_settings');
    credentialRevision = (await rpc('save_billing_credential', [settings.revision, 'mollie', 'test', 'test_SYNTHETICFinancialReviewOnly'])).credentialRevision;
    await service(); await rpc('record_billing_provider_test', [credentialRevision, { mode: 'test', profileId: 'pfl_financial', firstMethods: ['ideal'], recurringAvailable: true, callbackVerified: true, webhookVerified: true }]);
    await gate(true); await identity(admin); settings = await rpc('get_billing_settings'); await rpc('set_billing_gate', [settings.revision, 'mollieEnabled', true, false]);

    await t.test('an old invoice refund cannot remove a later paid period or replace its current provider segment', async () => {
      const { id, reservation } = await reserve();
      const older = mollieCalendarPeriod(new Date(Date.now() - 45 * 86400000).toISOString(), 'month');
      await rpc('apply_billing_provider_evidence', [evidence(reservation, { ...older, providerPaymentId: 'tr_financialOld' })]);
      const newer = mollieCalendarPeriod(new Date(Date.now() - 10 * 86400000).toISOString(), 'month');
      const oldMeta = { fabelpadContractId: reservation.id, fabelpadOperationId: randomUUID() }, newMeta = { fabelpadContractId: reservation.id, fabelpadOperationId: randomUUID() };
      await owner();
      for (const [providerId, metadata] of [['sub_financialOld', oldMeta], ['sub_financialNew', newMeta]]) await db.query('insert into private.billing_mollie_segments(provider_subscription_id,subscription_id,amount_cents,metadata,start_date) values($1,$2,$3,$4::jsonb,current_date)', [providerId, reservation.id, reservation.amountCents, JSON.stringify(metadata)]);
      await db.query('update private.billing_subscriptions set provider_subscription_id=$1 where id=$2', ['sub_financialNew', reservation.id]);
      await service(); await rpc('apply_billing_provider_evidence', [evidence(reservation, { ...newer, providerPaymentId: 'tr_financialNew', providerSubscriptionId: 'sub_financialNew' })]);
      await rpc('apply_billing_provider_evidence', [evidence(reservation, { ...older, providerPaymentId: 'tr_financialOldSegment', providerSubscriptionId: 'sub_financialOld', state: 'refunded', refundedCents: reservation.amountCents, autoRenew: false })]);
      await owner(); const contract = (await db.query('select state,paid_until,provider_subscription_id from private.billing_subscriptions where id=$1', [reservation.id])).rows[0];
      assert.equal(contract.state, 'active'); assert.equal(new Date(contract.paid_until).toISOString(), newer.periodEnd); assert.equal(contract.provider_subscription_id, 'sub_financialNew');
      const invoice = (await db.query('select refunded_cents from private.billing_payments where provider_payment_id=$1', ['tr_financialOldSegment'])).rows[0]; assert.equal(invoice.refunded_cents, reservation.amountCents);
      await identity(id); assert.equal((await rpc('get_billing_entitlement')).fullLibrary, true);
    });

    await t.test('phaseout while Checkout is open permanently stops that agreement from renewing after gates reopen', async () => {
      const { reservation } = await reserve(); await gate(false); await gate(true); await service();
      await rpc('apply_billing_provider_evidence', [evidence(reservation, { providerPaymentId: 'tr_financialPhaseout' })]);
      await owner(); const contract = (await db.query('select cancel_requested from private.billing_subscriptions where id=$1', [reservation.id])).rows[0]; assert.equal(contract.cancel_requested, true);
      assert.equal((await db.query("select count(*)::integer n from private.billing_jobs where subscription_id=$1 and kind='mollie_create_subscription'", [reservation.id])).rows[0].n, 0);
    });

    await t.test('an older verification cannot overwrite a later authoritative refund', async () => {
      const { reservation } = await reserve(); const initial = evidence(reservation, { providerPaymentId: 'tr_financialOrder', verifiedAt: new Date(Date.now() - 3000).toISOString() });
      await rpc('apply_billing_provider_evidence', [initial]);
      await rpc('apply_billing_provider_evidence', [{ ...initial, eventId: randomUUID(), state: 'refunded', refundedCents: reservation.amountCents, verifiedAt: new Date(Date.now() - 1000).toISOString() }]);
      const stale = await rpc('apply_billing_provider_evidence', [{ ...initial, eventId: randomUUID(), verifiedAt: new Date(Date.now() - 2000).toISOString() }]); assert.equal(stale.stale, true);
      await owner(); assert.equal((await db.query('select state from private.billing_subscriptions where id=$1', [reservation.id])).rows[0].state, 'refunded');
    });

    await t.test('an authoritative chargeback reversal restores the paid period even when its original paid fingerprint repeats', async () => {
      const { id, reservation } = await reserve(); const paid = evidence(reservation, { eventId: 'mollie:tr_financialReversal:paid:0:0', providerPaymentId: 'tr_financialReversal', chargedBackCents: 0, verifiedAt: new Date(Date.now() - 3000).toISOString() });
      await rpc('apply_billing_provider_evidence', [paid]);
      await rpc('apply_billing_provider_evidence', [{ ...paid, eventId: 'mollie:tr_financialReversal:paid:0:499', state: 'revoked', chargedBackCents: reservation.amountCents, autoRenew: false, verifiedAt: new Date(Date.now() - 2000).toISOString() }]);
      const restored = await rpc('apply_billing_provider_evidence', [{ ...paid, verifiedAt: new Date(Date.now() - 1000).toISOString() }]); assert.equal(restored.applied, true);
      await owner(); const current = (await db.query('select state,charged_back_cents from private.billing_subscriptions where id=$1', [reservation.id])).rows[0]; assert.equal(current.state, 'active'); assert.equal(current.charged_back_cents, 0);
      await identity(id); assert.equal((await rpc('get_billing_entitlement')).fullLibrary, true);
    });

    await t.test('rotating credentials retains the exact older key for existing obligations', async () => {
      await identity(admin); const current = await rpc('get_billing_settings'); const next = await rpc('save_billing_credential', [current.revision, 'mollie', 'test', 'test_SYNTHETICFinancialRotatedOnly']);
      assert.notEqual(next.credentialRevision, credentialRevision); await service();
      const old = await rpc('get_billing_provider_config', ['mollie', null, credentialRevision]); assert.equal(old.revision, credentialRevision); assert.equal(old.apiKey, 'test_SYNTHETICFinancialReviewOnly');
    });
  } finally { await db.close(); }
});
