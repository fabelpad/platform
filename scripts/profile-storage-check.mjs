import { compileSource } from './source-test-loader.mjs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const temporary = await mkdtemp(join(tmpdir(), 'fabelpad-profile-check-'));
import assert from 'node:assert/strict';

class MemoryStorage {
  data = new Map();
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { this.data.set(key, String(value)); }
}

let fixtureId = 0;
async function fixture(storage = new MemoryStorage()) {
  globalThis.window = { localStorage: storage };
  const moduleURL = new URL('../src/profileStorage.ts', import.meta.url);
  moduleURL.searchParams.set('fixture', String(++fixtureId));
  return { storage, api: await import(await compileSource(moduleURL, temporary)) };
}
function put(storage, key, value) { storage.setItem(key, JSON.stringify(value)); }

// JSON object field order is not part of the snapshot contract. PostgreSQL
// JSONB reorders both family and child objects before PostgREST returns them.
{
  const { api } = await fixture();
  const snapshot = { data: { 'child-jsonb': {} }, family: { activeId: 'child-jsonb', children: [{ avatar: 2, name: 'Avonturier', id: 'child-jsonb' }], version: 1 }, schemaVersion: 1 };
  assert.equal(api.isFamilySnapshot(snapshot), true);
  api.hydrateSnapshot(snapshot);
  assert.deepEqual(api.loadFamily(), { version: 1, children: [{ id: 'child-jsonb', name: 'Avonturier', avatar: 2 }], activeId: 'child-jsonb' });
  for (const mutate of [
    value => { value.family.extra = true; },
    value => { value.family.children[0].extra = true; },
    value => { value.family.children[0].name = ' Avonturier '; },
    value => { value.family.children[0].avatar = 7; },
    value => { value.family.activeId = 'missing'; },
    value => { value.family.children.push({ ...value.family.children[0] }); },
    value => { value.data.foreign = {}; },
  ]) {
    const invalid = structuredClone(snapshot); mutate(invalid);
    assert.equal(api.isFamilySnapshot(invalid), false, 'Accepting reordered keys must not repair or admit an invalid remote family');
  }
}

// All data from the original single-child prototype belongs only to its first child.
{
  const storage = new MemoryStorage();
  put(storage, 'fabelpad-profile', { name: ' Noor ', avatar: 2 });
  put(storage, 'fabelpad-favorites', ['dream']);
  put(storage, 'fabelpad-started', ['station']);
  put(storage, 'fabelpad-completed', { station: { ending: 'Het station om de hoek', date: '2026-10-27' } });
  put(storage, 'fabelpad-prefs', { muted: true, calm: true });
  put(storage, 'fabelpad-story-station', { picks: [0, 1, 0], updatedAt: 123 });
  const { api } = await fixture(storage);
  const family = api.loadFamily();
  const first = family.children[0];
  assert.equal(first.name, 'Noor');
  assert.equal(first.avatar, 2);
  assert.deepEqual(api.readChild(first.id, 'favorites', []), ['dream']);
  assert.deepEqual(api.readChild(first.id, 'started', []), ['station']);
  assert.equal(api.readChild(first.id, 'completed', {}).station.ending, 'Het station om de hoek');
  assert.deepEqual(api.readChild(first.id, 'prefs', {}), { muted: true, calm: true });
  assert.deepEqual(api.readChild(first.id, 'story-station', null).picks, [0, 1, 0]);
  assert.ok(storage.getItem('fabelpad-story-station'), 'Migration must retain legacy records');

  const sibling = api.createChild('Dex', 1);
  api.saveFamily({ ...family, children: [...family.children, sibling], activeId: sibling.id });
  assert.deepEqual(api.readChild(sibling.id, 'favorites', []), []);
  assert.deepEqual(api.readChild(sibling.id, 'completed', {}), {});
  assert.equal(api.readChild(sibling.id, 'story-station', null), null);
  assert.equal(api.loadFamily().activeId, sibling.id);

  api.saveChild(sibling.id, 'favorites', ['toy']);
  api.saveChild(sibling.id, 'prefs', { muted: false, calm: false });
  api.saveChild(sibling.id, 'story-station', { picks: [1, 1], updatedAt: 456 });
  api.saveChild(sibling.id, 'completed', { toy: { ending: 'De knuffelheld', date: '2026-10-28' } });
  assert.deepEqual(api.readChild(first.id, 'favorites', []), ['dream']);
  assert.deepEqual(api.readChild(first.id, 'prefs', {}), { muted: true, calm: true });
  assert.deepEqual(api.readChild(first.id, 'story-station', null).picks, [0, 1, 0]);
  assert.equal(api.readChild(first.id, 'completed', {}).toy, undefined);

  const renamed = { ...first, name: 'Noortje' };
  api.saveFamily({ version: 1, children: [renamed, sibling], activeId: first.id });
  assert.equal(api.loadFamily().children[0].id, first.id);
  assert.equal(api.loadFamily().children[0].name, 'Noortje');
  assert.deepEqual(api.readChild(first.id, 'story-station', null).picks, [0, 1, 0]);
  api.saveChild(first.id, 'story-station', { picks: [1], updatedAt: 789 });
  assert.equal(api.loadFamily().children[0].id, first.id);
  assert.deepEqual(api.readChild(first.id, 'story-station', null).picks, [1], 'Repeated load must not re-copy stale legacy choices');

  // A page reload loads the same IDs, active child, and each child's own records.
  const reloaded = (await fixture(storage)).api;
  assert.equal(reloaded.loadFamily().activeId, first.id);
  assert.equal(reloaded.loadFamily().children.length, 2);
  assert.deepEqual(reloaded.readChild(sibling.id, 'favorites', []), ['toy']);
}

// Invalid family membership is repaired without creating duplicate identities.
{
  const { storage, api } = await fixture();
  put(storage, 'fabelpad-family', { version: 1, children: [{ id: 'valid', name: 'Pip', avatar: 0 }, { id: 'valid', name: 'Duplicate', avatar: 1 }, { id: '../bad', name: 'Bad', avatar: 0 }], activeId: 'missing' });
  const family = api.loadFamily();
  assert.equal(family.children.length, 1);
  assert.equal(family.activeId, 'valid');
  put(storage, api.childKey('valid', 'favorites'), { invalid: true });
  assert.deepEqual(api.readChild('valid', 'favorites', []), []);
}

// Quota failures must not make an older disk value override a newer session value.
{
  const storage = new MemoryStorage();
  put(storage, 'fabelpad-child-quota-favorites', ['station']);
  storage.setItem = () => { throw new Error('Quota exceeded'); };
  const { api } = await fixture(storage);
  api.saveChild('quota', 'favorites', ['toy']);
  assert.deepEqual(api.readChild('quota', 'favorites', []), ['toy']);
}

// Blocked browser storage leaves a stable, isolated session instead of crashing.
{
  const blocked = { getItem() { throw new Error('Storage blocked'); }, setItem() { throw new Error('Storage full'); } };
  const { api } = await fixture(blocked);
  const family = api.loadFamily();
  const first = family.children[0];
  assert.equal(api.loadFamily().activeId, first.id);
  api.saveChild(first.id, 'story-toy', { picks: [0], updatedAt: 1 });
  const second = api.createChild('Beer', 3);
  assert.equal(api.readChild(second.id, 'story-toy', null), null);
  assert.deepEqual(api.readChild(first.id, 'story-toy', null).picks, [0]);
}

// A public prototype must never hydrate an existing authenticated parent's cache.
{
  const { api } = await fixture();
  api.setStorageScope('parent:prototype-owner');
  const parent = api.loadFamily(), parentChild = parent.children[0];
  api.saveChild(parentChild.id, 'story-station', { picks: [1, 0, 1], updatedAt: 1 });
  api.setStorageScope('prototype-demo');
  const demo = api.loadFamily(), demoChild = demo.children[0];
  assert.notEqual(demoChild.id, parentChild.id);
  assert.equal(api.readChild(parentChild.id, 'story-station', null), null);
  api.saveChild(demoChild.id, 'story-station', { picks: [0], updatedAt: 2 });
  api.setStorageScope('parent:prototype-owner');
  assert.deepEqual(api.readChild(parentChild.id, 'story-station', null).picks, [1, 0, 1]);
  assert.equal(api.readChild(demoChild.id, 'story-station', null), null);
}

delete globalThis.window;
await rm(temporary, { recursive: true, force: true });
console.log('Profile isolation checks passed: legacy migration, sibling isolation, rename continuity, reload, validation, blocked storage and a public demo isolated from authenticated parent caches.');
