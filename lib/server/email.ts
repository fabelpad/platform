import { getSupabaseConfig } from '../supabase/config';
import { createSupabaseServerClient, getVerifiedParent, isContentAdmin } from '../supabase/server';
import { parseEmailSettings, parseResendApiKey } from '../email/settings';
import { checkMutationOrigin, object, privateJson, readJson, RequestError } from './http';

type Action = 'get' | 'save' | 'test' | 'domain' | 'preview';
const messages: Record<string, string> = {
  sign_in_required: 'Log opnieuw in om je e-mailinstellingen te beheren.',
  admin_required: 'Alleen een beheerder kan e-mailinstellingen wijzigen.',
  settings_changed: 'Een andere beheerder heeft deze instellingen gewijzigd. Laad de opgeslagen instellingen opnieuw voordat je opslaat.',
  test_rate_limited: 'Wacht even voordat je opnieuw een testmail verstuurt.',
  tracking_enabled: 'Zet open- en kliktracking voor dit domein uit in Resend voordat je opslaat.',
  tracking_confirmation_required: 'Bevestig dat open- en kliktracking voor dit domein uitstaan in Resend.',
  sender_domain_not_found: 'Het afzenderdomein is niet gevonden in Resend. Controleer het domein en de rechten van de API-key.',
  sender_domain_unverified: 'Verifieer eerst het afzenderdomein in Resend voordat je opslaat.',
  settings_save_required: 'Sla de koppeling eerst op met een testmail voordat je een losse test verstuurt.',
  api_key_required: 'Vul eerst een Resend API-key in.',
  email_not_configured: 'Koppel eerst Resend en sla de e-mailinstellingen op.',
  test_not_accepted: 'Resend heeft de testmail niet geaccepteerd. Controleer de API-key en het geverifieerde afzenderdomein.',
  domain_check_failed: 'De domeinstatus kon niet worden gecontroleerd. Controleer de API-key en de rechten in Resend.',
  domain_check_timeout: 'De domeincontrole duurt te lang. Probeer het opnieuw.',
  invalid_request: 'Controleer de ingevulde e-mailinstellingen.',
};
function unavailable(): never { throw new RequestError(503, 'email_settings_unavailable', 'De e-mailinstellingen zijn tijdelijk niet bereikbaar.'); }
const boundedText = (value: unknown, max: number) => typeof value === 'string' && value.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value) ? value : unavailable();
async function responseJson(response: Response): Promise<unknown> {
  if (!response.headers.get('content-type')?.toLowerCase().startsWith('application/json')) unavailable();
  const reader = response.body?.getReader(); if (!reader) unavailable();
  let size = 0; const parts: Uint8Array[] = [];
  try {
    while (true) { const part = await reader!.read(); if (part.done) break; size += part.value.length; if (size > 256 * 1024) unavailable(); parts.push(part.value); }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.length; }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } finally { await reader!.cancel().catch(() => {}); }
}

/** The browser sends only a request-local user JWT. Service credentials and the
 * decrypted Resend key remain inside Supabase; upstream responses are projected
 * onto an explicit public DTO so an accidental secret field cannot escape. */
export async function emailAdminRequest(request: Request, action: Action): Promise<Response> {
  try {
    if (request.method !== 'GET') checkMutationOrigin(request);
    const config = getSupabaseConfig(); if (!config) unavailable();
    // Pin the target before Auth calls or any secret-bearing/sending operation.
    // A structurally valid but swapped URL must never write the other project.
    const targets = {
      'https://staging.fabelpad.nl': { environment: 'staging', url: 'https://tlwfpivafcokcjyjwgmq.supabase.co' },
      'https://fabelpad.nl': { environment: 'production', url: 'https://aptprpkosqctwrzeetgs.supabase.co' },
    } as const;
    const target = targets[config.appUrl as keyof typeof targets];
    const configuredEnvironment = process.env.FABELPAD_DEPLOY_ENV;
    if (!target || config.url !== target.url || (configuredEnvironment && configuredEnvironment !== 'local' && configuredEnvironment !== target.environment)) unavailable();
    const client = await createSupabaseServerClient();
    const parent = await getVerifiedParent(client);
    if (!parent) throw new RequestError(401, 'sign_in_required', messages.sign_in_required);
    const expected = request.headers.get('x-fabelpad-parent');
    if ((request.method !== 'GET' || expected !== null) && expected !== parent.id) throw new RequestError(401, 'account_changed', 'Het beheeraccount is gewijzigd. Laad de e-mailinstellingen opnieuw.');
    if (!await isContentAdmin(client, parent.id)) throw new RequestError(403, 'admin_required', messages.admin_required);
    // getSession supplies transport only, after getUser and the current DB role.
    const { data: { session }, error } = await client.auth.getSession();
    if (error || !session?.access_token) throw new RequestError(401, 'sign_in_required', messages.sign_in_required);
    let body: Record<string, unknown> = { action };
    if (action === 'save' || action === 'test' || (action === 'preview' && request.method === 'POST')) {
      const input = await readJson(request, 160 * 1024);
      if (!object(input)) throw new RequestError(400, 'invalid_request', messages.invalid_request);
      const permitted = action === 'save' ? ['baseRevision', 'requestId', 'apiKey', 'settings', 'trackingDisabledConfirmed'] : action === 'test' ? ['revision', 'requestId', 'trackingDisabledConfirmed'] : ['templateAction', 'settings'];
      if (Object.keys(input).some(key => !permitted.includes(key))) throw new RequestError(400, 'invalid_request', messages.invalid_request);
      body = { ...input, action };
      try {
        if (action === 'save' || (action === 'preview' && input.settings !== undefined)) body.settings = parseEmailSettings(input.settings);
        if (action === 'save' && input.apiKey !== undefined && input.apiKey !== '') body.apiKey = parseResendApiKey(input.apiKey);
      } catch { throw new RequestError(400, 'invalid_request', messages.invalid_request); }
      if (action === 'test') { body.baseRevision = body.revision; delete body.revision; }
    } else if (action === 'preview') body.templateAction = new URL(request.url).searchParams.get('template');
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let result: unknown; let status: number; let retry = 0;
    try {
      const run = async () => {
        const response = await fetch(`${config.url}/functions/v1/email-admin`, {
          method: 'POST', cache: 'no-store', redirect: 'error', signal: controller.signal,
          headers: { 'Content-Type': 'application/json', apikey: config.publishableKey, Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify(body),
        });
        status = response.status;
        retry = Math.min(86400, Math.max(0, Number(response.headers.get('retry-after')) || 0));
        result = await responseJson(response);
      };
      await Promise.race([run(), new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('Email unavailable')); }, 20_000); })]);
    } finally { if (timer) clearTimeout(timer); }
    if (!object(result)) unavailable();
    if (status! < 200 || status! >= 300) {
      const code = typeof result.error === 'string' && Object.hasOwn(messages, result.error) ? result.error : 'email_settings_unavailable';
      const safeStatus = [400, 401, 403, 409, 413, 415, 422, 429, 502, 503, 504].includes(status!) ? status! : 503;
      return privateJson({ error: code, message: messages[code] ?? 'De e-mailinstellingen zijn tijdelijk niet bereikbaar.' }, safeStatus, safeStatus === 429 && retry ? { 'Retry-After': String(Math.ceil(retry)) } : {});
    }
    if (action === 'preview') {
      const html = boundedText(result.html, 96 * 1024), subject = boundedText(result.subject, 500);
      if (request.method === 'GET') return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store', Vary: 'Cookie', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'" } });
      return privateJson({ html, subject });
    }
    if (action === 'domain') {
      const status = result.status === 'verified' ? 'verified' : result.status === 'restricted' ? 'restricted' : 'pending';
      const records = Array.isArray(result.records) ? result.records.slice(0, 30).filter(object).map(record => ({ type: boundedText(record.type, 20), name: boundedText(record.name, 254), value: boundedText(record.value, 2048), status: boundedText(record.status, 40) })) : [];
      return privateJson({ status, domain: boundedText(result.domain, 254), records, tracking: { open: typeof result.openTracking === 'boolean' ? result.openTracking : null, click: typeof result.clickTracking === 'boolean' ? result.clickTracking : null } });
    }
    const expectedEnvironment = target.environment;
    if (result.environment !== expectedEnvironment || result.appOrigin !== config.appUrl) unavailable();
    if (!Number.isSafeInteger(result.revision) || (result.revision as number) < 0 || typeof result.keyConfigured !== 'boolean' || !['vault', 'server', 'unconfigured'].includes(String(result.source))) unavailable();
    if (result.lastTestAt !== null && (typeof result.lastTestAt !== 'string' || !Number.isFinite(Date.parse(result.lastTestAt)))) unavailable();
    const snapshot = { environment: expectedEnvironment, appOrigin: config.appUrl, configured: result.keyConfigured, source: result.source === 'unconfigured' ? 'none' : result.source, revision: result.revision,
      keyConfigured: result.keyConfigured, settings: parseEmailSettings(result.settings), lastTestAt: result.lastTestAt,
      auth: { emailEnabled: config.emailEnabled, googleEnabled: config.googleEnabled },
    };
    if (action === 'test') {
      if (result.testStatus !== 'accepted') unavailable();
      return privateJson({ accepted: true, acceptedAt: result.lastTestAt });
    }
    if (action === 'save' && result.testStatus !== 'accepted') unavailable();
    return privateJson({ ...snapshot, ...(action === 'save' ? { test: { accepted: true, acceptedAt: result.lastTestAt } } : {}) });
  } catch (error) {
    if (error instanceof RequestError) return privateJson({ error: error.code, message: error.message }, error.status);
    return privateJson({ error: 'email_settings_unavailable', message: 'De e-mailinstellingen zijn tijdelijk niet bereikbaar.' }, 503);
  }
}
