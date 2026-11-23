import type { BillingJob } from './types.ts';
import { processMollieBillingJob, type BillingProviderBackend } from './mollie-service.ts';
import { createPlayBillingService } from './play-service.ts';
import { createPlayCredentialAccessToken } from './play.ts';
import { resolveHostedEmailTarget } from '../email/hosted-target.ts';
import { parseEmailSettings, parseResendApiKey } from '../email/settings.ts';
import { formatEmailSender } from '../email/auth-hook.ts';
import { renderServiceEmail, type RenderedEmail } from '../email/templates.ts';
import { sendFabelpadEmail } from '../email/resend.ts';

type Environment = Record<string, string | undefined>;
type Delivery = { from: string; to: string; replyTo: string; message: RenderedEmail };
type PlayWorker = { handleJob(job: BillingJob): Promise<unknown> };
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
function frozen(value: unknown): Delivery {
  if (!object(value) || typeof value.from !== 'string' || typeof value.to !== 'string' || typeof value.replyTo !== 'string' || !object(value.message) || typeof value.message.subject !== 'string' || typeof value.message.html !== 'string' || typeof value.message.text !== 'string') throw new Error('billing_email_invalid');
  return value as Delivery;
}
async function emailJob(job: BillingJob, backend: BillingProviderBackend, environment: Environment, fetcher: typeof fetch, timestamp: number) {
  try {
    const first = typeof job.firstAttemptAt === 'string' ? Date.parse(job.firstAttemptAt) : NaN;
    // Resend's idempotency lasts 24h. Do not replay an uncertain delivery after
    // that window. The durable attention row remains visible to the admin.
    if (!Number.isFinite(first) || timestamp < first || timestamp - first >= 23 * 3_600_000) throw new Error('billing_email_idempotency_expired');
    const context = await backend.rpc<unknown>('get_billing_email_context', { p_job_id: job.id, p_lease_token: job.leaseToken });
    if (context === null) {
      const outcome = await backend.rpc<{ completed: boolean }>('complete_billing_job', { p_job_id: job.id, p_lease_token: job.leaseToken, p_result: { skipped: true } });
      if (!outcome.completed) throw new Error('billing_email_completion_unconfirmed'); return true;
    }
    if (!object(context) || typeof context.recipient !== 'string' || typeof context.subject !== 'string' || typeof context.title !== 'string' || !Array.isArray(context.paragraphs) || context.paragraphs.some(value => typeof value !== 'string') || (context.actionPath !== undefined && (typeof context.actionPath !== 'string' || !( /^\/profiel\/(?:abonnement|account)(?:[/?]|$)/u.test(context.actionPath) || /^\/herroepen#token=[a-f0-9]{64}$/u.test(context.actionPath))))) throw new Error('billing_email_invalid');
    const config = await backend.rpc<unknown>('get_email_delivery_config');
    if (!object(config) || !Number.isSafeInteger(config.revision) || Number(config.revision) < 1) throw new Error('billing_email_configuration_unavailable');
    const settings = parseEmailSettings(config.settings), apiKey = parseResendApiKey(config.apiKey);
    const message = renderServiceEmail({ kind: 'service-notice', subject: context.subject, title: context.title, paragraphs: ['Dit is een servicebericht over je Fabelpad-abonnement.', ...context.paragraphs as string[]], ...(typeof context.actionPath === 'string' ? { action: { label: context.actionPath.startsWith('/herroepen#') ? 'Bevestig je herroepingsverzoek' : 'Bekijk je Fabelpad-abonnement', path: context.actionPath } } : {}) }, { siteUrl: environment.FABELPAD_APP_ORIGIN!, environment: environment.FABELPAD_ENVIRONMENT as 'staging' | 'production', settings });
    const delivery = frozen(await backend.rpc('freeze_billing_email', { p_job_id: job.id, p_lease_token: job.leaseToken, p_delivery: { from: formatEmailSender(settings, environment.FABELPAD_ENVIRONMENT!), to: context.recipient, replyTo: settings.replyTo, message } }));
    const receipt = await sendFabelpadEmail({ ...delivery, apiKey, idempotencyKey: `fabelpad-billing/${job.id}` }, fetcher);
    const outcome = await backend.rpc<{ completed: boolean }>('complete_billing_job', { p_job_id: job.id, p_lease_token: job.leaseToken, p_result: receipt });
    if (!outcome.completed) throw new Error('billing_email_completion_unconfirmed'); return true;
  } catch (error) {
    const known = error instanceof Error && ['billing_email_idempotency_expired', 'billing_email_configuration_unavailable', 'billing_email_invalid'].includes(error.message) ? error.message : 'billing_email_delivery_unconfirmed';
    // Retry the same frozen bytes/key inside the provider window, including a
    // lost DB receipt. Once the window expires the next claim stops visibly.
    await backend.rpc('fail_billing_job', { p_job_id: job.id, p_lease_token: job.leaseToken, p_error_code: known, p_uncertain: known === 'billing_email_idempotency_expired' });
    return false;
  }
}
/** One claim loop across all providers and service mails. The caller must run
 * this only behind a verified own-project scheduler proof or an authorized
 * server action. Provider processing deliberately ignores new-sales gates. */
export function createBillingCoordinator(environment: Environment, dependencies: { backend: BillingProviderBackend; play?: PlayWorker; fetch?: typeof fetch; now?: () => Date }) {
  const target = resolveHostedEmailTarget(environment), backend = dependencies.backend, fetcher = dependencies.fetch ?? fetch;
  const play = dependencies.play ?? createPlayBillingService({ backend, fetcher, accessToken: credential => createPlayCredentialAccessToken(credential.apiKey, { fetcher }), now: dependencies.now ? () => dependencies.now!().getTime() : undefined });
  let running: Promise<{ completed: number; deferred: number }> | null = null;
  async function run() {
    if (!target) throw new Error('billing_worker_target_unavailable');
    await backend.rpc('prepare_billing_jobs');
    const jobs = await backend.rpc<BillingJob[]>('claim_billing_jobs', { p_limit: 3 });
    if (!Array.isArray(jobs) || jobs.length > 3 || jobs.some(job => !uuid(job.id) || !uuid(job.leaseToken) || job.environment !== target.FABELPAD_ENVIRONMENT)) throw new Error('billing_worker_jobs_invalid');
    let completed = 0, deferred = 0;
    for (const job of jobs) {
      try {
        if (job.kind === 'send_billing_email') {
          if (await emailJob(job, backend, target, fetcher, (dependencies.now?.() ?? new Date()).getTime())) completed++; else deferred++;
        } else if (job.provider === 'mollie') {
          const outcome = await processMollieBillingJob(job, { backend, fetch: fetcher, now: dependencies.now });
          if (outcome.completed) completed++; else deferred++;
        } else if (job.provider === 'play') {
          // Play owns completion/failure, as does the Mollie executor.
          await play.handleJob(job); completed++;
        } else {
          await backend.rpc('fail_billing_job', { p_job_id: job.id, p_lease_token: job.leaseToken, p_error_code: 'billing_unknown_job', p_uncertain: false }); deferred++;
        }
      } catch { deferred++; }
    }
    return { completed, deferred };
  }
  return function tick() {
    // A scheduler tick and a checkout fast path in one isolate share this claim.
    if (!running) running = run().finally(() => { running = null; });
    return running;
  };
}
