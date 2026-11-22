import { formatEmailSender, type HookDeliveryConfiguration } from './auth-hook.ts';
import { AUTH_EMAIL_CATALOG, renderAuthEmail, renderServiceEmail, type AuthEmailAction, type EmailContext } from './templates.ts';
import { EmailDeliveryError, sendFabelpadEmail } from './resend.ts';
import { DEFAULT_EMAIL_SETTINGS, EMAIL_TEMPLATE_IDS, parseEmailSettings, parseResendApiKey, type EmailSettings, type EmailSettingsSnapshot, type EmailTemplateId } from './settings.ts';

type Environment = Record<string, string | undefined>;
export type EmailAdminActor = { id: string; email: string };
export interface EmailAdminBackend {
  /** Must call Auth getUser, reject anonymous/unconfirmed users and query content_admins with their JWT. */
  authenticate(accessToken: string): Promise<EmailAdminActor | null>;
  /** Service role by default; accessToken opts into the authenticated user's RLS context. */
  rpc<T = unknown>(name: string, parameters: Record<string, unknown>, accessToken?: string, signal?: AbortSignal): Promise<T>;
}
type ManagerOptions = { backend: EmailAdminBackend; fetch?: typeof fetch };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const mailbox = (value: unknown): value is string => typeof value === 'string' && value.length <= 254 && /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/u.test(value);
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const json = (status: number, value: unknown, retryAfter?: number) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...(status === 405 ? { Allow: 'POST' } : {}), ...(retryAfter ? { 'Retry-After': String(retryAfter) } : {}) } });
class ManagerError extends Error { constructor(readonly status: number, readonly code: string, readonly retryAfter?: number) { super(code); } }
function fail(status: number, code: string): never { throw new ManagerError(status, code); }
function contextFrom(environment: Environment): EmailContext {
  const origin = environment.FABELPAD_APP_ORIGIN ?? '', stage = environment.FABELPAD_ENVIRONMENT;
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.origin !== origin || url.username || url.password || (stage !== 'staging' && stage !== 'production')) throw new Error('Invalid email environment.');
  return { siteUrl: origin, environment: stage };
}
function snapshot(value: unknown): EmailSettingsSnapshot {
  if (!isObject(value) || !Number.isSafeInteger(value.revision) || (value.revision as number) < 0 || typeof value.keyConfigured !== 'boolean') throw new Error('Email settings unavailable.');
  const date = value.lastTestAt;
  if (date !== null && (typeof date !== 'string' || !Number.isFinite(Date.parse(date)))) throw new Error('Email settings unavailable.');
  if (value.lastTestProviderId !== null && (typeof value.lastTestProviderId !== 'string' || !/^[A-Za-z0-9-]{8,100}$/u.test(value.lastTestProviderId))) throw new Error('Email settings unavailable.');
  return { revision: value.revision as number, settings: parseEmailSettings(value.settings), keyConfigured: value.keyConfigured, lastTestAt: date as string | null, lastTestProviderId: value.lastTestProviderId as string | null };
}
function legacy(environment: Environment): HookDeliveryConfiguration | null {
  if (!environment.RESEND_API_KEY && !environment.FABELPAD_EMAIL_FROM && !environment.FABELPAD_EMAIL_REPLY_TO) return null;
  const match = /^Fabelpad(?: Staging)? <([^<>]+)>$/u.exec(environment.FABELPAD_EMAIL_FROM ?? '');
  if (!match) throw new Error('Email settings unavailable.');
  const settings = parseEmailSettings({ ...DEFAULT_EMAIL_SETTINGS, fromEmail: match[1], replyTo: environment.FABELPAD_EMAIL_REPLY_TO });
  return { revision: 0, settings, apiKey: parseResendApiKey(environment.RESEND_API_KEY) };
}
function delivery(value: unknown): HookDeliveryConfiguration | null {
  if (value === null) return null;
  if (!isObject(value) || !Number.isSafeInteger(value.revision) || (value.revision as number) < 1) throw new Error('Email settings unavailable.');
  return { revision: value.revision as number, settings: parseEmailSettings(value.settings), apiKey: parseResendApiKey(value.apiKey) };
}
function allowFields(body: Record<string, unknown>, fields: string[]) {
  if (Object.keys(body).some(key => !fields.includes(key))) fail(400, 'invalid_request');
}
async function readJson(request: Request): Promise<Record<string, unknown>> {
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/u.test(length) || Number(length) > 160 * 1024)) fail(413, 'request_too_large');
  const reader = request.body?.getReader(); if (!reader) fail(400, 'invalid_request');
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([(async () => {
      const decoder = new TextDecoder('utf-8', { fatal: true }); let raw = '', size = 0;
      while (true) {
        const part = await reader!.read(); if (part.done) break;
        size += part.value.byteLength; if (size > 160 * 1024) fail(413, 'request_too_large');
        raw += decoder.decode(part.value, { stream: true });
      }
      let value: unknown; try { value = JSON.parse(raw + decoder.decode()); } catch { return fail(400, 'invalid_request'); }
      if (!isObject(value)) fail(400, 'invalid_request'); return value;
    })(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new ManagerError(408, 'request_timeout')), 1000); })]);
  } catch (error) { if (error instanceof ManagerError) throw error; return fail(400, 'invalid_request'); }
  finally { if (timer) clearTimeout(timer); void reader!.cancel().catch(() => {}); }
}
function revision(value: unknown) { if (!Number.isSafeInteger(value) || (value as number) < 0) fail(400, 'invalid_request'); return value as number; }
function requestId(value: unknown) { if (typeof value !== 'string' || !UUID.test(value)) fail(400, 'invalid_request'); return value as string; }
function action(value: unknown): AuthEmailAction { if (typeof value !== 'string' || !Object.hasOwn(AUTH_EMAIL_CATALOG, value)) fail(400, 'invalid_request'); return value as AuthEmailAction; }
function templateId(value: unknown): EmailTemplateId { if (typeof value !== 'string' || !(EMAIL_TEMPLATE_IDS as readonly string[]).includes(value)) fail(400, 'invalid_request'); return value as EmailTemplateId; }
function submittedSettings(value: unknown) { try { return parseEmailSettings(value); } catch { return fail(400, 'invalid_request'); } }
function submittedKey(value: unknown) { try { return parseResendApiKey(value); } catch { return fail(400, 'invalid_request'); } }
async function idempotencyKey(stage: string, actor: string, id: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${stage}\n${actor}\n${id}`)));
  return `fabelpad-mail-test/${Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')}`;
}
const previewValues = (context: EmailContext) => ({ token: '123456', confirmationUrl: `${context.siteUrl}/auth/confirm?type=invite`, email: 'ouder@example.test', newEmail: 'nieuw@example.test', oldEmail: 'vorig@example.test', phone: '+31000000000', oldPhone: '+31000000001', provider: 'Voorbeeld', factorType: 'Voorbeeld' });
async function boundedJson(response: Response, limit = 64 * 1024): Promise<unknown> {
  const reader = response.body?.getReader(); if (!reader) throw new Error('Provider unavailable.');
  const decoder = new TextDecoder(); let body = '', size = 0;
  try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > limit) throw new Error('Provider response too large.'); body += decoder.decode(part.value, { stream: true }); } return JSON.parse(body + decoder.decode()); }
  finally { await reader.cancel().catch(() => {}); }
}
async function senderDomain(current: HookDeliveryConfiguration, fetcher: typeof fetch) {
  const name = current.settings.fromEmail.split('@')[1].toLowerCase();
  const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
  const run = async () => {
    const get = (path: string) => fetcher(`https://api.resend.com${path}`, { method: 'GET', redirect: 'error', signal: controller.signal, headers: { Authorization: `Bearer ${current.apiKey}`, 'User-Agent': 'Fabelpad/1.0 (transactional-mail)' } });
    const list = await get('/domains');
    if (list.status === 403) { await list.body?.cancel(); return { status: 'restricted', domain: name }; }
    if (!list.ok) { await list.body?.cancel(); throw new ManagerError(502, 'domain_check_failed'); }
    const payload = await boundedJson(list);
    if (!isObject(payload) || !Array.isArray(payload.data)) throw new Error('Provider response invalid.');
    const match = payload.data.find(item => isObject(item) && item.name === name);
    if (!isObject(match) || typeof match.id !== 'string' || !/^[A-Za-z0-9-]{8,100}$/u.test(match.id)) return { status: payload.has_more === true ? 'incomplete' : 'not_found', domain: name };
    const detail = await get(`/domains/${encodeURIComponent(match.id)}`);
    if (detail.status === 403) { await detail.body?.cancel(); return { status: 'restricted', domain: name }; }
    if (!detail.ok) { await detail.body?.cancel(); throw new ManagerError(502, 'domain_check_failed'); }
    const info = await boundedJson(detail);
    if (!isObject(info) || info.name !== name || typeof info.status !== 'string' || !/^[a-z_]{2,40}$/u.test(info.status) || typeof info.open_tracking !== 'boolean' || typeof info.click_tracking !== 'boolean' || !Array.isArray(info.records)) throw new Error('Provider response invalid.');
    const string = (value: unknown, max = 2048) => typeof value === 'string' && value.length <= max && !/[\u0000-\u001f\u007f]/u.test(value) ? value : '';
    return { status: string(info.status, 40), domain: name, openTracking: info.open_tracking === true, clickTracking: info.click_tracking === true,
      records: info.records.slice(0, 30).filter(isObject).map(record => ({ record: string(record.record, 40), name: string(record.name, 254), type: string(record.type, 20), value: string(record.value), status: string(record.status, 40), ttl: string(record.ttl, 40), ...(typeof record.priority === 'number' && Number.isSafeInteger(record.priority) ? { priority: record.priority } : {}) })) };
  };
  try { return await Promise.race([run(), new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new ManagerError(504, 'domain_check_timeout')); }, 6000); })]); }
  finally { if (timer) clearTimeout(timer); }
}
/** Admin-only mail control plane. It never returns API keys, raw provider errors,
 * JWTs or user-provided recipients; testing always targets the verified admin.
 * Every write verifies delivery acceptance before atomically replacing config.
 */
export function createEmailAdminHandler(environment: Environment, options: ManagerOptions) {
  let context: EmailContext | null = null; try { context = contextFrom(environment); } catch { /* Fail closed. */ }
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });
    if (!context) return json(503, { error: 'email_settings_unavailable' });
    if ((request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase() !== 'application/json' || request.headers.has('content-encoding')) return json(415, { error: 'unsupported_media_type' });
    try {
      const token = /^Bearer ([A-Za-z0-9._-]{20,8192})$/u.exec(request.headers.get('authorization') ?? '')?.[1];
      if (!token) fail(401, 'sign_in_required');
      const actor = await options.backend.authenticate(token);
      if (!actor || !UUID.test(actor.id) || !mailbox(actor.email)) fail(403, 'admin_required');
      const body = await readJson(request);
      if (body.action === 'get') {
        allowFields(body, ['action']);
        const value = snapshot(await options.backend.rpc('get_email_settings', {}, token));
        const fallback = value.revision === 0 ? legacy(environment) : null;
        return json(200, { ...value, ...(fallback ? { settings: fallback.settings, keyConfigured: true } : {}), environment: context.environment, appOrigin: context.siteUrl, source: value.revision > 0 ? 'vault' : fallback ? 'server' : 'unconfigured' });
      }
      if (body.action === 'preview') {
        allowFields(body, ['action', 'templateAction', 'settings']);
        const settings = body.settings === undefined ? snapshot(await options.backend.rpc('get_email_settings', {}, token)).settings : submittedSettings(body.settings);
        const id = templateId(body.templateAction), previewContext = { ...context, settings };
        const rendered = Object.hasOwn(AUTH_EMAIL_CATALOG, id) ? renderAuthEmail(action(id), previewValues(context), previewContext)
          : id === 'service-notice' ? renderServiceEmail({ kind: 'service-notice', subject: 'Een servicebericht van Fabelpad', title: 'Een bericht over je ouderaccount', paragraphs: ['Dit is een voorbeeld van een servicebericht over je ouderaccount.'] }, previewContext)
          : renderServiceEmail({ kind: id as 'welcome' | 'account-deletion-requested' | 'account-deleted' }, previewContext);
        return json(200, rendered);
      }
      if (body.action === 'domain') {
        allowFields(body, ['action']);
        const current = delivery(await options.backend.rpc('get_email_delivery_config', {})) ?? legacy(environment);
        if (!current) fail(409, 'email_not_configured');
        return json(200, await senderDomain(current, options.fetch ?? fetch));
      }
      if (body.action !== 'save' && body.action !== 'test') fail(400, 'invalid_request');
      allowFields(body, body.action === 'save' ? ['action', 'baseRevision', 'requestId', 'apiKey', 'settings', 'trackingDisabledConfirmed'] : ['action', 'baseRevision', 'requestId', 'trackingDisabledConfirmed']);
      const expected = revision(body.baseRevision), id = requestId(body.requestId);
      const existing = snapshot(await options.backend.rpc('get_email_settings', {}, token));
      if (existing.revision !== expected) fail(409, 'settings_changed');
      const current = delivery(await options.backend.rpc('get_email_delivery_config', {})) ?? legacy(environment);
      if (current && current.revision !== expected) fail(409, 'settings_changed');
      if (body.action === 'test' && existing.revision === 0) fail(409, 'settings_save_required');
      const settings: EmailSettings = body.action === 'save' ? submittedSettings(body.settings) : current?.settings ?? fail(409, 'email_not_configured');
      const replacement = body.apiKey === undefined || body.apiKey === '' ? null : submittedKey(body.apiKey);
      const apiKey = replacement ?? current?.apiKey ?? fail(409, 'api_key_required');
      const domain = await senderDomain({ revision: expected, settings, apiKey }, options.fetch ?? fetch);
      if ('openTracking' in domain && (domain.openTracking || domain.clickTracking)) fail(409, 'tracking_enabled');
      if (domain.status === 'restricted' && body.trackingDisabledConfirmed !== true) fail(409, 'tracking_confirmation_required');
      if (domain.status === 'not_found' || domain.status === 'incomplete') fail(409, 'sender_domain_not_found');
      if (domain.status !== 'restricted' && domain.status !== 'verified') fail(409, 'sender_domain_unverified');
      const reserved = await options.backend.rpc<{ allowed: boolean; retryAfter: number }>('reserve_email_test', { p_actor_id: actor.id, p_request_id: id });
      if (!isObject(reserved) || reserved.allowed !== true) throw new ManagerError(429, 'test_rate_limited', Number.isSafeInteger(reserved?.retryAfter) ? Math.max(1, Math.min(86400, reserved.retryAfter)) : 30);
      const message = renderServiceEmail({ kind: 'service-notice', subject: 'Fabelpad e-mailtest', title: 'Je e-mailkoppeling werkt', paragraphs: ['Dit testbericht is verstuurd vanuit de Fabelpad-beheeromgeving. Resend heeft het verzendverzoek geaccepteerd. Controleer je inbox en spammap om de ontvangst zelf te bevestigen.', 'De ingestelde afzender, antwoordadres en vormgeving zijn voor dit bericht gebruikt.'] }, { ...context, settings });
      const accepted = await sendFabelpadEmail({ apiKey, from: formatEmailSender(settings, context.environment), replyTo: settings.replyTo, to: actor.email, message, idempotencyKey: await idempotencyKey(context.environment, actor.id, id) }, options.fetch);
      const raw = await options.backend.rpc(body.action === 'save' ? 'save_email_settings' : 'record_email_test', {
        p_actor_id: actor.id, p_expected_revision: expected, p_test_provider_id: accepted.providerId, p_request_id: id,
        ...(body.action === 'save' ? { p_settings: settings, p_api_key: replacement ?? (existing.revision === 0 ? apiKey : null) } : {}),
      });
      if (!isObject(raw) || raw.saved !== true) fail(409, 'settings_changed');
      return json(200, { ...snapshot(raw), source: 'vault', environment: context.environment, appOrigin: context.siteUrl, testStatus: 'accepted', testRecipient: actor.email });
    } catch (error) {
      if (error instanceof ManagerError) return json(error.status, { error: error.code }, error.retryAfter);
      if (error instanceof EmailDeliveryError) return json(error.retryable ? 503 : 422, { error: 'test_not_accepted' });
      // Input validation and backend errors use one deliberately non-diagnostic message.
      return json(503, { error: 'email_settings_unavailable' });
    }
  };
}
