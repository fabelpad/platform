import { STORY_IDS } from './storyCatalog';

export type ChildProfile = { id: string; name: string; avatar: number };
export type Family = { version: 1; children: ChildProfile[]; activeId: string };
export type FamilySnapshot = { schemaVersion: 1; family: Family; data: Record<string, Record<string, unknown>> };
export const MAX_CHILDREN = 5;
export const CHILD_FIELDS: readonly string[] = ['favorites', 'started', 'completed', 'prefs', ...STORY_IDS.map(id => `story-${id}`), 'memory'];

const FAMILY_KEY = 'fabelpad-family';
const WORLD_IDS = STORY_IDS;
const IMPORT_OWNER_KEY = 'fabelpad-device-import-owner';
const memory = new Map<string, string>();
const volatileKeys = new Set<string>();
const listeners = new Set<(snapshot: FamilySnapshot) => void>();
let scope = '';
let scopeEpoch = 0;
let notificationEpoch: number | null = null;
let silent = 0;

function physical(key: string) { return scope ? `${scope}::${key}` : key; }
function getPhysical(key: string): string | null {
  if (volatileKeys.has(key)) return memory.get(key) ?? null;
  try { const stored = window.localStorage.getItem(key); if (stored !== null) return stored; } catch { /* A blocked browser keeps a usable session. */ }
  return memory.get(key) ?? null;
}
function setPhysical(key: string, value: string): void {
  memory.set(key, value);
  try { window.localStorage.setItem(key, value); volatileKeys.delete(key); } catch { volatileKeys.add(key); }
}
function getRaw(key: string) { return getPhysical(physical(key)); }
function setRaw(key: string, value: string) { setPhysical(physical(key), value); if (!silent) notifySoon(); }
function parse(key: string): unknown { try { const value = getRaw(key); return value === null ? null : JSON.parse(value); } catch { return null; } }
function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function cleanName(value: unknown) { return typeof value === 'string' && value.trim() ? value.trim().slice(0, 20) : 'Avonturier'; }
function cleanAvatar(value: unknown) { return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 3 ? value : 0; }

export function normalizeFamily(value: unknown): Family | null {
  if (!record(value) || value.version !== 1 || !Array.isArray(value.children)) return null;
  const ids = new Set<string>();
  const children: ChildProfile[] = [];
  for (const candidate of value.children) {
    if (!record(candidate) || typeof candidate.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(candidate.id) || ids.has(candidate.id)) continue;
    ids.add(candidate.id);
    children.push({ id: candidate.id, name: cleanName(candidate.name), avatar: cleanAvatar(candidate.avatar) });
    if (children.length === MAX_CHILDREN) break;
  }
  if (!children.length) return null;
  const activeId = typeof value.activeId === 'string' && children.some(child => child.id === value.activeId) ? value.activeId : children[0].id;
  return { version: 1, children, activeId };
}

export function isFamilySnapshot(value: unknown): value is FamilySnapshot {
  if (!record(value) || value.schemaVersion !== 1 || !record(value.data)) return false;
  if (record(value.family) && value.family.version === 1 && Array.isArray(value.family.children) && value.family.children.length === 0)
    return Object.keys(value.family).length === 3 && value.family.activeId === '' && Object.keys(value.data).length === 0;
  const family = normalizeFamily(value.family);
  if (!family || JSON.stringify(family) !== JSON.stringify(value.family)) return false;
  const childIds = new Set(family.children.map(child => child.id));
  return Object.entries(value.data).every(([id, fields]) => childIds.has(id) && record(fields) && Object.keys(fields).every(field => (CHILD_FIELDS as readonly string[]).includes(field)));
}

/** Account caches never fall back to the old, unclaimed device profiles. */
export function setStorageScope(next: string): void {
  scope = next ? `fabelpad-scope-${encodeURIComponent(next)}` : '';
  scopeEpoch += 1;
  notificationEpoch = null;
}
export function childKey(childId: string, field: string) { return `fabelpad-child-${childId}-${field}`; }
export function readChild<T>(childId: string, field: string, fallback: T): T {
  const value = parse(childKey(childId, field));
  if (value === null) return fallback;
  if (Array.isArray(fallback) && !Array.isArray(value)) return fallback;
  if (record(fallback) && !record(value)) return fallback;
  if (['string', 'number', 'boolean'].includes(typeof fallback) && typeof value !== typeof fallback) return fallback;
  return value as T;
}
export function saveChild(childId: string, field: string, value: unknown): boolean {
  if (!(CHILD_FIELDS as readonly string[]).includes(field)) return false;
  try { setRaw(childKey(childId, field), JSON.stringify(value)); return !volatileKeys.has(physical(childKey(childId, field))); } catch { return false; }
}
export function createChild(name: string, avatar: number): ChildProfile {
  const id = typeof globalThis.crypto?.randomUUID === 'function' ? globalThis.crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 13)}`;
  return { id: `child-${id}`, name: cleanName(name), avatar: cleanAvatar(avatar) };
}
export function saveFamily(family: Family): void { const normalized = normalizeFamily(family); if (normalized) setRaw(FAMILY_KEY, JSON.stringify(normalized)); }
function copyLegacyField(firstId: string, field: string, legacyKey: string, valid: (value: unknown) => boolean): void {
  if (getRaw(childKey(firstId, field)) !== null) return;
  const value = parse(legacyKey); if (valid(value)) saveChild(firstId, field, value);
}
export function loadFamily(): Family {
  const stored = normalizeFamily(parse(FAMILY_KEY));
  if (stored) return stored;
  silent += 1;
  try {
    // Single-child legacy migration is allowed only in the original device scope.
    const legacy = !scope ? parse('fabelpad-profile') : null;
    const first = createChild(record(legacy) ? cleanName(legacy.name) : 'Avonturier', record(legacy) ? cleanAvatar(legacy.avatar) : 0);
    const family: Family = { version: 1, children: [first], activeId: first.id };
    if (!scope) {
      const list = (v: unknown) => Array.isArray(v) && v.every(id => typeof id === 'string' && (WORLD_IDS as readonly string[]).includes(id));
      copyLegacyField(first.id, 'favorites', 'fabelpad-favorites', list);
      copyLegacyField(first.id, 'started', 'fabelpad-started', list);
      copyLegacyField(first.id, 'completed', 'fabelpad-completed', v => record(v) && Object.entries(v).every(([id, item]) => (WORLD_IDS as readonly string[]).includes(id) && record(item) && typeof item.ending === 'string' && typeof item.date === 'string'));
      copyLegacyField(first.id, 'prefs', 'fabelpad-prefs', v => record(v) && typeof v.muted === 'boolean' && typeof v.calm === 'boolean');
      for (const world of WORLD_IDS) copyLegacyField(first.id, `story-${world}`, `fabelpad-story-${world}`, v => record(v) && Array.isArray(v.picks) && v.picks.length <= 5 && v.picks.every(pick => pick === 0 || pick === 1));
    }
    saveFamily(family);
    return family;
  } finally { silent -= 1; }
}
function snapshotWithFamily(family: Family): FamilySnapshot {
  const data: FamilySnapshot['data'] = {};
  for (const child of family.children) {
    data[child.id] = {};
    for (const field of CHILD_FIELDS) { const value = parse(childKey(child.id, field)); if (value !== null) data[child.id][field] = value; }
  }
  return { schemaVersion: 1, family: { ...family, activeId: family.children[0].id }, data };
}
export function exportSnapshot(): FamilySnapshot { return snapshotWithFamily(loadFamily()); }
export function freshSnapshot(): FamilySnapshot {
  const child = createChild('Avonturier', 0);
  return { schemaVersion: 1, family: { version: 1, children: [child], activeId: child.id }, data: { [child.id]: {} } };
}
export function hydrateSnapshot(snapshot: FamilySnapshot): void {
  if (!isFamilySnapshot(snapshot)) throw new Error('Invalid family snapshot');
  silent += 1;
  try {
    const current = normalizeFamily(parse(FAMILY_KEY));
    const retained = new Set(snapshot.family.children.map(child => child.id));
    for (const child of current?.children || []) if (!retained.has(child.id)) for (const field of CHILD_FIELDS) {
      const key = physical(childKey(child.id, field)); memory.delete(key); volatileKeys.delete(key);
      try { window.localStorage.removeItem(key); } catch { memory.set(key, 'null'); volatileKeys.add(key); }
    }
    const activeId = current && snapshot.family.children.some(child => child.id === current.activeId) ? current.activeId : snapshot.family.activeId;
    saveFamily({ ...snapshot.family, activeId });
    for (const child of snapshot.family.children) for (const field of CHILD_FIELDS) {
      const value = snapshot.data[child.id]?.[field];
      // Explicit null prevents stale account-local records reappearing after refresh.
      setRaw(childKey(child.id, field), JSON.stringify(value ?? null));
    }
  } finally { silent -= 1; }
  dispatchChange();
}
export function subscribeStorage(listener: (snapshot: FamilySnapshot) => void): () => void { listeners.add(listener); return () => { listeners.delete(listener); }; }
function dispatchChange() { if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') window.dispatchEvent(new Event('fabelpad-storage-change')); }
function notifySoon() {
  if (notificationEpoch === scopeEpoch) return;
  const epoch = scopeEpoch; notificationEpoch = epoch;
  queueMicrotask(() => {
    if (notificationEpoch === epoch) notificationEpoch = null;
    if (epoch !== scopeEpoch) return;
    const family = normalizeFamily(parse(FAMILY_KEY));
    if (family) { const snapshot = snapshotWithFamily(family); for (const listener of listeners) listener(snapshot); }
    dispatchChange();
  });
}

/** Preview is returned only to its eligible parent; nothing is uploaded here. */
export function legacySnapshotForParent(parentId: string, includeDemo = false): FamilySnapshot | null {
  const owner = getPhysical(IMPORT_OWNER_KEY);
  if (owner && owner !== parentId) return null;
  const previous = scope; silent += 1; scope = '';
  try {
    if (includeDemo && !getRaw(FAMILY_KEY) && !getRaw('fabelpad-profile')) scope = `fabelpad-scope-${encodeURIComponent('prototype-demo')}`;
    const existing = getRaw(FAMILY_KEY) || getRaw('fabelpad-profile') || getRaw('fabelpad-started') || WORLD_IDS.some(id => getRaw(`fabelpad-story-${id}`));
    if (!existing) return null;
    const snapshot = exportSnapshot();
    const meaningful = snapshot.family.children.length > 1 || snapshot.family.children.some(c => c.name !== 'Avonturier') || Object.values(snapshot.data).some(fields => Object.entries(fields).some(([key, value]) => key !== 'prefs' && (Array.isArray(value) ? value.length : record(value) ? Object.keys(value).length : false)));
    return meaningful ? snapshot : null;
  } finally { scope = previous; silent -= 1; }
}
export function markLegacyImported(parentId: string): void { setPhysical(IMPORT_OWNER_KEY, parentId); }

export function isLocalStorageDurable(): boolean { return ![...volatileKeys].some(key => !scope || key.startsWith(`${scope}::`)); }

/** Remove only this parent's app-managed device data, never another family's scope. */
export function clearParentDeviceData(parentId: string): void {
  const prefix = `fabelpad-scope-${encodeURIComponent(`parent:${parentId}`)}::`;
  const draft = `fabelpad-cloud-draft-${encodeURIComponent(parentId)}`;
  const matches = (key: string) => key.startsWith(prefix) || key === draft || key === `${draft}-recovery` || key === `fabelpad-import-pending-${encodeURIComponent(parentId)}` || key === `fabelpad-parent-activity-${encodeURIComponent(parentId)}`;
  for (const key of [...memory.keys()]) if (matches(key)) { memory.delete(key); volatileKeys.delete(key); }
  try {
    const stored = window.localStorage;
    const keys = Array.from({ length: stored.length }, (_, index) => stored.key(index)).filter((key): key is string => key !== null);
    for (const key of keys) if (matches(key)) stored.removeItem(key);
  } catch { /* Memory is cleared even when persistent storage is unavailable. */ }
  if (scope === prefix.slice(0, -2)) { scopeEpoch += 1; notificationEpoch = null; }
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') window.dispatchEvent(new CustomEvent('fabelpad-parent-data-cleared', { detail: { parentId } }));
  dispatchChange();
}
