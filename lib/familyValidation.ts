import { STORY_IDS, MEMORY_ENCOUNTERS, MEMORY_ITEMS, MEMORY_THREADS, MEMORY_EVENTS } from '../src/storyCatalog';

export const MAX_FAMILY_BYTES = 256 * 1024;
export const MAX_CHILDREN = 5;
export const WORLD_IDS = STORY_IDS;
export const CHILD_FIELDS: readonly string[] = ['favorites', 'started', 'completed', 'prefs', ...WORLD_IDS.map(id => `story-${id}`), 'memory'];
type WorldId = typeof WORLD_IDS[number];

export type FamilySnapshot = {
  schemaVersion: 1;
  family: { version: 1; children: { id: string; name: string; avatar: number }[]; activeId: string };
  data: Record<string, Record<string, unknown>>;
};
export type SnapshotValidation = { ok: true; snapshot: FamilySnapshot } | { ok: false; reason: string };

function object(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function keys(value: Record<string, unknown>, allowed: readonly string[], required: readonly string[] = allowed): boolean {
  return Object.keys(value).every(key => allowed.includes(key)) && required.every(key => Object.hasOwn(value, key));
}
function text(value: unknown, max: number, allowEmpty = false): value is string {
  return typeof value === 'string' && value.length <= max && (allowEmpty || value.trim().length > 0);
}
function integer(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
}
function world(value: unknown): value is WorldId { return typeof value === 'string' && (WORLD_IDS as readonly string[]).includes(value); }
function isoDate(value: unknown): boolean {
  return typeof value === 'string' && value.length <= 30 && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) && Number.isFinite(Date.parse(value));
}
function boundedJson(value: unknown): boolean {
  let nodes = 0;
  function visit(item: unknown, depth: number): boolean {
    if (++nodes > 15_000 || depth > 12) return false;
    if (item === null || typeof item === 'boolean') return true;
    if (typeof item === 'number') return Number.isFinite(item);
    if (typeof item === 'string') return item.length <= 4096;
    if (Array.isArray(item)) return item.length <= 500 && item.every(child => visit(child, depth + 1));
    if (!object(item)) return false;
    const entries = Object.entries(item);
    return entries.length <= 100 && entries.every(([key, child]) => !['__proto__', 'prototype', 'constructor'].includes(key) && key.length <= 100 && visit(child, depth + 1));
  }
  return visit(value, 0);
}
function uniqueObjects(value: unknown, max: number, validate: (entry: Record<string, unknown>) => boolean): boolean {
  if (!Array.isArray(value) || value.length > max) return false;
  const ids = new Set<string>();
  return value.every(entry => {
    if (!object(entry) || !text(entry.id, 160) || ids.has(entry.id) || !validate(entry)) return false;
    ids.add(entry.id); return true;
  });
}
function source(value: unknown): boolean { return value === 'played' || value === 'reconstructed'; }
function memory(value: unknown): boolean {
  if (!object(value) || !keys(value, ['version', 'encounters', 'items', 'openThreads', 'events']) || value.version !== 1) return false;
  return uniqueObjects(value.encounters, MEMORY_ENCOUNTERS, entry => keys(entry, ['id', 'worldId', 'name', 'facts', 'firstMetAt', 'lastSeenAt', 'source']) &&
    world(entry.worldId) && text(entry.name, 100) && Array.isArray(entry.facts) && entry.facts.length <= 8 && entry.facts.every(fact => text(fact, 220)) && isoDate(entry.firstMetAt) && isoDate(entry.lastSeenAt) && source(entry.source)) &&
    uniqueObjects(value.items, MEMORY_ITEMS, entry => keys(entry, ['id', 'worldId', 'name', 'endingTitle', 'acquiredAt', 'source']) &&
      world(entry.worldId) && text(entry.name, 160) && text(entry.endingTitle, 160) && isoDate(entry.acquiredAt) && source(entry.source)) &&
    uniqueObjects(value.openThreads, MEMORY_THREADS, entry => keys(entry, ['id', 'worldId', 'label', 'nextChapter', 'createdAt', 'updatedAt']) &&
      world(entry.worldId) && text(entry.label, 220) && integer(entry.nextChapter, 1, 5) && isoDate(entry.createdAt) && isoDate(entry.updatedAt)) &&
    uniqueObjects(value.events, MEMORY_EVENTS, entry => keys(entry, ['id', 'worldId', 'kind', 'label', 'detail', 'recordedAt', 'source']) &&
      world(entry.worldId) && (entry.kind === 'choice' || entry.kind === 'ending') && text(entry.label, 220) && text(entry.detail, 600, true) && isoDate(entry.recordedAt) && source(entry.source));
}
function worldList(value: unknown): boolean {
  return Array.isArray(value) && value.length <= WORLD_IDS.length && value.every(world) && new Set(value).size === value.length;
}
function childField(field: string, value: unknown): boolean {
  if (field === 'favorites' || field === 'started') return worldList(value);
  if (field === 'completed') return object(value) && Object.entries(value).every(([id, entry]) => world(id) && object(entry) && keys(entry, ['ending', 'date']) && text(entry.ending, 160) && isoDate(entry.date));
  if (field === 'prefs') return object(value) && keys(value, ['muted', 'calm', 'textSize'], ['muted', 'calm']) && typeof value.muted === 'boolean' && typeof value.calm === 'boolean' && (value.textSize === undefined || value.textSize === 'normal' || value.textSize === 'large');
  if (field.startsWith('story-')) return object(value) && keys(value, ['picks', 'updatedAt', 'contentVersion', 'storyId', 'revision'], ['picks', 'updatedAt']) && Array.isArray(value.picks) && value.picks.length <= 5 && value.picks.every(pick => pick === 0 || pick === 1) && integer(value.updatedAt, 0, Number.MAX_SAFE_INTEGER) &&
    (value.contentVersion === undefined || (typeof value.contentVersion === 'string' && /^[a-f0-9]{16,64}$/.test(value.contentVersion))) &&
    (value.storyId === undefined || value.storyId === field.slice(6)) &&
    (value.revision === undefined || integer(value.revision, 0, Number.MAX_SAFE_INTEGER));
  if (field === 'memory') return memory(value);
  return false;
}

export function validateFamilySnapshot(value: unknown): SnapshotValidation {
  const invalid = (reason: string): SnapshotValidation => ({ ok: false, reason });
  if (!boundedJson(value)) return invalid('De gegevens zijn te groot of bevatten ongeldige velden.');
  if (!object(value) || !keys(value, ['schemaVersion', 'family', 'data']) || value.schemaVersion !== 1) return invalid('Het gegevensformaat wordt niet ondersteund.');
  const family = value.family;
  if (!object(family) || !keys(family, ['version', 'children', 'activeId']) || family.version !== 1 || !Array.isArray(family.children) || family.children.length < 1 || family.children.length > MAX_CHILDREN) return invalid('Een gezin heeft één tot vijf kindprofielen.');
  const ids = new Set<string>();
  for (const child of family.children) {
    if (!object(child) || !keys(child, ['id', 'name', 'avatar']) || typeof child.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(child.id) || ['__proto__', 'prototype', 'constructor'].includes(child.id) || ids.has(child.id) || !text(child.name, 20) || !integer(child.avatar, 0, 3)) return invalid('Een kindprofiel bevat ongeldige gegevens.');
    ids.add(child.id);
  }
  if (typeof family.activeId !== 'string' || !ids.has(family.activeId)) return invalid('Het actieve kindprofiel bestaat niet in dit gezin.');
  if (!object(value.data) || Object.keys(value.data).some(id => !ids.has(id))) return invalid('Verhaalgegevens horen bij een ander kindprofiel.');
  for (const fields of Object.values(value.data)) {
    if (!object(fields) || !keys(fields, CHILD_FIELDS, [])) return invalid('Een kindomgeving bevat onbekende gegevens.');
    for (const [field, record] of Object.entries(fields)) if (!childField(field, record)) return invalid('Een verhaalrecord bevat ongeldige gegevens.');
  }
  return { ok: true, snapshot: value as FamilySnapshot };
}

export function validPutBody(value: unknown): value is { baseRevision: number; snapshot: unknown } {
  return object(value) && keys(value, ['baseRevision', 'snapshot']) && integer(value.baseRevision, 0, Number.MAX_SAFE_INTEGER - 1);
}
