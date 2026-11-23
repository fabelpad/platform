/** Billing wire contract. Money is integer EUR cents; timestamps are UTC ISO8601. */
export type BillingEnvironment = 'staging' | 'production';
export type BillingMode = 'test' | 'live';
export type BillingProvider = 'mollie' | 'play';
export type BillingPeriod = 'month' | 'year';
export type BillingGate = 'paymentRequired' | 'foundersEnabled' | 'mollieEnabled' | 'playEnabled';
export interface BillingSettings {
  schemaVersion: 1;
  environment: BillingEnvironment;
  appOrigin: string;
  offerVersion: string;
  termsVersion: string;
  privacyVersion: string;
  prices: Record<BillingPeriod, { amountCents: number; currency: 'EUR'; enabled: boolean }>;
  founders: { maximum: number; durationMonths: number; startsAt: string | null; endsAt: string | null; campaignVersion: string };
  mollie: { mode: BillingMode; expectedProfileId: string; firstMethods: string[]; description: string };
  play: { packageName: 'nl.fabelpad.app'; monthlyProductId: string; monthlyBasePlanId: string; yearlyProductId: string; yearlyBasePlanId: string; rtdnAudience: string; rtdnServiceAccount: string; pubsubSubscription: string };
}
export interface GateDecision { configured: boolean; effective: boolean; reason: string }
export interface BillingSnapshot {
  revision: number; settings: BillingSettings; gates: Record<BillingGate, GateDecision>;
  founders: { awarded: number; remaining: number; maximum: number; durationMonths: number; startsAt: string | null; status: string };
  credentials: Array<{ provider: BillingProvider; mode: BillingMode; revision: number; configured: boolean; verified: boolean; active?: boolean; verification?: { mode?: string; profileId?: string; firstMethods?: string[]; recurringAvailable?: boolean; callbackVerified?: boolean; webhookVerified?: boolean; productsVerified?: boolean; rtdnVerified?: boolean; serverVerificationVerified?: boolean; salesStatus?: string }; verifiedAt: string | null }>;
}
export interface BillingEntitlement {
  plan: 'free' | 'family' | 'founders' | 'coupon'; fullLibrary: boolean; paymentRequired: boolean;
  validUntil: string | null; source: BillingProvider | 'founders' | 'coupon' | null;
  preview: { fullStoryId: string | null; chapterOneStoryIds: string[] };
  activePaidContract: boolean; maxChildren: 5;
}
export interface BillingCredential {
  revision: number; environment: BillingEnvironment; mode: BillingMode; provider: BillingProvider;
  apiKey: string; profileId: string; settingsRevision: number;
  config: BillingSettings; verification?: Record<string, unknown>;
}
export type BillingJobKind = 'mollie_first_payment' | 'mollie_create_subscription' | 'mollie_cancel' | 'mollie_refund' | 'mollie_reconcile' | 'play_verify' | 'play_acknowledge' | 'play_cancel' | 'play_revoke' | 'play_reconcile' | 'play_sales_pause' | 'send_billing_email';
export interface BillingJob {
  id: string; kind: BillingJobKind; provider: BillingProvider | null;
  idempotencyKey: string; firstAttemptAt: string | null; providerId: string | null;
  payload: Record<string, unknown>; settingsRevision: number; credentialRevision: number | null;
  environment: BillingEnvironment; mode: BillingMode; attempt: number; leaseToken: string;
}
export interface PurchaseReservation {
  id: string; parentId: string; provider: BillingProvider; period: BillingPeriod;
  amountCents: number; baseAmountCents: number; currency: 'EUR'; settingsRevision: number;
  credentialRevision: number; mode: BillingMode; environment: BillingEnvironment;
  offerVersion: string; termsVersion: string; expiresAt: string; status: string;
  idempotencyKey: string; couponId: string | null; productId?: string; basePlanId?: string; obfuscatedAccountId?: string;
}
export interface BillingCouponInput {
  name: string; codes: string[]; kind: 'percentage' | 'amount'; value: number; amountBasis: 'period' | 'month';
  durationMonths: number | null; validFrom: string | null; validUntil: string | null;
  maximumRedemptions: number | null; perFamilyLimit: 1; periods: BillingPeriod[]; enabled: boolean;
}
/** Service-only provider evidence: produced after authoritative API verification. Never client data. */
export interface BillingProviderEvidence {
  provider: BillingProvider; eventId: string; reservationId?: string; subscriptionId?: string;
  providerCustomerId?: string; providerPaymentId?: string; purchaseToken?: string;
  environment: BillingEnvironment; mode: BillingMode; credentialRevision: number;
  amountCents?: number; currency?: 'EUR'; profileId?: string;
  state: 'pending' | 'active' | 'grace' | 'hold' | 'cancelled' | 'expired' | 'refunded' | 'revoked' | 'failed';
  periodStart?: string; periodEnd?: string; autoRenew: boolean; verifiedAt: string;
  acknowledgementRequired?: boolean; mandateId?: string; refundAmountCents?: number;
  tokenHash?: string; obfuscatedAccountId?: string; linkedTokenHash?: string; productId?: string; basePlanId?: string; period?: BillingPeriod; acknowledged?: boolean; latestOrderId?: string;
}
