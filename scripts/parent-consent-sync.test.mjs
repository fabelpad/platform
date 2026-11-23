import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileSource } from './source-test-loader.mjs';

const temp = await mkdtemp(join(tmpdir(), 'fabelpad-parent-consent-'));
const { FamilySyncClient } = await import(await compileSource(new URL('../src/cloudSync.ts', import.meta.url), temp));
const { ParentActivityQueue } = await import(await compileSource(new URL('../src/parentActivity.ts', import.meta.url), temp));
after(() => rm(temp, { recursive: true, force: true }));
class Store {
  data = new Map();
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { this.data.set(key, value); }
}
const parent = { id: 'parent-a', email: 'parent@example.test', displayName: 'Ouder' };
const initial = () => ({ schemaVersion: 1, family: { version: 1, children: [{ id: 'first', name: 'Noor', avatar: 0 }, { id: 'kept', name: 'Mila', avatar: 1 }], activeId: 'first' }, data: { first: { favorites: ['dream'] }, kept: { favorites: ['station'], prefs: { calm: true } } } });
const remaining = () => ({ schemaVersion: 1, family: { version: 1, children: [{ id: 'kept', name: 'Mila op de server', avatar: 1 }], activeId: 'kept' }, data: { kept: { favorites: ['toy'], prefs: { calm: true } } } });
const response = (snapshot, revision = 1, owner = parent) => Response.json({ parent: owner, revision, snapshot });

test('withdrawing one profile preserves sibling activity and ignores an old in-flight rejection', async () => {
  const store = new Store(); let release, began;
  const started = new Promise(resolve => { began = resolve; });
  const event = (suffix, profileId) => ({ eventId: `00000000-0000-4000-8000-0000000000${suffix}`, kind: 'reading', profileId, occurredAt: '2026-11-23T12:00:00.000Z' });
  const key = `fabelpad-parent-activity-${parent.id}`;
  store.setItem(key, JSON.stringify([event('01', 'first'), event('02', 'kept')])); store.setItem('other-activity', 'preserved');
  const sent = [];
  const queue = new ParentActivityQueue(parent.id, { store, id: () => event('03', 'kept').eventId, fetcher: async (_url, init) => { const value = JSON.parse(init.body); sent.push(value.profileId); if (sent.length === 1) { began(); return new Promise(resolve => { release = () => resolve(new Response(null, { status: 403 })); }); } return Response.json({ ok: true }); } });
  const writing = queue.flush(); await started; queue.discardProfile('first');
  assert.deepEqual(JSON.parse(store.getItem(key)).map(value => value.profileId), ['kept']);
  release(); await writing; assert.deepEqual(sent, ['first', 'kept']);
  queue.record('kept'); await queue.flush(); assert.deepEqual(sent, ['first', 'kept', 'kept']);
  assert.deepEqual(JSON.parse(store.getItem(key)), []); assert.equal(store.getItem('other-activity'), 'preserved'); queue.stop();
});

test('confirmed withdrawal pauses writes on read failure, preserves siblings and retries only a server read', async () => {
  const store = new Store(); let online = true, withdrawn = false, writes = 0, applied;
  store.setItem('other-parent-cache', 'preserved');
  const client = new FamilySyncClient(parent.id, { store, debounceMs: 60_000, onRemote: value => { applied = value; }, onMerged: value => { applied = value; }, fetcher: async (_url, init) => {
    if (init.method === 'PUT') { writes++; throw new Error('No write is expected'); }
    if (!online) throw new Error('Offline');
    return response(withdrawn ? remaining() : initial(), withdrawn ? 2 : 1);
  } });
  await client.load();
  const dirty = initial(); dirty.data.kept.favorites = ['station', 'dream']; client.enqueue(dirty);
  withdrawn = true; online = false;
  await assert.rejects(client.reloadAfterConsentWithdrawal('first'));
  assert.equal(client.getState().consentReloadRequired, 'first');
  assert.equal(client.getState().dirty, true, 'Unsent edits of the retained sibling remain recoverable while writes are paused');
  assert.deepEqual(applied.family.children.map(child => child.id), ['kept']);
  assert.deepEqual(applied.data.kept.favorites, ['station', 'dream']);
  const persisted = JSON.parse(store.getItem(client.cacheKey));
  assert.equal(JSON.stringify(persisted).includes('Noor'), false);
  assert.equal(store.getItem('other-parent-cache'), 'preserved');
  client.enqueue(initial()); await client.flush(); assert.equal(writes, 0);
  online = true; await client.reloadAfterConsentWithdrawal('first');
  assert.equal(client.getState().consentReloadRequired, undefined);
  assert.equal(client.getState().phase, 'conflict', 'Unsent sibling edits remain recoverable when that sibling also changed remotely');
  assert.deepEqual(client.getState().snapshot.data.kept.favorites, ['station', 'dream']);
  assert.deepEqual(client.getState().remote.snapshot, remaining());
  assert.equal(JSON.stringify(client.getState()).includes('Noor'), false);
  client.chooseRemote(); assert.equal(client.getState().phase, 'saved');
  assert.deepEqual(applied, remaining()); assert.equal(writes, 0);
  client.dispose();
});

test('a late acknowledged write cannot restore a withdrawn profile after the authoritative reload', async () => {
  let release, started; const pending = new Promise(resolve => { started = resolve; });
  let withdrawn = false, writes = 0; const store = new Store();
  const client = new FamilySyncClient(parent.id, { store, debounceMs: 60_000, fetcher: async (_url, init) => {
    if (init.method === 'PUT') { writes++; started(); return new Promise(resolve => { release = () => resolve(response(initial(), 2)); }); }
    return response(withdrawn ? remaining() : initial(), withdrawn ? 3 : 1);
  } });
  await client.load(); const dirty = initial(); dirty.data.first.favorites.push('station'); client.enqueue(dirty);
  const writing = client.flush(); await pending;
  withdrawn = true; await client.reloadAfterConsentWithdrawal('first'); release(); await writing;
  assert.equal(client.getState().revision, 3); assert.deepEqual(client.getState().snapshot, remaining());
  assert.equal(client.getState().dirty, false); assert.equal(writes, 1);
  assert.equal(JSON.stringify(JSON.parse(store.getItem(client.cacheKey))).includes('Noor'), false);
  client.dispose();
});

test('a failed confirmation reload cannot reveal another account or resurrect the removed child offline', async () => {
  const store = new Store(); let another = false;
  const client = new FamilySyncClient(parent.id, { store, fetcher: async () => response(initial(), 1, another ? { ...parent, id: 'other-parent' } : parent) });
  await client.load(); another = true;
  await assert.rejects(client.reloadAfterConsentWithdrawal('first'));
  assert.equal(client.getState().phase, 'signed-out');
  assert.deepEqual(client.getState().snapshot.family.children.map(child => child.id), ['kept']); client.dispose();
  let applied;
  const reopened = new FamilySyncClient(parent.id, { store, fetcher: async () => { throw new Error('Offline'); }, onRemote: value => { applied = value; } });
  await reopened.load(); assert.equal(reopened.getState().phase, 'offline');
  assert.deepEqual(applied.family.children.map(child => child.id), ['kept']);
  assert.equal(JSON.stringify(applied).includes('Noor'), false); reopened.dispose();
});

test('sibling changes automatically resume after a superseded in-flight write finishes', async () => {
  const store = new Store(); let release, start; const started = new Promise(resolve => { start = resolve; });
  const kept = initial(); kept.family.children = [kept.family.children[1]]; kept.family.activeId = 'kept'; delete kept.data.first;
  let withdrawn = false, writes = 0;
  const client = new FamilySyncClient(parent.id, { store, debounceMs: 60_000, fetcher: async (_url, init) => {
    if (init.method === 'PUT') {
      writes++;
      if (writes === 1) { start(); return new Promise(resolve => { release = () => resolve(response(initial(), 2)); }); }
      const submitted = JSON.parse(init.body).snapshot;
      assert.deepEqual(submitted.family.children.map(child => child.id), ['kept']);
      assert.deepEqual(submitted.data.kept.favorites, ['station', 'dream']);
      return response(submitted, 4);
    }
    return response(withdrawn ? kept : initial(), withdrawn ? 3 : 1);
  } });
  await client.load(); const dirty = initial(); dirty.data.kept.favorites.push('dream'); client.enqueue(dirty);
  const oldWrite = client.flush(); await started; withdrawn = true;
  await client.reloadAfterConsentWithdrawal('first'); assert.equal(client.getState().phase, 'pending');
  release(); await oldWrite;
  for (let i = 0; i < 10 && client.getState().phase !== 'saved'; i++) await new Promise(resolve => setImmediate(resolve));
  assert.equal(writes, 2); assert.equal(client.getState().phase, 'saved'); assert.equal(client.getState().revision, 4);
  assert.deepEqual(client.getState().snapshot.data.kept.favorites, ['station', 'dream']); client.dispose();
});
