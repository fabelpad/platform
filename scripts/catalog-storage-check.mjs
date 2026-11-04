import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { compileSource } from './source-test-loader.mjs';

const temp = await mkdtemp(path.join(tmpdir(), 'fabelpad-catalog-storage-'));
const load = async relative => import(await compileSource(new URL(relative, new URL('../', import.meta.url)), temp));
class MemoryStorage { data = new Map(); getItem(key) { return this.data.get(key) ?? null; } setItem(key, value) { this.data.set(key, String(value)); } }
globalThis.window = { localStorage: new MemoryStorage(), dispatchEvent() {} };
const clone = value => JSON.parse(JSON.stringify(value));
try {
  const catalog = await load('src/storyCatalog.ts');
  const profiles = await load('src/profileStorage.ts');
  const memoryAPI = await load('src/storyMemory.ts');
  const stories = await load('src/storyData.ts');
  const validation = await load('lib/familyValidation.ts');
  const ids = [...catalog.STORY_IDS];
  assert.equal(ids.length, 13);
  assert.deepEqual(validation.WORLD_IDS, ids);
  assert.deepEqual(profiles.CHILD_FIELDS, validation.CHILD_FIELDS);
  assert.equal(validation.CHILD_FIELDS.filter(field => field.startsWith('story-')).length, 13);
  const at = '2026-11-03T12:00:00.000Z';
  let fullMemory = memoryAPI.emptyStoryMemory();
  const completed = {};
  const possibleEvents = new Map();
  // All 416 real routes produce valid persisted fictional memory and bounded keepsakes.
  for (const id of ids) {
    const unopened = memoryAPI.advanceStoryMemory(memoryAPI.emptyStoryMemory(), id, [], 'Alexandertje', { at });
    assert.equal(unopened.encounters.length, 0, `An unchosen story must not invent an encounter: ${id}`);
    assert.equal(unopened.events.length, 0);
    assert.equal(unopened.items.length, 0);
    const endings = new Set();
    for (let route = 0; route < 32; route++) {
      const picks = Array.from({ length: 5 }, (_, bit) => (route >> bit) & 1);
      fullMemory = memoryAPI.advanceStoryMemory(fullMemory, id, picks, 'Alexandertje', { at });
      for (const event of fullMemory.events) possibleEvents.set(event.id, clone(event));
      const ending = stories.getEnding(id, picks, 'Alexandertje');
      endings.add(ending.title);
      assert.ok(fullMemory.items.some(item => item.worldId === id && item.name === ending.keepsake), `Exact keepsake missing for ${id}/${route}`);
      const sample = { schemaVersion: 1, family: { version: 1, children: [{ id: 'sample', name: 'Alexandertje', avatar: 0 }], activeId: 'sample' }, data: { sample: { memory: fullMemory } } };
      assert.equal(validation.validateFamilySnapshot(sample).ok, true, `Memory rejected for ${id}/${route}`);
      assert.equal(fullMemory.openThreads.some(thread => thread.worldId === id), false);
      completed[id] = { ending: ending.title, date: at };
    }
    assert.ok(endings.size >= 2, `${id} needs distinct endings`);
  }
  assert.ok(fullMemory.encounters.length <= catalog.MEMORY_ENCOUNTERS);
  assert.ok(fullMemory.items.length <= catalog.MEMORY_ITEMS);
  assert.ok(fullMemory.events.length <= catalog.MEMORY_EVENTS);
  for (const id of ids) fullMemory = memoryAPI.advanceStoryMemory(fullMemory, id, [0, 1, 0, 1], 'Alexandertje', { at });
  assert.equal(fullMemory.openThreads.length, 13, 'Every started world must remain available to continue');
  for (const id of ids) assert.ok(memoryAPI.continuityGreeting(fullMemory, id, 'Alexandertje'), `Returning recognition missing for ${id}`);
  // Use the largest real event records rather than relying on one lucky replay order.
  fullMemory.events = [...possibleEvents.values()].sort((a, b) => Buffer.byteLength(JSON.stringify(b)) - Buffer.byteLength(JSON.stringify(a))).slice(0, catalog.MEMORY_EVENTS);

  profiles.setStorageScope('parent:catalog-test');
  const children = Array.from({ length: 5 }, (_, i) => ({ id: `catalog-child-${i}`, name: `Avonturier ${i + 1}`, avatar: i % 4 }));
  profiles.saveFamily({ version: 1, children, activeId: children[3].id });
  for (const child of children) {
    for (const id of ids) profiles.saveChild(child.id, `story-${id}`, { picks: [0, 1, 0, 1], updatedAt: Date.parse(at) });
    profiles.saveChild(child.id, 'favorites', ids);
    profiles.saveChild(child.id, 'started', ids);
    profiles.saveChild(child.id, 'completed', completed);
    profiles.saveChild(child.id, 'prefs', { calm: true, muted: false });
    profiles.saveChild(child.id, 'memory', fullMemory);
  }
  const snapshot = profiles.exportSnapshot();
  assert.equal(snapshot.family.activeId, children[0].id, 'Synced active child stays canonical');
  assert.equal(profiles.loadFamily().activeId, children[3].id, 'Device-local active child is retained');
  assert.equal(profiles.isFamilySnapshot(snapshot), true);
  assert.equal(validation.validateFamilySnapshot(snapshot).ok, true, 'Five fully explored children must pass the real backend validator');
  const bytes = Buffer.byteLength(JSON.stringify({ baseRevision: 1, snapshot }));
  assert.ok(bytes < validation.MAX_FAMILY_BYTES, `Five-child document ${bytes} exceeds request cap ${validation.MAX_FAMILY_BYTES}`);
  profiles.hydrateSnapshot(snapshot);
  for (const child of children) for (const id of ids) assert.deepEqual(profiles.readChild(child.id, `story-${id}`, null).picks, [0, 1, 0, 1]);
  profiles.saveChild(children[0].id, 'story-stars', { picks: [1], updatedAt: Date.parse(at) });
  assert.deepEqual(profiles.readChild(children[1].id, 'story-stars', null).picks, [0, 1, 0, 1], 'Siblings remain isolated');
  profiles.setStorageScope('parent:other-account');
  assert.equal(profiles.readChild(children[0].id, 'story-stars', null), null, 'Parent scopes remain isolated');

  const legacy = clone(snapshot);
  legacy.family.children = [children[0]]; legacy.family.activeId = children[0].id;
  legacy.data = { [children[0].id]: { favorites: ['station'], started: ['dream', 'toy'], 'story-dream': { picks: [0, 1], updatedAt: 1 } } };
  assert.equal(validation.validateFamilySnapshot(legacy).ok, true, 'Existing three-story accounts must stay valid');
  for (const mutate of [
    value => { value.data[children[0].id].favorites = ['unknown-world']; },
    value => { value.data[children[0].id]['story-unknown-world'] = { picks: [], updatedAt: 1 }; },
    value => { value.data[children[0].id].memory.encounters[0].worldId = 'unknown-world'; },
    value => { value.data[children[0].id].memory.openThreads.push(clone(value.data[children[0].id].memory.openThreads[0])); },
  ]) {
    const malformed = clone(snapshot); mutate(malformed);
    assert.equal(validation.validateFamilySnapshot(malformed).ok, false, 'Unknown or duplicate content must be rejected');
  }
  console.log(`Catalog storage checks passed: 13 stories / 416 routes, actual keepsakes and recognition, 13 open threads, legacy compatibility, isolated accounts/children and all fields round-trip. Five-child request: ${bytes} bytes / ${validation.MAX_FAMILY_BYTES}.`);
} finally { await rm(temp, { recursive: true, force: true }); }
