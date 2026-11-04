import { getEnding, getScene, storyTitles } from './storyData';
import { readChild, saveChild } from './profileStorage';
import { STORY_IDS, MEMORY_ENCOUNTERS, MEMORY_ITEMS, MEMORY_THREADS, MEMORY_EVENTS, isStoryId } from './storyCatalog';
import type { StoryId } from './storyCatalog';
import { newStories } from './newStories';

export type StoryWorld = StoryId;
export type MemorySource = 'played' | 'reconstructed';
export type StoryEncounter = { id: string; worldId: StoryWorld; name: string; facts: string[]; firstMetAt: string; lastSeenAt: string; source: MemorySource };
export type StoryItem = { id: string; worldId: StoryWorld; name: string; endingTitle: string; acquiredAt: string; source: MemorySource };
export type StoryThread = { id: string; worldId: StoryWorld; label: string; nextChapter: number; createdAt: string; updatedAt: string };
export type StoryMemoryEvent = { id: string; worldId: StoryWorld; kind: 'choice' | 'ending'; label: string; detail: string; recordedAt: string; source: MemorySource };
export type StoryMemory = { version: 1; encounters: StoryEncounter[]; items: StoryItem[]; openThreads: StoryThread[]; events: StoryMemoryEvent[] };
type SavedStory = { picks: number[]; updatedAt?: number };

const WORLDS: readonly StoryWorld[] = STORY_IDS;
const threadLabels: Partial<Record<StoryWorld, string>> = { station: 'Ontdek waar het Verdwaalde Station naartoe reist.', dream: 'Help Pippa de droompost weer op de juiste plek te brengen.', toy: 'Breng het havenlicht terug met de Knuffelwacht.' };
const isWorld = isStoryId;
const threadLabel = (world: StoryWorld): string => threadLabels[world] ?? newStories[world]?.threadLabel ?? `Lees verder in ${storyTitles[world]}.`;
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown, max = 220): value is string => typeof value === 'string' && value.length > 0 && value.length <= max;
const isSource = (value: unknown): value is MemorySource => value === 'played' || value === 'reconstructed';
const isDate = (value: unknown): value is string => typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value));
const slug = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function emptyStoryMemory(): StoryMemory { return { version: 1, encounters: [], items: [], openThreads: [], events: [] }; }

/** Accept only the small documented fictional-memory schema, including after a cloud restore. */
export function normalizeStoryMemory(value: unknown): StoryMemory {
  if (!isObject(value) || value.version !== 1) return emptyStoryMemory();
  const list = (key: string) => Array.isArray(value[key]) ? value[key] as unknown[] : [];
  const encounters = list('encounters').filter((v): v is StoryEncounter => isObject(v) && isString(v.id, 100) && isWorld(v.worldId) && isString(v.name, 100) && Array.isArray(v.facts) && v.facts.length <= 8 && v.facts.every(f => isString(f)) && isDate(v.firstMetAt) && isDate(v.lastSeenAt) && isSource(v.source)).slice(-MEMORY_ENCOUNTERS);
  const items = list('items').filter((v): v is StoryItem => isObject(v) && isString(v.id, 160) && isWorld(v.worldId) && isString(v.name) && isString(v.endingTitle) && isDate(v.acquiredAt) && isSource(v.source)).slice(-MEMORY_ITEMS);
  const openThreads = list('openThreads').filter((v): v is StoryThread => isObject(v) && isString(v.id, 100) && isWorld(v.worldId) && isString(v.label) && typeof v.nextChapter === 'number' && Number.isInteger(v.nextChapter) && v.nextChapter >= 1 && v.nextChapter <= 5 && isDate(v.createdAt) && isDate(v.updatedAt)).slice(-MEMORY_THREADS);
  const events = list('events').filter((v): v is StoryMemoryEvent => isObject(v) && isString(v.id, 160) && isWorld(v.worldId) && (v.kind === 'choice' || v.kind === 'ending') && isString(v.label) && typeof v.detail === 'string' && v.detail.length <= 220 && isDate(v.recordedAt) && isSource(v.source)).slice(-MEMORY_EVENTS);
  return { version: 1, encounters, items, openThreads, events };
}

export function getStoryMemory(profileId: string): StoryMemory { return normalizeStoryMemory(readChild<unknown>(profileId, 'memory', null)); }

function knownTime(value: number | string | undefined): string {
  const timestamp = typeof value === 'number' ? value : typeof value === 'string' ? Date.parse(value) : NaN;
  return new Date(Number.isFinite(timestamp) && timestamp > 0 && timestamp <= Date.now() + 60_000 ? timestamp : Date.now()).toISOString();
}

/** Pure reducer: every fact comes from a selected branch or its already-visible result. */
export function advanceStoryMemory(previous: StoryMemory, worldId: StoryWorld, picks: number[], childName: string, options: { at?: number | string; source?: MemorySource } = {}): StoryMemory {
  if (!isWorld(worldId) || picks.length > 5 || !picks.every(p => p === 0 || p === 1)) return normalizeStoryMemory(previous);
  const memory = structuredClone(normalizeStoryMemory(previous));
  const at = knownTime(options.at), source = options.source ?? 'played';
  const meet = (id: string, name: string, fact: string) => {
    const existing = memory.encounters.find(item => item.id === id);
    if (existing) {
      existing.facts = [...new Set([...existing.facts, fact])].slice(-8);
      existing.lastSeenAt = Date.parse(existing.lastSeenAt) > Date.parse(at) ? existing.lastSeenAt : at;
      // Keep the origin of firstMetAt: a later visit cannot make a reconstructed
      // historical timestamp become an exact first-encounter time.
    } else memory.encounters.push({ id, worldId, name, facts: [fact], firstMetAt: at, lastSeenAt: at, source });
  };
  const event = (item: StoryMemoryEvent) => { const index = memory.events.findIndex(old => old.id === item.id); if (index >= 0) { if (source === 'reconstructed' && memory.events[index].source === 'played') return; memory.events.splice(index, 1); } memory.events.push(item); };

  for (let step = 0; step < picks.length; step++) {
    const scene = getScene(worldId, step, picks.slice(0, step), childName);
    const choice = scene.choices[picks[step]];
    event({ id: `${worldId}:choice:${picks.slice(0, step + 1).join('')}`, worldId, kind: 'choice', label: choice.label, detail: scene.title, recordedAt: at, source });
  }

  if (picks.length > 0 && worldId === 'station') {
    meet('station-vos', 'Vos de conducteur', 'Je reisde mee met Vos op het Verdwaalde Station.');
    if (picks[0] === 0) meet('station-dibbel', 'Dibbel het draakje', 'Je repareerde Dibbels kaartje met een sterrensticker.');
    if (picks.length >= 3) meet('station-wolk', 'De wolk met de hik', picks[2] === 0 ? 'Je zong met de wolk zodat zijn hik verdween.' : 'Je bracht de wolk warme wolkenthee tegen de hik.');
  }
  if (picks.length > 0 && worldId === 'dream') {
    meet('dream-pippa', 'Pippa de postuil', 'Je hielp Pippa met haar droompost.');
    if (picks[0] === 0) meet('dream-melle', 'Melle de mol', 'Melle reisde met je mee door de mollentunnel.');
    else meet('dream-fien', 'Fien de vliegende vis', 'Fien reisde met je mee over de regenboogbrug.');
    if (picks.length >= 2) {
      if (picks[1] === 0) meet('dream-beer', 'De dromende beer', 'Je bezocht de beer als eerste om zijn droom terug te brengen.');
      else meet('dream-maantje', 'Het maantje', 'Je bezocht het giechelende maantje als eerste.');
    }
    if (picks.length === 5 && picks[4] === 0) {
      meet('dream-beer', 'De dromende beer', 'De beer kwam rusten in de tuin van duizend dromen.');
      meet('dream-maantje', 'Het maantje', 'Het maantje vertelde een grap in de tuin van duizend dromen.');
    }
  }
  if (picks.length > 0 && worldId === 'toy') {
    if (picks[0] === 0) meet('toy-bram', 'Bram de beer', 'Bram was jouw reisgenoot op de boot.');
    else meet('toy-nola', 'Nola het konijn', 'Nola was jouw reisgenoot op de boot.');
    if (picks.length >= 3) meet('toy-sokkenmonster', 'Het sokkenmonster', picks[2] === 0 ? 'Je maakte een slaapzak van een zakdoek voor het sokkenmonster.' : 'Je nam het sokkenmonster mee op reis.');
    if (picks.length >= 4) meet('toy-reus', 'De grote teddybeer', picks[3] === 0 ? 'Je zong een zacht slaaplied voor de grote teddybeer.' : 'Je vroeg de grote teddybeer vriendelijk of je erlangs mocht.');
  }

  // New story facts are authored alongside their branches, never inferred about the child.
  if (newStories[worldId]) for (const encounter of newStories[worldId].encounters(picks)) meet(encounter.id, encounter.name, encounter.fact);

  const thread = memory.openThreads.find(item => item.worldId === worldId);
  memory.openThreads = memory.openThreads.filter(item => item.worldId !== worldId);
  if (picks.length < 5) memory.openThreads.push({ id: `${worldId}:open-adventure`, worldId, label: threadLabel(worldId), nextChapter: picks.length + 1, createdAt: thread?.createdAt ?? at, updatedAt: at });
  else {
    const ending = getEnding(worldId, picks, childName);
    const itemId = `${worldId}:${slug(ending.keepsake)}`;
    if (!memory.items.some(item => item.id === itemId)) memory.items.push({ id: itemId, worldId, name: ending.keepsake, endingTitle: ending.title, acquiredAt: at, source });
    event({ id: `${worldId}:ending:${slug(ending.title)}`, worldId, kind: 'ending', label: ending.title, detail: ending.keepsake, recordedAt: at, source });
  }
  memory.encounters = memory.encounters.slice(-MEMORY_ENCOUNTERS);
  memory.items = memory.items.slice(-MEMORY_ITEMS);
  memory.events = memory.events.slice(-MEMORY_EVENTS);
  return memory;
}

export function recordStoryProgress(profileId: string, worldId: StoryWorld, picks: number[], childName: string, options: { at?: number | string; source?: MemorySource } = {}): StoryMemory {
  const previous = getStoryMemory(profileId);
  const next = advanceStoryMemory(previous, worldId, picks, childName, options);
  if (JSON.stringify(previous) !== JSON.stringify(next)) saveChild(profileId, 'memory', next);
  return next;
}

/** Older choices are factual, but their individual visit times are unknown. Mark their origin. */
export function backfillStoryMemory(profileId: string, childName: string): StoryMemory {
  const previous = getStoryMemory(profileId);
  let memory = previous;
  for (const world of WORLDS) {
    const saved = readChild<SavedStory | null>(profileId, `story-${world}`, null);
    if (!saved || !Array.isArray(saved.picks) || saved.picks.length > 5 || !saved.picks.every(p => p === 0 || p === 1)) continue;
    const recorded = saved.picks.length ? memory.events.some(item => item.id === `${world}:choice:${saved.picks.join('')}`) : memory.openThreads.some(item => item.worldId === world);
    if (recorded) continue;
    memory = advanceStoryMemory(memory, world, saved.picks, childName, { at: saved.updatedAt, source: 'reconstructed' });
  }
  if (JSON.stringify(previous) !== JSON.stringify(memory)) saveChild(profileId, 'memory', memory);
  return memory;
}

/** Opening an unfinished story creates a thread without replaying or redating past encounters. */
export function openStoryThread(profileId: string, worldId: StoryWorld, picks: number[]): void {
  if (!isWorld(worldId) || picks.length >= 5 || !picks.every(pick => pick === 0 || pick === 1)) return;
  const memory = getStoryMemory(profileId);
  const at = new Date().toISOString();
  const thread = memory.openThreads.find(item => item.worldId === worldId);
  if (thread?.nextChapter === picks.length + 1) return;
  memory.openThreads = memory.openThreads.filter(item => item.worldId !== worldId);
  memory.openThreads.push({ id: `${worldId}:open-adventure`, worldId, label: threadLabel(worldId), nextChapter: picks.length + 1, createdAt: thread?.createdAt ?? at, updatedAt: at });
  saveChild(profileId, 'memory', memory);
}

export function continuityGreeting(memory: StoryMemory, worldId: StoryWorld, childName: string): string | null {
  const name = childName.trim() || 'Avonturier';
  const has = (id: string) => memory.encounters.some(item => item.id === id);
  if (worldId === 'station' && has('station-dibbel')) return `${name}, Dibbel herinnert zich hoe jij zijn kaartje repareerde. Er staat weer een plekje voor je klaar!`;
  if (worldId === 'station' && has('station-vos')) return `Welkom terug, ${name}! Vos weet nog dat jij met zijn bijzondere trein hebt gereisd.`;
  if (worldId === 'dream' && has('dream-melle')) return `${name}, Pippa en Melle kennen je nog van jullie reis door de mollentunnel. De droompost wacht op jullie!`;
  if (worldId === 'dream' && has('dream-fien')) return `${name}, Pippa en Fien kennen je nog van jullie reis over de regenboogbrug.`;
  if (worldId === 'toy' && has('toy-sokkenmonster')) return `${name}, het sokkenmonster herinnert zich jullie avontuur. Je knuffelvrienden zien je graag terug!`;
  if (worldId === 'toy' && has('toy-bram')) return `${name}, Bram weet nog dat jullie samen op de boot stapten.`;
  if (worldId === 'toy' && has('toy-nola')) return `${name}, Nola weet nog dat jullie samen op de boot stapten.`;
  const friend = memory.encounters.find(item => item.worldId === worldId);
  if (friend) return `${name}, ${friend.name} herinnert zich jullie avontuur. ${friend.facts[friend.facts.length - 1] ?? 'Er staat weer een plekje voor je klaar!'}`;
  return null;
}

export function worldName(worldId: StoryWorld): string { return storyTitles[worldId]; }
