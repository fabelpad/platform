import { compileSource } from './source-test-loader.mjs';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

class MemoryStorage { data = new Map(); getItem(key) { return this.data.get(key) ?? null; } setItem(key, value) { this.data.set(key, String(value)); } }
const storage = new MemoryStorage();
globalThis.window = { localStorage: storage, dispatchEvent() {} };
const work = await mkdtemp(path.join(tmpdir(), 'fabelpad-memory-check-'));
try {
  const api = await import(await compileSource(new URL('../src/storyMemory.ts', import.meta.url), work));
  const profiles = await import(await compileSource(new URL('../src/profileStorage.ts', import.meta.url), work));
  const data = await import(await compileSource(new URL('../src/storyData.ts', import.meta.url), work));
  const at = '2026-10-26T12:00:00.000Z';

  // A key-route child did not repair Dibbel's ticket or choose him as a companion.
  const keyRoute = api.advanceStoryMemory(api.emptyStoryMemory(), 'station', [1], 'Noor', { at });
  assert.ok(keyRoute.encounters.some(e => e.id === 'station-vos'));
  assert.ok(!keyRoute.encounters.some(e => e.id === 'station-dibbel'));
  assert.ok(!api.continuityGreeting(keyRoute, 'station', 'Noor').includes('kaartje repareerde'));
  assert.equal(keyRoute.items.length, 0);
  assert.equal(keyRoute.openThreads[0].nextChapter, 2);

  const dragon = api.advanceStoryMemory(api.emptyStoryMemory(), 'station', [0], 'Noor', { at });
  assert.ok(dragon.encounters.some(e => e.id === 'station-dibbel'));
  assert.ok(api.continuityGreeting(dragon, 'station', 'Noor').includes('kaartje repareerde'));
  assert.ok(!api.continuityGreeting(dragon, 'station', 'Noor').includes('gisteren'));
  assert.ok(!dragon.encounters.some(e => e.id === 'station-wolk'));

  // Every complete route awards exactly the keepsake actually returned by the story.
  for (const world of ['station', 'dream', 'toy']) {
    const endings = new Set();
    for (let value = 0; value < 32; value++) {
      const picks = Array.from({ length: 5 }, (_, bit) => (value >> bit) & 1);
      const memory = api.advanceStoryMemory(api.emptyStoryMemory(), world, picks, 'Noor', { at });
      const ending = data.getEnding(world, picks, 'Noor');
      assert.deepEqual(memory.items.map(item => item.name), [ending.keepsake]);
      assert.equal(memory.items[0].endingTitle, ending.title);
      assert.equal(memory.openThreads.length, 0);
      assert.equal(memory.events.filter(item => item.kind === 'choice').length, 5);
      endings.add(ending.title);
      if (world === 'dream') {
        assert.equal(memory.encounters.some(item => item.id === 'dream-melle'), picks[0] === 0);
        assert.equal(memory.encounters.some(item => item.id === 'dream-fien'), picks[0] === 1);
      }
      if (world === 'toy') {
        assert.equal(memory.encounters.some(item => item.id === 'toy-bram'), picks[0] === 0);
        assert.equal(memory.encounters.some(item => item.id === 'toy-nola'), picks[0] === 1);
        const monster = memory.encounters.find(item => item.id === 'toy-sokkenmonster');
        assert.ok(monster.facts.some(fact => fact.includes(picks[2] === 0 ? 'slaapzak' : 'mee op reis')));
      }
    }
    assert.equal(endings.size, 3);
  }

  // Replaying keeps old friends/items but does not duplicate the same facts or event IDs.
  const firstRun = api.advanceStoryMemory(dragon, 'station', [0, 0, 0, 0, 0], 'Noor', { at });
  const secondRun = api.advanceStoryMemory(firstRun, 'station', [0, 0, 0, 0, 0], 'Noor', { at: '2026-10-27T12:00:00.000Z' });
  assert.equal(secondRun.items.length, firstRun.items.length);
  assert.equal(secondRun.events.length, firstRun.events.length);
  assert.equal(secondRun.encounters.length, firstRun.encounters.length);
  assert.equal(new Set(secondRun.events.map(item => item.id)).size, secondRun.events.length);
  const combined = api.advanceStoryMemory(secondRun, 'dream', [0, 0], 'Noor', { at });
  assert.ok(combined.items.some(item => item.worldId === 'station'));
  assert.equal(combined.openThreads[0].worldId, 'dream');

  // Storage is per child, and unfinished worlds remain open while other stories complete.
  api.recordStoryProgress('memory-child-a', 'station', [0, 0], 'Noor', { at });
  api.recordStoryProgress('memory-child-b', 'toy', [1], 'Dex', { at });
  assert.ok(api.getStoryMemory('memory-child-a').encounters.some(item => item.id === 'station-dibbel'));
  assert.equal(api.getStoryMemory('memory-child-b').encounters.some(item => item.id === 'station-dibbel'), false);
  assert.equal(api.getStoryMemory('memory-child-a').encounters.some(item => item.id === 'toy-nola'), false);
  api.recordStoryProgress('memory-child-a', 'dream', [1, 1], 'Noor', { at });
  api.recordStoryProgress('memory-child-a', 'station', [0, 0, 0, 0, 1], 'Noor', { at });
  assert.deepEqual(api.getStoryMemory('memory-child-a').openThreads.map(item => item.worldId), ['dream']);
  api.openStoryThread('memory-child-a', 'station', []);
  assert.equal(api.getStoryMemory('memory-child-a').openThreads.find(item => item.worldId === 'station').nextChapter, 1);

  // Historical progress is restored as reconstructed evidence without inventing a visit day.
  profiles.saveChild('legacy-memory', 'story-dream', { picks: [1, 0, 0], updatedAt: Date.parse(at) });
  profiles.saveChild('legacy-memory', 'story-toy', { picks: [0, 0, 0, 0, 0], updatedAt: Date.parse(at) });
  const restored = api.backfillStoryMemory('legacy-memory', 'Pip');
  assert.ok(restored.encounters.some(item => item.id === 'dream-fien' && item.source === 'reconstructed'));
  assert.ok(!restored.encounters.some(item => item.id === 'dream-melle'));
  assert.equal(restored.items[0].name, data.getEnding('toy', [0, 0, 0, 0, 0], 'Pip').keepsake);
  assert.equal(restored.events[0].recordedAt, at);
  const secondRestore = api.backfillStoryMemory('legacy-memory', 'Pip');
  assert.deepEqual(secondRestore, restored, 'Backfill is idempotent');

  // Many alternate paths cannot grow the cloud record without bound.
  let many = api.emptyStoryMemory();
  for (const world of ['station', 'dream', 'toy']) for (let value = 0; value < 32; value++) many = api.advanceStoryMemory(many, world, Array.from({ length: 5 }, (_, bit) => (value >> bit) & 1), 'Pip', { at });
  assert.ok(many.events.length <= 100);
  assert.ok(many.encounters.length <= 24);
  assert.ok(many.items.length <= 24);
  const validation = await import(await compileSource(new URL('../lib/familyValidation.ts', import.meta.url), work));
  const children = Array.from({ length: 5 }, (_, index) => ({ id: `memory-child-${index}`, name: `Kind ${index + 1}`, avatar: index % 4 }));
  const snapshot = { schemaVersion: 1, family: { version: 1, children, activeId: children[0].id }, data: Object.fromEntries(children.map(child => [child.id, { memory: many }])) };
  const validated = validation.validateFamilySnapshot(snapshot);
  assert.equal(validated.ok, true, validated.ok ? undefined : validated.reason);
  assert.ok(Buffer.byteLength(JSON.stringify(snapshot)) < validation.MAX_FAMILY_BYTES, 'Five fully explored memories must fit the cloud document limit');
  assert.equal(api.advanceStoryMemory(restored, 'dream', [1, 0, 0], 'Pip', { at: Date.now() }).encounters.find(item => item.id === 'dream-fien').source, 'reconstructed', 'A later visit cannot turn an approximate historical first-visit timestamp into a verified one');
  const recordedBefore = Date.now();
  const future = api.advanceStoryMemory(api.emptyStoryMemory(), 'station', [0], 'Pip', { at: '2099-01-01T00:00:00.000Z', source: 'reconstructed' });
  assert.ok(Date.parse(future.encounters[0].firstMetAt) >= recordedBefore && Date.parse(future.encounters[0].firstMetAt) <= Date.now());
  assert.equal(api.normalizeStoryMemory({ version: 1, encounters: [{ id: 'invalid' }] }).encounters.length, 0);
  assert.deepEqual(api.advanceStoryMemory(api.emptyStoryMemory(), 'station', [2], 'Pip'), api.emptyStoryMemory());
  console.log('Story memory checks passed: all96routes, exact keepsakes, branch facts, replay dedupe, open threads, child isolation, historical backfill, bounded events, real cloud validation of five fully explored children.');
} finally { await rm(work, { recursive: true, force: true }); }
