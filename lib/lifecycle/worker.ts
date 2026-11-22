import { renderServiceEmail, type EmailEnvironment, type RenderedEmail } from '../email/templates.ts';
import { formatEmailSender } from '../email/auth-hook.ts';
import { sendFabelpadEmail } from '../email/resend.ts';
import { parseEmailSettings, parseResendApiKey, DEFAULT_EMAIL_SETTINGS } from '../email/settings.ts';

type Environment = Record<string, string | undefined>;
type Job = { id: string; leaseId: string; parentId: string; kind: string; payload: Record<string, unknown> };
type Context = { parentId: string; kind: string; alreadyDeleted: boolean; recipient?: string; payload: Record<string, unknown>; objects?: { bucket: string; name: string }[] };
type Delivery = { from: string; to: string; replyTo: string; message: RenderedEmail };
export type LifecycleBackend = {
  rpc<T>(name: string, parameters?: Record<string, unknown>): Promise<T>;
  removeStorage(bucket: string, names: string[]): Promise<void>;
  deleteAuth(userId: string): Promise<void>;
  authExists(userId: string): Promise<boolean>;
};
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
const kinds = ['welcome', 'deletion_requested', 'account_restored', 'inactivity_14', 'inactivity_3', 'delete_account'];
function deadline(value: unknown) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error('configuration_unavailable');
  const date = new Date(value);
  return new Intl.DateTimeFormat('nl-NL', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Amsterdam' }).format(date) + ' (Nederlandse tijd)';
}
function messageFor(context: Context, siteUrl: string, environment: EmailEnvironment, settings: ReturnType<typeof parseEmailSettings>): RenderedEmail {
  const brand = { siteUrl, environment, settings };
  if (context.kind === 'welcome') return renderServiceEmail({ kind: 'welcome' }, brand);
  const restore = '/profiel/account/herstellen';
  if (context.kind === 'deletion_requested') return renderServiceEmail({ kind: 'service-notice', subject: 'Je Fabelpad-account staat stil voor verwijdering', title: 'Je verwijderaanvraag is bevestigd', paragraphs: [
    'Je hebt de verwijdering van je gezinsaccount aangevraagd.',
    `Je account staat meteen stil. Op ${deadline(context.payload.deadline)} verwijderen we het account en alle bijbehorende online kinderprofielen, voortgang en voorkeuren.`,
    'Wil je dit ongedaan maken? Open de beveiligde herstelroute, log opnieuw in als ouder en bevestig daar uitdrukkelijk dat je het account wilt herstellen. Alleen inloggen of de app opnieuw installeren herstelt niets. Herstellen kan uitsluitend vóór de genoemde datum en tijd.',
    'Wil je gegevens eerder laten wissen of heb je hulp nodig? Mail support@fabelpad.nl. Een verzoek volgens de AVG kent geen vaste wachttijd van 30 dagen.',
    'Er zijn momenteel geen betaalde abonnementen. Herstel start nooit automatisch een betaling of verlenging.',
  ], action: { label: 'Bekijk de beveiligde herstelroute', path: restore } }, brand);
  if (context.kind === 'account_restored') return renderServiceEmail({ kind: 'service-notice', subject: 'Je Fabelpad-account is hersteld', title: 'Je account is weer beschikbaar', paragraphs: [
    'Je hebt de verwijdering van je account uitdrukkelijk geannuleerd.',
    'Je gezinsaccount is weer actief. De termijn van 90 dagen zonder bewust gezinsgebruik begint opnieuw. Een gestopte betaling of verlenging wordt nooit automatisch herstart.',
    'Heb je dit niet zelf gedaan? Mail support@fabelpad.nl.',
  ], action: { label: 'Open het oudergedeelte', path: '/profiel/account' } }, brand);
  if (context.kind === 'inactivity_14' || context.kind === 'inactivity_3') return renderServiceEmail({ kind: 'service-notice', subject: 'Gebruik Fabelpad vóór de verwijderdatum', title: 'Wil je je gezinsaccount behouden?', paragraphs: [
    'We hebben al een tijd geen bewust gebruik van je gezinsaccount geregistreerd.',
    `Als niemand in het gezin Fabelpad vóór ${deadline(context.payload.deadline)} bewust gebruikt, verwijderen we op dat moment het gezinsaccount met alle online kinderprofielen, voortgang en voorkeuren. Daarna is herstel niet mogelijk; er volgt geen extra wachttijd van 30 dagen.`,
    'Je voorkomt dit door vóór die datum in het oudergedeelte in te loggen en Fabelpad te gebruiken, of door echt verder te lezen onder een gekoppeld online kinderprofiel. Offline leesactiviteit telt alleen mee als deze vóór de deadline bij Fabelpad is gesynchroniseerd. Alleen deze e-mail openen of automatische achtergrondverversing telt niet mee.',
    'Er zijn momenteel geen betaalde abonnementen. Lees de voorwaarden voor de bescherming die geldt wanneer later betaalde toegang wordt aangeboden.',
    'Staat hier inmiddels recent gebruik tegenover? Dan vervalt deze waarschuwing automatisch. Mail support@fabelpad.nl als je hulp nodig hebt.',
  ], action: { label: 'Open Fabelpad als ouder', path: '/profiel/account' } }, brand);
  throw new Error('configuration_unavailable');
}
function frozenDelivery(value: unknown): Delivery {
  if (!value || typeof value !== 'object') throw new Error('configuration_unavailable');
  const delivery = value as Delivery;
  if (typeof delivery.to !== 'string' || typeof delivery.from !== 'string' || typeof delivery.replyTo !== 'string' || !delivery.message || typeof delivery.message.subject !== 'string' || typeof delivery.message.html !== 'string' || typeof delivery.message.text !== 'string') throw new Error('configuration_unavailable');
  return delivery;
}
/** Every request carries a short-lived, own-project HMAC and one-use nonce.
 * The signing key stays in Vault; a service-only verifier consumes each proof. No user identity, recipient, clock or delete target is
 * accepted from HTTP. Jobs, deadlines and deletion scopes come from PostgreSQL.
 */
export function createLifecycleWorker(environment: Environment, dependencies: { backend: LifecycleBackend; fetch?: typeof fetch }): (request: Request) => Promise<Response> {
  const backend = dependencies.backend, fetcher = dependencies.fetch ?? fetch;
  const respond = (body: object, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  return async request => {
    if (request.method !== 'POST') return respond({ error: 'method_not_allowed' }, 405);
    // Reusable bearer credentials are not accepted on this endpoint.
    if (request.headers.has('authorization')) return respond({ error: 'not_authenticated' }, 401);
    try {
      // Bound streaming before verifying the proof, even if a
      // malicious client forges Content-Length or holds an unbounded body open.
      if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return respond({ error: 'invalid_request' }, 415);
      const controller = new AbortController(); let bodyReader: ReadableStreamDefaultReader<Uint8Array> | undefined; let timer: ReturnType<typeof setTimeout> | undefined;
      const readBody = async () => {
        const reader = request.body?.getReader(); if (!reader) return {}; bodyReader=reader;
        let size = 0, raw = ''; const decoder = new TextDecoder();
        try { while (true) { const part = await reader.read(); if (controller.signal.aborted) throw new Error(); if (part.done) break; size += part.value.byteLength; if (size > 1024) throw new Error(); raw += decoder.decode(part.value, { stream: true }); } return JSON.parse(raw + decoder.decode()); }
        finally { await reader.cancel().catch(() => {}); }
      };
      let body: unknown;
      try { body = await Promise.race([readBody(), new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); void bodyReader?.cancel().catch(()=>{}); reject(new Error()); }, 500); })]); }
      catch { return respond({ error: 'invalid_request' }, 422); }
      finally { if (timer) clearTimeout(timer); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return respond({ error: 'invalid_request' }, 422);
      const proof=body as Record<string,unknown>;
      if (Object.keys(proof).some(key=>!['nonce','issuedAt','signature'].includes(key))) return respond({error:'invalid_request'},422);
      if (!uuid(proof.nonce) || typeof proof.issuedAt!=='number' || !Number.isSafeInteger(proof.issuedAt) || proof.issuedAt<1 || typeof proof.signature!=='string' || !/^[a-f0-9]{64}$/u.test(proof.signature)) return respond({error:'not_authenticated'},401);
      if (!await backend.rpc<boolean>('verify_lifecycle_worker_request',{p_nonce:proof.nonce,p_issued_at:proof.issuedAt,p_signature:proof.signature})) return respond({error:'not_authenticated'},401);
      const siteUrl = environment.FABELPAD_APP_ORIGIN ?? '', stage = environment.FABELPAD_ENVIRONMENT;
      if (!['production', 'staging'].includes(stage ?? '') || !/^https:\/\/[^/]+$/u.test(siteUrl)) return respond({ error: 'configuration_unavailable' }, 503);
      const jobs = await backend.rpc<Job[]>('claim_lifecycle_jobs', { p_limit: 3 });
      if (!Array.isArray(jobs) || jobs.length > 3 || jobs.some(job => !uuid(job.id) || !uuid(job.leaseId) || !uuid(job.parentId) || !kinds.includes(job.kind))) throw new Error();
      let completed = 0, deferred = 0;
      for (const job of jobs) {
        let safeError = 'provider_unavailable';
        try {
          let context = await backend.rpc<Context | null>('get_lifecycle_job_context', { p_job_id: job.id, p_lease_id: job.leaseId });
          if (!context) continue;
          if (context.parentId !== job.parentId || context.kind !== job.kind) throw new Error();
          if (job.kind === 'delete_account') {
            safeError = 'storage_unverified';
            {
              if (!Array.isArray(context.objects) || context.objects.length > 10000) throw new Error();
              const buckets = new Map<string, string[]>();
              for (const object of context.objects) {
                if (typeof object.bucket !== 'string' || !/^[A-Za-z0-9._-]{1,100}$/u.test(object.bucket) || typeof object.name !== 'string' || !object.name || object.name.length > 1024 || /[\u0000-\u001f]/u.test(object.name)) throw new Error();
                buckets.set(object.bucket, [...(buckets.get(object.bucket) ?? []), object.name]);
              }
              for (const [bucket, names] of buckets) for (let i = 0; i < names.length; i += 100) await backend.removeStorage(bucket, names.slice(i, i + 100));
              context = await backend.rpc<Context | null>('get_lifecycle_job_context', { p_job_id: job.id, p_lease_id: job.leaseId });
              if (!context || context.parentId !== job.parentId || !Array.isArray(context.objects) || context.objects.length) throw new Error();
              safeError = 'auth_unavailable';
              if (!context.alreadyDeleted) await backend.deleteAuth(job.parentId);
            }
            safeError = 'auth_unavailable';
            if (await backend.authExists(job.parentId)) throw new Error();
            const success = await backend.rpc<boolean>('complete_lifecycle_job', { p_job_id: job.id, p_lease_id: job.leaseId, p_auth_deleted: true, p_storage_checked: true });
            if (!success) throw new Error();
          } else {
            safeError = 'configuration_unavailable';
            const saved = await backend.rpc<unknown>('get_email_delivery_config');
            const configuration = saved === null ? null : (() => {
              if (!saved || typeof saved!=='object' || !('revision' in saved) || !Number.isSafeInteger(saved.revision) || Number(saved.revision)<1 || !('settings' in saved) || !('apiKey' in saved)) throw new Error();
              return {settings:parseEmailSettings(saved.settings),apiKey:parseResendApiKey(saved.apiKey)};
            })();
            const settings = configuration?.settings ?? parseEmailSettings({ ...DEFAULT_EMAIL_SETTINGS, ...(environment.FABELPAD_EMAIL_REPLY_TO ? { replyTo: environment.FABELPAD_EMAIL_REPLY_TO } : {}) });
            const apiKey = configuration?.apiKey ?? environment.RESEND_API_KEY;
            if (!apiKey || !context.recipient) throw new Error();
            const from = configuration ? formatEmailSender(settings, stage!) : environment.FABELPAD_EMAIL_FROM;
            if (!from) throw new Error();
            const delivery = frozenDelivery(await backend.rpc<unknown>('freeze_lifecycle_email', {
              p_job_id: job.id, p_lease_id: job.leaseId,
              p_delivery: { from, to: context.recipient, replyTo: settings.replyTo, message: messageFor(context, siteUrl, stage as EmailEnvironment, settings) },
            }));
            safeError = 'provider_unavailable';
            const receipt = await sendFabelpadEmail({ ...delivery, apiKey, idempotencyKey: `fabelpad-lifecycle/${job.id}` }, fetcher);
            const success = await backend.rpc<boolean>('complete_lifecycle_job', { p_job_id: job.id, p_lease_id: job.leaseId, p_provider_id: receipt.providerId });
            if (!success) throw new Error();
          }
          completed++;
        } catch {
          await backend.rpc('fail_lifecycle_job', { p_job_id: job.id, p_lease_id: job.leaseId, p_error: safeError }).catch(() => {});
          deferred++;
        }
      }
      return respond({ completed, deferred });
    } catch { return respond({ error: 'maintenance_unavailable' }, 503); }
  };
}
