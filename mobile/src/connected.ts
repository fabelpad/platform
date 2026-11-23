import { requireOptionalNativeModule } from 'expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSecureSessionStorage } from './secureSessionStorage';
import type { Store } from './types';
import { ConnectedError, nativeFamilyImport } from './connected-contract';
export { nativeFamilyImport } from './connected-contract';
import { validateFamilySnapshot, type FamilySnapshot } from '../../lib/familyValidation';
import { mergeConnectedProgress, type ConnectedProgressDraft } from './connected-progress';
import type { BillingEntitlement, BillingPeriod, PurchaseReservation } from '../../lib/billing/types';
import type { ParentAccountStatus } from '../../lib/parentAccount';
import { validateHostedEmailTarget } from '../../lib/email/hosted-target';

export type PlayOffer = { productId: string; basePlanId: string; offerToken: string; formattedPrice: string; currency: string; priceAmountMicros: string; billingPeriod: string };
type NativePurchase = { purchaseToken: string; productIds: string[]; state: 'pending' | 'purchased'; acknowledged: boolean };
type NativeBilling = {
  connected: boolean; backendOrigin: string; environment: string; deleteAccountUrl: string; supabaseUrl: string; supabaseKey: string;
  products(productIds: string[]): Promise<PlayOffer[]>;
  purchase(productId: string, basePlanId: string, accountId: string, offerToken: string): Promise<NativePurchase[]>;
  restore(): Promise<NativePurchase[]>; disconnect(): Promise<void>;
  requestId(): Promise<string>;
  sealContent(text: string): Promise<string>; openContent(sealed: string): Promise<string>; clearContentKey(): Promise<void>;
  sealProgress(text: string): Promise<string>; openProgress(sealed: string): Promise<string>; clearProgressKey(): Promise<void>;
};
const native = requireOptionalNativeModule<NativeBilling>('FabelpadPlayBilling');
export const connectedConfig = {
  enabled: native?.connected === true,
  origin: native?.backendOrigin ?? '', environment: native?.environment ?? '',
  deleteAccountUrl: native?.deleteAccountUrl ?? '',
};
type Session = { accessToken: string; refreshToken: string; expiresAt: number; parentId: string; email: string };
let session: Session | null = null, loaded = false;
const ref = native?.supabaseUrl.match(/^https:\/\/([a-z0-9]{20})\.supabase\.co$/u)?.[1];
const secure = ref ? createSecureSessionStorage(ref) : null;
const CACHE_PREFIX = `fabelpad.connected.${connectedConfig.environment}.`;
const DRAFT_PREFIX = `fabelpad.progress.${connectedConfig.environment}.`;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export { ConnectedError } from './connected-contract';
function configured() {
  if (!native?.connected || !secure || !['staging', 'production'].includes(connectedConfig.environment)
    || !validateHostedEmailTarget({ FABELPAD_ENVIRONMENT: connectedConfig.environment, FABELPAD_APP_ORIGIN: connectedConfig.origin, SUPABASE_URL: native.supabaseUrl }) || !native.supabaseKey.startsWith('sb_publishable_')) throw new ConnectedError('unavailable', 'Deze build heeft geen passende gezinskoppeling.');
}
async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 20_000);
  try { return await fetch(url, { ...init, signal: controller.signal }); } finally { clearTimeout(timer); }
}
async function responseJson(response: Response): Promise<Record<string, unknown>> {
  let value: unknown;
  try { value = await response.json(); } catch { throw new ConnectedError('unavailable', 'De gezinsomgeving gaf geen leesbaar antwoord.', response.status); }
  if (!object(value)) throw new ConnectedError('unavailable', 'De gezinsomgeving gaf geen leesbaar antwoord.', response.status);
  if (!response.ok) throw new ConnectedError(typeof value.error === 'string' ? value.error : 'unavailable', typeof value.message === 'string' ? value.message.slice(0, 500) : 'Dit verzoek kon niet worden verwerkt.', response.status);
  return value;
}
export async function clearProtectedContent(): Promise<void> {
  const keys = (await AsyncStorage.getAllKeys()).filter(key => key.startsWith(CACHE_PREFIX));
  await AsyncStorage.multiRemove(keys); await native?.clearContentKey();
}
export async function clearConnectedProgress(): Promise<void> {
  const keys = (await AsyncStorage.getAllKeys()).filter(key => key.startsWith(DRAFT_PREFIX));
  await AsyncStorage.multiRemove(keys); await native?.clearProgressKey();
}
export async function disconnectFamily(): Promise<void> {
  const old = session; session = null; loaded = true;
  await Promise.all(['access', 'refresh', 'identity'].map(name => secure?.removeItem(name)));
  await clearProtectedContent(); await clearConnectedProgress(); await native?.disconnect();
  if (old && native) await fetchWithTimeout(`${native.supabaseUrl}/auth/v1/logout?scope=local`, { method: 'POST', headers: { apikey: native.supabaseKey, Authorization: `Bearer ${old.accessToken}` } }).catch(() => {});
}
async function persistSession(value: Record<string, unknown>): Promise<Session> {
  const user = value.user;
  if (!object(user) || typeof user.id !== 'string' || typeof user.email !== 'string' || user.is_anonymous === true || !user.email_confirmed_at
    || typeof value.access_token !== 'string' || typeof value.refresh_token !== 'string' || typeof value.expires_in !== 'number') throw new ConnectedError('invalid_session', 'De ouderaanmelding kon niet worden bevestigd.');
  session = { accessToken: value.access_token, refreshToken: value.refresh_token, expiresAt: Date.now() + value.expires_in * 1000, parentId: user.id, email: user.email };
  await Promise.all([secure!.setItem('access', session.accessToken), secure!.setItem('refresh', session.refreshToken), secure!.setItem('identity', JSON.stringify({ parentId: session.parentId, email: session.email, expiresAt: session.expiresAt }))]);
  loaded = true; return session;
}
export async function familySession(): Promise<Session | null> {
  configured();
  if (!loaded) {
    const [accessToken, refreshToken, raw] = await Promise.all(['access', 'refresh', 'identity'].map(name => secure!.getItem(name)));
    if (accessToken && refreshToken && raw) { try { const identity = JSON.parse(raw); if (typeof identity.parentId === 'string' && typeof identity.email === 'string' && Number.isFinite(identity.expiresAt)) session = { ...identity, accessToken, refreshToken }; } catch { /* Invalid secure sessions never become identities. */ } }
    loaded = true;
  }
  if (session && session.expiresAt <= Date.now() + 60_000) {
    const response = await fetchWithTimeout(`${native!.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, { method: 'POST', headers: { apikey: native!.supabaseKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: session.refreshToken }) });
    if (response.status === 400 || response.status === 401) { await disconnectFamily(); throw new ConnectedError('session_expired', 'Log opnieuw in als ouder.', 401); }
    session = await persistSession(await responseJson(response));
  }
  return session;
}
export async function sendParentCode(email: string): Promise<void> {
  configured();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email) || email.length > 254) throw new ConnectedError('invalid_email', 'Vul je e-mailadres in.');
  await responseJson(await fetchWithTimeout(`${native!.supabaseUrl}/auth/v1/otp`, { method: 'POST', headers: { apikey: native!.supabaseKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim().toLowerCase(), create_user: false }) }));
}
export async function verifyParentCode(email: string, code: string): Promise<Session> {
  configured(); if (!/^\d{6}$/u.test(code)) throw new ConnectedError('invalid_code', 'Vul de zescijferige inlogcode in.');
  const next = await persistSession(await responseJson(await fetchWithTimeout(`${native!.supabaseUrl}/auth/v1/verify`, { method: 'POST', headers: { apikey: native!.supabaseKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim().toLowerCase(), token: code, type: 'email' }) })));
  // An Auth token alone never establishes the current account's lifecycle.
  const status = await connectedRequest('/api/parent/status');
  if (status.state === 'active' && status.acceptedTermsVersion === status.termsVersion) await connectedRequest('/api/parent/activity', { eventId: await connectedRequestId(), kind: 'parent_action' });
  return next;
}
export async function connectedRequest(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST', purgeForbidden = true): Promise<Record<string, unknown>> {
  configured(); if (!path.startsWith('/api/') || path.includes('..')) throw new ConnectedError('invalid_path', 'Ongeldige gezinsactie.');
  const current = await familySession(); if (!current) throw new ConnectedError('login_required', 'Log eerst in als ouder.', 401);
  const response = await fetchWithTimeout(`${connectedConfig.origin}${path}`, { method, credentials: 'omit', redirect: 'error', headers: {
    Authorization: `Bearer ${current.accessToken}`, 'X-Fabelpad-Parent': current.parentId, Origin: connectedConfig.origin,
    ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  if ([401, 410].includes(response.status) || purgeForbidden && response.status === 403) await Promise.all([clearProtectedContent(), clearConnectedProgress()]);
  return responseJson(response);
}
export async function loadConnectedAccount(): Promise<{ session: Session; lifecycle: ParentAccountStatus; billing: Record<string, unknown> }> {
  const current = await familySession(); if (!current) throw new ConnectedError('login_required', 'Log eerst in als ouder.', 401);
  const lifecycle = await connectedRequest('/api/parent/status') as unknown as ParentAccountStatus;
  if (lifecycle.state !== 'active' || lifecycle.acceptedTermsVersion !== lifecycle.termsVersion) {
    await clearProtectedContent(); if (lifecycle.state !== 'active') await clearConnectedProgress(); return { session: current, lifecycle, billing: {} };
  }
  const billing = await connectedRequest('/api/billing/account');
  return { session: current, lifecycle, billing };
}
export async function connectedRequestId(): Promise<string> { configured(); return native!.requestId(); }
export async function queryPlayOffers(productIds: string[]): Promise<PlayOffer[]> { configured(); return native!.products(productIds); }
export async function queryConfiguredPlayOffers(play: Record<string, unknown>, prices: Record<string, unknown>): Promise<PlayOffer[]> {
  const enabled = (['month', 'year'] as const).filter(period => object(prices[period]) && prices[period].enabled === true);
  const ids = enabled.map(period => period === 'month' ? play.monthlyProductId : play.yearlyProductId).filter((value): value is string => typeof value === 'string' && !!value);
  if (ids.length !== enabled.length || !ids.length) return [];
  return (await queryPlayOffers(ids)).filter(offer => offer.currency === 'EUR' && enabled.some(period => offer.productId === (period === 'month' ? play.monthlyProductId : play.yearlyProductId)
    && offer.basePlanId === (period === 'month' ? play.monthlyBasePlanId : play.yearlyBasePlanId) && offer.billingPeriod === (period === 'month' ? 'P1M' : 'P1Y')));
}
type PlayAgreement = { expectedRevision: number; expectedAmountCents: number; termsVersion: string; acceptTerms: true; acceptRecurring: true };
/** The staging test is visible only after the server confirms the admin role.
 * A normal parent's missing admin permission does not invalidate family rights.
 */
export async function loadPlayTrialOffers(): Promise<PlayOffer[]> {
  configured(); if (connectedConfig.environment !== 'staging') return [];
  let snapshot: Record<string, unknown>;
  try { snapshot = await connectedRequest('/api/admin/billing', undefined, 'GET', false); }
  catch (error) { if (error instanceof ConnectedError && error.status === 403) return []; throw error; }
  if (!object(snapshot.settings) || snapshot.settings.environment !== 'staging' || !object(snapshot.settings.play)) return [];
  const credentials = Array.isArray(snapshot.credentials) ? snapshot.credentials.filter(object) : [];
  if (!credentials.some(value => value.provider === 'play' && value.mode === 'test' && value.active === true && value.verified === true && object(value.verification) && value.verification.productsVerified === true)) return [];
  return object(snapshot.settings.prices) ? queryConfiguredPlayOffers(snapshot.settings.play, snapshot.settings.prices) : [];
}
export async function loadPlayLicenseProofOffers(): Promise<{ offers: PlayOffer[]; credentialRevision: number } | null> {
  configured(); if (connectedConfig.environment !== 'production') return null;
  let snapshot: Record<string, unknown>;
  try { snapshot = await connectedRequest('/api/admin/billing', undefined, 'GET', false); }
  catch (error) { if (error instanceof ConnectedError && error.status === 403) return null; throw error; }
  if (!object(snapshot.settings) || snapshot.settings.environment !== 'production' || !object(snapshot.settings.play) || !object(snapshot.settings.prices)) return null;
  const credential = Array.isArray(snapshot.credentials) ? snapshot.credentials.filter(object).find(value => value.provider === 'play' && value.mode === 'live' && value.active === true && value.verified === true && object(value.verification) && value.verification.productsVerified === true) : null;
  if (!credential || !Number.isSafeInteger(credential.revision)) return null;
  return { credentialRevision: Number(credential.revision), offers: await queryConfiguredPlayOffers(snapshot.settings.play, snapshot.settings.prices) };
}
async function executePlayPurchase(result: Record<string, unknown>, offer: PlayOffer, agreement: PlayAgreement): Promise<{ pending: boolean; cancelled: boolean }> {
  const reservation = (object(result.reservation) ? result.reservation : result) as unknown as PurchaseReservation & { obfuscatedAccountId?: string; productId?: string; basePlanId?: string };
  if (!reservation.id || typeof result.obfuscatedAccountId !== 'string' && !reservation.obfuscatedAccountId
    || (result.productId ?? reservation.productId) !== offer.productId || (result.basePlanId ?? reservation.basePlanId) !== offer.basePlanId
    || reservation.settingsRevision !== agreement.expectedRevision || reservation.amountCents !== agreement.expectedAmountCents || reservation.termsVersion !== agreement.termsVersion
    || reservation.amountCents !== Number(offer.priceAmountMicros) / 10_000) throw new ConnectedError('offer_changed', 'Het aanbod is gewijzigd. Laad de abonnementen opnieuw.');
  const purchases = await native!.purchase(offer.productId, offer.basePlanId, String(result.obfuscatedAccountId ?? reservation.obfuscatedAccountId), offer.offerToken);
  for (const purchase of purchases) if (purchase.state === 'purchased') await connectedRequest('/api/billing/play/verify', { purchaseToken: purchase.purchaseToken, reservationId: reservation.id });
  return { pending: purchases.some(value => value.state === 'pending'), cancelled: purchases.length === 0 };
}
export async function purchasePlayOffer(offer: PlayOffer, period: BillingPeriod, agreement: PlayAgreement): Promise<{ pending: boolean; cancelled: boolean }> {
  configured();
  const result = await connectedRequest('/api/billing/play/reserve', { period, requestId: await connectedRequestId(), ...agreement });
  return executePlayPurchase(result, offer, agreement);
}
export async function purchasePlayTrialOffer(offer: PlayOffer, period: BillingPeriod, agreement: PlayAgreement): Promise<{ pending: boolean; cancelled: boolean }> {
  configured();
  if (connectedConfig.environment !== 'staging' || agreement.acceptTerms !== true || agreement.acceptRecurring !== true) throw new ConnectedError('trial_not_allowed', 'Deze beheertest vereist staging en je afzonderlijke bevestiging.');
  const result = await connectedRequest('/api/admin/billing/play-trial', { period, requestId: await connectedRequestId() });
  const reservation = object(result.reservation) ? result.reservation : result;
  if (reservation.environment !== 'staging' || reservation.mode !== 'test') throw new ConnectedError('trial_not_allowed', 'De beheertest is niet als stagingtest bevestigd.');
  return executePlayPurchase(result, offer, agreement);
}
export async function purchasePlayLicenseProofOffer(offer: PlayOffer, period: BillingPeriod, credentialRevision: number, agreement: PlayAgreement, licenseTester: boolean): Promise<{ pending: boolean; cancelled: boolean; confirmed: boolean }> {
  configured();
  if (connectedConfig.environment !== 'production' || licenseTester !== true || agreement.acceptTerms !== true || agreement.acceptRecurring !== true) throw new ConnectedError('proof_not_allowed', 'Bevestig eerst expliciet je Google Play-licentietestaccount en het getoonde testaanbod.');
  const ticket = await connectedRequest('/api/admin/billing/play-proof', { credentialRevision });
  const price = object(ticket.prices) && object(ticket.prices[period]) ? ticket.prices[period] : {};
  if (ticket.proofOnly !== true || ticket.environment !== 'production' || ticket.mode !== 'live' || ticket.credentialRevision !== credentialRevision
    || typeof ticket.id !== 'string' || typeof ticket.obfuscatedAccountId !== 'string' || !/^[a-f0-9]{64}$/u.test(ticket.obfuscatedAccountId)
    || Date.parse(String(ticket.expiresAt)) <= Date.now() || !Number.isFinite(Date.parse(String(ticket.expiresAt)))
    || ticket.settingsRevision !== agreement.expectedRevision || ticket.termsVersion !== agreement.termsVersion || price.enabled !== true || price.amountCents !== agreement.expectedAmountCents
    || price.amountCents !== Number(offer.priceAmountMicros) / 10_000 || offer.currency !== 'EUR'
    || (period === 'month' ? ticket.monthlyProductId : ticket.yearlyProductId) !== offer.productId || (period === 'month' ? ticket.monthlyBasePlanId : ticket.yearlyBasePlanId) !== offer.basePlanId) throw new ConnectedError('proof_offer_changed', 'De licentietest wijkt af van het getoonde aanbod. Laad opnieuw; er is geen aankoop gestart.');
  const purchases = await native!.purchase(offer.productId, offer.basePlanId, ticket.obfuscatedAccountId, offer.offerToken);
  let confirmed = false;
  for (const purchase of purchases) if (purchase.state === 'purchased') { const proof = await connectedRequest('/api/admin/billing/play-proof', { proofId: ticket.id, purchaseToken: purchase.purchaseToken }); confirmed = proof.saved === true; }
  return { pending: purchases.some(value => value.state === 'pending'), cancelled: purchases.length === 0, confirmed };
}
export async function restorePlayLicenseProof(credentialRevision: number, licenseTester: boolean): Promise<boolean> {
  configured(); if (connectedConfig.environment !== 'production' || licenseTester !== true) throw new ConnectedError('proof_not_allowed', 'Bevestig eerst je Google Play-licentietestaccount.');
  const ticket = await connectedRequest('/api/admin/billing/play-proof', { credentialRevision });
  if (ticket.proofOnly !== true || ticket.environment !== 'production' || ticket.mode !== 'live' || typeof ticket.id !== 'string') throw new ConnectedError('proof_not_allowed', 'De beheerproef is niet bevestigd.');
  for (const purchase of await native!.restore()) if (purchase.state === 'purchased') {
    try { const proof = await connectedRequest('/api/admin/billing/play-proof', { proofId: ticket.id, purchaseToken: purchase.purchaseToken }); if (proof.saved === true) return true; }
    catch (error) { if (error instanceof ConnectedError && [401,403,410].includes(error.status)) throw error; }
  }
  return false;
}
export async function restorePlayPurchases(): Promise<number> {
  configured(); let restored = 0;
  for (const purchase of await native!.restore()) if (purchase.state === 'purchased') { await connectedRequest('/api/billing/play/verify', { purchaseToken: purchase.purchaseToken }); restored += 1; }
  return restored;
}
export async function importLocalProfiles(store: Store, selectedIds: string[], explicitConsent: boolean): Promise<void> {
  if (!explicitConsent) throw new ConnectedError('consent_required', 'Bevestig afzonderlijk de online opslag van deze kinderprofielen.');
  const existing = await connectedRequest('/api/family');
  const snapshot = nativeFamilyImport(store, existing.snapshot as FamilySnapshot | null, selectedIds);
  for (const profileId of selectedIds) await connectedRequest('/api/parent/consent', { profileId, consent: true, guardianDeclaration: true });
  await connectedRequest('/api/family', { baseRevision: existing.revision ?? 0, snapshot }, 'PUT');
}

export type ConnectedFamilyState = { snapshot: FamilySnapshot | null; revision: number; pending: boolean; conflict: boolean };
let progressQueue: Promise<unknown> = Promise.resolve(), progressRetryAt = 0;
function serializeProgress<T>(action: () => Promise<T>): Promise<T> {
  const next = progressQueue.then(action, action); progressQueue = next.catch(() => {}); return next;
}
async function progressIdentity(): Promise<Session> {
  if (!loaded) await familySession().catch(() => {});
  if (!session) throw new ConnectedError('login_required', 'Log eerst in als ouder.', 401);
  return session;
}
async function readProgressDraft(): Promise<ConnectedProgressDraft | null> {
  const current = await progressIdentity(), sealed = await AsyncStorage.getItem(`${DRAFT_PREFIX}${current.parentId}`);
  if (!sealed) return null;
  try {
    const draft: unknown = JSON.parse(await native!.openProgress(sealed));
    if (!object(draft) || draft.schemaVersion !== 1 || draft.parentId !== current.parentId || draft.environment !== connectedConfig.environment
      || !Number.isSafeInteger(draft.baseRevision) || Number(draft.baseRevision) < 0 || !validateFamilySnapshot(draft.baseSnapshot).ok || !validateFamilySnapshot(draft.snapshot).ok) throw new Error();
    return draft as unknown as ConnectedProgressDraft;
  } catch { throw new ConnectedError('progress_storage_invalid', 'De beveiligde offline voortgang kon niet worden geopend. Je opgeslagen kopie blijft bewaard; neem contact op met support.'); }
}
async function writeProgressDraft(draft: ConnectedProgressDraft): Promise<void> {
  await AsyncStorage.setItem(`${DRAFT_PREFIX}${draft.parentId}`, await native!.sealProgress(JSON.stringify(draft)));
}
async function deleteProgressDraft(parentId: string): Promise<void> { await AsyncStorage.removeItem(`${DRAFT_PREFIX}${parentId}`); }
async function flushProgressDraft(force = false): Promise<ConnectedFamilyState | null> {
  const draft = await readProgressDraft(); if (!draft) return null;
  if (!force && progressRetryAt > Date.now()) return { snapshot: draft.snapshot, revision: draft.baseRevision, pending: true, conflict: false };
  try {
    const current = await connectedRequest('/api/family'), revision = Number(current.revision);
    if (!Number.isSafeInteger(revision) || !validateFamilySnapshot(current.snapshot).ok) throw new ConnectedError('family_unavailable', 'Je online gezinsgegevens konden niet worden gecontroleerd.');
    const cloud = current.snapshot as unknown as FamilySnapshot, merged = mergeConnectedProgress(draft, cloud);
    if (merged.conflicts.length) return { snapshot: draft.snapshot, revision: draft.baseRevision, pending: true, conflict: true };
    if (JSON.stringify(merged.snapshot) === JSON.stringify(cloud)) {
      await deleteProgressDraft(draft.parentId); return { snapshot: cloud, revision, pending: false, conflict: false };
    }
    const saved = await connectedRequest('/api/family', { baseRevision: revision, snapshot: merged.snapshot }, 'PUT');
    if (!Number.isSafeInteger(saved.revision) || !validateFamilySnapshot(saved.snapshot).ok) throw new ConnectedError('family_unavailable', 'De opgeslagen gezinsgegevens konden niet worden bevestigd.');
    await deleteProgressDraft(draft.parentId); progressRetryAt = 0;
    return { snapshot: saved.snapshot as unknown as FamilySnapshot, revision: Number(saved.revision), pending: false, conflict: false };
  } catch (error) {
    if (error instanceof ConnectedError && error.status && error.status !== 409) throw error;
    progressRetryAt = Date.now() + 30_000;
    return { snapshot: draft.snapshot, revision: draft.baseRevision, pending: true, conflict: error instanceof ConnectedError && error.status === 409 };
  }
}
export function flushConnectedProgress(): Promise<ConnectedFamilyState | null> { return serializeProgress(() => flushProgressDraft(true)); }
export function readConnectedProgress(): Promise<ConnectedFamilyState | null> {
  return serializeProgress(async () => { const draft = await readProgressDraft(); return draft ? { snapshot: draft.snapshot, revision: draft.baseRevision, pending: true, conflict: false } : null; });
}
export function loadConnectedFamily(): Promise<ConnectedFamilyState> {
  return serializeProgress(async () => {
    const pending = await flushProgressDraft(true); if (pending) return pending;
    const current = await connectedRequest('/api/family');
    if (current.snapshot !== null && !validateFamilySnapshot(current.snapshot).ok || !Number.isSafeInteger(current.revision)) throw new ConnectedError('family_unavailable', 'Je online gezinsgegevens konden niet worden gecontroleerd.');
    return { snapshot: current.snapshot as FamilySnapshot | null, revision: Number(current.revision), pending: false, conflict: false };
  });
}
export function saveConnectedProgress(baseRevision: number, previous: FamilySnapshot, snapshot: FamilySnapshot): Promise<ConnectedFamilyState> {
  return serializeProgress(async () => {
    const current = await progressIdentity(), existing = await readProgressDraft();
    if (!validateFamilySnapshot(snapshot).ok || !validateFamilySnapshot(previous).ok || !Number.isSafeInteger(baseRevision)) throw new ConnectedError('invalid_progress', 'Deze leesvoortgang kon niet veilig worden bewaard.');
    const draft: ConnectedProgressDraft = { schemaVersion: 1, parentId: current.parentId, environment: connectedConfig.environment,
      baseRevision: existing?.baseRevision ?? baseRevision, baseSnapshot: existing?.baseSnapshot ?? previous, snapshot, updatedAt: Date.now() };
    // Persist before any network attempt or visual route advance. An app kill
    // during a request therefore leaves a recoverable, device-encrypted draft.
    await writeProgressDraft(draft);
    return (await flushProgressDraft())!;
  });
}
export function resolveConnectedProgress(useLocal: boolean): Promise<ConnectedFamilyState> {
  return serializeProgress(async () => {
    const draft = await readProgressDraft(), current = await connectedRequest('/api/family');
    if (!validateFamilySnapshot(current.snapshot).ok || !Number.isSafeInteger(current.revision)) throw new ConnectedError('family_unavailable', 'Je online gezinsgegevens konden niet worden gecontroleerd.');
    const cloud = current.snapshot as unknown as FamilySnapshot;
    if (!draft || !useLocal) {
      if (draft) await deleteProgressDraft(draft.parentId);
      return { snapshot: cloud, revision: Number(current.revision), pending: false, conflict: false };
    }
    const merged = mergeConnectedProgress(draft, cloud, true);
    if (merged.conflicts.length) throw new ConnectedError('profile_removed', 'Een betrokken kinderprofiel bestaat online niet meer. Je offline kopie is bewaard; een verwijderd profiel wordt niet opnieuw aangemaakt.');
    await writeProgressDraft({ ...draft, baseRevision: Number(current.revision), baseSnapshot: cloud, snapshot: merged.snapshot, updatedAt: Date.now() });
    return (await flushProgressDraft(true))!;
  });
}

/** Cached premium payloads are device-encrypted and have a server-issued,
 * bounded expiry. Local bundled stories never use this namespace or key.
 */
export async function cacheConnectedRelease(storyId: string, response: Record<string, unknown>): Promise<void> {
  const current = await familySession(), expiry = Date.parse(String(response.offlineUntil ?? ''));
  if (!current || !object(response.release) || !Number.isFinite(expiry) || expiry <= Date.now() || expiry > Date.now() + 24 * 60 * 60_000 + 60_000) return;
  const envelope = { parentId: current.parentId, environment: connectedConfig.environment, validUntil: expiry, downloadedAt: Date.now(), response };
  await AsyncStorage.setItem(`${CACHE_PREFIX}${current.parentId}.${storyId}`, await native!.sealContent(JSON.stringify(envelope)));
}
export async function cachedConnectedRelease(storyId: string): Promise<Record<string, unknown> | null> {
  configured();
  // Loading the secure identity is allowed while offline; a failed refresh
  // never extends the lease and is not interpreted as account verification.
  if (!loaded) await familySession().catch(() => {});
  if (!session) return null;
  const key = `${CACHE_PREFIX}${session.parentId}.${storyId}`, sealed = await AsyncStorage.getItem(key);
  if (!sealed) return null;
  try {
    const value = JSON.parse(await native!.openContent(sealed));
    if (value.parentId !== session.parentId || value.environment !== connectedConfig.environment || typeof value.validUntil !== 'number' || value.validUntil <= Date.now()
      || value.downloadedAt > Date.now() + 60_000 || value.validUntil - value.downloadedAt > 24 * 60 * 60_000 + 60_000 || !object(value.response)) throw new Error();
    return value.response;
  } catch { await AsyncStorage.removeItem(key); return null; }
}
export async function loadConnectedRelease(storyId: string, version?: string): Promise<Record<string, unknown>> {
  try {
    const result = await connectedRequest(`/api/content/${encodeURIComponent(storyId)}${version ? `?version=${encodeURIComponent(version)}` : ''}`);
    await cacheConnectedRelease(storyId, result); return result;
  } catch (error) {
    if (error instanceof ConnectedError && error.status) throw error;
    const cached = await cachedConnectedRelease(storyId);
    if (cached && (!version || object(cached.release) && cached.release.contentVersion === version)) return cached;
    throw new ConnectedError('online_required', 'Maak verbinding om je gezinsrecht en dit verhaal opnieuw te controleren.');
  }
}
