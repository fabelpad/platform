import { compileNarrationLibrary, compileNarrationSource, narrationHash } from './compiler.ts';
import { withCompatibleNarrationReading } from './bundled-sources.ts';
import { DEFAULT_NAME_CATALOGUE, DEFAULT_NAME_CUES, type NarrationPlannedItem, type NarrationSettings, type NarrationSource } from './contracts.ts';
import { NarrationBackendError, narrationObject, narrationRequestBody, narrationUuid, type NarrationBackend } from './backend-types.ts';
import { narrationHostedTarget } from './hosted-target.ts';
import { createRealtimeNarrationProvider, NarrationProviderError, narrationUsageCents, type NarrationProvider, type NarrationUsage } from './provider.ts';
import { encodeNarrationAudio } from './quality.ts';
interface PlanningJob { id: string; leaseId: string; storyId: string; contentVersion: string; sourceKind: string; source: Omit<NarrationSource, 'storyId' | 'contentVersion'>; settings: NarrationSettings; }
interface GenerationItem { jobId: string; itemId: string; leaseId: string; apiKey: string; maxOutputTokens: number; item: NarrationPlannedItem; }
/** One resumable planning job and one bounded provider fragment per tick.
 * Caller input can only wake the queue; text, credentials and costs come from
 * service-only, lease-bound database capabilities. No raw failure is logged. */
export function createNarrationWorkerHandler(environment: Record<string, string | undefined>, options: { backend: NarrationBackend; provider?: (apiKey: string) => NarrationProvider; background?: (task: Promise<unknown>) => void }) {
  const backend = options.backend;
  const respond = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  return async (request: Request): Promise<Response> => {
    if (!narrationHostedTarget(environment)) return respond({ error: 'narration_staging_only' }, 503);
    if (request.method !== 'POST') return respond({ error: 'method_not_allowed' }, 405);
    if (request.headers.has('authorization')) return respond({ error: 'not_authenticated' }, 401);
    try {
      const proof = await narrationRequestBody(request, 1024);
      if (Object.keys(proof).some(key => !['nonce', 'issuedAt', 'signature'].includes(key)) || !narrationUuid(proof.nonce) || !Number.isSafeInteger(proof.issuedAt) || typeof proof.signature !== 'string' || !/^[a-f0-9]{64}$/u.test(proof.signature)) return respond({ error: 'not_authenticated' }, 401);
      if (!await backend.rpc('verify_narration_worker_request', { p_nonce: proof.nonce, p_issued_at: proof.issuedAt, p_signature: proof.signature })) return respond({ error: 'not_authenticated' }, 401);
      const tick = async () => {
      let planned = 0, completed = 0, deferred = 0;
      const job = await backend.rpc<PlanningJob | null>('claim_narration_job');
      if (job) {
        if (!narrationUuid(job.id) || !narrationUuid(job.leaseId) || !narrationObject(job.source)) throw new Error();
        try {
          const rawSource = { ...job.source, storyId: job.storyId, contentVersion: job.contentVersion };
          const readingSource = job.sourceKind === 'library' ? rawSource : withCompatibleNarrationReading(rawSource);
          const plan = job.sourceKind === 'library'
            ? await compileNarrationLibrary(job.settings.slots, job.settings.cueCatalogue ?? DEFAULT_NAME_CATALOGUE, job.settings.nameCues ?? DEFAULT_NAME_CUES, job.settings.namePackVersion ?? 1)
            : await compileNarrationSource(readingSource, job.settings.slots, job.settings);
          if ('manifests' in plan && readingSource !== rawSource) {
            // Compatibility is a derived reading view. The durable publication
            // proof remains bound to the exact registered, unmodified snapshot.
            plan.sourceFingerprint = await narrationHash(rawSource);
            for (const manifest of plan.manifests) manifest.sourceFingerprint = plan.sourceFingerprint;
          }
          if (await backend.rpc('install_narration_plan', { p_job_id: job.id, p_lease_id: job.leaseId, p_plan: plan })) planned++;
        } catch { await backend.rpc('fail_narration_job', { p_job_id: job.id, p_lease_id: job.leaseId }).catch(() => {}); deferred++; }
      }
      const claim = await backend.rpc<GenerationItem | null>('claim_narration_item');
      if (claim) {
        if (!narrationUuid(claim.jobId) || !narrationUuid(claim.leaseId) || typeof claim.itemId !== 'string' || !narrationObject(claim.item) || claim.item.id !== claim.itemId) throw new Error();
        let spent = false;
        let knownUsage: NarrationUsage | undefined; let actualCents: number | null = null;
        try {
          const provider = options.provider?.(claim.apiKey) ?? createRealtimeNarrationProvider({ apiKey: claim.apiKey });
          spent = true;
          const generated = await provider.generate({ text: claim.item.text, preset: claim.item.preset, requestId: crypto.randomUUID(), maxOutputTokens: claim.maxOutputTokens }, AbortSignal.timeout(100_000));
          // Deterministic test fixtures are never accepted into hosted storage.
          if (generated.fixture || !generated.complete || generated.sampleRate !== 24000) throw new NarrationProviderError('fixture_or_incomplete', false, true);
          knownUsage = generated.usage; actualCents = narrationUsageCents(generated.usage, claim.item.preset.model);
          const audio = await encodeNarrationAudio(generated.pcm, generated.transcript, claim.item.text);
          if (!await backend.rpc('renew_narration_lease', { p_job_id: claim.jobId, p_item_id: claim.itemId, p_lease_id: claim.leaseId })) throw new NarrationProviderError('lease_lost', false, true);
          const objectPath = `assets/${claim.item.fingerprint}/${crypto.randomUUID()}.wav`;
          await backend.uploadAudio(objectPath, audio.bytes);
          const saved = await backend.rpc('complete_narration_item', { p_job_id: claim.jobId, p_item_id: claim.itemId, p_lease_id: claim.leaseId,
            p_asset: { objectPath, sha256: audio.sha256, byteLength: audio.byteLength, durationMs: audio.durationMs, quality: audio.quality, transcript: audio.transcript, providerConfirmed: true }, p_usage: generated.usage, p_actual_cents: actualCents });
          if (saved) completed++; else deferred++;
        } catch (error) {
          const provider = error instanceof NarrationProviderError ? error : null;
          const category = provider?.category ?? 'storage_unavailable';
          const safeError = /authentication/u.test(category) ? 'provider_unauthorized' : /rate_limit/u.test(category) ? 'provider_rate_limited' : /timeout/u.test(category) ? 'provider_timeout' : /audio|incomplete/u.test(category) ? 'provider_incomplete' : category === 'storage_unavailable' ? category : 'provider_unavailable';
          await backend.rpc('fail_narration_item', { p_job_id: claim.jobId, p_item_id: claim.itemId, p_lease_id: claim.leaseId, p_error: safeError, p_uncertain: provider?.uncertain ?? spent, p_retryable: provider?.retryable ?? true, p_usage: knownUsage ?? null, p_actual_cents: actualCents }).catch(() => {}); deferred++;
        }
      }
      return respond({ planned, completed, deferred });
      };
      if (options.background) {
        options.background(tick().catch(error => {
          const code = error instanceof NarrationBackendError ? error.databaseCode : undefined;
          // Deliberately omit messages, details, credentials and queue content.
          console.error(JSON.stringify({ event: 'narration_worker_background_failed', narrationRPCCode: typeof code === 'string' && /^(?:PGRST[A-Z0-9]{3,8}|[0-9A-Z]{5})$/u.test(code) ? code : 'unknown' }));
        }));
        return respond({ accepted: true });
      }
      return await tick();
    } catch { return respond({ error: 'narration_worker_unavailable' }, 503); }
  };
}
