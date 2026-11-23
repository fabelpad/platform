import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo';
import { PermissionsAndroid } from 'react-native';
import { DEFAULT_NARRATION_PRESETS, normalizeVoiceSlot, type LocalNarrationNameChoice, type NarrationAsset, type NarrationCuePack, type NarrationManifest, type NarrationVoices, type VoiceSlot } from '../../lib/narration/contracts';
import { connectedConfig, connectedRequest, familySession } from './connected';
import { manifestMatches, narrationQuery, packageAssetRequests, validNarrationAsset, type NativeAudioIdentity } from './narrationContract';
import { clearProtectedNarrationData, narrationLocalGeneration, writeNarrationPreference } from './narrationCleanup';

type Subscription = { remove(): void };
type NativeNarration = {
  audioOrigin: string; fixtureEnabled: boolean; fixtureAsset(): Promise<string>; fixtureCorrupt(owner: string, key: string): Promise<boolean>; fixtureExpire(owner: string, key: string): Promise<boolean>; hash(value: string): Promise<string>;
  storageGeneration(): Promise<number>;
  hasAssets(scope: string, assets: string): Promise<boolean>;
  addListener(event: 'onPlayback' | 'onDownload', listener: (value: Record<string, unknown>) => void): Subscription;
  prepareAssets(request: string, authorization: string): Promise<boolean>;
  download(request: string, authorization: string): Promise<string>;
  pauseDownload(key: string): Promise<boolean>; downloads(scope: string): Promise<string>; removeDownload(scope: string, key: string): Promise<boolean>;
  play(items: string): Promise<'done' | 'stopped' | 'error'>; pause(): Promise<boolean>; resume(): Promise<boolean>; stop(): Promise<boolean>;
  startRecording(scope: string, cueId: string): Promise<boolean>; stopRecording(): Promise<boolean>; saveRecording(): Promise<boolean>; cancelRecording(): Promise<boolean>;
  recordings(scope: string): Promise<string[]>; deleteRecording(scope: string, cueId: string): Promise<boolean>; clearProfile(scope: string): Promise<boolean>;
  registerConnectedProfile(scope: string): Promise<boolean>; clearProtected(): Promise<boolean>; clearAll(): Promise<boolean>;
};
const native = requireOptionalNativeModule<NativeNarration>('FabelpadNarration');
const prefix = 'fabelpad.narration.local.v1.';
const nameKey = (scope: AudioScope, id: string) => `${prefix}${scope.kind === 'family' ? 'connected.' : ''}name.${id}`;
export const narrationOrigin = native?.audioOrigin === 'https://staging.fabelpad.nl' || native?.audioOrigin === 'https://fabelpad.nl' ? native.audioOrigin : '';
export const narrationAvailable = !!native;
export const narrationFixtureEnabled = native?.fixtureEnabled === true;
const requireAudio = (): NativeNarration => { if (!native) throw new Error('Deze voorleesfunctie vraagt een actuele Android-build.'); return native; };
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export type AudioScope = { kind: 'local' } | { kind: 'family'; parentId: string };
export type LocalNameSettings = LocalNarrationNameChoice;
export type NativeDownload = { key: string; scope: string; manifest: NarrationManifest; expiresAt: number; byteLength: number; complete: boolean };
export type NativePlayable = { kind: 'asset'; scope: string; asset: NarrationAsset; key?: string } | { kind: 'recording'; scope: string; cueId: string; pending?: boolean };
export async function audioScope(scope: AudioScope): Promise<string> { return scope.kind === 'local' ? 'public' : requireAudio().hash(`parent:${scope.parentId}`); }
export async function profileAudioScope(scope: AudioScope, profileId: string): Promise<string> {
  const id = await requireAudio().hash(`${scope.kind === 'local' ? 'local' : `parent:${scope.parentId}`}:profile:${profileId}`);
  if (scope.kind === 'family') await requireAudio().registerConnectedProfile(id); return id;
}
async function authorization(scope: AudioScope): Promise<string> {
  if (scope.kind === 'local') return '';
  const session = await familySession();
  if (!session || session.parentId !== scope.parentId) throw new Error('De ouderaanmelding is gewijzigd. Open je gezinsbibliotheek opnieuw.');
  return `Bearer ${session.accessToken}`;
}
async function publicRequest(path: string): Promise<Record<string, unknown>> {
  if (!narrationOrigin) throw new Error('Audiopakketten zijn in deze app nog niet verbonden. De lokale apparaatstem blijft beschikbaar.');
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 20_000);
  try { const response = await fetch(`${narrationOrigin}${path}`, { signal: controller.signal, credentials: 'omit', redirect: 'error' }); const result: unknown = await response.json(); if (!response.ok || !object(result)) throw new Error('De voorleesopnamen zijn nog niet beschikbaar.'); return result; }
  finally { clearTimeout(timeout); }
}
export async function loadNarrationVoices(): Promise<NarrationVoices> {
  try {
    const value = await publicRequest('/api/voorlezen/voices');
    if (value.schemaVersion !== 1 || !Array.isArray(value.voices) || value.voices.length !== 5) throw new Error();
    const result = value as unknown as NarrationVoices;
    await AsyncStorage.setItem(`${prefix}voices.${narrationOrigin}`, JSON.stringify(result)); return result;
  } catch {
    try { const raw = await AsyncStorage.getItem(`${prefix}voices.${narrationOrigin}`); if (raw) return JSON.parse(raw) as NarrationVoices; } catch { /* Offline labels remain deterministic. */ }
    return { schemaVersion: 1, environment: narrationOrigin.includes('staging') ? 'staging' : 'lokaal', available: false, active: false, defaultVoiceSlot: 'stem-1', voices: DEFAULT_NARRATION_PRESETS, reason: 'AI-voorleesstemmen wachten op een goedgekeurde audiopublicatie. De lokale apparaatstem blijft beschikbaar.' };
  }
}
export async function localNameSettings(scope: AudioScope, profileId: string): Promise<LocalNameSettings> {
  const id = await profileAudioScope(scope, profileId);
  try { const raw = await AsyncStorage.getItem(nameKey(scope, id)); const value: unknown = raw ? JSON.parse(raw) : null;
    if (object(value) && ['avonturier', 'name', 'alias', 'recording'].includes(String(value.mode))) return { mode: value.mode as LocalNameSettings['mode'], ...(typeof value.catalogueId === 'string' ? { catalogueId: value.catalogueId } : {}), ...(typeof value.pronunciationId === 'string' ? { pronunciationId: value.pronunciationId } : {}) };
  } catch { /* A malformed local preference never affects family data. */ }
  return { mode: 'avonturier' };
}
export async function saveLocalNameSettings(scope: AudioScope, profileId: string, value: LocalNameSettings): Promise<void> {
  const expected = narrationLocalGeneration(), id = await profileAudioScope(scope, profileId);
  if (scope.kind === 'family') await authorization(scope);
  await writeNarrationPreference(expected, () => AsyncStorage.setItem(nameKey(scope, id), JSON.stringify(value)));
}
export async function loadCuePack(slot: VoiceSlot, presetVersion: number, expected?: { packId: string; packVersion: number }): Promise<NarrationCuePack | null> {
  const key = `${prefix}pack.${narrationOrigin}.${slot}.${presetVersion}.${expected?.packId ?? 'latest'}.${expected?.packVersion ?? 'latest'}`;
  try {
    const value = await publicRequest(`/api/voorlezen/name-pack?voiceSlot=${slot}&presetVersion=${presetVersion}${expected ? `&packId=${encodeURIComponent(expected.packId)}&packVersion=${expected.packVersion}` : ''}`);
    const pack = (object(value.pack) ? value.pack : value) as unknown as NarrationCuePack;
    if (pack.schemaVersion !== 1 || pack.voiceSlot !== slot || pack.presetVersion !== presetVersion || !pack.assets || !pack.variants || expected && (pack.packId !== expected.packId || pack.packVersion !== expected.packVersion)) return null;
    const assets = Object.values(pack.assets); if (!assets.length || assets.some(asset => !validNarrationAsset(asset) || typeof asset.base64 !== 'string')) return null;
    // The complete editorial pack travels together. No selected name or cue is requested.
    await requireAudio().prepareAssets(JSON.stringify({ scope: 'public', assets }), '');
    const metadata = { ...pack, assets: Object.fromEntries(Object.entries(pack.assets).map(([id, asset]) => { const { base64: _bytes, ...safe } = asset; return [id, safe]; })) };
    await AsyncStorage.setItem(key, JSON.stringify(metadata)); return metadata as NarrationCuePack;
  } catch { try { const raw = await AsyncStorage.getItem(key); if (!raw) return null; const pack = JSON.parse(raw) as NarrationCuePack; return await requireAudio().hasAssets('public', JSON.stringify(Object.values(pack.assets))) ? pack : null; } catch { return null; } }
}
export async function downloadedNarration(scope: AudioScope): Promise<NativeDownload[]> {
  try { return JSON.parse(await requireAudio().downloads(await audioScope(scope))) as NativeDownload[]; } catch { return []; }
}
export async function loadNarrationManifest(identity: NativeAudioIdentity, scope: AudioScope): Promise<{ manifest: NarrationManifest | null; download?: NativeDownload; reason?: string }> {
  const downloads = await downloadedNarration(scope), matching = downloads.filter(value => value.complete && manifestMatches(value.manifest, identity)).sort((a, b) => b.manifest.audioRevision - a.manifest.audioRevision);
  try {
    const result = scope.kind === 'family' ? await connectedRequest(`/api/voorlezen/manifest?${narrationQuery(identity)}`) : await publicRequest(`/api/voorlezen/manifest?${narrationQuery(identity)}`);
    if (object(result.manifest) && manifestMatches(result.manifest as unknown as NarrationManifest, identity)) {
      const manifest = result.manifest as unknown as NarrationManifest;
      const same = matching.find(value => value.manifest.audioRevision === manifest.audioRevision && value.manifest.voice.presetVersion === manifest.voice.presetVersion);
      return same ? { manifest: same.manifest, download: same } : { manifest };
    }
    return matching[0] ? { manifest: matching[0].manifest, download: matching[0] } : { manifest: null, reason: typeof result.reason === 'string' ? result.reason : 'De AI-opnamen zijn nog niet vrijgegeven. Je kunt de lokale apparaatstem gebruiken.' };
  } catch (error) {
    // A definitive permission failure has already cleared protected downloads.
    if (object(error) && typeof error.status === 'number' && [401, 403, 410].includes(error.status)) throw error;
    return matching[0] ? { manifest: matching[0].manifest, download: matching[0] } : { manifest: null, reason: 'Geen passende goedgekeurde audio beschikbaar. De tekst blijft leesbaar.' };
  }
}
export async function prepareNarrationAssets(manifest: NarrationManifest, ids: string[], scope: AudioScope): Promise<NativePlayable[]> {
  const storageGeneration = await requireAudio().storageGeneration();
  const owner = await audioScope(scope), requests = packageAssetRequests(manifest, narrationOrigin).filter(asset => ids.includes(asset.id));
  // Manifest dictionary keys need not be storage asset IDs.
  if (requests.length !== new Set(ids).size) throw new Error('Een opname ontbreekt in deze verhaalversie.');
  await requireAudio().prepareAssets(JSON.stringify({ scope: owner, storageGeneration, offlineUntil: manifest.access.offlineUntil, assets: requests }), await authorization(scope));
  return requests.map(asset => ({ kind: 'asset', scope: owner, asset }));
}
export async function downloadNarration(manifest: NarrationManifest, scope: AudioScope): Promise<NativeDownload> {
  const storageGeneration = await requireAudio().storageGeneration();
  const owner = await audioScope(scope), key = await requireAudio().hash(`${manifest.storyId}:${manifest.contentVersion}:${manifest.readingLevel}:${manifest.voice.slotId}:${manifest.voice.presetVersion}:${manifest.audioRevision}`);
  const value = await requireAudio().download(JSON.stringify({ scope: owner, key, storageGeneration, offlineUntil: manifest.access.offlineUntil, manifest, assets: packageAssetRequests(manifest, narrationOrigin) }), await authorization(scope));
  return { ...JSON.parse(value), complete: true } as NativeDownload;
}
export const pauseNarrationDownload = (key: string): Promise<boolean> => requireAudio().pauseDownload(key);
export const removeNarrationDownload = (scope: string, key: string): Promise<boolean> => requireAudio().removeDownload(scope, key);
export const playNarration = (items: NativePlayable[]): Promise<'done' | 'stopped' | 'error'> => requireAudio().play(JSON.stringify(items));
export const pauseNarration = (): Promise<boolean> => requireAudio().pause();
export const resumeNarration = (): Promise<boolean> => requireAudio().resume();
export const stopNarration = (): Promise<boolean> => native?.stop() ?? Promise.resolve(true);
export const narrationEvents = (event: 'onPlayback' | 'onDownload', listener: (value: Record<string, unknown>) => void): Subscription => native?.addListener(event, listener) ?? { remove() {} };
export async function startParentRecording(scope: AudioScope, profileId: string, cueId: string, authorized: () => boolean): Promise<void> {
  if (!authorized()) throw new Error('Open eerst opnieuw het ouderhoekje.');
  const permission = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, { title: 'Een aanspreekzin inspreken', message: 'Alleen deze ouderopname wordt op dit apparaat bewaard. De opname wordt niet verstuurd.', buttonPositive: 'Microfoon toestaan', buttonNegative: 'Terug' });
  if (permission !== PermissionsAndroid.RESULTS.GRANTED) throw new Error('Microfoontoegang is niet toegestaan. Je kunt Avonturier of een ingesproken catalogusnaam gebruiken.');
  const owner = await profileAudioScope(scope, profileId);
  if (!authorized()) throw new Error('De ouderpoort is gesloten. Open het ouderhoekje om zelf een opname te starten.');
  await requireAudio().startRecording(owner, cueId);
}
export const stopParentRecording = (): Promise<boolean> => requireAudio().stopRecording();
export const saveParentRecording = (): Promise<boolean> => requireAudio().saveRecording();
export const cancelParentRecording = (): Promise<boolean> => native?.cancelRecording() ?? Promise.resolve(true);
export async function parentRecordings(scope: AudioScope, profileId: string): Promise<string[]> { return requireAudio().recordings(await profileAudioScope(scope, profileId)); }
export async function deleteParentRecording(scope: AudioScope, profileId: string, cueId: string): Promise<boolean> { return requireAudio().deleteRecording(await profileAudioScope(scope, profileId), cueId); }
export async function clearNarrationProfile(scope: AudioScope, profileId: string): Promise<void> { const owner = await profileAudioScope(scope, profileId); await requireAudio().clearProfile(owner); await AsyncStorage.removeItem(nameKey(scope, owner)); }
export const clearProtectedNarration = clearProtectedNarrationData;
export { clearAllNarration } from './narrationCleanup';
export async function narrationFamilyScope(): Promise<AudioScope> { const current = await familySession(); if (!current) throw new Error('Log eerst in als ouder.'); return { kind: 'family', parentId: current.parentId }; }
export async function installNarrationFixture(pauseOnce = false): Promise<{ download: NativeDownload; pauseVerified: boolean }> {
  const module = requireAudio(); if (!module.fixtureEnabled) throw new Error('Deze CI-fixture is niet beschikbaar in deze app.');
  const asset = JSON.parse(await module.fixtureAsset()) as NarrationAsset & { base64: string };
  const assets = Array.from({ length: 6 }, (_, index) => ({ ...asset, id: `${asset.id}-${index}` }));
  const manifest: NarrationManifest = { schemaVersion: 1, storyId: 'ci-audio-fixture', contentVersion: 'ci-audio-v1', audioRevision: 1, sourceFingerprint: asset.sha256, locale: 'nl-NL', readingLevel: '6to8', access: { scope: 'full', offlineUntil: null }, voice: { slotId: 'stem-1', presetVersion: 1, label: 'Synthetische CI-proeftoon' }, format: { mimeType: 'audio/wav', codec: 'pcm_s16le', sampleRate: 24000, channels: 1, encodingVersion: 1 }, cuePack: { packId: 'ci-empty', packVersion: 1, voicePresetVersion: 1, lookup: 'device' }, assets: Object.fromEntries(assets.map(value => { const { base64: _bytes, ...metadata } = value; return [value.id, metadata]; })), scenes: { '': { segments: [{ kind: 'asset', asset: assets[0].id }, { kind: 'asset', asset: assets[1].id }], choices: [{ choiceIndex: 0, segments: [{ kind: 'asset', asset: assets[2].id }] }, { choiceIndex: 1, segments: [{ kind: 'asset', asset: assets[3].id }] }] } }, endings: { '0': { segments: [{ kind: 'asset', asset: assets[4].id }] }, '1': { segments: [{ kind: 'asset', asset: assets[5].id }] } } };
  const key = await module.hash('ci-audio-fixture-v1'), request = JSON.stringify({ scope: 'public', key, offlineUntil: null, manifest, assets, fixtureDelay: pauseOnce });
  let pauseVerified = false, requested = false;
  const event = pauseOnce ? narrationEvents('onDownload', value => { if (!requested && value.key === key && value.status === 'downloading') { requested = true; void module.pauseDownload(key); } }) : null;
  try { await module.download(request, ''); }
  catch (error) { if (!pauseOnce || !requested) throw error; pauseVerified = (await downloadedNarration({ kind: 'local' })).some(value => value.key === key && !value.complete); if (!pauseVerified) throw error; }
  finally { event?.remove(); }
  if (pauseVerified) await module.download(JSON.stringify({ scope: 'public', key, offlineUntil: null, manifest, assets }), '');
  const download = (await downloadedNarration({ kind: 'local' })).find(value => value.key === key && value.complete);
  if (!download) throw new Error('De fixture is niet als compleet geactiveerd.'); return { download, pauseVerified };
}
export async function corruptNarrationFixture(download: NativeDownload): Promise<void> { if (!requireAudio().fixtureEnabled) throw new Error(); await requireAudio().fixtureCorrupt(download.scope, download.key); }
export async function expireNarrationFixture(download: NativeDownload): Promise<void> { if (!requireAudio().fixtureEnabled) throw new Error(); await requireAudio().fixtureExpire(download.scope, download.key); }
export { normalizeVoiceSlot };
