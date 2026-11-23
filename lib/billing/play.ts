import type { BillingMode, BillingPeriod, BillingProviderEvidence, BillingSettings } from './types.ts';

type Json = Record<string, unknown>;
type Fetcher = typeof fetch;
export type GoogleAccessToken = () => Promise<string>;
export class PlayError extends Error {
  constructor(readonly code: string, readonly retryable = false, readonly uncertain = false) { super(code); }
}
const record = (value: unknown): value is Json => !!value && typeof value === 'object' && !Array.isArray(value);
const field = (value: unknown, max = 512): string | undefined => typeof value === 'string' && value.length > 0 && value.length <= max && !/[\u0000-\u001f]/u.test(value) ? value : undefined;
const identifier = (value: unknown): string => { if (!field(value, 200) || !/^[a-zA-Z0-9._-]+$/u.test(value as string)) throw new PlayError('invalid_play_identifier'); return value as string; };
const timestamp = (value: unknown): string | undefined => typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : undefined;
const bytes = (value: string) => new TextEncoder().encode(value);
export async function playDigest(value: string): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes(value))), part => part.toString(16).padStart(2, '0')).join('');
}
/** An opaque family binding; no e-mail, child name or Google identity goes to Play. */
export function playAccountId(parentId: string): Promise<string> {
  if (!/^[0-9a-f-]{36}$/iu.test(parentId)) throw new PlayError('invalid_parent_id');
  return playDigest(`fabelpad:${parentId}`);
}
export function validPlayPurchaseToken(token: unknown): token is string {
  return typeof token === 'string' && token.length >= 10 && token.length <= 4096 && /^[A-Za-z0-9._~+\/-]+={0,2}$/u.test(token);
}
async function jsonResponse(response: Response): Promise<unknown> {
  if (Number(response.headers.get('content-length')) > 256 * 1024) throw new PlayError('play_response_too_large');
  const reader = response.body?.getReader(); if (!reader) return {};
  let size = 0, raw = ''; const decoder = new TextDecoder();
  try {
    while (true) { const item = await reader.read(); if (item.done) break; size += item.value.byteLength; if (size > 256 * 1024) throw new PlayError('play_response_too_large'); raw += decoder.decode(item.value, { stream: true }); }
    const text = raw + decoder.decode(); return text ? JSON.parse(text) as unknown : {};
  } catch (error) { if (error instanceof PlayError) throw error; throw new PlayError('invalid_play_response'); }
  finally { await reader.cancel().catch(() => {}); }
}

/** Keyless WIF: the deployment supplies a short-lived platform OIDC token source.
 * No JSON private key, refresh token or permanent Google credential is accepted.
 */
export function createPlayWorkloadIdentityToken(options: {
  audience: string; serviceAccount: string; subjectToken: () => Promise<string>; fetcher?: Fetcher; now?: () => number;
}): GoogleAccessToken {
  if (!/^\/\/iam\.googleapis\.com\/projects\/[0-9]+\/locations\/global\/workloadIdentityPools\/[a-z0-9-]+\/providers\/[a-z0-9-]+$/u.test(options.audience)
    || !/^[a-z0-9-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com$/u.test(options.serviceAccount)) throw new PlayError('invalid_play_workload_identity');
  const fetcher = options.fetcher ?? fetch, now = options.now ?? Date.now;
  let cached: { token: string; until: number } | undefined, running: Promise<string> | undefined;
  return async () => {
    if (cached && cached.until > now() + 90_000) return cached.token;
    if (running) return running;
    running = (async () => {
      const subjectToken = await options.subjectToken();
      if (!field(subjectToken, 16_384) || subjectToken.split('.').length !== 3) throw new PlayError('play_workload_identity_unavailable');
      const exchange = await fetcher('https://sts.googleapis.com/v1/token', { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15_000), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        audience: options.audience, grantType: 'urn:ietf:params:oauth:grant-type:token-exchange', requestedTokenType: 'urn:ietf:params:oauth:token-type:access_token',
        scope: 'https://www.googleapis.com/auth/cloud-platform', subjectTokenType: 'urn:ietf:params:oauth:token-type:jwt', subjectToken,
      }) });
      if (!exchange.ok) { await exchange.body?.cancel(); throw new PlayError('play_workload_identity_exchange_failed', exchange.status >= 500); }
      const federated = await jsonResponse(exchange);
      if (!record(federated) || !field(federated.access_token, 16_384)) throw new PlayError('play_workload_identity_exchange_failed');
      const impersonation = await fetcher(`https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(options.serviceAccount)}:generateAccessToken`, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15_000), headers: { Authorization: `Bearer ${federated.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: ['https://www.googleapis.com/auth/androidpublisher'], lifetime: '3600s' }),
      });
      if (!impersonation.ok) { await impersonation.body?.cancel(); throw new PlayError('play_workload_identity_impersonation_failed', impersonation.status >= 500); }
      const result = await jsonResponse(impersonation);
      if (!record(result) || !field(result.accessToken, 16_384) || !timestamp(result.expireTime)) throw new PlayError('play_workload_identity_impersonation_failed');
      cached = { token: result.accessToken as string, until: Math.min(Date.parse(result.expireTime as string), now() + 3_600_000) };
      return cached.token;
    })();
    try { return await running; } finally { running = undefined; }
  };
}

/** Vault-only fallback for an existing service-account key. The caller reads
 * the encrypted secret server-side; this helper never creates or exports keys.
 * External-account credentials require a trusted, refreshable runtime source.
 */
export function createPlayCredentialAccessToken(secret: string, options: { fetcher?: Fetcher; now?: () => number; subjectToken?: () => Promise<string> } = {}): GoogleAccessToken {
  let credential: unknown;
  try { credential = JSON.parse(secret); } catch { throw new PlayError('invalid_play_server_credential'); }
  if (!record(credential)) throw new PlayError('invalid_play_server_credential');
  if (credential.type === 'external_account') {
    const url = String(credential.service_account_impersonation_url ?? '');
    const serviceAccount = /^https:\/\/iamcredentials\.googleapis\.com\/v1\/projects\/-\/serviceAccounts\/([^/]+):generateAccessToken$/u.exec(url)?.[1];
    if (!serviceAccount || !options.subjectToken || credential.token_url !== 'https://sts.googleapis.com/v1/token' || credential.subject_token_type !== 'urn:ietf:params:oauth:token-type:jwt') throw new PlayError('play_workload_identity_source_unavailable');
    return createPlayWorkloadIdentityToken({ audience: String(credential.audience), serviceAccount: decodeURIComponent(serviceAccount), subjectToken: options.subjectToken, fetcher: options.fetcher, now: options.now });
  }
  const validPem = typeof credential.private_key === 'string' && credential.private_key.length <= 16_384
    && /^-----BEGIN PRIVATE KEY-----\r?\n(?:[A-Za-z0-9+/]{1,76}={0,2}\r?\n)+-----END PRIVATE KEY-----\r?\n?$/u.test(credential.private_key);
  if (credential.type !== 'service_account' || !field(credential.client_email, 200) || !/^[a-z0-9-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com$/u.test(credential.client_email as string)
    || !validPem || credential.token_uri !== 'https://oauth2.googleapis.com/token') throw new PlayError('invalid_play_server_credential');
  const service = { email: credential.client_email as string, key: credential.private_key as string }, now = options.now ?? Date.now, fetcher = options.fetcher ?? fetch;
  let cached: { token: string; until: number } | undefined;
  const base64url = (data: Uint8Array) => btoa(Array.from(data, value => String.fromCharCode(value)).join('')).replace(/=/gu, '').replace(/\+/gu, '-').replace(/\//gu, '_');
  return async () => {
    if (cached && cached.until > now() + 90_000) return cached.token;
    try {
      const pem = service.key.replace('-----BEGIN PRIVATE KEY-----', '').replace('-----END PRIVATE KEY-----', '').replace(/\s/gu, '');
      if (!/^[A-Za-z0-9+/]+=*$/u.test(pem)) throw new PlayError('invalid_play_server_credential');
      const key = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), value => value.charCodeAt(0)), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
      const issued = Math.floor(now() / 1000), header = base64url(bytes(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
      const payload = base64url(bytes(JSON.stringify({ iss: service.email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: 'https://oauth2.googleapis.com/token', iat: issued, exp: issued + 3_600 })));
      const signature = base64url(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, bytes(`${header}.${payload}`))));
      const response = await fetcher('https://oauth2.googleapis.com/token', { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15_000), headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${payload}.${signature}` }),
      });
      if (!response.ok) { await response.body?.cancel(); throw new PlayError('play_server_authentication_failed', response.status >= 500); }
      const result = await jsonResponse(response);
      if (!record(result) || !field(result.access_token, 16_384) || typeof result.expires_in !== 'number' || result.expires_in < 60) throw new PlayError('play_server_authentication_failed');
      cached = { token: result.access_token as string, until: now() + Math.min(result.expires_in, 3_600) * 1000 };
      return cached.token;
    } catch (error) { if (error instanceof PlayError) throw error; throw new PlayError('play_server_authentication_failed'); }
  };
}

export function createPlayClient(accessToken: GoogleAccessToken, fetcher: Fetcher = fetch) {
  async function request(path: string, body?: unknown): Promise<unknown> {
    let response: Response;
    try { response = await fetcher(`https://androidpublisher.googleapis.com/androidpublisher/v3/${path}`, {
      method: body === undefined ? 'GET' : 'POST', redirect: 'error', signal: AbortSignal.timeout(20_000),
      headers: { Authorization: `Bearer ${await accessToken()}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }); } catch (error) { if (error instanceof PlayError) throw error; throw new PlayError('play_unavailable', true, body !== undefined); }
    if (!response.ok) {
      await response.body?.cancel();
      throw new PlayError(response.status === 401 || response.status === 403 ? 'play_permission_denied' : response.status === 404 || response.status === 410 ? 'play_purchase_unavailable' : 'play_api_failed', response.status === 429 || response.status >= 500, body !== undefined && response.status >= 500);
    }
    return jsonResponse(response);
  }
  const tokenPath = (packageName: string, token: string) => {
    if (packageName !== 'nl.fabelpad.app' || !validPlayPurchaseToken(token)) throw new PlayError('invalid_play_purchase');
    return `applications/${packageName}/purchases/subscriptionsv2/tokens/${encodeURIComponent(token)}`;
  };
  return {
    getSubscription(packageName: string, token: string) { return request(tokenPath(packageName, token)); },
    acknowledge(packageName: string, productId: string, token: string) {
      tokenPath(packageName, token);
      return request(`applications/${packageName}/purchases/subscriptions/${identifier(productId)}/tokens/${encodeURIComponent(token)}:acknowledge`, {});
    },
    cancel(packageName: string, token: string, developerStop = false) {
      return request(`${tokenPath(packageName, token)}:cancel`, { cancellationContext: { cancellationType: developerStop ? 'DEVELOPER_REQUESTED_STOP_PAYMENTS' : 'USER_REQUESTED_STOP_RENEWALS' } });
    },
    revoke(packageName: string, token: string, refund: 'full' | 'prorated') {
      return request(`${tokenPath(packageName, token)}:revoke`, { revocationContext: refund === 'full' ? { fullRefund: {} } : { proratedRefund: {} } });
    },
    getProduct(packageName: string, productId: string) {
      if (packageName !== 'nl.fabelpad.app') throw new PlayError('invalid_play_package');
      return request(`applications/${packageName}/subscriptions/${identifier(productId)}`);
    },
    deactivateBasePlan(packageName: string, productId: string, basePlanId: string) {
      if (packageName !== 'nl.fabelpad.app') throw new PlayError('invalid_play_package');
      return request(`applications/${packageName}/subscriptions/${identifier(productId)}/basePlans/${identifier(basePlanId)}:deactivate`, {});
    },
  };
}
export type PlayClient = ReturnType<typeof createPlayClient>;
export type VerifiedPlayPurchase = Omit<BillingProviderEvidence, 'environment' | 'credentialRevision' | 'eventId'> & {
  tokenHash: string; obfuscatedAccountId: string; linkedTokenHash?: string; productId: string; basePlanId: string;
  period: BillingPeriod; acknowledged: boolean; latestOrderId?: string;
};
/** Only an authoritative subscriptionsv2 response may enter this function. */
export async function verifyPlaySubscription(value: unknown, options: {
  settings: BillingSettings['play']; token: string; mode: BillingMode; expectedAccountId?: string; knownLinkedAccountId?: string; now?: number;
}): Promise<VerifiedPlayPurchase> {
  if (!record(value) || !validPlayPurchaseToken(options.token) || !Array.isArray(value.lineItems) || !value.lineItems.length || value.lineItems.length > 20) throw new PlayError('invalid_play_purchase');
  const test = record(value.testPurchase);
  if ((options.mode === 'test') !== test) throw new PlayError('play_purchase_mode_mismatch');
  const external = record(value.externalAccountIdentifiers) ? value.externalAccountIdentifiers : {};
  const accountId = field(external.obfuscatedExternalAccountId, 64) ?? options.knownLinkedAccountId;
  if (!accountId || !/^[a-f0-9]{64}$/u.test(accountId) || options.expectedAccountId && options.expectedAccountId !== accountId) throw new PlayError('play_purchase_owner_mismatch');
  const pending = value.subscriptionState === 'SUBSCRIPTION_STATE_PENDING' || value.subscriptionState === 'SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED';
  const recognized = value.lineItems.filter(record).map(item => {
    const offer = record(item.offerDetails) ? item.offerDetails : {};
    const period: BillingPeriod | undefined = item.productId === options.settings.monthlyProductId && offer.basePlanId === options.settings.monthlyBasePlanId ? 'month'
      : item.productId === options.settings.yearlyProductId && offer.basePlanId === options.settings.yearlyBasePlanId ? 'year' : undefined;
    return { item, period, end: timestamp(item.expiryTime), basePlanId: field(offer.basePlanId) };
  }).filter(item => item.period && (item.end || pending)).sort((a, b) => Date.parse(b.end ?? '1970-01-01') - Date.parse(a.end ?? '1970-01-01'));
  // Add-on/multi-product purchases are never silently accepted as Fabelpad Gezin.
  if (recognized.length !== value.lineItems.length || !recognized.length) throw new PlayError('play_product_mismatch');
  const { item, period, end, basePlanId } = recognized[0];
  const states: Record<string, BillingProviderEvidence['state']> = {
    SUBSCRIPTION_STATE_PENDING: 'pending', SUBSCRIPTION_STATE_ACTIVE: 'active', SUBSCRIPTION_STATE_IN_GRACE_PERIOD: 'grace',
    SUBSCRIPTION_STATE_ON_HOLD: 'hold', SUBSCRIPTION_STATE_PAUSED: 'hold', SUBSCRIPTION_STATE_CANCELED: 'cancelled',
    SUBSCRIPTION_STATE_EXPIRED: 'expired', SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED: 'failed',
  };
  let state = states[String(value.subscriptionState)]; if (!state) throw new PlayError('unknown_play_subscription_state');
  const now = options.now ?? Date.now();
  if (['active', 'grace', 'cancelled'].includes(state) && Date.parse(end!) <= now) state = 'expired';
  const acknowledged = value.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED';
  if (!acknowledged && value.acknowledgementState !== 'ACKNOWLEDGEMENT_STATE_PENDING') throw new PlayError('invalid_play_acknowledgement_state');
  const renewal = record(item.autoRenewingPlan) ? item.autoRenewingPlan : undefined;
  const price = renewal && record(renewal.recurringPrice) ? renewal.recurringPrice : undefined;
  let amountCents: number | undefined;
  if (price) {
    if (price.currencyCode !== 'EUR' || !/^-?\d+$/u.test(String(price.units ?? '0')) || !Number.isInteger(price.nanos ?? 0)) throw new PlayError('play_currency_mismatch');
    const total = Number(price.units ?? 0) * 100 + Number(price.nanos ?? 0) / 10_000_000;
    if (!Number.isSafeInteger(total) || total < 0) throw new PlayError('invalid_play_price'); amountCents = total;
  }
  const linkedToken = field(value.linkedPurchaseToken, 4096);
  return {
    provider: 'play', mode: options.mode, purchaseToken: options.token, tokenHash: await playDigest(options.token), obfuscatedAccountId: accountId,
    ...(linkedToken && validPlayPurchaseToken(linkedToken) ? { linkedTokenHash: await playDigest(linkedToken) } : {}),
    productId: item.productId as string, basePlanId: basePlanId!, period: period!, state,
    ...(timestamp(value.startTime) ? { periodStart: timestamp(value.startTime) } : {}), periodEnd: end,
    autoRenew: renewal?.autoRenewEnabled === true, acknowledged, acknowledgementRequired: !acknowledged && ['active', 'grace', 'cancelled'].includes(state),
    ...(amountCents === undefined ? {} : { amountCents, currency: 'EUR' }),
    ...(field(item.latestSuccessfulOrderId ?? value.latestOrderId, 200) ? { latestOrderId: (item.latestSuccessfulOrderId ?? value.latestOrderId) as string,
      providerPaymentId: (item.latestSuccessfulOrderId ?? value.latestOrderId) as string } : {}),
    verifiedAt: new Date(now).toISOString(),
  };
}

export function verifyPlayProduct(value: unknown, productId: string, basePlanId: string, period: BillingPeriod) {
  if (!record(value) || value.packageName !== 'nl.fabelpad.app' || value.productId !== productId || !Array.isArray(value.basePlans)) throw new PlayError('play_product_mismatch');
  const plan = value.basePlans.find(item => record(item) && item.basePlanId === basePlanId);
  if (!record(plan) || !record(plan.autoRenewingBasePlanType) || plan.autoRenewingBasePlanType.billingPeriodDuration !== (period === 'month' ? 'P1M' : 'P1Y') || plan.autoRenewingBasePlanType.installmentsInfo) throw new PlayError('play_base_plan_mismatch');
  const regions = Array.isArray(plan.regionalConfigs) ? plan.regionalConfigs.filter(record) : [];
  const region = regions.find(region => region.regionCode === 'NL' && (region.newSubscriberAvailability === true || plan.state === 'INACTIVE') && record(region.price) && region.price.currencyCode === 'EUR');
  if (!region || !record(region.price)) throw new PlayError('play_eur_region_unavailable');
  const amountCents = Number(region.price.units ?? 0) * 100 + Number(region.price.nanos ?? 0) / 10_000_000;
  if (!Number.isSafeInteger(amountCents) || amountCents < 0) throw new PlayError('invalid_play_price');
  return { productId, basePlanId, period, amountCents, salesStatus: plan.state === 'ACTIVE' ? 'active' as const : plan.state === 'INACTIVE' ? 'inactive' as const : 'unknown' as const };
}

/** Verifies Pub/Sub's Google-signed OIDC JWT locally using Google's public JWKS. */
export function createGooglePushVerifier(options: { audience: string; serviceAccount: string; subscription?: string; fetcher?: Fetcher; now?: () => number }) {
  if (!/^https:\/\//u.test(options.audience) || !/^[a-z0-9-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com$/u.test(options.serviceAccount)) throw new PlayError('invalid_play_push_configuration');
  const fetcher = options.fetcher ?? fetch, now = options.now ?? Date.now;
  let keys: Array<JsonWebKey & { kid?: string }> = [], until = 0;
  const decode = (value: string) => {
    if (!/^[A-Za-z0-9_-]+$/u.test(value)) throw new PlayError('invalid_play_push_token');
    try { return Uint8Array.from(atob(value.replace(/-/gu, '+').replace(/_/gu, '/')), part => part.charCodeAt(0)); } catch { throw new PlayError('invalid_play_push_token'); }
  };
  return async (authorization: string | null): Promise<void> => {
    if (!authorization?.startsWith('Bearer ') || authorization.length > 16_384) throw new PlayError('invalid_play_push_token');
    const jwt = authorization.slice(7).split('.'); if (jwt.length !== 3) throw new PlayError('invalid_play_push_token');
    let header: unknown, claims: unknown;
    try { header = JSON.parse(new TextDecoder().decode(decode(jwt[0]))); claims = JSON.parse(new TextDecoder().decode(decode(jwt[1]))); } catch { throw new PlayError('invalid_play_push_token'); }
    const seconds = now() / 1000;
    if (!record(header) || header.alg !== 'RS256' || !field(header.kid, 200) || !record(claims)
      || !['accounts.google.com', 'https://accounts.google.com'].includes(String(claims.iss)) || claims.aud !== options.audience
      || claims.email !== options.serviceAccount || claims.email_verified !== true || !/^[0-9]+$/u.test(String(claims.sub))
      || typeof claims.exp !== 'number' || claims.exp <= seconds - 30 || typeof claims.iat !== 'number' || claims.iat > seconds + 30
      || claims.iat < seconds - 3_660 || claims.exp - claims.iat > 3_660) throw new PlayError('invalid_play_push_token');
    if (until < now() || !keys.some(key => key.kid === header.kid)) {
      const response = await fetcher('https://www.googleapis.com/oauth2/v3/certs', { redirect: 'error', signal: AbortSignal.timeout(10_000) });
      if (!response.ok) { await response.body?.cancel(); throw new PlayError('play_push_keys_unavailable', true); }
      const result = await jsonResponse(response);
      if (!record(result) || !Array.isArray(result.keys) || result.keys.length > 10) throw new PlayError('play_push_keys_unavailable', true);
      keys = result.keys.filter(record) as Array<JsonWebKey & { kid?: string }>;
      const maxAge = Number(response.headers.get('cache-control')?.match(/max-age=(\d+)/u)?.[1] ?? 300);
      until = now() + Math.min(maxAge, 3_600) * 1000;
    }
    const key = keys.find(key => key.kid === header.kid && key.kty === 'RSA' && key.alg === 'RS256' && key.use === 'sig');
    if (!key) throw new PlayError('invalid_play_push_token');
    let valid = false;
    try { const publicKey = await crypto.subtle.importKey('jwk', key, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']); valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, decode(jwt[2]), bytes(`${jwt[0]}.${jwt[1]}`)); } catch { /* Invalid signatures never disclose parser/key details. */ }
    if (!valid) throw new PlayError('invalid_play_push_token');
  };
}

export function parsePlayNotification(value: unknown, options: { packageName: string; subscription?: string }) {
  if (!record(value) || options.subscription && value.subscription !== options.subscription || !record(value.message) || !field(value.message.messageId, 200) || !field(value.message.data, 24_000)) throw new PlayError('invalid_play_notification');
  let data: unknown;
  try { const raw = atob(value.message.data as string); if (raw.length > 16_384) throw new Error(); data = JSON.parse(new TextDecoder().decode(Uint8Array.from(raw, part => part.charCodeAt(0)))); } catch { throw new PlayError('invalid_play_notification'); }
  if (!record(data) || data.packageName !== options.packageName || !/^\d{10,16}$/u.test(String(data.eventTimeMillis))) throw new PlayError('invalid_play_notification');
  if (record(data.testNotification)) return { eventId: value.message.messageId as string, test: true as const, payload: { test: true } };
  const notification = record(data.subscriptionNotification) ? data.subscriptionNotification : record(data.voidedPurchaseNotification) ? data.voidedPurchaseNotification : null;
  if (!notification || !validPlayPurchaseToken(notification.purchaseToken)) throw new PlayError('invalid_play_notification');
  return { eventId: value.message.messageId as string, test: false as const, payload: { purchaseToken: notification.purchaseToken, notificationType: notification.notificationType ?? 'voided', eventTimeMillis: data.eventTimeMillis } };
}
