import { referencedNarrationAssets, type NarrationAsset, type NarrationManifest, type NarrationReadingLevel, type VoiceSlot } from '../../lib/narration/contracts';

export type NativeAudioIdentity = { storyId: string; contentVersion: string; readingLevel: NarrationReadingLevel; voiceSlot: VoiceSlot };
export function narrationQuery(identity: NativeAudioIdentity): string {
  return `storyId=${encodeURIComponent(identity.storyId)}&version=${encodeURIComponent(identity.contentVersion)}&readingLevel=${identity.readingLevel}&voiceSlot=${identity.voiceSlot}`;
}
export function manifestMatches(manifest: NarrationManifest, identity: NativeAudioIdentity): boolean {
  return manifest.schemaVersion === 1 && manifest.storyId === identity.storyId && manifest.contentVersion === identity.contentVersion && manifest.readingLevel === identity.readingLevel
    && manifest.voice.slotId === identity.voiceSlot && manifest.format.mimeType === 'audio/wav' && manifest.format.codec === 'pcm_s16le' && manifest.format.sampleRate === 24000 && manifest.format.channels === 1
    && Number.isSafeInteger(manifest.audioRevision) && manifest.audioRevision > 0 && Number.isSafeInteger(manifest.voice.presetVersion) && manifest.voice.presetVersion > 0
    && (manifest.access.offlineUntil === null || Number.isFinite(Date.parse(manifest.access.offlineUntil)) && Date.parse(manifest.access.offlineUntil) > Date.now());
}
/** A package is complete for the actual loaded text graph, including original
 * choice indices and endings. An API preview can never become a full download. */
export function completeNarrationManifest(manifest: NarrationManifest, identity: NativeAudioIdentity, source: { scenes: Record<string, { choices: unknown[] }>; endings: Record<string, unknown> }): boolean {
  if (!manifestMatches(manifest, identity) || manifest.access.scope !== 'full') return false;
  const scenes = Object.keys(source.scenes), endings = Object.keys(source.endings);
  if (!scenes.includes('') || scenes.length !== Object.keys(manifest.scenes).length || endings.length !== Object.keys(manifest.endings).length) return false;
  if (scenes.some(route => !manifest.scenes[route]?.segments.length || source.scenes[route].choices.some((_, index) => !manifest.scenes[route].choices.find(choice => choice.choiceIndex === index)?.segments.length))) return false;
  if (endings.some(route => !manifest.endings[route]?.segments.length)) return false;
  return referencedNarrationAssets(manifest).every(id => validNarrationAsset(manifest.assets[id]));
}
export function validNarrationAsset(asset?: NarrationAsset): asset is NarrationAsset {
  return !!asset && /^[a-zA-Z0-9_-]{1,160}$/u.test(asset.id) && /^[a-f0-9]{64}$/u.test(asset.sha256) && Number.isSafeInteger(asset.byteLength) && asset.byteLength > 0 && asset.byteLength <= 50_000_000 && Number.isFinite(asset.durationMs) && asset.durationMs > 0;
}
export function packageAssetRequests(manifest: NarrationManifest, origin: string): NarrationAsset[] {
  const query = narrationQuery({ storyId: manifest.storyId, contentVersion: manifest.contentVersion, readingLevel: manifest.readingLevel, voiceSlot: manifest.voice.slotId });
  return referencedNarrationAssets(manifest).map(id => {
    const asset = manifest.assets[id]; if (!validNarrationAsset(asset)) throw new Error('Dit audiopakket bevat een ongeldige opname.');
    return { ...asset, url: `${origin}/api/voorlezen/assets/${encodeURIComponent(asset.id)}?${query}` };
  });
}
