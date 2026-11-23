/** Public, platform-neutral contract. No provider credential or personal name belongs here. */
export const VOICE_SLOTS = ['stem-1', 'stem-2', 'stem-3', 'stem-4', 'stem-5'] as const;
export type VoiceSlot = typeof VOICE_SLOTS[number];
export type VoiceSlotId = VoiceSlot;
export type NarrationReadingLevel = 'under6' | '6to8' | '9plus';
export const NARRATION_LEVELS: NarrationReadingLevel[] = ['under6', '6to8', '9plus'];
export const SUPPORTED_NARRATION_MODELS = ['gpt-realtime-2.1-mini', 'gpt-realtime-2.1'] as const;
export type NarrationModel = typeof SUPPORTED_NARRATION_MODELS[number];
export const NARRATION_FORMAT = { mimeType: 'audio/wav', codec: 'pcm_s16le', sampleRate: 24000, channels: 1, encodingVersion: 1 } as const;
export const DEFAULT_NARRATION_INSTRUCTIONS = 'Lees de aangeleverde tekst letterlijk voor in helder Nederlands. Spreek rustig, warm en duidelijk, met natuurlijke korte rustpunten. Dialogen blijven letterlijk. Voeg geen uitleg, begroeting, muziek of andere woorden toe. Spannende passages blijven kalm en verstaanbaar.';
export const NARRATION_TEST_TEXT = 'Het kleine kompas wijst naar de groene brug. Kies rustig je volgende stap.';

export interface NarrationPreset {
  slotId: VoiceSlot; label: string; providerVoice: string; presetVersion: number;
  model: NarrationModel; locale: 'nl-NL'; instructions: string; styleVersion: number;
  pronunciationVersion?: number; encoderVersion?: number;
}
export const DEFAULT_NARRATION_PRESETS: NarrationPreset[] = [
  ['Warme verteller', 'marin'], ['Zachte voorlezer', 'cedar'], ['Heldere verteller', 'sage'],
  ['Sprookjesstem', 'ballad'], ['Vrolijke verteller', 'shimmer'],
].map(([label, providerVoice], index) => ({ slotId: VOICE_SLOTS[index], label, providerVoice, presetVersion: 1,
  model: 'gpt-realtime-2.1-mini', locale: 'nl-NL', instructions: DEFAULT_NARRATION_INSTRUCTIONS, styleVersion: 1, pronunciationVersion: 1, encoderVersion: 1 }));
export const DEFAULT_VOICE_SLOTS = DEFAULT_NARRATION_PRESETS;
export function isVoiceSlot(value: unknown): value is VoiceSlot { return VOICE_SLOTS.includes(value as VoiceSlot); }
export function normalizeVoiceSlot(value: unknown, fallback: VoiceSlot = 'stem-1'): VoiceSlot { return isVoiceSlot(value) ? value : fallback; }

export interface NarrationAsset {
  id: string; sha256: string; byteLength: number; durationMs: number;
  mimeType?: 'audio/wav'; url?: string;
}
export type NarrationSegment = { kind: 'asset'; asset: string } | { kind: 'nameCue'; cueId: string; fallbackAsset: string };
export interface NarrationScene { segments: NarrationSegment[]; choices: { choiceIndex: number; segments: NarrationSegment[] }[]; }
export interface NarrationEnding { segments: NarrationSegment[]; }
export interface NarrationManifest {
  schemaVersion: 1; id?: string; storyId: string; contentVersion: string; audioRevision: number;
  sourceFingerprint: string; locale: 'nl-NL'; readingLevel: NarrationReadingLevel;
  access: { scope: 'full' | 'preview'; offlineUntil: string | null; cacheOwnerId?: string };
  voice: { slotId: VoiceSlot; presetVersion: number; label: string };
  format: typeof NARRATION_FORMAT;
  cuePack: { packId: string; packVersion: number; voicePresetVersion: number; lookup: 'device' };
  assets: Record<string, NarrationAsset>; scenes: Record<string, NarrationScene>; endings: Record<string, NarrationEnding>;
}
export interface NarrationNameEntry {
  id: string; kind: 'firstName' | 'alias' | 'fallback'; displayName: string;
  pronunciations: { id: string; spokenSpelling: string }[];
}
export interface NarrationCue { id: string; template: string; }
export const DEFAULT_NAME_CUES: NarrationCue[] = [
  { id: 'kom-mee', template: 'Kom mee, {{naam}}.' },
  { id: 'jij-bent-aan-zet', template: 'Jij bent aan zet, {{naam}}.' },
  { id: 'goed-gedaan', template: 'Goed gedaan, {{naam}}.' },
  { id: 'daar-ga-je', template: 'Daar ga je, {{naam}}.' },
];
/** Independently curated public staging catalogue; never populated from family records. */
export const DEFAULT_NAME_CATALOGUE: NarrationNameEntry[] = [
  { id: 'avonturier', kind: 'fallback', displayName: 'Avonturier', pronunciations: [{ id: 'nl', spokenSpelling: 'Avonturier' }] },
  ...[['n-noor', 'Noor'], ['n-amir', 'Amir'], ['n-aisha', 'Aïsha'], ['n-celine', 'Céline']].map(([id, displayName]) => ({ id, kind: 'firstName' as const, displayName, pronunciations: [{ id: 'nl', spokenSpelling: displayName }] })),
  ...[['a-dappere-vos', 'Dappere Vos'], ['a-kleine-kompasheld', 'Kleine Kompasheld']].map(([id, displayName]) => ({ id, kind: 'alias' as const, displayName, pronunciations: [{ id: 'nl', spokenSpelling: displayName }] })),
];
export interface NarrationCuePack {
  schemaVersion: 1; packId: string; packVersion: number; locale: 'nl-NL'; voiceSlot: VoiceSlot; presetVersion: number;
  catalogue: NarrationNameEntry[]; cues: NarrationCue[];
  /** cue ID -> catalogue item ID -> pronunciation ID -> asset ID; all variants travel together. */
  variants: Record<string, Record<string, Record<string, string>>>;
  fallbackNameId: 'avonturier';
  assets: Record<string, NarrationAsset & { base64: string }>;
}
export type NarrationNamePack = NarrationCuePack;
export type LocalNameMode = 'avonturier' | 'name' | 'alias' | 'recording';
export interface LocalNarrationNameChoice { mode: LocalNameMode; catalogueId?: string; pronunciationId?: string; }
export function normalizeNameLookup(value: string): string { return value.normalize('NFC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('nl-NL'); }
export function findNarrationName(value: string, catalogue: NarrationNameEntry[]): NarrationNameEntry | null {
  const key = normalizeNameLookup(value);
  const matches = catalogue.filter(item => normalizeNameLookup(item.displayName) === key);
  return matches.length === 1 ? matches[0] : null;
}
export function cueAssetForChoice(pack: NarrationCuePack, cueId: string, choice?: LocalNarrationNameChoice): string | null {
  const requested = choice && choice.mode !== 'avonturier' ? choice.catalogueId : undefined;
  const nameId = requested && pack.catalogue.some(item => item.id === requested) ? requested : pack.fallbackNameId;
  const variants = pack.variants[cueId];
  const value = variants?.[nameId]?.[choice?.pronunciationId ?? 'nl'] ?? variants?.[pack.fallbackNameId]?.nl;
  return value && pack.assets[value] ? value : null;
}
export function segmentsForRoute(manifest: NarrationManifest, route: string, kind: 'scene' | 'ending' | 'choice' = 'scene', choiceIndex?: number): NarrationSegment[] {
  if (kind === 'ending') return manifest.endings[route]?.segments ?? [];
  if (kind === 'choice') return manifest.scenes[route]?.choices.find(choice => choice.choiceIndex === choiceIndex)?.segments ?? [];
  return manifest.scenes[route]?.segments ?? [];
}
export function referencedNarrationAssets(manifest: NarrationManifest): string[] {
  const ids = new Set<string>();
  const visit = (segments: NarrationSegment[]) => { for (const segment of segments) ids.add(segment.kind === 'asset' ? segment.asset : segment.fallbackAsset); };
  for (const scene of Object.values(manifest.scenes)) { visit(scene.segments); for (const choice of scene.choices) visit(choice.segments); }
  for (const ending of Object.values(manifest.endings)) visit(ending.segments);
  return [...ids];
}
export interface NarrationVoice extends Pick<NarrationPreset, 'slotId' | 'label' | 'presetVersion'> { sampleUrl?: string | null; sampleAsset?: NarrationAsset | null; available?: boolean; }
export interface NarrationVoices { schemaVersion: 1; environment: string; available: boolean; active: boolean; defaultVoiceSlot: VoiceSlot; voices: NarrationVoice[]; reason?: string; }
export interface NarrationSettings {
  generationEnabled: boolean; playbackEnabled: boolean; defaultVoiceSlot: VoiceSlot; model: NarrationModel;
  styleVersion: number; budgetCents: number; maxParallel: number; slots: NarrationPreset[];
  cueCatalogue?: NarrationNameEntry[]; nameCues?: NarrationCue[]; namePackVersion?: number;
}
export type NarrationJobState = 'awaiting_configuration' | 'queued' | 'generating' | 'review' | 'ready' | 'published' | 'failed' | 'cancelled' | 'stale' | 'budget_paused';
export interface NarrationAdminStatus {
  environment: string; revision: number; keyConfigured: boolean; lastTestAt: string | null; lastTestResult: string | null;
  settings: NarrationSettings; supportedModels: readonly string[];
  workerHealth: unknown; queue: unknown[]; coverage: unknown; usage: unknown;
  [key: string]: unknown;
}
export interface NarrationSource {
  storyId: string; contentVersion: string;
  scenes: Record<string, { title?: string; text: string; choices: ({ label: string; hint?: string; text?: string } | string)[] }>;
  endings: Record<string, { title?: string; text: string; narration?: string; keepsake?: string }>;
  readingLevels?: Partial<Record<NarrationReadingLevel, { scenes: NarrationSource['scenes']; endings: NarrationSource['endings'] }>>;
  parts?: number;
}
export interface NarrationPlannedItem {
  id: string; fingerprint: string; text: string; preset: NarrationPreset; readingLevel: NarrationReadingLevel;
  kind: 'scene' | 'choice' | 'ending' | 'nameCue' | 'sample'; route: string; choiceIndex?: number;
  cueId?: string; catalogueId?: string; pronunciationId?: string;
}
export interface NarrationPlan {
  schemaVersion: 1; storyId: string; contentVersion: string; sourceFingerprint: string;
  items: NarrationPlannedItem[]; manifests: NarrationManifest[];
  expectedItems: number; uniqueItems: number; estimatedMinutes: number; estimatedCents: number;
  estimateComplete: boolean; estimation: { textInputCents: number; audioOutputCents: number; otherCostsIncluded: false };
}
