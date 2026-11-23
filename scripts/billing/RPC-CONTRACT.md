# Billing RPC contract (2026-11-23)

The shared TypeScript DTOs live in `lib/billing/types.ts`. Settings schema/version 1 and canonical defaults live in `lib/billing/settings.ts`; all four persisted gates start disabled. Staging and production resolve to their own installation environment and Vault records. No hosted migration or provider mutation is performed by these local checks.

All exposed billing wrappers use `SECURITY INVOKER` with an empty search path. They call narrowly granted private functions; private tables and internal helpers are inaccessible to API roles. Parent identity, actual session freshness and database administrator membership are checked in the private layer. Secret reads, provider evidence and durable worker operations are service-only. Ordinary parents can never grant themselves rights through metadata.

## Settings and administration

`get_billing_settings()` returns `{revision,settings,gates,founders,credentials}`. `gates` contains `paymentRequired`, `foundersEnabled`, `mollieEnabled`, `playEnabled`, each with `{configured,effective,reason}`. `configured` is the administrator's persisted switch. `credentials` contains revision/mode/verification metadata, never raw keys. Read-only administration does not require reauthentication; configuration, credential, coupon and publishing mutations do.

Every settings mutation supplies `p_expected_revision`. A stale write returns `{saved:false,revision,...}`; a successful mutation increments revision and records an audit event. Saving settings never implicitly changes a gate. Provider config changes create an unverified candidate using the existing Vault secret when the key is left unchanged. Saving a replacement key creates a separate immutable candidate; the last verified active key remains selected until a successful provider test promotes the candidate. Existing financial obligations retain the exact old credential/config revision.

`set_billing_coupon_enabled` pauses or resumes new uses of an existing batch. It does not rewrite frozen quotes, paid discounts or already granted gifts. `maximumRedemptions` limits each code in the batch; batch `redeemed` is a combined statistic. An active hold counts against the per-code limit until it succeeds or is released. A family uses one code from a batch once; coupons do not stack.

## Public offer, quotes and checkout consent

`get_billing_public_offer()` returns `{revision,environment,offerVersion,termsVersion,privacyVersion,prices,paymentRequired,gates,founders,mollie,play}`. Founders includes `effective,maximum,awarded,remaining,durationMonths,startsAt,status`; Mollie includes its gate decision; Play adds frozen package/product/base-plan identifiers without RTDN configuration or secrets.

`quote_billing_purchase(period,code?)` returns `{period,baseAmountCents,amountCents,discountCents,couponId,couponDurationMonths,amountBasis,offerVersion,termsVersion,settingsRevision,gift,renewalAmountCents,discountEndsAt,couponSnapshot}`. It does not reserve stock or redeem a code. Fixed amount basis `period` applies once per selected payment; basis `month` covers at most twelve agreed months for an annual charge. An annual percentage below 100% covers `min(12,durationMonths)` out of twelve months, rounded half up to integer cents. A 100% percentage is always a calendar gift for the configured duration, independent of interval, with zero renewal amount. Null duration means unlimited. Amounts never become negative.

`reserve_billing_purchase(provider,period,requestId,expectedRevision,expectedAmountCents,termsVersion,acceptRecurring,code?)` validates the exact quote under the shared purchase/configuration lock. A changed revision/amount/terms fails with SQLSTATE `40001`. A positive purchase requires explicit recurring consent. A zero-price gift grants the frozen entitlement without a customer, mandate, subscription, provider job or automatic conversion; it returns `{gift:true,entitlement}`. Preview reads never consume a gift.

A paid reservation returns `PurchaseReservation`, including `id/reservationId,parentId,provider,period,amountCents,baseAmountCents,currency,settingsRevision,credentialRevision,environment,mode,expiresAt,status,idempotencyKey,obfuscatedAccountId,productId,basePlanId,checkoutUrl,quote`. Play's account identifier is SHA-256 of `fabelpad:` plus the actual parent UUID. A master-off period permanently marks outstanding checkouts for phaseout; reenabling gates cannot restart that agreement. Checkout URLs are masked after phaseout or when its sales gate is ineffective.

Providers call `recheck_billing_purchase` immediately before an external start. It checks current gates, parent lifecycle and the exact frozen reservation. A single shared reservation and active-contract check covers Mollie and Play. Staging-only fresh-admin Play trials and test-only Mollie trials are explicit separate paths and never alter the sales gates.

## Entitlements and content

`get_billing_entitlement()` returns `{plan,fullLibrary,paymentRequired,validUntil,source,activePaidContract,preview:{fullStoryId,chapterOneStoryIds},maxChildren:5}`. Full story selection persists once; a replacement is allowed only if the selected story becomes unavailable. Two chapter-one previews stay stable. Founders stock is atomically granted only at a new verified parent's first completed onboarding, never on reacceptance, replay or account deletion. Deleted awards never restock the campaign.

The thirteen historic Android bundled stories remain available in the existing local offline edition. Online catalog content follows the same Ontdek/paid entitlement rules; a historic-public marker never bypasses online authorization.

`get_billing_content_release(storyId,version?)` returns `{story_id,content_version,published_at,payload,access:'full'|'preview'|'locked'}`. A preview includes only the first scene, no endings and `parts:1`; locked payload is null. Catalog access returns metadata only. New premium payloads and download paths remain in private tables. `publish_billing_premium_content` checks canonical scene/choice/ending/reading-level shape and immutable content hash directly in the database, including direct RPC calls. Families store only bounded validated IDs/progress, never premium text.

## Durable provider work

`claim_billing_jobs(limit)` returns `BillingJob[]` with immutable idempotency key, exact credential/settings/environment/mode, firstAttemptAt and leaseToken. Jobs use `SKIP LOCKED`; completion and failure require the live lease. All gates may be disabled while cancellation, verification, refund and lifecycle jobs continue. An uncertain provider mutation requires provider reconciliation; it is never blindly retried beyond the provider idempotency window.

`record_billing_provider_event` queues verification only. It deduplicates canonical signal payloads independently of the local receivedAt timestamp. `apply_billing_provider_evidence` accepts only verified, exactly bound evidence with fresh authoritative query time. A token cannot transfer to another family. Service-only token binding reads can identify financial tombstones after deletion without recreating family records. Raw Play tokens remain in Vault and are decrypted only for claimed service work. Acknowledgement is separately durable.

Mollie contexts freeze the exact payment/price segment/metadata. Separate refund intents cannot jointly exceed the remaining paid amount. Confirmed refunds store the official cumulative `paymentRefundedCents` using `greatest`, never addition, so webhook/worker races cannot double count. Pending refunds retain their refundId and reschedule status reads. Late refunds for an old period preserve newer paid rights. Reversal of a chargeback can restore an earlier paid snapshot because deduplication compares the latest subscription evidence rather than permanently discarding every prior fingerprint.

Cancellation records requested/confirmed separately. A subscription creation returning after a stop becomes a new durable cancellation obligation, even when an earlier absence check had already confirmed no subscription. Reenabling gates never resumes cancelled contracts. Annual renewals after the initial fixed term use the statutory one-month notice cap and prorata Mollie refund; Play actions that need Console confirmation remain visible as attention jobs.

`get_billing_email_context` obtains the authorized recipient and immutable safe message data. `freeze_billing_email` freezes exact rendered provider bytes. Account stops scrub/cancel undeliverable messages. Expired or confirmed public-withdrawal tokens/recipient Vault secrets are cleaned in bounded batches; old completed mail payloads are scrubbed separately. Minimal financial records remain available for outstanding obligations.

## Public withdrawal

`request_billing_withdrawal(email,reference,requestId)` always returns `{received:true}` for a syntactically valid request, including nonmatches. It accepts the verified buyer's email and a payment reference, calculates any refundable amount on the server and sends an opaque confirmation token. The email link uses `/herroepen#token=<opaque>` so the token is absent from server query logs. After the 24-hour verification period, a new form submission can rotate the nonce within the original fourteen-day payment window; the original request date is retained.

`confirm_billing_withdrawal(token)` verifies expiry/hash under lock, records one request, queues actual provider cancellation/refund and is idempotent. It requires no logged-in account and never accepts an arbitrary client amount. Raw tokens and recipients are short-lived Vault data.

## Production Play sandbox readiness

The additive migration `20261123123231_billing_play_sandbox_readiness_proof.sql` closes the live-credential readiness cycle without recording a paid production purchase. `prepare_billing_play_license_proof(p_credential_revision)` requires the actual fresh administrator and a current verified production/live product configuration. It creates a five-minute ticket and returns only its ID, frozen product IDs, price, obfuscated administrator account ID and revision metadata. No account entitlement or payment reservation is created.

Service-only `get_billing_play_license_proof(p_proof_id)` returns `{id,parentId,credentialRevision,settingsRevision,environment,mode,expiresAt,obfuscatedAccountId,settings,termsVersion,prices}`. The gateway must compare `parentId` to the authenticated fresh administrator before querying Google. Its credential config uses the frozen `settings`. The service-only record call accepts `{sandbox:true,acknowledged:true,ownerBinding,tokenHash,packageName,productId,basePlanId,period,amountCents,currency:'EUR',verifiedAt}` after authoritative Google verification and acknowledgement readback. Raw purchase tokens are rejected by the persistence contract.

`record_billing_play_license_proof(p_proof_id,p_proof)` consumes the ticket against the exact current credential/settings, account binding and product price. It updates server-verification readiness and an audit record only; it never creates a subscription, entitlement, payment or normal purchase reservation. Production's own authenticated RTDN proof remains independently required. A real paid production receipt is forbidden on this route.

Changing only app prices creates an unverified Play credential candidate retaining the same Vault reference, closes effective sales readiness and requires a new product/license proof. Old immutable credentials remain available for existing obligations. Direct Play reservations reject nonzero app coupon offers; a forged expected zero is still rejected by the locked quote. A fully free gift creates no Google purchase and remains idempotent.

## Exact SQL signatures

All named parameters below are the PostgREST argument names. Role grants are declared alongside each wrapper in the migration.

- `authorize_billing_admin(p_fresh boolean default true) → jsonb`
- `prepare_billing_play_license_proof(p_credential_revision bigint) → jsonb`
- `get_billing_play_license_proof(p_proof_id uuid) → jsonb`
- `record_billing_play_license_proof(p_proof_id uuid,p_proof jsonb) → jsonb`
- `get_billing_settings() → jsonb`
- `save_billing_settings(p_expected_revision bigint,p_settings jsonb) → jsonb`
- `set_billing_gate(p_expected_revision bigint,p_gate text,p_enabled boolean,p_confirm_phaseout boolean default false) → jsonb`
- `billing_phaseout_impact() → jsonb`
- `save_billing_credential(p_expected_revision bigint,p_provider text,p_mode text,p_secret text) → jsonb`
- `delete_billing_credential(p_expected_revision bigint,p_credential_revision bigint) → jsonb`
- `get_billing_entitlement() → jsonb`
- `choose_billing_free_story(p_story_id text) → jsonb`
- `quote_billing_purchase(p_period text,p_coupon_code text default null) → jsonb`
- `reserve_billing_purchase(p_provider text,p_period text,p_request_id uuid,p_expected_revision bigint,p_expected_amount_cents integer,p_terms_version text,p_accept_recurring boolean,p_coupon_code text default null) → jsonb`
- `get_billing_purchase(p_reservation_id uuid) → jsonb`
- `cancel_billing_subscription(p_subscription_id uuid,p_request_id uuid) → jsonb`
- `save_billing_coupon_batch(p_expected_revision bigint,p_coupon jsonb) → jsonb`
- `set_billing_coupon_enabled(p_expected_revision bigint,p_batch_id uuid,p_enabled boolean) → jsonb`
- `list_billing_coupons() → jsonb`
- `list_billing_subscriptions() → jsonb`
- `list_billing_operations() → jsonb`
- `prepare_billing_mollie_trial(p_credential_revision bigint,p_request_id uuid) → jsonb`
- `reserve_billing_play_trial(p_period text,p_request_id uuid) → jsonb`
- `publish_billing_premium_content(p_story_id text,p_content_version text,p_metadata jsonb,p_payload jsonb,p_download_path text default null) → jsonb`
- `get_billing_public_offer() → jsonb`
- `get_billing_content_release(p_story_id text,p_content_version text default null) → jsonb`
- `request_billing_withdrawal(p_email text,p_reference text,p_request_id uuid) → jsonb`
- `confirm_billing_withdrawal(p_token text) → jsonb`
- `get_billing_provider_config(p_provider text,p_mode text,p_credential_revision bigint default null) → jsonb`
- `record_billing_provider_test(p_credential_revision bigint,p_result jsonb) → jsonb`
- `claim_billing_jobs(p_limit integer default 20) → jsonb`
- `complete_billing_job(p_job_id uuid,p_lease_token uuid,p_result jsonb) → jsonb`
- `fail_billing_job(p_job_id uuid,p_lease_token uuid,p_error_code text,p_uncertain boolean default false) → jsonb`
- `record_billing_provider_event(p_provider text,p_event_id text,p_payload jsonb) → jsonb`
- `apply_billing_provider_evidence(p_evidence jsonb) → jsonb`
- `recheck_billing_purchase(p_reservation_id uuid) → jsonb`
- `prepare_billing_jobs() → jsonb`
- `request_billing_refund(p_payment_id uuid,p_request_id uuid,p_amount_cents integer,p_reason text) → jsonb`
- `get_billing_play_binding(p_purchase_token_hash text,p_obfuscated_account_id text default null) → jsonb`
- `get_billing_play_reservation(p_reservation_id uuid,p_parent_id uuid) → jsonb`
- `get_billing_mollie_binding(p_payment_id text,p_provider_subscription_id text default null,p_reservation_id uuid default null) → jsonb`
- `get_billing_mollie_job_context(p_job_id uuid,p_lease_token uuid) → jsonb`
- `record_billing_mollie_customer(p_job_id uuid,p_lease_token uuid,p_customer_id text) → boolean`
- `recheck_billing_renewal(p_job_id uuid,p_lease_token uuid) → boolean`
- `get_billing_email_context(p_job_id uuid,p_lease_token uuid) → jsonb`
- `freeze_billing_email(p_job_id uuid,p_lease_token uuid,p_delivery jsonb) → jsonb`
- `get_billing_mollie_trial(p_trial_id uuid default null,p_payment_id text default null) → jsonb`
- `record_billing_mollie_trial(p_trial_id uuid,p_result jsonb) → jsonb`
- `claim_billing_withdrawal(p_withdrawal_id uuid) → jsonb`

## Local verification

- `pnpm check:billing`: domain/provider/API/worker tests, actual fresh and upgrade SQL scenarios, legal-version migration checks.
- `node scripts/billing/concurrency-check.mjs`: isolated actual PostgreSQL multi-session stock 49/50/51, duplicate onboarding, deleted-place retention and admin CAS. Its temporary container is removed in `finally`; it never contacts hosted Supabase.

The PGlite fixture follows all repository migrations and replaces only unavailable platform/Vault/cron boundaries. It does not claim to test Vault encryption. Actual financial provider API reads and Android/Play publishing remain external deployment verification steps.
