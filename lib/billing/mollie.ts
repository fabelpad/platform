/** Server/Edge-only Mollie Payments API. Official contracts checked 2026-11-23:
 * docs.mollie.com/reference/{get-current-profile,list-methods,create-payment,
 * create-subscription,cancel-subscription,create-refund,api-idempotency}.
 * API keys are bound to one profile and mode: never send profileId/testmode.
 * Mollie's idempotency cache lasts ONE HOUR, not the mail provider's 24 hours.
 */
export type MollieMode = 'test' | 'live';
export type MollieCredential = { revision: number; environment: 'staging' | 'production'; mode: MollieMode; apiKey: string; profileId: string };
export type MollieMetadata = { fabelpadContractId: string; fabelpadOperationId: string; fabelpadAttemptId?: string };
export type MolliePayment = { id: string; mode: MollieMode; profileId: string; customerId: string; subscriptionId: string | null; mandateId: string | null; sequenceType: 'first' | 'recurring' | 'oneoff'; status: 'open' | 'canceled' | 'pending' | 'authorized' | 'expired' | 'failed' | 'paid'; amountCents: number; refundedCents: number; chargedBackCents: number; paidAt: string | null; metadata: MollieMetadata; checkoutUrl: string | null };
export type MollieSubscription = { id: string; mode: MollieMode; customerId: string; profileId: string; mandateId: string | null; status: 'pending' | 'active' | 'suspended' | 'canceled' | 'completed'; amountCents: number; interval: '1 month' | '12 months'; startDate: string; metadata: MollieMetadata };
export type MollieRefund = { id: string; paymentId: string; amountCents: number; status: 'queued' | 'pending' | 'processing' | 'refunded' | 'failed' | 'canceled'; metadata: MollieMetadata | null };
export type MollieMandate = { id: string; status: 'valid' | 'pending' | 'invalid'; method: 'directdebit' | 'creditcard' | 'paypal' };
export const MOLLIE_RETRY_WINDOW_MS = 55 * 60 * 1000;
export const MOLLIE_FIRST_METHODS = ['ideal', 'bancontact', 'belfius', 'eps', 'kbc', 'paybybank', 'creditcard', 'paypal'] as const;
export const MOLLIE_ORIGINS = { staging: 'https://staging.fabelpad.nl', production: 'https://fabelpad.nl' } as const;

export class MollieError extends Error {
  readonly status: number | null; readonly uncertain: boolean; readonly retryable: boolean;
  readonly code: 'configuration_invalid' | 'provider_unavailable' | 'provider_rejected' | 'provider_response_invalid' | 'provider_binding_mismatch' | 'reconciliation_incomplete';
  constructor(code: MollieError['code'], status: number | null = null, uncertain = false) {
    super(code); this.name = 'MollieError'; this.status = status; this.uncertain = uncertain;
    this.code = code;
    this.retryable = status === null || status === 408 || status === 429 || status >= 500;
  }
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const id = (value: unknown, prefix: string): value is string => typeof value === 'string' && new RegExp(`^${prefix}_[A-Za-z0-9]{4,100}$`, 'u').test(value);
const opaque = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{7,119}$/u.test(value);
const invalid = (): never => { throw new MollieError('provider_response_invalid'); };
const binding = (): never => { throw new MollieError('provider_binding_mismatch'); };
export function mollieAmount(cents: number) {
  if (!Number.isSafeInteger(cents) || cents < 1 || cents > 100_000_000) throw new MollieError('configuration_invalid');
  return { currency: 'EUR' as const, value: `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}` };
}
function cents(value: unknown): number {
  if (!record(value) || value.currency !== 'EUR' || typeof value.value !== 'string' || !/^(?:0|[1-9][0-9]{0,6})\.[0-9]{2}$/u.test(value.value)) return invalid();
  const [whole, fraction] = value.value.split('.'); return Number(whole) * 100 + Number(fraction);
}
function metadata(value: unknown): MollieMetadata {
  if (!record(value) || !opaque(value.fabelpadContractId) || !opaque(value.fabelpadOperationId) || (value.fabelpadAttemptId !== undefined && !opaque(value.fabelpadAttemptId))) return invalid();
  return { fabelpadContractId: value.fabelpadContractId, fabelpadOperationId: value.fabelpadOperationId, ...(value.fabelpadAttemptId ? { fabelpadAttemptId: value.fabelpadAttemptId } : {}) };
}
export function assertMollieMetadata(actual: MollieMetadata, expected: MollieMetadata): void {
  for (const [key, value] of Object.entries(expected)) if (actual[key as keyof MollieMetadata] !== value) binding();
}
function date(value: unknown): value is string { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/u.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value; }
export function safeMollieCheckout(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2048) return invalid();
  let url: URL; try { url = new URL(value); } catch { return invalid(); }
  if (url.protocol !== 'https:' || !['www.mollie.com', 'checkout.mollie.com'].includes(url.hostname) || url.port || url.username || url.password || url.hash || !url.pathname.startsWith('/checkout/')) return invalid();
  return url.href;
}
export function validateMollieCredential(value: MollieCredential): void {
  if (typeof document !== 'undefined' || !Number.isSafeInteger(value.revision) || value.revision < 1 || !['staging', 'production'].includes(value.environment) || !['test', 'live'].includes(value.mode) || !id(value.profileId, 'pfl') || !new RegExp(`^${value.mode}_[A-Za-z0-9]{20,128}$`, 'u').test(value.apiKey) || (value.environment === 'staging' && value.mode !== 'test')) throw new MollieError('configuration_invalid');
}
export function createMollieClient(credential: MollieCredential, dependencies: { fetch?: typeof fetch } = {}) {
  validateMollieCredential(credential); const fetcher = dependencies.fetch ?? fetch;
  async function request(path: string, method = 'GET', body?: object, key?: string): Promise<Record<string, unknown>> {
    if (!path.startsWith('/v2/') || path.includes('..') || path.includes('#') || (method !== 'GET' && !opaque(key))) throw new MollieError('configuration_invalid');
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined; let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    const run = async () => {
      let response: Response;
      try { response = await fetcher(`https://api.mollie.com${path}`, { method, redirect: 'error', cache: 'no-store', signal: controller.signal, headers: { Authorization: `Bearer ${credential.apiKey}`, Accept: 'application/hal+json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(key ? { 'Idempotency-Key': key } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }); }
      catch { throw new MollieError('provider_unavailable', null, method !== 'GET'); }
      if (!response.ok) { await response.body?.cancel().catch(() => {}); throw new MollieError('provider_rejected', response.status, method !== 'GET' && (response.status === 408 || response.status >= 500)); }
      try {
        if (Number(response.headers.get('content-length')) > 512 * 1024) throw new Error();
        reader = response.body?.getReader(); if (!reader) throw new Error();
        let size = 0, raw = ''; const decoder = new TextDecoder('utf-8', { fatal: true });
        while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 512 * 1024) throw new Error(); raw += decoder.decode(part.value, { stream: true }); }
        const result: unknown = JSON.parse(raw + decoder.decode()); if (!record(result)) throw new Error(); return result;
      } catch { throw new MollieError('provider_response_invalid', response.status, method !== 'GET'); }
      finally { await reader?.cancel().catch(() => {}); }
    };
    try { return await Promise.race([run(), new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); void reader?.cancel().catch(() => {}); reject(new MollieError('provider_unavailable', null, method !== 'GET')); }, 10_000); })]); }
    finally { if (timer) clearTimeout(timer); }
  }
  async function list(path: string, field: string): Promise<Record<string, unknown>[]> {
    const values: Record<string, unknown>[] = []; let next: string | null = `${path}${path.includes('?') ? '&' : '?'}limit=250`;
    for (let page = 0; next && page < 20; page++) {
      const result = await request(next); const embedded = result._embedded;
      if (!record(embedded) || !Array.isArray(embedded[field]) || embedded[field].some(item => !record(item))) return invalid();
      values.push(...embedded[field] as Record<string, unknown>[]);
      const links = result._links, link = record(links) ? links.next : undefined;
      if (link === null || link === undefined) next = null;
      else {
        if (!record(link) || typeof link.href !== 'string') return invalid();
        const url = new URL(link.href); const base = new URL(path, 'https://api.mollie.com');
        if (url.origin !== base.origin || url.pathname !== base.pathname || url.username || url.password || url.hash) return invalid();
        next = url.pathname + url.search;
      }
    }
    if (next) throw new MollieError('reconciliation_incomplete'); return values;
  }
  function payment(value: Record<string, unknown>): MolliePayment {
    if (!id(value.id, 'tr') || value.mode !== credential.mode || value.profileId !== credential.profileId || !id(value.customerId, 'cst') || !['first', 'recurring', 'oneoff'].includes(String(value.sequenceType)) || !['open', 'canceled', 'pending', 'authorized', 'expired', 'failed', 'paid'].includes(String(value.status))) return binding();
    if ((value.subscriptionId !== undefined && value.subscriptionId !== null && !id(value.subscriptionId, 'sub')) || (value.mandateId !== undefined && value.mandateId !== null && !id(value.mandateId, 'mdt'))) return invalid();
    const paidAt = typeof value.paidAt === 'string' && Number.isFinite(Date.parse(value.paidAt)) ? value.paidAt : null;
    if (value.status === 'paid' && !paidAt) return invalid();
    const links = value._links; const checkout = record(links) && record(links.checkout) ? links.checkout.href : null;
    return { id: value.id, mode: credential.mode, profileId: credential.profileId, customerId: value.customerId, subscriptionId: typeof value.subscriptionId === 'string' ? value.subscriptionId : null, mandateId: typeof value.mandateId === 'string' ? value.mandateId : null, sequenceType: value.sequenceType as MolliePayment['sequenceType'], status: value.status as MolliePayment['status'], amountCents: cents(value.amount), refundedCents: value.amountRefunded === undefined ? 0 : cents(value.amountRefunded), chargedBackCents: value.amountChargedBack === undefined ? 0 : cents(value.amountChargedBack), paidAt, metadata: metadata(value.metadata), checkoutUrl: checkout === null ? null : safeMollieCheckout(checkout) };
  }
  function subscription(value: Record<string, unknown>, customerId: string): MollieSubscription {
    if (!id(value.id, 'sub') || value.mode !== credential.mode || value.profileId !== credential.profileId || value.customerId !== customerId || !['pending', 'active', 'suspended', 'canceled', 'completed'].includes(String(value.status)) || !['1 month', '12 months'].includes(String(value.interval)) || !date(value.startDate) || (value.mandateId !== undefined && value.mandateId !== null && !id(value.mandateId, 'mdt'))) return binding();
    return { id: value.id, mode: credential.mode, customerId, profileId: credential.profileId, mandateId: typeof value.mandateId === 'string' ? value.mandateId : null, status: value.status as MollieSubscription['status'], amountCents: cents(value.amount), interval: value.interval as MollieSubscription['interval'], startDate: value.startDate, metadata: metadata(value.metadata) };
  }
  function refund(value: Record<string, unknown>, paymentId: string): MollieRefund {
    if (!id(value.id, 're') || value.paymentId !== paymentId || !['queued', 'pending', 'processing', 'refunded', 'failed', 'canceled'].includes(String(value.status))) return binding();
    if (value.mode !== credential.mode) return binding();
    return { id: value.id, paymentId, amountCents: cents(value.amount), status: value.status as MollieRefund['status'], metadata: record(value.metadata) && value.metadata.fabelpadContractId !== undefined ? metadata(value.metadata) : null };
  }
  function mandate(value: Record<string, unknown>, customerId: string): MollieMandate {
    if (!id(value.id, 'mdt') || value.customerId !== customerId || value.mode !== credential.mode || !['valid', 'pending', 'invalid'].includes(String(value.status)) || !['directdebit', 'creditcard', 'paypal'].includes(String(value.method))) return binding();
    if (value.scopes !== undefined && value.scopes !== null && (!Array.isArray(value.scopes) || !value.scopes.includes('customer-not-present'))) return binding();
    return { id: value.id, status: value.status as MollieMandate['status'], method: value.method as MollieMandate['method'] };
  }
  function customerPath(customerId: string) { if (!id(customerId, 'cst')) throw new MollieError('configuration_invalid'); return `/v2/customers/${customerId}`; }
  function paymentPath(paymentId: string) { if (!id(paymentId, 'tr')) throw new MollieError('configuration_invalid'); return `/v2/payments/${paymentId}`; }
  function subscriptionPath(customerId: string, subscriptionId: string) { if (!id(subscriptionId, 'sub')) throw new MollieError('configuration_invalid'); return `${customerPath(customerId)}/subscriptions/${subscriptionId}`; }
  function ownCallback(url: string, kind: 'redirect' | 'webhook') { const origin = MOLLIE_ORIGINS[credential.environment]; const parsed = new URL(url); if (parsed.origin !== origin || parsed.username || parsed.password || parsed.hash || !parsed.pathname.startsWith(kind === 'webhook' ? '/api/billing/mollie/webhook' : '/profiel/abonnement')) throw new MollieError('configuration_invalid'); }
  return {
    async probe(firstMethods: readonly string[], amountCents = 499) {
      const profile = await request('/v2/profiles/me'); if (profile.id !== credential.profileId) return binding();
      const amount = mollieAmount(amountCents), query = `amount[currency]=EUR&amount[value]=${amount.value}`;
      const first = await request(`/v2/methods?sequenceType=first&${query}`), recurring = await request(`/v2/methods?sequenceType=recurring&${query}`);
      function methods(result: Record<string, unknown>) { const embedded = result._embedded; if (!record(embedded) || !Array.isArray(embedded.methods)) return invalid(); return embedded.methods.map(item => { if (!record(item) || typeof item.id !== 'string' || !/^[a-z]{2,30}$/u.test(item.id)) return invalid(); return item.id; }); }
      const availableFirst = methods(first), availableRecurring = methods(recurring);
      const enabledFirst = firstMethods.filter(method => MOLLIE_FIRST_METHODS.includes(method as typeof MOLLIE_FIRST_METHODS[number]) && availableFirst.includes(method));
      const recurringReady = enabledFirst.length > 0 && enabledFirst.every(method => availableRecurring.includes(method === 'creditcard' || method === 'paypal' ? method : 'directdebit'));
      return { profileId: credential.profileId, mode: credential.mode, modeSource: 'api-key-prefix' as const, profileVerified: true, firstMethods: enabledFirst, availableFirstMethods: availableFirst, recurringMethods: availableRecurring, recurringReady, transactionPerformed: false, callbackEndToEndVerified: false, webhookEndToEndVerified: false, chargePermissionVerified: false };
    },
    async createCustomer(meta: MollieMetadata, key: string) { const value = await request('/v2/customers', 'POST', { metadata: metadata(meta) }, key); if (!id(value.id, 'cst') || value.mode !== credential.mode) return binding(); assertMollieMetadata(metadata(value.metadata), meta); return { id: value.id }; },
    async getCustomer(customerId: string) { const value = await request(customerPath(customerId)); if (value.id !== customerId || value.mode !== credential.mode) return binding(); return { id: customerId, metadata: metadata(value.metadata) }; },
    async findCustomers(meta: MollieMetadata) { return (await list('/v2/customers', 'customers')).filter(value => record(value.metadata) && Object.entries(meta).every(([key, expected]) => value.metadata && (value.metadata as Record<string, unknown>)[key] === expected)).map(value => { if (!id(value.id, 'cst') || value.mode !== credential.mode) return binding(); return { id: value.id }; }); },
    async createFirstPayment(input: { customerId: string; amountCents: number; description: string; methods: readonly string[]; redirectUrl: string; webhookUrl: string; metadata: MollieMetadata }, key: string) {
      customerPath(input.customerId); ownCallback(input.redirectUrl, 'redirect'); ownCallback(input.webhookUrl, 'webhook');
      if (!input.description || input.description.length > 255 || /[\u0000-\u001f]/u.test(input.description) || !input.methods.length || input.methods.some(method => !MOLLIE_FIRST_METHODS.includes(method as typeof MOLLIE_FIRST_METHODS[number]))) throw new MollieError('configuration_invalid');
      const value = payment(await request('/v2/payments', 'POST', { amount: mollieAmount(input.amountCents), customerId: input.customerId, sequenceType: 'first', description: input.description, method: input.methods, redirectUrl: input.redirectUrl, webhookUrl: input.webhookUrl, metadata: metadata(input.metadata), locale: 'nl_NL' }, key));
      if (value.customerId !== input.customerId || value.amountCents !== input.amountCents || value.sequenceType !== 'first' || value.subscriptionId) return binding(); assertMollieMetadata(value.metadata, input.metadata); return value;
    },
    async getPayment(paymentId: string) { const value = payment(await request(paymentPath(paymentId))); if (value.id !== paymentId) return binding(); return value; },
    async listCustomerPayments(customerId: string) { return (await list(`${customerPath(customerId)}/payments`, 'payments')).map(payment).filter(value => { if (value.customerId !== customerId) return binding(); return true; }); },
    async getMandate(customerId: string, mandateId: string): Promise<MollieMandate> { if (!id(mandateId, 'mdt')) throw new MollieError('configuration_invalid'); const value = mandate(await request(`${customerPath(customerId)}/mandates/${mandateId}`), customerId); if (value.id !== mandateId) return binding(); return value; },
    async listMandates(customerId: string): Promise<MollieMandate[]> { return (await list(`${customerPath(customerId)}/mandates`, 'mandates')).map(value => mandate(value, customerId)); },
    async createSubscription(input: { customerId: string; mandateId: string; amountCents: number; period: 'month' | 'year'; startDate: string; description: string; webhookUrl: string; metadata: MollieMetadata; times?: number }, key: string) {
      if (!id(input.mandateId, 'mdt') || !date(input.startDate) || !['month', 'year'].includes(input.period) || !input.description || input.description.length > 255 || (input.times !== undefined && (!Number.isSafeInteger(input.times) || input.times < 1))) throw new MollieError('configuration_invalid'); ownCallback(input.webhookUrl, 'webhook');
      const value = subscription(await request(`${customerPath(input.customerId)}/subscriptions`, 'POST', { amount: mollieAmount(input.amountCents), interval: input.period === 'month' ? '1 month' : '12 months', startDate: input.startDate, description: input.description, mandateId: input.mandateId, webhookUrl: input.webhookUrl, metadata: metadata(input.metadata), ...(input.times !== undefined ? { times: input.times } : {}) }, key), input.customerId);
      if (value.amountCents !== input.amountCents || value.startDate !== input.startDate || value.mandateId !== input.mandateId || value.interval !== (input.period === 'month' ? '1 month' : '12 months')) return binding(); assertMollieMetadata(value.metadata, input.metadata); return value;
    },
    async getSubscription(customerId: string, subscriptionId: string) { const value = subscription(await request(subscriptionPath(customerId, subscriptionId)), customerId); if (value.id !== subscriptionId) return binding(); return value; },
    async listSubscriptions(customerId: string) { return (await list(`${customerPath(customerId)}/subscriptions`, 'subscriptions')).map(value => subscription(value, customerId)); },
    async cancelSubscription(customerId: string, subscriptionId: string, key: string) { const value = subscription(await request(subscriptionPath(customerId, subscriptionId), 'DELETE', undefined, key), customerId); if (value.id !== subscriptionId || value.status !== 'canceled') return binding(); return value; },
    async createRefund(paymentId: string, amountCents: number, meta: MollieMetadata, key: string) { const value = refund(await request(`${paymentPath(paymentId)}/refunds`, 'POST', { amount: mollieAmount(amountCents), description: 'Fabelpad terugbetaling', metadata: metadata(meta) }, key), paymentId); if (value.amountCents !== amountCents || value.metadata === null) return binding(); assertMollieMetadata(value.metadata, meta); return value; },
    async getRefund(paymentId: string, refundId: string) { if (!id(refundId, 're')) throw new MollieError('configuration_invalid'); const value = refund(await request(`${paymentPath(paymentId)}/refunds/${refundId}`), paymentId); if (value.id !== refundId) return binding(); return value; },
    async listRefunds(paymentId: string) { return (await list(`${paymentPath(paymentId)}/refunds`, 'refunds')).map(value => refund(value, paymentId)); },
  };
}
export type MollieClient = ReturnType<typeof createMollieClient>;
