import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileSource } from '../source-test-loader.mjs';

const temporary = await mkdtemp(join(tmpdir(), 'fabelpad-narration-reading-'));
const load = async file => import(await compileSource(new URL('../../' + file, import.meta.url), temporary));
const { bundledNarrationSources, withCompatibleNarrationReading } = await load('lib/narration/bundled-sources.ts');
const { readingLevelsForRelease } = await load('src/contentReadingLevels.ts');
const { canonicalContentJson } = await load('lib/contentHash.ts');
const { compileNarrationSource, estimateNarrationCatalogue, narrationHash } = await load('lib/narration/compiler.ts');
const { DEFAULT_NARRATION_PRESETS, DEFAULT_NAME_CATALOGUE, DEFAULT_NAME_CUES } = await load('lib/narration/contracts.ts');
const { createNarrationWorkerHandler } = await load('lib/narration/worker-handler.ts');
const { createNarrationAdminHandler } = await load('lib/narration/admin-handler.ts');
const sources = bundledNarrationSources();
const old = sources.find(source => source.storyId === 'station' && source.contentVersion === '4e48e9296a01fff5');
const raw = () => ({ ...structuredClone(old.payload), storyId: old.storyId, contentVersion: old.contentVersion });
const settings = { generationEnabled: false, playbackEnabled: false, defaultVoiceSlot: 'stem-1', model: 'gpt-realtime-2.1-mini', styleVersion: 1, budgetCents: 2500, maxParallel: 1, slots: DEFAULT_NARRATION_PRESETS, cueCatalogue: DEFAULT_NAME_CATALOGUE, nameCues: DEFAULT_NAME_CUES, namePackVersion: 1 };
const environment = { SUPABASE_URL: 'https://tlwfpivafcokcjyjwgmq.supabase.co', FABELPAD_APP_ORIGIN: 'https://staging.fabelpad.nl', FABELPAD_ENVIRONMENT: 'staging' };
test.after(() => rm(temporary, { recursive: true, force: true }));

test('all exact historical bases use the same three reading views as the existing web reader', () => {
  for (const source of sources.filter(source => source.contentVersion === '4e48e9296a01fff5')) {
    const release = { ...source.payload, storyId: source.storyId, contentVersion: source.contentVersion }, before = JSON.stringify(release);
    assert.equal(release.readingLevels, undefined);
    const enriched = withCompatibleNarrationReading(release);
    assert.deepEqual(enriched.readingLevels, readingLevelsForRelease(release));
    assert.deepEqual(Object.keys(enriched.readingLevels).sort(), ['6to8', '9plus', 'under6']);
    assert.equal(JSON.stringify(release), before);
    assert.equal(enriched.contentVersion, release.contentVersion);
  }
});
test('edited historical prose, choices and endings never acquire unrelated bundled views', () => {
  for (const edit of [release => { release.scenes[''].text += ' Eigen historische tekst.'; }, release => { release.scenes[''].choices[0].label += ' Eigen keuze.'; }, release => { release.endings['00000'].text += ' Eigen einde.'; }]) {
    const release = raw(); edit(release); const before = JSON.stringify(release);
    assert.equal(withCompatibleNarrationReading(release), release);
    assert.equal(readingLevelsForRelease(release), undefined);
    assert.equal(JSON.stringify(release), before);
  }
  const explicit = withCompatibleNarrationReading(raw());
  assert.equal(withCompatibleNarrationReading(explicit), explicit);
});
test('historical audio uses the visible under6 and 6to8 prose while keeping the raw publication proof', async () => {
  const release = raw(), before = JSON.stringify(release), enriched = withCompatibleNarrationReading(release);
  const visiblePlan = await compileNarrationSource({ ...release, readingLevels: readingLevelsForRelease(release) }, settings.slots, settings);
  let installed, providerCalls = 0;
  const job = { id: randomUUID(), leaseId: randomUUID(), storyId: release.storyId, contentVersion: release.contentVersion, sourceKind: 'release', source: structuredClone(old.payload), settings };
  const backend = { rpc: async (name, parameters) => {
    if (name === 'verify_narration_worker_request') return true;
    if (name === 'claim_narration_job') return job;
    if (name === 'install_narration_plan') { installed = parameters.p_plan; return true; }
    if (name === 'claim_narration_item') return null;
    throw new Error('Unexpected fixture RPC: ' + name);
  } };
  const request = new Request('https://edge.example.test', { method: 'POST', body: JSON.stringify({ nonce: randomUUID(), issuedAt: 1, signature: 'a'.repeat(64) }), headers: { 'Content-Type': 'application/json' } });
  const response = await createNarrationWorkerHandler(environment, { backend, provider: () => { providerCalls++; throw new Error(); } })(request);
  assert.equal(response.status, 200); assert.equal((await response.json()).planned, 1); assert.equal(providerCalls, 0);
  assert.deepEqual(installed.items, visiblePlan.items);
  for (const level of ['under6', '6to8']) {
    const texts = readingLevel => installed.items.filter(item => item.readingLevel === readingLevel && item.voiceSlot === undefined && item.preset.slotId === 'stem-1' && item.route === '' && item.kind === 'scene').map(item => item.text);
    assert.notDeepEqual(texts(level), texts('9plus'));
    assert.equal(enriched.readingLevels[level].scenes[''].text, readingLevelsForRelease(release)[level].scenes[''].text);
  }
  assert.equal(installed.sourceFingerprint, await narrationHash(release));
  assert.notEqual(installed.sourceFingerprint, visiblePlan.sourceFingerprint);
  assert.ok(installed.manifests.every(manifest => manifest.sourceFingerprint === installed.sourceFingerprint));
  assert.equal(JSON.stringify(release), before); assert.deepEqual(job.source, old.payload);
});
test('lean catalogue estimate uses compatible views but registers only the unmodified raw snapshots', async () => {
  let registered, saved;
  const backend = { authenticate: async () => ({ id: randomUUID() }), rpc: async (name, parameters) => {
    if (name === 'get_narration_admin_status') return { revision: 2, settings };
    if (name === 'register_narration_served_sources') { registered = parameters.p_sources; return true; }
    if (name === 'get_narration_catalogue_sources') return [old];
    if (name === 'save_narration_catalogue_plan') { saved = parameters; return { saved: true }; }
    throw new Error('Unexpected fixture RPC: ' + name);
  } };
  const response = await createNarrationAdminHandler(environment, { backend })(new Request('https://edge.example.test', { method: 'POST', headers: { Authorization: 'Bearer synthetic_authenticated_fixture_token', 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'plan', baseRevision: 2 }) }));
  assert.equal(response.status, 200);
  assert.deepEqual(saved.p_estimate, estimateNarrationCatalogue([withCompatibleNarrationReading(raw())], settings.slots, settings));
  assert.deepEqual(saved.p_selection, [{ storyId: old.storyId, contentVersion: old.contentVersion }]);
  assert.deepEqual(registered, sources); assert.equal(registered.find(source => source.contentVersion === old.contentVersion).payload.readingLevels, undefined);
});

// Exercise the actual text authority with a fixture transport, including the
// unconfigured path and entitlement projection. No hosted database is touched.
const transportSymbol = Symbol.for('fabelpad.narration.reading.transport');
const contentURL = await compileSource(new URL('../../lib/server/content.ts', import.meta.url), temporary);
const serverURL = await compileSource(new URL('../../lib/supabase/server.ts', import.meta.url), temporary);
await writeFile(new URL(serverURL), `const state=()=>globalThis[Symbol.for('fabelpad.narration.reading.transport')];export async function createSupabaseRequestClient(){return state().client;}export async function createSupabaseServerClient(){return state().client;}export async function getVerifiedParent(){return {id:state().parent};}export async function isContentAdmin(){return false;}`);
const configURL = await compileSource(new URL('../../lib/supabase/config.ts', import.meta.url), temporary);
await writeFile(new URL(configURL), `export class BackendConfigurationError extends Error{};export function getBackendStatus(){return {configured:globalThis[Symbol.for('fabelpad.narration.reading.transport')].configured};}export function getSupabaseConfig(){return null;}`);
const { getContent } = await import(contentURL);
test.after(() => { delete globalThis[transportSymbol]; });
function textTransport({ configured, preview = false, edited = false, row, parent = '11111111-1111-4111-8111-111111111111' }) {
  globalThis[transportSymbol] = { configured, parent, client: { rpc: async name => {
    if (name === 'get_billing_public_offer') return { data: { paymentRequired: true }, error: null };
    if (name === 'get_billing_entitlement') return { data: { fullLibrary: !preview, preview: { fullStoryId: null, chapterOneStoryIds: ['station'] } }, error: null };
    if (name === 'get_billing_content_release') { const payload = structuredClone(old.payload); if (edited) payload.scenes[''].text += ' Eigen historische tekst.'; return { data: row === undefined ? edited ? { story_id: old.storyId, content_version: old.contentVersion, payload, access: 'full' } : null : structuredClone(row), error: null }; }
    throw new Error('Unexpected fixture text RPC: ' + name);
  } } };
}
for (const configured of [false, true]) test(`actual getContent preserves a pinned historical version and supplies compatible reading views (${configured ? 'connected' : 'local'})`, async () => {
  textTransport({ configured });
  const response = await getContent(new Request('https://staging.fabelpad.nl/api/content/station?version=' + old.contentVersion), old.storyId);
  assert.equal(response.status, 200); const { release } = await response.json();
  assert.equal(release.contentVersion, old.contentVersion); assert.deepEqual(release.scenes, old.payload.scenes);
  assert.deepEqual(release.readingLevels, withCompatibleNarrationReading(raw()).readingLevels);
});
test('actual getContent projects compatible preview views before delivery and preserves edited historical text', async () => {
  textTransport({ configured: true, preview: true });
  const response = await getContent(new Request('https://staging.fabelpad.nl/api/content/station?version=' + old.contentVersion), old.storyId);
  assert.equal(response.status, 200); const { release } = await response.json(); assert.equal(release.parts, 1);
  for (const [level, layer] of Object.entries(release.readingLevels)) { assert.deepEqual(Object.keys(layer.scenes), ['']); assert.deepEqual(layer.endings, {}); assert.deepEqual(layer.scenes[''], withCompatibleNarrationReading(raw()).readingLevels[level].scenes['']); }
  textTransport({ configured: true, edited: true });
  const edited = await (await getContent(new Request('https://staging.fabelpad.nl/api/content/station?version=' + old.contentVersion), old.storyId)).json();
  assert.equal(edited.release.readingLevels, undefined); assert.match(edited.release.scenes[''].text, /Eigen historische tekst\.$/u);
});
function previewRowFor(payload) {
  return { story_id: old.storyId, content_version: createHash('sha256').update(canonicalContentJson(payload)).digest('hex').slice(0,16), published_at: '2026-11-20T10:00:00Z', access: 'preview',
    payload: { ...structuredClone(payload), parts: 1, scenes: { '': structuredClone(payload.scenes['']) }, endings: {} } };
}
test('preprojected DB preview recovers reading views only after proving the entire raw payload and preserves the current actor', async () => {
  const payload = { ...structuredClone(old.payload), metadata: { ...old.payload.metadata, title: 'Historische publicatietitel' }, editorialTag: 'immutable_fixture_field' };
  const row = previewRowFor(payload), before = JSON.stringify(row);
  for (const parent of ['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222']) {
    textTransport({ configured: true, preview: true, row, parent });
    const response = await getContent(new Request('https://staging.fabelpad.nl/api/content/station?version=' + row.content_version), old.storyId);
    assert.equal(response.status, 200); const { release } = await response.json();
    assert.equal(release.contentVersion, row.content_version); assert.equal(release.publishedAt, row.published_at); assert.equal(release.bundled, false);
    assert.equal(release.cacheOwnerId, parent); assert.ok(Date.parse(release.offlineUntil) <= Date.now()+24*60*60*1000);
    assert.equal(release.parts, 1); assert.equal(release.nameToken, payload.nameToken); assert.equal(release.editorialTag, payload.editorialTag); assert.deepEqual(release.metadata, payload.metadata);
    assert.deepEqual(release.scenes, row.payload.scenes); assert.deepEqual(release.endings, {});
    for (const [level, layer] of Object.entries(release.readingLevels)) { assert.deepEqual(Object.keys(layer.scenes), ['']); assert.deepEqual(layer.endings, {}); assert.deepEqual(layer.scenes[''], withCompatibleNarrationReading(raw()).readingLevels[level].scenes['']); }
    assert.equal(JSON.stringify(row), before);
  }
});
test('the same visible chapter cannot prove a release with a different hidden chapter, choice or ending', async () => {
  for (const edit of [payload => { payload.scenes['0'].text += ' Andere verborgen tekst.'; }, payload => { payload.scenes['0'].choices[0].label += ' Andere verborgen keuze.'; }, payload => { payload.endings['00000'].text += ' Ander verborgen einde.'; }]) {
    const payload = structuredClone(old.payload); edit(payload); const row = previewRowFor(payload), before = JSON.stringify(row);
    assert.deepEqual(row.payload.scenes[''], old.payload.scenes['']);
    textTransport({ configured: true, preview: true, row });
    const response = await getContent(new Request('https://staging.fabelpad.nl/api/content/station?version=' + row.content_version), old.storyId);
    assert.equal(response.status, 200); const { release } = await response.json();
    assert.equal(release.readingLevels, undefined); assert.deepEqual(release.scenes, row.payload.scenes); assert.deepEqual(release.endings, {}); assert.equal(release.contentVersion, row.content_version); assert.equal(JSON.stringify(row), before);
  }
});
