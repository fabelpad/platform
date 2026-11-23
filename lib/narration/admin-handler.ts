import { compileNarrationLibrary, estimateNarrationCatalogue, narrationHash, validateNarrationPresets } from './compiler.ts';
import { DEFAULT_NAME_CATALOGUE, DEFAULT_NAME_CUES, NARRATION_TEST_TEXT, SUPPORTED_NARRATION_MODELS, isVoiceSlot, type NarrationAsset, type NarrationManifest, type NarrationSettings, type NarrationSource } from './contracts.ts';
import { NarrationBackendError, narrationObject, narrationRequestBody, narrationUuid, type NarrationBackend } from './backend-types.ts';
import { narrationHostedTarget } from './hosted-target.ts';
import { createRealtimeNarrationProvider, narrationUsageCents, type NarrationProvider, type NarrationUsage } from './provider.ts';
import { encodeNarrationAudio } from './quality.ts';
import { bundledNarrationSources, withCompatibleNarrationReading } from './bundled-sources.ts';

const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
const invalid = (): never => { throw new NarrationBackendError('narration_invalid_request', 422); };
function only(body: Record<string, unknown>, allowed: string[]) { if (Object.keys(body).some(k => k !== 'action' && !allowed.includes(k))) invalid(); }
function revision(value: unknown): number { if (!Number.isSafeInteger(value) || (value as number) < 0) invalid(); return value as number; }
function id(value: unknown): string { if (!narrationUuid(value)) invalid(); return value as string; }
function text(value: unknown, maximum = 200): string { if (typeof value !== 'string' || !value || value.length > maximum) invalid(); return value as string; }
function safeResult(value: unknown): void {
  if (Array.isArray(value)) { for (const item of value) safeResult(item); return; }
  if (narrationObject(value)) for (const [key, child] of Object.entries(value)) { if (/^(?:apiKey|secret|secret_id|leaseId|authorization|accessToken|refreshToken|objectPath)$/iu.test(key)) throw new NarrationBackendError('narration_unavailable'); safeResult(child); }
}
export async function parseNarrationSettings(value: unknown): Promise<NarrationSettings> {
  if (!narrationObject(value) || Object.keys(value).some(k => !['generationEnabled', 'playbackEnabled', 'defaultVoiceSlot', 'model', 'styleVersion', 'budgetCents', 'maxParallel', 'slots', 'cueCatalogue', 'nameCues', 'namePackVersion'].includes(k)) || typeof value.generationEnabled !== 'boolean' || typeof value.playbackEnabled !== 'boolean' || !isVoiceSlot(value.defaultVoiceSlot) || !SUPPORTED_NARRATION_MODELS.includes(value.model as NarrationSettings['model']) || !Number.isSafeInteger(value.budgetCents) || (value.budgetCents as number) < 0 || (value.budgetCents as number) > 1_000_000 || ![1, 2].includes(value.maxParallel as number) || !Number.isSafeInteger(value.styleVersion) || (value.styleVersion as number) < 1 || !Array.isArray(value.slots)) invalid();
  const settings = value as unknown as NarrationSettings;
  try {
    validateNarrationPresets(settings.slots);
    if (settings.slots.some(p => p.model !== settings.model || p.styleVersion !== settings.styleVersion)) invalid();
    await compileNarrationLibrary(settings.slots, settings.cueCatalogue ?? DEFAULT_NAME_CATALOGUE, settings.nameCues ?? DEFAULT_NAME_CUES, settings.namePackVersion ?? 1);
  } catch { invalid(); }
  return { ...settings, cueCatalogue: settings.cueCatalogue ?? DEFAULT_NAME_CATALOGUE, nameCues: settings.nameCues ?? DEFAULT_NAME_CUES, namePackVersion: settings.namePackVersion ?? 1 };
}
async function audioAsset(backend: NarrationBackend, assetId: string): Promise<{ metadata: NarrationAsset; bytes: Uint8Array }> {
  const context = await backend.rpc<Record<string, unknown> | null>('get_narration_asset_context', { p_asset_id: assetId });
  if (!context || !narrationUuid(context.id) || typeof context.objectPath !== 'string') throw new NarrationBackendError('narration_asset_unavailable', 404);
  const bytes = await backend.readAudio(context.objectPath);
  if (bytes.byteLength !== Number(context.byteLength) || await narrationHash(bytes) !== context.sha256) throw new NarrationBackendError('narration_asset_unavailable', 404);
  return { metadata: { id: context.id, sha256: String(context.sha256), byteLength: Number(context.byteLength), durationMs: Number(context.durationMs), mimeType: 'audio/wav' }, bytes };
}
function base64(bytes: Uint8Array) { let binary = ''; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192)); return btoa(binary); }
export function createNarrationAdminHandler(environment: Record<string, string | undefined>, options: { backend: NarrationBackend; provider?: (apiKey: string) => NarrationProvider }) {
  const backend = options.backend;
  return async (request: Request): Promise<Response> => {
    if (!narrationHostedTarget(environment)) return json({ error: 'narration_staging_only' }, 503);
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
    try {
      const body = await narrationRequestBody(request); const action = text(body.action, 40);
      const token = /^Bearer ([A-Za-z0-9._-]{20,16384})$/u.exec(request.headers.get('authorization') ?? '')?.[1];
      const publicActions = ['voices', 'manifest', 'asset', 'namePack', 'sample'];
      if (token && !await backend.authenticate(token)) throw new NarrationBackendError('sign_in_required', 401);
      if (!publicActions.includes(action) && !token) throw new NarrationBackendError('sign_in_required', 401);
      const rpc = <T = unknown>(name: string, parameters: Record<string, unknown> = {}) => backend.rpc<T>(name, parameters, token);
      const publicRpc = <T = unknown>(name: string, parameters: Record<string, unknown> = {}) => backend.publicRpc<T>(name, parameters, token);
      let result: unknown;
      if (action === 'voices') {
        only(body, []); result = await publicRpc('get_narration_voices');
        if (narrationObject(result) && Array.isArray(result.voices)) result.voices = result.voices.map(voice => narrationObject(voice) ? { ...voice, sampleUrl: voice.available ? `/api/voorlezen/samples/${voice.slotId}?presetVersion=${voice.presetVersion}` : null } : voice);
      } else if (action === 'manifest' || action === 'asset') {
        only(body, ['storyId', 'version', 'readingLevel', 'voiceSlot', ...(action === 'asset' ? ['assetId'] : [])]);
        if (!/^[a-z][a-z0-9_-]{1,79}$/u.test(text(body.storyId)) || !/^[a-f0-9]{16,64}$/u.test(text(body.version)) || !['under6', '6to8', '9plus'].includes(String(body.readingLevel)) || !isVoiceSlot(body.voiceSlot)) invalid();
        const parameters = { p_story_id: body.storyId, p_content_version: body.version, p_reading_level: body.readingLevel, p_voice_slot: body.voiceSlot };
        if (action === 'manifest') result = await publicRpc('get_narration_manifest', parameters);
        else {
          const assetId = id(body.assetId); if (!await publicRpc('authorize_narration_asset', { ...parameters, p_asset_id: assetId })) throw new NarrationBackendError('narration_asset_unavailable', 404);
          const asset = await audioAsset(backend, assetId); return new Response(new Uint8Array(asset.bytes), { headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Length': String(asset.bytes.length) } });
        }
      } else if (action === 'namePack' || action === 'sample') {
        only(body, ['voiceSlot', 'presetVersion', ...(action === 'namePack' ? ['packVersion', 'packId'] : [])]); if (!isVoiceSlot(body.voiceSlot) || !Number.isSafeInteger(body.presetVersion) || (body.presetVersion as number) < 1 || body.packVersion !== undefined && (!Number.isSafeInteger(body.packVersion) || (body.packVersion as number) < 1) || body.packId !== undefined && (typeof body.packId !== 'string' || !/^pack-[a-f0-9]{40}$/u.test(body.packId))) invalid();
        const parameters = { p_voice_slot: body.voiceSlot, p_preset_version: body.presetVersion };
        if (action === 'sample') {
          const sample = await publicRpc<string | null>('get_narration_sample', parameters); if (!sample) throw new NarrationBackendError('narration_asset_unavailable', 404);
          const asset = await audioAsset(backend, sample); return new Response(new Uint8Array(asset.bytes), { headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
        }
        const pack = await publicRpc<Record<string, unknown> | null>('get_narration_name_pack', { ...parameters, p_pack_version: body.packVersion ?? null, p_pack_id: body.packId ?? null }); if (!pack || !narrationObject(pack.assets)) return json({ pack: null, reason: 'name_pack_not_published' });
        const assets: Record<string, unknown> = {}; let total = 0;
        // Every catalogue variant travels in the same response, independently
        // of any local choice. No selected name reaches a request or log.
        for (const [key, metadata] of Object.entries(pack.assets)) {
          if (!narrationObject(metadata)) throw new NarrationBackendError('narration_unavailable');
          const asset = await audioAsset(backend, id(metadata.id)); total += asset.bytes.length; if (total > 32 * 1024 * 1024) throw new NarrationBackendError('narration_pack_too_large');
          assets[key] = { ...asset.metadata, base64: base64(asset.bytes) };
        }
        result = { ...pack, assets };
      } else if (action === 'get') {
        only(body, ['jobId']); result = await rpc('get_narration_admin_status', { p_job_id: body.jobId == null ? null : id(body.jobId) });
        if (narrationObject(result) && narrationObject(result.detail) && Array.isArray(result.detail.items)) result.detail.items = result.detail.items.map(item => narrationObject(item) && item.assetId ? { ...item, previewUrl: `/api/admin/voorlezen/preview?jobId=${body.jobId}&itemId=${encodeURIComponent(String(item.id))}` } : item);
      } else if (action === 'save') {
        only(body, ['baseRevision', 'settings', 'apiKey']); const settings = await parseNarrationSettings(body.settings);
        if (body.apiKey !== undefined && body.apiKey !== '' && (typeof body.apiKey !== 'string' || !/^sk-[A-Za-z0-9_-]{16,250}$/u.test(body.apiKey))) invalid();
        result = await rpc('save_narration_settings', { p_expected_revision: revision(body.baseRevision), p_settings: settings, p_api_key: body.apiKey || null });
        if (narrationObject(result) && result.saved === false) throw new NarrationBackendError('narration_revision_conflict', 409);
      } else if (action === 'test') {
        only(body, ['baseRevision']); const ticket = await rpc<string>('reserve_narration_test', { p_expected_revision: revision(body.baseRevision) });
        const context = await backend.rpc<{ apiKey: string; settings: NarrationSettings } | null>('get_narration_test_context', { p_test_id: ticket });
        if (!context) throw new NarrationBackendError('narration_unavailable');
        let testUsage: NarrationUsage | null = null; let testCents: number | null = null;
        try {
          const preset = context.settings.slots.find(s => s.slotId === context.settings.defaultVoiceSlot)!;
          const generated = await (options.provider?.(context.apiKey) ?? createRealtimeNarrationProvider({ apiKey: context.apiKey })).generate({ text: NARRATION_TEST_TEXT, preset, requestId: ticket, maxOutputTokens: 1024 });
          testUsage = generated.usage; testCents = generated.fixture ? 0 : narrationUsageCents(generated.usage, preset.model);
          const audio = await encodeNarrationAudio(generated.pcm, generated.transcript, NARRATION_TEST_TEXT);
          const passed = generated.complete && !generated.fixture && audio.quality === 'pass';
          await backend.rpc('complete_narration_test', { p_test_id: ticket, p_passed: passed, p_usage: generated.usage, p_actual_cents: generated.fixture ? 0 : narrationUsageCents(generated.usage, preset.model) });
          result = { passed, fixture: generated.fixture === true, providerConfirmed: passed, model: preset.model, voiceSlot: preset.slotId, audio: { base64: base64(audio.bytes), mimeType: 'audio/wav' }, usage: generated.usage };
        } catch { await backend.rpc('complete_narration_test', { p_test_id: ticket, p_passed: false, p_usage: testUsage, p_actual_cents: testCents }).catch(() => {}); throw new NarrationBackendError('narration_provider_test_failed', 422); }
      } else if (action === 'plan') {
        only(body, ['baseRevision', 'storyIds']); const expected = revision(body.baseRevision);
        const status = await rpc<{ revision: number; settings: NarrationSettings }>('get_narration_admin_status'); if (status.revision !== expected) throw new NarrationBackendError('narration_revision_conflict', 409);
        // These snapshots are the same immutable built-in archives used by the
        // text authority, never payloads supplied by the browser.
        await backend.rpc('register_narration_served_sources', { p_sources: bundledNarrationSources() });
        if (body.storyIds !== undefined && (!Array.isArray(body.storyIds) || body.storyIds.some(s => typeof s !== 'string' || !/^[a-z][a-z0-9_-]{1,79}$/u.test(s)))) invalid();
        const sources = await rpc<{ storyId: string; contentVersion: string; payload: Omit<NarrationSource, 'storyId' | 'contentVersion'> }[]>('get_narration_catalogue_sources');
        const selected = sources.filter(source => body.storyIds === undefined || (body.storyIds as string[]).includes(source.storyId));
        const estimate = estimateNarrationCatalogue(selected.map(source => withCompatibleNarrationReading({ ...source.payload, storyId: source.storyId, contentVersion: source.contentVersion })), status.settings.slots, status.settings);
        result = await rpc('save_narration_catalogue_plan', { p_expected_revision: expected, p_selection: selected.map(({ storyId, contentVersion }) => ({ storyId, contentVersion })), p_estimate: estimate });
      } else if (action === 'enqueue') {
        only(body, ['baseRevision', 'planId']); result = await rpc('enqueue_narration_catalogue', { p_expected_revision: revision(body.baseRevision), p_plan_id: id(body.planId) });
      } else if (action === 'retry') {
        only(body, ['baseRevision', 'jobId', 'itemId']); result = await rpc('retry_narration_job', { p_expected_revision: revision(body.baseRevision), p_job_id: id(body.jobId), p_item_id: body.itemId == null ? null : text(body.itemId) });
      } else if (action === 'review') {
        only(body, ['baseRevision', 'jobId', 'itemId', 'decision', 'note', 'listened', 'transcriptChecked']);
        if (!['approve', 'reject'].includes(String(body.decision)) || body.listened !== true || body.transcriptChecked !== true || body.note != null && (typeof body.note !== 'string' || body.note.length > 500)) invalid();
        result = await rpc('review_narration_item', { p_expected_revision: revision(body.baseRevision), p_job_id: id(body.jobId), p_item_id: text(body.itemId), p_decision: body.decision, p_listened: true, p_transcript_checked: true, p_note: body.note ?? null });
      } else if (action === 'publish') {
        only(body, ['baseRevision', 'jobId']); result = await rpc('publish_narration_job', { p_expected_revision: revision(body.baseRevision), p_job_id: id(body.jobId) });
      } else if (action === 'preview') {
        only(body, ['jobId', 'itemId']); const assetId = await rpc<string | null>('authorize_narration_preview', { p_job_id: id(body.jobId), p_item_id: text(body.itemId) }); if (!assetId) throw new NarrationBackendError('narration_asset_unavailable', 404);
        const asset = await audioAsset(backend, assetId); return new Response(new Uint8Array(asset.bytes), { headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
      } else invalid();
      safeResult(result); return json(result);
    } catch (error) { return json({ error: error instanceof NarrationBackendError ? error.code : 'narration_unavailable' }, error instanceof NarrationBackendError ? error.status : 503); }
  };
}
