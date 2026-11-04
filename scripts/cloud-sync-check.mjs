import { compileSource } from './source-test-loader.mjs';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const temp = await mkdtemp(join(tmpdir(), 'fabelpad-sync-'));
const storageURL = await compileSource(new URL('../src/profileStorage.ts', import.meta.url), temp);
const { FamilySyncClient } = await import(await compileSource(new URL('../src/cloudSync.ts', import.meta.url), temp));
const storageAPI = await import(storageURL);
class MemoryStore { data = new Map(); getItem(key) { return this.data.get(key) ?? null; } setItem(key, value) { this.data.set(key, value); } }
const clone = value => JSON.parse(JSON.stringify(value));
const snapshot = (name = 'Noor') => ({ schemaVersion: 1, family: { version: 1, children: [{ id: 'child-one', name, avatar: 0 }], activeId: 'child-one' }, data: { 'child-one': {} } });
const changed = (source, field, value) => { const next = clone(source); next.data['child-one'][field] = value; return next; };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function server(owner = 'parent-a', initial = snapshot()) {
  const value = { owner, revision: 1, snapshot: clone(initial), online: true, putCount: 0, active: 0, maxActive: 0, delayFirstPut: null };
  value.fetcher = async (_url, options) => {
    assert.equal(options.headers['X-Fabelpad-Parent'], owner, 'Every call must bind its expected parent identity');
    if (!value.online) throw new TypeError('offline');
    if (value.owner !== owner) return json({ error: 'account_changed' }, 401);
    if (options.method === 'GET') return json({ parent: { id: owner, email: `${owner}@example.test`, displayName: owner }, revision: value.revision, snapshot: clone(value.snapshot) });
    value.putCount++; value.active++; value.maxActive = Math.max(value.maxActive, value.active);
    const body = JSON.parse(options.body);
    try {
      if (value.delayFirstPut && value.putCount === 1) await value.delayFirstPut.promise;
      if (body.baseRevision !== value.revision) return json({ error: 'revision_conflict', revision: value.revision, snapshot: clone(value.snapshot) }, 409);
      value.snapshot = clone(body.snapshot); value.revision++;
      return json({ parent: { id: owner, email: `${owner}@example.test`, displayName: owner }, revision: value.revision, snapshot: clone(value.snapshot) });
    } finally { value.active--; }
  };
  return value;
}

// An acknowledgement for one generation must not erase edits made during that PUT.
{
  const remote = server(); remote.delayFirstPut = deferred();
  const store = new MemoryStore(); const client = new FamilySyncClient('parent-a', { fetcher: remote.fetcher, store, debounceMs: 60_000 });
  await client.load();
  const first = changed(snapshot(), 'favorites', ['station']); client.enqueue(first);
  const saving = client.flush();
  await Promise.resolve();
  const second = changed(first, 'story-station', { picks: [0, 1], updatedAt: 2 }); client.enqueue(second);
  assert.equal(JSON.parse(store.getItem(client.cacheKey)).dirty, true, 'Pending state must be persisted before network acknowledgement');
  remote.delayFirstPut.resolve(); await saving;
  assert.equal(remote.putCount, 2); assert.equal(remote.maxActive, 1);
  assert.equal(client.getState().phase, 'saved'); assert.equal(client.getState().revision, 3);
  assert.deepEqual(remote.snapshot.data['child-one']['story-station'].picks, [0, 1]);
  client.dispose();
}

// A full reload while offline restores the account's unsent draft and its base revision.
{
  const remote = server(); const store = new MemoryStore();
  const client = new FamilySyncClient('parent-a', { fetcher: remote.fetcher, store, debounceMs: 60_000 }); await client.load();
  remote.online = false;
  client.enqueue(changed(snapshot(), 'favorites', ['toy'])); await client.flush();
  assert.equal(client.getState().phase, 'offline'); client.dispose();
  let restored;
  const reloaded = new FamilySyncClient('parent-a', { fetcher: remote.fetcher, store, debounceMs: 60_000, onRemote: value => { restored = value; } });
  await reloaded.load();
  assert.deepEqual(restored.data['child-one'].favorites, ['toy']); assert.equal(reloaded.getState().dirty, true);
  remote.online = true; await reloaded.flush();
  assert.equal(reloaded.getState().phase, 'saved'); assert.equal(reloaded.getState().revision, 2);
  assert.deepEqual(remote.snapshot.data['child-one'].favorites, ['toy']); reloaded.dispose();
}

// A conflict never retries or overwrites by itself; both explicit resolution paths work.
{
  const remote = server(); const store = new MemoryStore(); let hydrated;
  const client = new FamilySyncClient('parent-a', { fetcher: remote.fetcher, store, debounceMs: 60_000, onRemote: value => { hydrated = value; } }); await client.load();
  remote.snapshot = changed(remote.snapshot, 'favorites', ['dream']); remote.revision++;
  client.enqueue(changed(snapshot(), 'favorites', ['toy'])); await client.flush();
  assert.equal(client.getState().phase, 'conflict'); assert.equal(remote.putCount, 1);
  assert.deepEqual(remote.snapshot.data['child-one'].favorites, ['dream']);
  assert.ok(store.getItem(`${client.cacheKey}-recovery`));
  client.chooseRemote(); assert.deepEqual(hydrated.data['child-one'].favorites, ['dream']); assert.equal(client.getState().dirty, false);
  client.enqueue(changed(hydrated, 'favorites', ['station'])); remote.snapshot.data['child-one'].prefs = { calm: true, muted: false }; remote.revision++; await client.flush();
  assert.equal(client.getState().phase, 'conflict');
  await client.chooseLocal(); assert.equal(client.getState().phase, 'saved');
  assert.deepEqual(remote.snapshot.data['child-one'].favorites, ['station']); client.dispose();
}

// Different siblings can continue simultaneously without overwriting each other's full records.
{
  const family = snapshot(); family.family.children.push({ id: 'child-two', name: 'Dex', avatar: 1 }); family.data['child-two'] = {};
  const remote = server('parent-a', family); let merged;
  const first = new FamilySyncClient('parent-a', { fetcher: remote.fetcher, store: new MemoryStore(), debounceMs: 60_000 });
  const second = new FamilySyncClient('parent-a', { fetcher: remote.fetcher, store: new MemoryStore(), debounceMs: 60_000, onMerged: value => { merged = value; } });
  await first.load(); await second.load();
  first.enqueue(changed(family, 'favorites', ['station'])); await first.flush();
  const siblingUpdate = clone(family); siblingUpdate.data['child-two'] = { 'story-dream': { picks: [1, 0], updatedAt: 44 }, memory: { version: 1, events: [{ id: 'owl-met' }] } };
  second.enqueue(siblingUpdate); await second.flush();
  assert.equal(second.getState().phase, 'saved'); assert.equal(remote.revision, 3);
  assert.deepEqual(remote.snapshot.data['child-one'].favorites, ['station']);
  assert.deepEqual(remote.snapshot.data['child-two']['story-dream'].picks, [1, 0]);
  assert.equal(remote.snapshot.data['child-two'].memory.events[0].id, 'owl-met');
  assert.deepEqual(merged.data['child-one'].favorites, ['station'], 'Merged siblings must silently enter the cache before next local export');
  first.dispose(); second.dispose();
}

// Persisted merge bases allow an offline sibling to reconnect after a full reload.
{
  const family = snapshot(); family.family.children.push({ id: 'child-two', name: 'Dex', avatar: 1 }); family.data['child-two'] = {};
  const remote = server('parent-a', family); const store = new MemoryStore();
  const first = new FamilySyncClient('parent-a', { fetcher: remote.fetcher, store, debounceMs: 60_000 }); await first.load();
  remote.online = false; const local = clone(family); local.data['child-two'].favorites = ['toy']; first.enqueue(local); await first.flush(); first.dispose();
  remote.online = true; remote.snapshot.data['child-one'].favorites = ['dream']; remote.revision++;
  const second = new FamilySyncClient('parent-a', { fetcher: remote.fetcher, store, debounceMs: 60_000 }); await second.load(); await second.flush();
  assert.equal(second.getState().phase, 'saved');
  assert.deepEqual(remote.snapshot.data['child-one'].favorites, ['dream']); assert.deepEqual(remote.snapshot.data['child-two'].favorites, ['toy']); second.dispose();
}

// Choosing this device for one conflicted child must preserve unrelated remote siblings.
{
  const family = snapshot(); family.family.children.push({ id: 'child-two', name: 'Dex', avatar: 1 }); family.data['child-two'] = {};
  const remote = server('parent-a', family);
  const client = new FamilySyncClient('parent-a', { fetcher: remote.fetcher, store: new MemoryStore(), debounceMs: 60_000 }); await client.load();
  remote.snapshot.data['child-one'].favorites = ['dream']; remote.snapshot.data['child-two']['story-toy'] = { picks: [0], updatedAt: 44 }; remote.revision++;
  client.enqueue(changed(family, 'favorites', ['station'])); await client.flush(); assert.equal(client.getState().phase, 'conflict');
  await client.chooseLocal();
  assert.deepEqual(remote.snapshot.data['child-one'].favorites, ['station']); assert.deepEqual(remote.snapshot.data['child-two']['story-toy'].picks, [0]); client.dispose();
}

// Retry is bounded when a sibling keeps changing on another device.
{
  const family = snapshot(); family.family.children.push({ id: 'child-two', name: 'Dex', avatar: 1 }); family.data['child-two'] = {};
  const remote = server('parent-a', family);
  const fetcher = async (url, options) => {
    if (options.method === 'PUT') { remote.snapshot.data['child-one'].favorites = remote.putCount % 2 ? ['dream'] : ['station']; remote.revision++; }
    return remote.fetcher(url, options);
  };
  const client = new FamilySyncClient('parent-a', { fetcher, store: new MemoryStore(), debounceMs: 60_000 }); await client.load();
  const local = clone(family); local.data['child-two'].favorites = ['toy']; client.enqueue(local); await client.flush();
  assert.equal(remote.putCount, 4); assert.equal(client.getState().phase, 'conflict'); client.dispose();
}

// Family metadata changes are never merged automatically, even for different children.
{
  const remote = server(); const client = new FamilySyncClient('parent-a', { fetcher: remote.fetcher, store: new MemoryStore(), debounceMs: 60_000 }); await client.load();
  remote.snapshot.family.children[0].name = 'Changed elsewhere'; remote.revision++;
  client.enqueue(changed(snapshot(), 'favorites', ['toy'])); await client.flush();
  assert.equal(client.getState().phase, 'conflict'); assert.equal(remote.putCount, 1); client.dispose();
}

// A browser that cannot retain its draft must never report durable local storage.
{
  const remote = server(); const blocked = { getItem() { return null; }, setItem() { throw new Error('Storage unavailable'); } };
  const client = new FamilySyncClient('parent-a', { fetcher: remote.fetcher, store: blocked, debounceMs: 60_000 }); await client.load();
  remote.online = false; client.enqueue(changed(snapshot(), 'favorites', ['toy'])); await client.flush();
  assert.equal(client.getState().phase, 'offline'); assert.equal(client.getState().localDurable, false); client.dispose();
}

// A disposed parent's late response cannot hydrate another account's interface.
{
  const waiting = deferred(); const applied = [];
  const first = new FamilySyncClient('parent-a', { store: new MemoryStore(), fetcher: async () => waiting.promise, onRemote: value => applied.push(['a', value]) });
  const loading = first.load(); first.dispose();
  const remoteB = server('parent-b', snapshot('Dex'));
  const second = new FamilySyncClient('parent-b', { store: new MemoryStore(), fetcher: remoteB.fetcher, onRemote: value => applied.push(['b', value]) }); await second.load();
  waiting.resolve(json({ parent: { id: 'parent-a', email: '', displayName: '' }, revision: 3, snapshot: snapshot('Noor') })); await loading;
  assert.equal(applied.length, 1); assert.equal(applied[0][0], 'b'); assert.equal(applied[0][1].family.children[0].name, 'Dex'); second.dispose();
}

// If identity changed in another tab, a write is rejected and remains recoverable locally.
{
  const remote = server(); const client = new FamilySyncClient('parent-a', { fetcher: remote.fetcher, store: new MemoryStore(), debounceMs: 60_000 }); await client.load();
  remote.owner = 'parent-b'; client.enqueue(changed(snapshot(), 'favorites', ['toy'])); await client.flush();
  assert.equal(client.getState().phase, 'signed-out'); assert.equal(client.getState().dirty, true); assert.equal(remote.putCount, 0); client.dispose();
}

// Even a malformed successful acknowledgement for another parent must block the old interface.
{
  const remote = server();
  const fetcher = async (url, options) => options.method === 'PUT' ? json({ parent: { id: 'parent-b', email: '', displayName: 'B' }, revision: 9, snapshot: snapshot('B child') }) : remote.fetcher(url, options);
  const client = new FamilySyncClient('parent-a', { fetcher, store: new MemoryStore(), debounceMs: 60_000 }); await client.load();
  client.enqueue(changed(snapshot(), 'favorites', ['toy'])); await client.flush();
  assert.equal(client.getState().phase, 'signed-out'); assert.equal(client.getState().dirty, true);
  assert.equal(client.getState().snapshot.family.children[0].name, 'Noor'); client.dispose();
}

// Session checks can detect account drift without replacing an open editing dialog's data.
{
  const remote = server(); let hydrates = 0;
  const client = new FamilySyncClient('parent-a', { fetcher: remote.fetcher, store: new MemoryStore(), onRemote: () => hydrates++ }); await client.load();
  remote.snapshot.data['child-one'].favorites = ['dream']; remote.revision++;
  await client.verifyIdentity(); assert.equal(client.getState().revision, 1); assert.equal(hydrates, 1);
  remote.owner = 'parent-b'; await client.verifyIdentity(); assert.equal(client.getState().phase, 'signed-out'); client.dispose();
}

// A profile modal opened while GET was in flight prevents hydration and revision advancement.
{
  const remote = server(); let canApply = true; let hydrateCount = 0;
  const client = new FamilySyncClient('parent-a', { fetcher: remote.fetcher, store: new MemoryStore(), canApplyRemote: () => canApply, onRemote: () => hydrateCount++ }); await client.load();
  remote.snapshot = changed(remote.snapshot, 'favorites', ['dream']); remote.revision++;
  canApply = false; await client.refresh();
  assert.equal(client.getState().revision, 1); assert.equal(hydrateCount, 1);
  canApply = true; await client.refresh(); assert.equal(client.getState().revision, 2); assert.equal(hydrateCount, 2); client.dispose();
}

// Local cache boundaries and import ownership do not expose a sibling parent's data.
{
  const store = new MemoryStore(); globalThis.window = { localStorage: store, dispatchEvent() {} };
  storageAPI.setStorageScope(''); store.setItem('fabelpad-profile', JSON.stringify({ name: 'Legacy Noor', avatar: 0 }));
  const legacy = storageAPI.legacySnapshotForParent('parent-a'); assert.equal(legacy.family.children[0].name, 'Legacy Noor');
  storageAPI.markLegacyImported('parent-a'); assert.equal(storageAPI.legacySnapshotForParent('parent-b'), null);
  assert.ok(store.getItem('fabelpad-profile'), 'Legacy source must remain intact');
  storageAPI.setStorageScope('parent:parent-a'); storageAPI.hydrateSnapshot(snapshot('Noor'));
  storageAPI.saveChild('child-one', 'favorites', ['station']);
  storageAPI.setStorageScope('parent:parent-b'); const b = storageAPI.loadFamily();
  assert.equal(b.children[0].name, 'Avonturier'); assert.deepEqual(storageAPI.readChild('child-one', 'favorites', []), []);
  storageAPI.setStorageScope('guest'); assert.equal(storageAPI.loadFamily().children[0].name, 'Avonturier');
  storageAPI.setStorageScope('parent:parent-a'); assert.equal(storageAPI.loadFamily().children[0].name, 'Noor'); assert.deepEqual(storageAPI.readChild('child-one', 'favorites', []), ['station']);
  let notifications = 0; const unsubscribe = storageAPI.subscribeStorage(() => notifications++);
  storageAPI.hydrateSnapshot(snapshot('Noor')); await Promise.resolve(); assert.equal(notifications, 0, 'Hydration cannot queue another upload');
  storageAPI.saveChild('child-one', 'favorites', ['toy']); await Promise.resolve(); assert.equal(notifications, 1); unsubscribe();
  delete globalThis.window;
}

// Child selection is device-local and never creates a cloud revision by itself.
{
  const store = new MemoryStore(); globalThis.window = { localStorage: store, dispatchEvent() {} };
  storageAPI.setStorageScope('parent:selection');
  const family = snapshot(); family.family.children.push({ id: 'child-two', name: 'Dex', avatar: 1 }); family.data['child-two'] = {};
  storageAPI.hydrateSnapshot(family);
  const remote = server('parent-a', family); const client = new FamilySyncClient('parent-a', { store: new MemoryStore(), fetcher: remote.fetcher, debounceMs: 60_000 }); await client.load();
  storageAPI.saveFamily({ ...storageAPI.loadFamily(), activeId: 'child-two' });
  const exported = storageAPI.exportSnapshot(); assert.equal(exported.family.activeId, 'child-one');
  client.enqueue(exported); await client.flush(); assert.equal(remote.putCount, 0);
  storageAPI.hydrateSnapshot(family); assert.equal(storageAPI.loadFamily().activeId, 'child-two', 'Remote hydration must preserve this device’s selected child');
  client.dispose(); delete globalThis.window;
}

await rm(temp, { recursive: true, force: true });
console.log('Cloud sync checks passed: serialized generations, offline reload, disjoint sibling merges, explicit same-child conflicts, identity drift, modal-safe refresh, account boundaries, import ownership, silent hydration and device-local child selection.');
