import {
  DEFAULT_NAME_CATALOGUE, DEFAULT_NAME_CUES, NARRATION_FORMAT, NARRATION_LEVELS,
  NARRATION_TEST_TEXT, SUPPORTED_NARRATION_MODELS, VOICE_SLOTS,
  type NarrationAsset, type NarrationCue, type NarrationCuePack, type NarrationManifest,
  type NarrationNameEntry, type NarrationPlan, type NarrationPlannedItem, type NarrationPreset,
  type NarrationReadingLevel, type NarrationSegment, type NarrationSource, type VoiceSlot,
} from './contracts.ts';

export const NARRATION_COMPILER_VERSION = 1;
export function canonicalNarrationJSON(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalNarrationJSON).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => `${JSON.stringify(k)}:${canonicalNarrationJSON(v)}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
export async function narrationHash(value: unknown): Promise<string> {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value instanceof Uint8Array ? value : new TextEncoder().encode(canonicalNarrationJSON(value));
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes)))).map(b => b.toString(16).padStart(2, '0')).join('');
}
export function normalizeNarrationText(value: string): string { return value.normalize('NFC').replace(/\r\n?/gu, '\n').trim(); }
const genericText = (value: string) => normalizeNarrationText(value).replace(/__FABELPAD_CHILD__|\{\{naam\}\}/gu, 'Avonturier');
const safeKey = (value: string) => /^[a-z0-9][a-z0-9-]{0,79}$/u.test(value);
export function validateNarrationPresets(presets: NarrationPreset[]): void {
  const allowedVoices = ['marin', 'cedar', 'sage', 'ballad', 'shimmer'];
  if (!Array.isArray(presets) || presets.length !== 5 || presets.some(p => !p || typeof p !== 'object') || new Set(presets.map(p => p.slotId)).size !== 5) throw new Error('narration_invalid_presets');
  for (const p of presets) if (Object.keys(p).some(key => !['slotId', 'label', 'providerVoice', 'presetVersion', 'model', 'locale', 'instructions', 'styleVersion', 'pronunciationVersion', 'encoderVersion'].includes(key)) || !VOICE_SLOTS.includes(p.slotId) || !SUPPORTED_NARRATION_MODELS.includes(p.model) || !allowedVoices.includes(p.providerVoice) || p.locale !== 'nl-NL' || typeof p.label !== 'string' || !p.label.trim() || p.label.length > 80 || !Number.isSafeInteger(p.presetVersion) || p.presetVersion < 1 || !Number.isSafeInteger(p.styleVersion) || p.styleVersion < 1 || typeof p.instructions !== 'string' || !p.instructions.trim() || p.instructions.length > 4000 || [p.pronunciationVersion ?? 1, p.encoderVersion ?? 1].some(v => !Number.isSafeInteger(v) || v < 1)) throw new Error('narration_invalid_presets');
}
function validateLibrary(catalogue: NarrationNameEntry[], cues: NarrationCue[]): void {
  if (!catalogue.length || catalogue.length > 2000 || !cues.length || cues.length > 20 || new Set(catalogue.map(n => n.id)).size !== catalogue.length || new Set(cues.map(c => c.id)).size !== cues.length) throw new Error('narration_invalid_library');
  const fallback = catalogue.find(n => n.id === 'avonturier');
  if (fallback?.kind !== 'fallback' || fallback.displayName !== 'Avonturier' || !fallback.pronunciations.some(p => p.id === 'nl' && p.spokenSpelling === 'Avonturier')) throw new Error('narration_invalid_library');
  for (const name of catalogue) if (!safeKey(name.id) || !['firstName', 'alias', 'fallback'].includes(name.kind) || !name.displayName.trim() || name.displayName.length > 100 || !name.pronunciations.length || name.pronunciations.length > 5 || new Set(name.pronunciations.map(p => p.id)).size !== name.pronunciations.length || name.pronunciations.some(p => !safeKey(p.id) || !p.spokenSpelling.trim() || p.spokenSpelling.length > 100 || /[\r\n{}<>]/u.test(p.spokenSpelling))) throw new Error('narration_invalid_library');
  for (const cue of cues) if (!safeKey(cue.id) || cue.template.length > 300 || cue.template.split('{{naam}}').length !== 2 || /[\r\n<>]/u.test(cue.template) || cue.template.replace('{{naam}}', '').includes('{')) throw new Error('narration_invalid_library');
}
/** Provider prices checked 2026-11-23. USD cents, indicative; excludes tax, FX, storage, retries and review. */
export function estimateNarrationCost(items: Pick<NarrationPlannedItem, 'fingerprint' | 'text' | 'preset'>[]) {
  const unique = [...new Map(items.map(i => [i.fingerprint, i])).values()];
  let minutes = 0, input = 0, output = 0;
  for (const item of unique) {
    const duration = Math.max(0.025, item.text.split(/\s+/u).length / 130);
    const full = item.preset.model === 'gpt-realtime-2.1';
    minutes += duration;
    input += (item.text.length + item.preset.instructions.length + 200) / 3 * (full ? 4 : 0.6) / 10000;
    output += duration * 1200 * (full ? 64 : 20) / 10000;
  }
  return { expectedItems: items.length, uniqueItems: unique.length, estimatedMinutes: Math.round(minutes * 100) / 100, estimatedCents: Math.ceil(input + output), estimateComplete: false,
    estimation: { textInputCents: Math.ceil(input), audioOutputCents: Math.ceil(output), otherCostsIncluded: false as const } };
}
/** Every reachable edge must terminate in a scene or ending; no hard-coded chapter count. */
function graph(source: Pick<NarrationSource, 'scenes' | 'endings'>) {
  const scenes: string[] = [], endings: string[] = [], pending = [''];
  while (pending.length) {
    const route = pending.shift()!;
    if (route.length > 64 || scenes.length + endings.length > 10000) throw new Error('narration_graph_limit');
    if (Object.hasOwn(source.scenes, route)) {
      if (Object.hasOwn(source.endings, route)) throw new Error('narration_ambiguous_route');
      const scene = source.scenes[route];
      if (!scene || typeof scene.text !== 'string' || !scene.choices.length || scene.choices.length > 10) throw new Error('narration_invalid_scene');
      scenes.push(route);
      scene.choices.forEach((_, index) => pending.push(`${route}${index}`));
    } else if (Object.hasOwn(source.endings, route)) {
      if (typeof source.endings[route]?.text !== 'string') throw new Error('narration_invalid_ending');
      endings.push(route);
    } else throw new Error('narration_missing_route');
  }
  return { scenes, endings };
}
/** Conservative boundaries preserve punctuation and accents. Very long sentences split at a word boundary. */
function boundedText(value: string): string[] {
  const result: string[] = []; let remaining = value;
  while (remaining.length > 700) {
    const end = remaining.lastIndexOf(' ', 700);
    if (end < 1) throw new Error('narration_unbroken_text');
    result.push(remaining.slice(0, end)); remaining = remaining.slice(end + 1);
  }
  if (remaining) result.push(remaining);
  return result;
}
function narrationChunks(value: string, cues: NarrationCue[]): { text: string; cue?: NarrationCue }[] {
  const result: { text: string; cue?: NarrationCue }[] = []; let pending = '';
  const flush = () => { if (pending) result.push({ text: pending }); pending = ''; };
  for (const paragraph of normalizeNarrationText(value).split(/\n\s*\n/gu)) {
    let firstInParagraph = true;
    for (const sentence of paragraph.split(/(?<=[.!?…])\s+/gu).filter(Boolean)) {
      const generic = genericText(sentence), cue = cues.find(candidate => generic === candidate.template.replace('{{naam}}', 'Avonturier'));
      if (cue) { flush(); result.push({ text: generic, cue }); }
      else for (const text of boundedText(generic)) {
        const separator = pending ? firstInParagraph ? '\n\n' : ' ' : '';
        if (pending.length + separator.length + text.length > 700) flush();
        pending += (pending ? separator : '') + text;
      }
      firstInParagraph = false;
    }
  }
  flush(); return result;
}
function placeholderAsset(id: string): NarrationAsset { return { id, sha256: '', byteLength: 0, durationMs: 0, mimeType: 'audio/wav' }; }
async function plannedItem(text: string, preset: NarrationPreset, context: Omit<NarrationPlannedItem, 'id' | 'fingerprint' | 'text' | 'preset'>, cache = new Map<string, string>()): Promise<NarrationPlannedItem> {
  text = normalizeNarrationText(text);
  if (!text || text.length > 700) throw new Error('narration_invalid_fragment');
  const semantic = canonicalNarrationJSON({ compilerVersion: NARRATION_COMPILER_VERSION, text, locale: preset.locale, model: preset.model, voice: preset.providerVoice,
    instructions: preset.instructions, styleVersion: preset.styleVersion, pronunciationVersion: preset.pronunciationVersion ?? 1, encoderVersion: preset.encoderVersion ?? 1, format: NARRATION_FORMAT,
    delivery: context.kind === 'nameCue' ? 'whole-cue' : 'literal' });
  const fingerprint = cache.get(semantic) ?? await narrationHash(semantic);
  cache.set(semantic, fingerprint);
  const id = await narrationHash({ ...context, voiceSlot: preset.slotId, presetVersion: preset.presetVersion, fingerprint });
  return { ...context, id, fingerprint, text, preset: { ...preset } };
}
async function packIdentity(preset: NarrationPreset, catalogue: NarrationNameEntry[], cues: NarrationCue[], packVersion: number) {
  if (!Number.isSafeInteger(packVersion) || packVersion < 1) throw new Error('narration_invalid_library');
  return `pack-${(await narrationHash({ preset, catalogue, cues, packVersion })).slice(0, 40)}`;
}
export async function compileNarrationSource(source: NarrationSource, presets: NarrationPreset[], options: { nameCues?: NarrationCue[]; cueCatalogue?: NarrationNameEntry[]; namePackVersion?: number } = {}): Promise<NarrationPlan> {
  validateNarrationPresets(presets);
  if (!source.storyId || !/^[a-f0-9]{16,64}$/u.test(source.contentVersion)) throw new Error('narration_invalid_source');
  const cues = options.nameCues ?? DEFAULT_NAME_CUES, catalogue = options.cueCatalogue ?? DEFAULT_NAME_CATALOGUE, packVersion = options.namePackVersion ?? 1;
  validateLibrary(catalogue, cues);
  const sourceFingerprint = await narrationHash(source), items: NarrationPlannedItem[] = [], manifests: NarrationManifest[] = [], fingerprintCache = new Map<string, string>();
  const packIds = new Map(await Promise.all(presets.map(async preset => [preset.slotId, await packIdentity(preset, catalogue, cues, packVersion)] as const)));
  const baseGraph = graph(source);
  for (const readingLevel of NARRATION_LEVELS) {
    const layer = source.readingLevels?.[readingLevel] ?? source, routes = graph(layer);
    if (canonicalNarrationJSON(routes) !== canonicalNarrationJSON(baseGraph)) throw new Error('narration_reading_graph_mismatch');
    for (const preset of presets) {
      const manifest: NarrationManifest = { schemaVersion: 1, storyId: source.storyId, contentVersion: source.contentVersion, audioRevision: 1, sourceFingerprint, locale: 'nl-NL', readingLevel,
        access: { scope: 'full', offlineUntil: null }, voice: { slotId: preset.slotId, presetVersion: preset.presetVersion, label: preset.label }, format: NARRATION_FORMAT,
        cuePack: { packId: packIds.get(preset.slotId)!, packVersion, voicePresetVersion: preset.presetVersion, lookup: 'device' }, assets: {}, scenes: {}, endings: {} };
      const compile = async (value: string, kind: 'scene' | 'choice' | 'ending', route: string, choiceIndex?: number): Promise<NarrationSegment[]> => {
        const segments: NarrationSegment[] = []; let part = 0;
        for (const { text, cue } of narrationChunks(value, cues)) {
            const item = await plannedItem(text, preset, { readingLevel, kind: cue ? 'nameCue' : kind, route: `${route}:${kind}:${part++}`, ...(choiceIndex === undefined ? {} : { choiceIndex }), ...(cue ? { cueId: cue.id, catalogueId: 'avonturier', pronunciationId: 'nl' } : {}) }, fingerprintCache);
            // The source route stays useful to administrators; the part disambiguates the item ID only.
            item.route = route; items.push(item); manifest.assets[item.id] = placeholderAsset(item.id);
            segments.push(cue ? { kind: 'nameCue', cueId: cue.id, fallbackAsset: item.id } : { kind: 'asset', asset: item.id });
        }
        if (!segments.length) throw new Error('narration_empty_fragment');
        return segments;
      };
      for (const route of routes.scenes) {
        const scene = layer.scenes[route];
        const segments = await compile([scene.title, scene.text].filter(Boolean).join('\n\n'), 'scene', route);
        const choices = [];
        for (let index = 0; index < scene.choices.length; index++) {
          const choice = scene.choices[index];
          const text = typeof choice === 'string' ? choice : [choice.label, choice.hint].filter(Boolean).join('. ');
          choices.push({ choiceIndex: index, segments: await compile(text, 'choice', route, index) });
        }
        manifest.scenes[route] = { segments, choices };
      }
      for (const route of routes.endings) {
        const ending = layer.endings[route];
        manifest.endings[route] = { segments: await compile([ending.title, ending.text, ending.narration, ending.keepsake].filter(Boolean).join('\n\n'), 'ending', route) };
      }
      manifests.push(manifest);
    }
  }
  return { schemaVersion: 1, storyId: source.storyId, contentVersion: source.contentVersion, sourceFingerprint, items, manifests, ...estimateNarrationCost(items) };
}
export type NarrationLibraryPlan = Omit<ReturnType<typeof estimateNarrationCost>, 'estimation'> & {
  schemaVersion: 1; items: NarrationPlannedItem[];
  cuePacks: (Omit<NarrationCuePack, 'assets'> & { assets: Record<string, NarrationAsset> })[];
  samples: Record<VoiceSlot, string>;
};
export async function compileNarrationLibrary(presets: NarrationPreset[], catalogue = DEFAULT_NAME_CATALOGUE, cues = DEFAULT_NAME_CUES, packVersion = 1): Promise<NarrationLibraryPlan> {
  validateNarrationPresets(presets); validateLibrary(catalogue, cues);
  const items: NarrationPlannedItem[] = [], cuePacks: NarrationLibraryPlan['cuePacks'] = [], samples = {} as Record<VoiceSlot, string>;
  for (const preset of presets) {
    const sample = await plannedItem(NARRATION_TEST_TEXT, preset, { readingLevel: '9plus', kind: 'sample', route: '' });
    samples[preset.slotId] = sample.id; items.push(sample);
    const pack: NarrationLibraryPlan['cuePacks'][number] = { schemaVersion: 1, packId: await packIdentity(preset, catalogue, cues, packVersion), packVersion, locale: 'nl-NL', voiceSlot: preset.slotId, presetVersion: preset.presetVersion, catalogue, cues, variants: {}, fallbackNameId: 'avonturier', assets: {} };
    for (const cue of cues) {
      pack.variants[cue.id] = {};
      for (const name of catalogue) {
        pack.variants[cue.id][name.id] = {};
        for (const pronunciation of name.pronunciations) {
          const item = await plannedItem(cue.template.replace('{{naam}}', pronunciation.spokenSpelling), preset, { readingLevel: '9plus', kind: 'nameCue', route: cue.id, cueId: cue.id, catalogueId: name.id, pronunciationId: pronunciation.id });
          items.push(item); pack.variants[cue.id][name.id][pronunciation.id] = item.id; pack.assets[item.id] = placeholderAsset(item.id);
        }
      }
    }
    cuePacks.push(pack);
  }
  return { schemaVersion: 1, items, cuePacks, samples, ...estimateNarrationCost(items) };
}

/** Dry planning avoids allocating manifests and hashing every logical occurrence in an Edge request. */
export function estimateNarrationCatalogue(sources: NarrationSource[], presets: NarrationPreset[], options: { nameCues?: NarrationCue[]; cueCatalogue?: NarrationNameEntry[] } = {}) {
  validateNarrationPresets(presets);
  const cues = options.nameCues ?? DEFAULT_NAME_CUES, catalogue = options.cueCatalogue ?? DEFAULT_NAME_CATALOGUE;
  validateLibrary(catalogue, cues);
  const items = new Map<string, Pick<NarrationPlannedItem, 'fingerprint' | 'text' | 'preset'>>(); let expectedItems = 0;
  const semantics = new Map(presets.map(p => [p.slotId, canonicalNarrationJSON({ model: p.model, voice: p.providerVoice, instructions: p.instructions, locale: p.locale, styleVersion: p.styleVersion, pronunciationVersion: p.pronunciationVersion ?? 1, encoderVersion: p.encoderVersion ?? 1 })]));
  const add = (text: string, preset: NarrationPreset, cue: boolean) => { expectedItems++; const fingerprint = JSON.stringify([text, cue ? 'whole-cue' : 'literal', semantics.get(preset.slotId)]); if (!items.has(fingerprint)) items.set(fingerprint, { text, preset, fingerprint }); };
  for (const preset of presets) {
    add(NARRATION_TEST_TEXT, preset, false);
    for (const cue of cues) for (const name of catalogue) for (const p of name.pronunciations) add(cue.template.replace('{{naam}}', p.spokenSpelling), preset, true);
  }
  for (const source of sources) {
    const base = graph(source);
    for (const level of NARRATION_LEVELS) {
      const layer = source.readingLevels?.[level] ?? source, routes = graph(layer);
      if (canonicalNarrationJSON(base) !== canonicalNarrationJSON(routes)) throw new Error('narration_reading_graph_mismatch');
      const values = [
        ...routes.scenes.flatMap(route => { const scene = layer.scenes[route]; return [[scene.title, scene.text].filter(Boolean).join('\n\n'), ...scene.choices.map(choice => typeof choice === 'string' ? choice : [choice.label, choice.hint].filter(Boolean).join('. '))]; }),
        ...routes.endings.map(route => { const ending = layer.endings[route]; return [ending.title, ending.text, ending.narration, ending.keepsake].filter(Boolean).join('\n\n'); }),
      ];
      for (const value of values) for (const part of narrationChunks(value, cues)) for (const preset of presets) add(part.text, preset, Boolean(part.cue));
    }
  }
  return { ...estimateNarrationCost([...items.values()]), expectedItems };
}
