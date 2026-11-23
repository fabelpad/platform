import { DEFAULT_NARRATION_PRESETS, cueAssetForChoice, type NarrationAsset, type NarrationCuePack, type NarrationManifest, type NarrationSegment, type NarrationVoices, type VoiceSlot } from '../lib/narration/contracts';
import { claimNarrationAudio } from './narrationAudioSession';
import { readLocalNameChoice, readLocalRecording } from './narrationLocal';

export const unavailableVoices = (): NarrationVoices => ({ schemaVersion: 1, environment: 'local', available: false, active: false, defaultVoiceSlot: 'stem-1', voices: DEFAULT_NARRATION_PRESETS.map(({ slotId, label, presetVersion }) => ({ slotId, label, presetVersion, available: false })), reason: 'De nieuwe voorleesstemmen wachten op vrijgave. Een lokale Nederlandse apparaatstem blijft beschikbaar waar die is geïnstalleerd.' });
export async function fetchNarrationVoices(signal?: AbortSignal): Promise<NarrationVoices> {
  const response = await fetch('/api/voorlezen/voices', { cache: 'no-store', signal });
  if (!response.ok) return unavailableVoices();
  const value = await response.json() as NarrationVoices;
  return value?.schemaVersion === 1 && value.voices?.length === 5 ? value : unavailableVoices();
}
export const narrationQuery = (storyId: string, version: string, readingLevel: string, voiceSlot: VoiceSlot) => new URLSearchParams({ storyId, version, readingLevel, voiceSlot }).toString();
export async function fetchNarrationManifest(storyId: string, version: string, readingLevel: string, voiceSlot: VoiceSlot, signal?: AbortSignal): Promise<NarrationManifest | null> {
  const response = await fetch(`/api/voorlezen/manifest?${narrationQuery(storyId, version, readingLevel, voiceSlot)}`, { cache: 'no-store', signal });
  if (!response.ok) return null;
  const value = (await response.json()).manifest as NarrationManifest | null;
  if (!value || value.schemaVersion !== 1 || value.storyId !== storyId || value.contentVersion !== version || value.readingLevel !== readingLevel || value.voice.slotId !== voiceSlot || value.locale !== 'nl-NL' || value.access.offlineUntil && Date.parse(value.access.offlineUntil) <= Date.now()) return null;
  return value;
}
async function verifiedBlob(bytes: ArrayBuffer, asset: NarrationAsset): Promise<Blob> {
  if (!bytes.byteLength || bytes.byteLength !== asset.byteLength || bytes.byteLength > 15 * 1024 * 1024) throw new Error('De audio is niet volledig ontvangen.');
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
  if (digest !== asset.sha256) throw new Error('De audio kon niet veilig worden gecontroleerd.');
  return new Blob([bytes], { type: asset.mimeType || 'audio/wav' });
}
export type LoadedCuePack = { pack: NarrationCuePack; blobs: Map<string, Blob> };
const cuePacks = new Map<string, Promise<LoadedCuePack | null>>();
/** Fetch and verify ALL names before consulting any device-only name choice. */
export async function fetchWholeCuePack(voiceSlot: VoiceSlot, presetVersion: number, packVersion?: number, packId?: string): Promise<LoadedCuePack | null> {
  const key = `${voiceSlot}:${presetVersion}:${packVersion ?? 'current'}:${packId ?? ''}`;
  let pending = cuePacks.get(key);
  if (!pending) {
    pending = (async () => {
      const response = await fetch(`/api/voorlezen/name-pack?${new URLSearchParams({ voiceSlot, presetVersion: String(presetVersion), ...(packVersion === undefined ? {} : { packVersion: String(packVersion) }), ...(packId ? { packId } : {}) })}`, { cache: 'no-store' });
      if (!response.ok) return null;
      const data = await response.json(); const pack = (data.pack ?? data) as NarrationCuePack;
      if (pack.schemaVersion !== 1 || pack.voiceSlot !== voiceSlot || pack.presetVersion !== presetVersion || packVersion !== undefined && pack.packVersion !== packVersion || packId && pack.packId !== packId || !pack.assets || !Array.isArray(pack.catalogue) || !Array.isArray(pack.cues)) return null;
      const blobs = new Map<string, Blob>();
      await Promise.all(Object.entries(pack.assets).map(async ([id, asset]) => { const decoded = atob(asset.base64); const bytes = Uint8Array.from(decoded, value => value.charCodeAt(0)); blobs.set(id, await verifiedBlob(bytes.buffer, asset)); }));
      return { pack, blobs };
    })().catch(() => null);
    cuePacks.set(key, pending);
  }
  const result = await pending; if (!result) cuePacks.delete(key); return result;
}
export async function fetchNarrationAsset(manifest: NarrationManifest, id: string, signal: AbortSignal): Promise<Blob> {
  const asset = manifest.assets[id]; if (!asset) throw new Error('Dit fragment ontbreekt in de vrijgegeven versie.');
  const response = await fetch(`/api/voorlezen/assets/${encodeURIComponent(asset.id)}?${narrationQuery(manifest.storyId, manifest.contentVersion, manifest.readingLevel, manifest.voice.slotId)}`, { cache: 'no-store', signal });
  if (!response.ok) throw new Error('Deze audio is nu niet beschikbaar.');
  return verifiedBlob(await response.arrayBuffer(), asset);
}
export type WebNarrationState = 'idle' | 'loading' | 'speaking' | 'paused' | 'error';
export class WebNarrationPlayer {
  private generation = 0; private controller: AbortController | null = null; private audio: HTMLAudioElement | null = null;
  private release: (() => void) | null = null; private urls = new Set<string>(); private resumeWaiter: (() => void) | null = null; private cancelledClip: (() => void) | null = null; private paused = false;
  private expires: ReturnType<typeof setTimeout> | null = null;
  constructor(private changed: (state: WebNarrationState, message?: string) => void) {}
  stop() { this.generation++; this.controller?.abort(); this.controller = null; if (this.expires) clearTimeout(this.expires); this.expires = null; this.audio?.pause(); if (this.audio) this.audio.removeAttribute('src'); this.audio = null; this.cancelledClip?.(); this.cancelledClip = null; this.resumeWaiter?.(); this.resumeWaiter = null; this.release?.(); this.release = null; for (const url of this.urls) URL.revokeObjectURL(url); this.urls.clear(); this.paused = false; this.changed('idle'); }
  pause() { if (!this.controller) return; this.paused = true; this.audio?.pause(); this.changed('paused'); }
  resume() { if (!this.controller) return; const token = this.generation; const audio = this.audio; this.paused = false; this.resumeWaiter?.(); this.resumeWaiter = null; if (audio?.src) void audio.play().then(() => { if (token === this.generation && audio === this.audio) this.changed('speaking'); else audio.pause(); }).catch(() => { if (token === this.generation && audio === this.audio) this.changed('error', 'Afspelen lukt nu niet.'); }); else this.changed('loading'); }
  async play(manifest: NarrationManifest, segments: NarrationSegment[], profileId: string, onFailure?: () => void): Promise<void> {
    this.stop(); if (!segments.length) { onFailure?.(); return; }
    const token = this.generation; this.controller = new AbortController(); const signal = this.controller.signal;
    this.audio = new Audio(); this.audio.preload = 'auto'; this.release = claimNarrationAudio(() => this.stop()); this.changed('loading');
    if (manifest.access.offlineUntil) this.expires = setTimeout(() => { this.stop(); this.changed('error', 'Maak verbinding om de toegang opnieuw te controleren.'); }, Math.max(0, Date.parse(manifest.access.offlineUntil) - Date.now()));
    const current = () => token === this.generation && !signal.aborted && (!manifest.access.offlineUntil || Date.parse(manifest.access.offlineUntil) > Date.now());
    try {
      const pack = await fetchWholeCuePack(manifest.voice.slotId, manifest.voice.presetVersion, manifest.cuePack.packVersion, manifest.cuePack.packId); if (!current()) return;
      const choice = await readLocalNameChoice(profileId); if (!current()) return;
      const load = async (segment: NarrationSegment): Promise<Blob> => {
        if (segment.kind === 'nameCue') {
          if (choice.mode === 'recording') { const local = await readLocalRecording(profileId, segment.cueId); if (!current()) throw new DOMException('Aborted', 'AbortError'); if (local) return local; }
          const id = pack ? cueAssetForChoice(pack.pack, segment.cueId, choice) : null;
          const blob = id && pack?.blobs.get(id); if (blob) return blob;
          return fetchNarrationAsset(manifest, segment.fallbackAsset, signal);
        }
        return fetchNarrationAsset(manifest, segment.asset, signal);
      };
      // Start the next verified buffer before the current clip ends.
      let pending = load(segments[0]);
      for (let index = 0; index < segments.length; index++) {
        const blob = await pending; if (!current()) return;
        pending = index + 1 < segments.length ? load(segments[index + 1]) : Promise.resolve(blob); void pending.catch(() => {});
        if (this.paused) await new Promise<void>(resolve => { this.resumeWaiter = resolve; }); if (!current()) return;
        const url = URL.createObjectURL(blob); this.urls.add(url); const audio = this.audio!; audio.src = url;
        await new Promise<void>((resolve, reject) => {
          this.cancelledClip = resolve;
          audio.onended = () => { this.cancelledClip = null; resolve(); }; audio.onerror = () => reject(new Error('Afspelen lukt nu niet.'));
          void audio.play().then(() => { if (current()) { if (this.paused) audio.pause(); this.changed(this.paused ? 'paused' : 'speaking'); } else audio.pause(); }).catch(reject);
        });
        audio.removeAttribute('src'); URL.revokeObjectURL(url); this.urls.delete(url); if (!current()) return;
      }
      if (current()) this.stop();
    } catch (error) { if (current()) { this.stop(); this.changed('error', error instanceof Error ? error.message : 'Afspelen lukt nu niet.'); onFailure?.(); } }
  }
}
