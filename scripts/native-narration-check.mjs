import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compileSource } from './source-test-loader.mjs';
import ts from 'typescript';

const temporary = await mkdtemp(join(tmpdir(), 'fabelpad-native-narration-'));
const originalFetch = globalThis.fetch;
after(async () => { globalThis.fetch = originalFetch; delete globalThis.__fabelpadNarrationFixture; await rm(temporary, { recursive: true, force: true }); });
const contract = await import(await compileSource(new URL('../mobile/src/narrationContract.ts', import.meta.url), temporary));
const shared = await import(await compileSource(new URL('../lib/narration/contracts.ts', import.meta.url), temporary));
const { nativeFamilyImport } = await import(await compileSource(new URL('../mobile/src/connected-contract.ts', import.meta.url), temporary));
const narrationURL = await compileSource(new URL('../mobile/src/narration.ts', import.meta.url), temporary);
const connectedURL = await compileSource(new URL('../mobile/src/connected.ts', import.meta.url), temporary);
const expoStub = join(temporary, 'expo-fixture.mjs'), storageStub = join(temporary, 'storage-fixture.mjs'), reactStub = join(temporary, 'react-native-fixture.mjs'), connectedStub = join(temporary, 'connected-fixture.mjs');
await writeFile(expoStub, 'export const requireOptionalNativeModule=()=>globalThis.__fabelpadNarrationFixture.native;');
await writeFile(storageStub, 'export default {getItem:async k=>globalThis.__fabelpadNarrationFixture.storage.get(k)??null,setItem:async(k,v)=>{if(globalThis.__fabelpadNarrationFixture.onSet)await globalThis.__fabelpadNarrationFixture.onSet(k,v);globalThis.__fabelpadNarrationFixture.storage.set(k,v);},removeItem:async k=>{globalThis.__fabelpadNarrationFixture.storage.delete(k);},getAllKeys:async()=>[...globalThis.__fabelpadNarrationFixture.storage.keys()],multiRemove:async keys=>{for(const k of keys)globalThis.__fabelpadNarrationFixture.storage.delete(k);}};');
await writeFile(reactStub, 'export const PermissionsAndroid={PERMISSIONS:{RECORD_AUDIO:"record"},RESULTS:{GRANTED:"granted"},request:async()=>globalThis.__fabelpadNarrationFixture.permission()};');
await writeFile(connectedStub, 'export const connectedConfig={}; export const familySession=async()=>globalThis.__fabelpadNarrationFixture.session; export const connectedRequest=async path=>globalThis.__fabelpadNarrationFixture.connectedRequest(path);');
for (const name of await readdir(temporary)) if (name.endsWith('.mjs') && !name.endsWith('-fixture.mjs')) {
  const file = join(temporary, name); let code = await readFile(file, 'utf8');
  for (const [specifier, target] of [['expo', expoStub], ['@react-native-async-storage/async-storage', storageStub], ['react-native', reactStub], [connectedURL, connectedStub]]) code = code.replaceAll(`'${specifier}'`, JSON.stringify(pathToFileURL(target).href)).replaceAll(`"${specifier}"`, JSON.stringify(pathToFileURL(target).href));
  await writeFile(file, code);
}
const asset = { id: 'editorial-asset', sha256: '0'.repeat(64), byteLength: 48044, durationMs: 1000 };
const identity = { storyId: 'synthetic-story', contentVersion: 'immutable-v1', readingLevel: '6to8', voiceSlot: 'stem-2' };
function manifest() {
  return { schemaVersion: 1, ...identity, audioRevision: 1, sourceFingerprint: 'a'.repeat(64), locale: 'nl-NL', access: { scope: 'full', offlineUntil: null }, voice: { slotId: 'stem-2', presetVersion: 1, label: 'Synthetic' }, format: shared.NARRATION_FORMAT, cuePack: { packId: 'editorial-pack', packVersion: 2, voicePresetVersion: 1, lookup: 'device' }, assets: { generic: { ...asset } }, scenes: { '': { segments: [{ kind: 'asset', asset: 'generic' }], choices: [{ choiceIndex: 0, segments: [{ kind: 'asset', asset: 'generic' }] }, { choiceIndex: 1, segments: [{ kind: 'asset', asset: 'generic' }] }] } }, endings: { '0': { segments: [{ kind: 'asset', asset: 'generic' }] }, '1': { segments: [{ kind: 'asset', asset: 'generic' }] } } };
}
const source = { scenes: { '': { choices: ['left', 'right'] } }, endings: { '0': {}, '1': {} } };
test('download contract refuses previews, omitted original choices/endings, mismatched releases/levels/slots, invalid checksums and expired access', () => {
  assert.equal(contract.completeNarrationManifest(manifest(), identity, source), true);
  for (const mutate of [m => { m.access.scope = 'preview'; }, m => { delete m.endings['1']; }, m => { m.scenes[''].choices.pop(); }, m => { m.scenes[''].choices[0].choiceIndex = 8; }, m => { m.contentVersion = 'edited-v2'; }, m => { m.readingLevel = 'under6'; }, m => { m.voice.slotId = 'stem-5'; }, m => { m.assets.generic.sha256 = 'broken'; }, m => { m.assets.generic.byteLength = -1; }, m => { m.access.offlineUntil = new Date(Date.now() - 1).toISOString(); }]) {
    const candidate = manifest(); mutate(candidate); assert.equal(contract.completeNarrationManifest(candidate, identity, source), false);
  }
});
test('all current bundled source graphs can be bound to complete per-level/per-slot packages without reducing the route denominator', async () => {
  const catalogue = JSON.parse(await readFile(new URL('../mobile/src/content.json', import.meta.url), 'utf8')); let sceneTracks = 0, choiceTracks = 0, endingTracks = 0;
  for (const story of catalogue.stories) for (const readingLevel of shared.NARRATION_LEVELS) for (const voiceSlot of shared.VOICE_SLOTS) {
    const reading = story.readingLevels?.[readingLevel] ?? story, candidate = manifest();
    Object.assign(candidate, { storyId: story.id, contentVersion: catalogue.contentVersion, readingLevel, voice: { ...candidate.voice, slotId: voiceSlot } });
    candidate.scenes = Object.fromEntries(Object.entries(reading.scenes).map(([route, scene]) => [route, { segments: [{ kind: 'asset', asset: 'generic' }], choices: scene.choices.map((_, choiceIndex) => ({ choiceIndex, segments: [{ kind: 'asset', asset: 'generic' }] })) }]));
    candidate.endings = Object.fromEntries(Object.keys(reading.endings).map(route => [route, { segments: [{ kind: 'asset', asset: 'generic' }] }]));
    assert.equal(contract.completeNarrationManifest(candidate, { storyId: story.id, contentVersion: catalogue.contentVersion, readingLevel, voiceSlot }, reading), true);
    sceneTracks += Object.keys(reading.scenes).length; choiceTracks += Object.values(reading.scenes).reduce((sum, scene) => sum + scene.choices.length, 0); endingTracks += Object.keys(reading.endings).length;
  }
  assert.equal(sceneTracks, 6045); assert.equal(choiceTracks, 12090); assert.equal(endingTracks, 6240);
});
test('only the stable voice slot enters an explicit family import; device name modes and recording locations are excluded', () => {
  const profile = { id: 'synthetic-child', name: 'Synthetic Private Name', avatar: 0, birthDate: '2019-01-01', picks: {}, favorites: [], calm: false, largeText: false, voiceSlot: 'stem-4', nameMode: 'recording', recordingURI: 'private://opaque-file', catalogueId: 'private-selection' };
  const imported = nativeFamilyImport({ schemaVersion: 1, contentVersion: 'v1', activeId: profile.id, profiles: [profile] }, null, [profile.id]);
  assert.equal(imported.data[profile.id].prefs.voiceSlot, 'stem-4'); const text = JSON.stringify(imported); for (const value of ['recordingURI', 'private://', 'catalogueId', 'nameMode']) assert(!text.includes(value));
});
test('actual Android config keeps local networking opt-in and rejects the fixture in every ordinary or signed build', async () => {
  const config = ts.transpileModule(await readFile(new URL('../mobile/app.config.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  function load(env) { const exports = {}; new Function('require', 'process', 'exports', config)(() => ({ version: '1.0.2' }), { env: { FABELPAD_VARIANT: 'production', FABELPAD_ANDROID_VERSION_CODE: '3', ...env } }, exports); return exports.default.expo; }
  const ordinary = load({}); assert(ordinary.android.blockedPermissions.includes('android.permission.INTERNET')); assert(ordinary.android.permissions.includes('android.permission.RECORD_AUDIO')); assert.equal(ordinary.extra.narrationFixture, false);
  const staging = load({ FABELPAD_AUDIO_ENVIRONMENT: 'staging', FABELPAD_AUDIO_ORIGIN: 'https://staging.fabelpad.nl' }); assert(!staging.android.blockedPermissions.includes('android.permission.INTERNET')); assert.equal(staging.extra.audioOrigin, 'https://staging.fabelpad.nl');
  assert.throws(() => load({ FABELPAD_AUDIO_ENVIRONMENT: 'production', FABELPAD_AUDIO_ORIGIN: 'https://fabelpad.nl' }), /stagingomgeving/u);
  for (const env of [{}, { CI: '1' }, { FABELPAD_UNSIGNED_CHECK: 'true' }, { FABELPAD_UNSIGNED_CHECK: 'false', CI: '1' }]) assert.throws(() => load({ ...env, FABELPAD_NARRATION_FIXTURE: 'true' }), /ongesigneerde CI/u);
  assert.equal(load({ FABELPAD_NARRATION_FIXTURE: 'true', FABELPAD_UNSIGNED_CHECK: 'true', CI: '1' }).extra.narrationFixture, true);
});
let instance = 0;
async function fixture() {
  const calls = [], storage = new Map();
  const native = { audioOrigin: 'https://staging.fabelpad.nl', fixtureEnabled: false, hash: async value => createHash('sha256').update(value).digest('hex'), storageGeneration: async () => 17,
    prepareAssets: async (request, auth) => { calls.push({ type: 'prepare', request: JSON.parse(request), auth }); return true; },
    downloads: async () => '[]', hasAssets: async () => true, registerConnectedProfile: async () => true, startRecording: async () => { calls.push({ type: 'record' }); return true; }, clearAll: async () => true };
  globalThis.__fabelpadNarrationFixture = { native, storage, permission: async () => 'granted', session: { parentId: 'synthetic-parent', accessToken: 'synthetic-token' }, connectedRequest: async () => ({ manifest: null, reason: 'awaiting_configuration' }) };
  return { calls, storage, state: globalThis.__fabelpadNarrationFixture, api: await import(`${narrationURL}?fixture=${++instance}`) };
}
test('a complete shared cue pack is fetched without a selected personal name and cached by immutable pack version for a cold offline instance', async () => {
  const { api, calls } = await fixture(), requests = [];
  const pack = { schemaVersion: 1, packId: 'public-editorial-pack', packVersion: 3, locale: 'nl-NL', voiceSlot: 'stem-2', presetVersion: 1, catalogue: [{ id: 'avonturier', kind: 'fallback', displayName: 'Avonturier', pronunciations: [{ id: 'nl', spokenSpelling: 'Avonturier' }] }, { id: 'n-noor', kind: 'firstName', displayName: 'Noor', pronunciations: [{ id: 'nl', spokenSpelling: 'Noor' }] }], cues: [{ id: 'kom-mee', template: 'Kom mee, {{naam}}.' }], variants: { 'kom-mee': { avonturier: { nl: 'all' }, 'n-noor': { nl: 'all' } } }, fallbackNameId: 'avonturier', assets: { all: { ...asset, base64: 'synthetic-entire-pack' } } };
  globalThis.fetch = async url => { requests.push(String(url)); return Response.json({ pack }); };
  await api.saveLocalNameSettings({ kind: 'local' }, 'private-profile', { mode: 'name', catalogueId: 'n-noor', pronunciationId: 'nl' });
  const loaded = await api.loadCuePack('stem-2', 1, { packId: pack.packId, packVersion: 3 }); assert.equal(loaded.packVersion, 3);
  assert.equal(requests.length, 1); assert(!requests[0].includes('noor')); assert(!requests[0].includes('private-profile')); assert.equal(calls[0].request.assets.length, 1); assert.equal(calls[0].request.assets[0].base64, 'synthetic-entire-pack');
  globalThis.fetch = async () => { throw new Error('offline'); };
  const restarted = await import(`${narrationURL}?fixture=${++instance}`); assert.equal((await restarted.loadCuePack('stem-2', 1, { packId: pack.packId, packVersion: 3 })).packVersion, 3); assert.equal(await restarted.loadCuePack('stem-2', 1, { packId: pack.packId, packVersion: 4 }), null);
});
test('parent permission denial and a permission result arriving after the gate closes never start the recorder', async () => {
  const { api, calls, state } = await fixture(); state.permission = async () => 'denied';
  await assert.rejects(api.startParentRecording({ kind: 'local' }, 'private-child', 'kom-mee', () => true), /Microfoontoegang/u); assert.equal(calls.length, 0);
  let granted, active = true; state.permission = () => new Promise(resolve => { granted = resolve; });
  const pending = api.startParentRecording({ kind: 'local' }, 'private-child', 'kom-mee', () => active); active = false; granted('granted'); await assert.rejects(pending, /ouderpoort/u); assert.equal(calls.length, 0);
});
test('family preparation carries its pre-auth native storage generation and fails after account replacement without submitting old audio', async () => {
  const { api, calls, state } = await fixture(), value = manifest(); value.access.offlineUntil = new Date(Date.now() + 60_000).toISOString();
  await api.prepareNarrationAssets(value, [asset.id], { kind: 'family', parentId: 'synthetic-parent' }); assert.equal(calls[0].request.storageGeneration, 17); assert.equal(calls[0].auth, 'Bearer synthetic-token');
  state.session = { parentId: 'different-parent', accessToken: 'new-token' };
  await assert.rejects(api.prepareNarrationAssets(value, [asset.id], { kind: 'family', parentId: 'synthetic-parent' }), /ouderaanmelding/u); assert.equal(calls.length, 1);
});
test('logout cleanup waits for a delayed personal preference write and prevents its old name selection from returning', async () => {
  const { api, state, storage } = await fixture(); let release, started; const reached = new Promise(resolve => { started = resolve; });
  storage.set('fabelpad.narration.local.v1.name.local-profile', '{"mode":"avonturier"}');
  state.onSet = async () => { started(); await new Promise(resolve => { release = resolve; }); };
  const writing = api.saveLocalNameSettings({ kind: 'family', parentId: 'synthetic-parent' }, 'synthetic-child', { mode: 'name', catalogueId: 'n-noor', pronunciationId: 'nl' });
  const rejected = assert.rejects(writing, /intussen gewist/u); await reached; state.session = null; const clearing = api.clearProtectedNarration(); release(); await Promise.all([rejected, clearing]);
  assert.deepEqual([...storage.keys()], ['fabelpad.narration.local.v1.name.local-profile']);
});
