import { currentStorageIdentity } from './profileStorage';
import type { LocalNarrationNameChoice } from '../lib/narration/contracts';

export type LocalNameMode = LocalNarrationNameChoice['mode'];
export type LocalNarrationChoice = LocalNarrationNameChoice;
type Context = { scope: string; profileId: string; epoch: number; scopeEpoch: number };
type Stored = { id: string; scope: string; profileId: string; choice?: LocalNarrationChoice; cueId?: string; blob?: Blob; purgeEpoch?: string; scopePurgeEpoch?: string };
const DATABASE = 'fabelpad-device-narration-v1';
const epochs = new Map<string, number>();
const blocked = new Map<string, number>();
const failedPurges = new Set<string>();
const identity = (scope: string, profileId: string) => `${scope}:${profileId}`;
const scopeKey = (scope: string) => `scope|${scope}`;
const current = (context: Context) => !blocked.get(scopeKey(context.scope)) && !blocked.get(identity(context.scope, context.profileId)) && !failedPurges.has(scopeKey(context.scope)) && !failedPurges.has(identity(context.scope, context.profileId)) && context.scope === currentStorageIdentity() && context.epoch === (epochs.get(identity(context.scope, context.profileId)) ?? 0) && context.scopeEpoch === (epochs.get(scopeKey(context.scope)) ?? 0);
const contextFor = (profileId: string): Context => ({ scope: currentStorageIdentity(), profileId, epoch: epochs.get(identity(currentStorageIdentity(), profileId)) ?? 0, scopeEpoch: epochs.get(scopeKey(currentStorageIdentity())) ?? 0 });
const request = <T,>(value: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => { value.onsuccess = () => resolve(value.result); value.onerror = () => reject(new Error('Lokale audio-opslag is niet beschikbaar.')); });
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const value = indexedDB.open(DATABASE, 1);
    value.onupgradeneeded = () => { value.result.createObjectStore('settings', { keyPath: 'id' }); value.result.createObjectStore('recordings', { keyPath: 'id' }); value.result.createObjectStore('epochs'); };
    value.onsuccess = () => resolve(value.result); value.onerror = () => reject(new Error('Lokale audio-opslag is niet beschikbaar.'));
  });
}
function validChoice(value: unknown): value is LocalNarrationChoice {
  if (!value || typeof value !== 'object') return false;
  const choice = value as LocalNarrationChoice;
  return ['avonturier', 'name', 'alias', 'recording'].includes(choice.mode) && (choice.catalogueId === undefined || /^[a-z0-9-]{1,100}$/u.test(choice.catalogueId)) && (choice.pronunciationId === undefined || /^[a-z0-9-]{1,100}$/u.test(choice.pronunciationId));
}
async function get(profileId: string, store: 'settings' | 'recordings', suffix = ''): Promise<Stored | null> {
  const context = contextFor(profileId); let db: IDBDatabase | undefined;
  try { db = await open(); const tx = db.transaction([store, 'epochs']); const [row, purgeEpoch, scopePurgeEpoch] = await Promise.all([request(tx.objectStore(store).get(`${identity(context.scope, profileId)}${suffix}`)) as Promise<Stored | undefined>, request(tx.objectStore('epochs').get(identity(context.scope, profileId))), request(tx.objectStore('epochs').get(scopeKey(context.scope)))]); return current(context) && row?.scope === context.scope && row.profileId === profileId && row.purgeEpoch === purgeEpoch && row.scopePurgeEpoch === scopePurgeEpoch ? row : null; }
  catch { return null; } finally { db?.close(); }
}
async function put(profileId: string, store: 'settings' | 'recordings', value: Partial<Stored>, suffix = '', remove = false): Promise<void> {
  const context = contextFor(profileId); const db = await open();
  try {
    const epochId = identity(context.scope, profileId);
    const persistentEpoch = await request(db.transaction('epochs').objectStore('epochs').get(epochId));
    const persistentScopeEpoch = await request(db.transaction('epochs').objectStore('epochs').get(scopeKey(context.scope)));
    if (!current(context)) throw new Error('Het actieve profiel is gewijzigd.');
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['epochs', store], 'readwrite'); const check = tx.objectStore('epochs').get(epochId); const checkScope = tx.objectStore('epochs').get(scopeKey(context.scope)); let applied = false;
      check.onsuccess = () => {
        checkScope.onsuccess = () => {
          if (!current(context) || check.result !== persistentEpoch || checkScope.result !== persistentScopeEpoch) return;
          const id = `${epochId}${suffix}`; if (remove) tx.objectStore(store).delete(id); else tx.objectStore(store).put({ ...value, id, scope: context.scope, profileId, purgeEpoch: persistentEpoch, scopePurgeEpoch: persistentScopeEpoch }); applied = true;
        };
      };
      tx.oncomplete = () => applied && current(context) ? resolve() : reject(new Error('Het actieve profiel is gewijzigd.'));
      tx.onerror = tx.onabort = () => reject(new Error('Lokale audio bewaren lukt niet. Controleer de vrije opslagruimte.'));
    });
  } finally { db.close(); }
}
/** These values never enter profileStorage, exports, cloud sync or HTTP. */
export async function readLocalNameChoice(profileId: string): Promise<LocalNarrationChoice> {
  const row = await get(profileId, 'settings'); return validChoice(row?.choice) ? row.choice : { mode: 'avonturier' };
}
export async function saveLocalNameChoice(profileId: string, choice: LocalNarrationChoice): Promise<void> {
  if (!validChoice(choice)) throw new Error('Deze naamkeuze is niet geldig.');
  await put(profileId, 'settings', { choice: { mode: choice.mode, ...(choice.catalogueId ? { catalogueId: choice.catalogueId } : {}), ...(choice.pronunciationId ? { pronunciationId: choice.pronunciationId } : {}) } });
}
export async function readLocalRecording(profileId: string, cueId: string): Promise<Blob | null> {
  const row = await get(profileId, 'recordings', `:cue:${cueId}`); return row?.blob instanceof Blob ? row.blob : null;
}
export async function saveLocalRecording(profileId: string, cueId: string, blob: Blob): Promise<void> {
  if (!/^[a-z0-9-]{1,100}$/u.test(cueId) || !blob.type.startsWith('audio/') || !blob.size || blob.size > 5 * 1024 * 1024) throw new Error('Neem een korte volledige zin op (maximaal 5 MB).');
  await put(profileId, 'recordings', { cueId, blob }, `:cue:${cueId}`);
}
export async function removeLocalRecording(profileId: string, cueId: string): Promise<void> { await put(profileId, 'recordings', {}, `:cue:${cueId}`, true); }
export async function clearLocalNarration(scope: string, profileId?: string): Promise<void> {
  const prefix = profileId ? identity(scope, profileId) : `${scope}:`;
  const block = profileId ? prefix : scopeKey(scope); blocked.set(block, (blocked.get(block) ?? 0) + 1);
  if (profileId) epochs.set(prefix, (epochs.get(prefix) ?? 0) + 1);
  else epochs.set(scopeKey(scope), (epochs.get(scopeKey(scope)) ?? 0) + 1);
  let db: IDBDatabase | undefined;
  try {
    db = await open(); await new Promise<void>((resolve, reject) => {
      const tx = db!.transaction(['settings', 'recordings', 'epochs'], 'readwrite');
      if (profileId) tx.objectStore('epochs').put(crypto.randomUUID(), identity(scope, profileId));
      else tx.objectStore('epochs').put(crypto.randomUUID(), scopeKey(scope));
      for (const store of ['settings', 'recordings'] as const) {
        const cursor = tx.objectStore(store).openCursor(); cursor.onsuccess = () => {
          const row = cursor.result; if (!row) return;
          const value = row.value as Stored;
          if (value.scope === scope && (!profileId || value.profileId === profileId)) { tx.objectStore('epochs').put(crypto.randomUUID(), identity(scope, value.profileId)); row.delete(); }
          row.continue();
        };
      }
      tx.oncomplete = () => resolve(); tx.onerror = tx.onabort = () => reject(new Error('Lokale audio wissen lukt niet.'));
    });
    failedPurges.delete(block);
  } catch (error) { failedPurges.add(block); throw error; }
  finally { db?.close(); const remaining = (blocked.get(block) ?? 1) - 1; if (remaining) blocked.set(block, remaining); else blocked.delete(block); }
}
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('fabelpad-profile-data-cleared', event => { const detail = (event as CustomEvent<{ scope: string; profileId: string }>).detail; if (detail) void clearLocalNarration(detail.scope, detail.profileId).catch(() => {}); });
  window.addEventListener('fabelpad-parent-data-cleared', event => { const id = (event as CustomEvent<{ parentId?: string }>).detail?.parentId; if (id) void clearLocalNarration(`fabelpad-scope-${encodeURIComponent(`parent:${id}`)}`).catch(() => {}); });
}
