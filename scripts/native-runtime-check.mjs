import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { compileSource } from './source-test-loader.mjs';

const directory = await mkdtemp(path.join(tmpdir(), 'fabelpad-native-runtime-'));
try {
  const { createStationInteraction } = await import(await compileSource(new URL('../mobile/src/stationInteraction.ts', import.meta.url), directory));
  const { appendChoice } = await import(await compileSource(new URL('../mobile/src/readerProgress.ts', import.meta.url), directory));
  const { createStorageQueue } = await import(await compileSource(new URL('../mobile/src/storageQueue.ts', import.meta.url), directory));
  const catalog = JSON.parse(await readFile(new URL('../mobile/src/content.json', import.meta.url), 'utf8'));
  assert.equal(catalog.stories.length, 13);
  assert.equal(catalog.stories.reduce((sum, story) => sum + Object.keys(story.scenes).length, 0), 403);
  assert.equal(catalog.stories.reduce((sum, story) => sum + Object.keys(story.endings).length, 0), 416);

  for (const choice of [0, 1]) {
    const callbacks = [], chosen = [], canceled = [];
    const clock = { schedule: fn => { callbacks.push(fn); return fn; }, cancel: handle => canceled.push(handle) };
    const scene = createStationInteraction(0, () => {}, value => chosen.push(value), 10, clock);
    scene.apply({ type: 'depart' });
    scene.apply({ type: 'repair' });
    assert.equal(scene.getState().phase, 'choosing', 'Task cannot be skipped');
    scene.apply({ type: 'choose', choice });
    scene.apply({ type: 'choose', choice: 1 - choice });
    scene.apply({ type: 'depart' });
    assert.equal(callbacks.length, 0, 'Must complete ticket/cabinet before boarding');
    scene.apply({ type: choice === 0 ? 'repair' : 'unlock' });
    scene.apply({ type: 'depart' });
    scene.apply({ type: 'depart' });
    assert.equal(callbacks.length, 1);
    callbacks[0](); callbacks[0]();
    assert.deepEqual(chosen, [choice], 'Double taps and duplicate callbacks commit once');
    scene.dispose();

    for (const cleanup of ['suspend', 'dispose']) {
      const pending = [], result = [], cleared = [];
      const old = createStationInteraction(1, () => {}, value => result.push(value), 10, { schedule: fn => { pending.push(fn); return fn; }, cancel: value => cleared.push(value) });
      old.apply({ type: 'choose', choice }); old[cleanup]();
      assert.equal(cleared.length, 1);
      pending[0]();
      assert.deepEqual(result, [], `${cleanup} invalidates queued callbacks even if already dispatched`);
      if (cleanup === 'suspend') {
        old.resume(); old.apply({ type: 'choose', choice: 1 - choice });
        pending[0](); pending[1]();
        assert.deepEqual(result, [1 - choice], 'Resume uses a fresh interaction');
      }
    }
  }

  const profile = id => ({ id, name: id, avatar: 0, picks: { station: [] }, favorites: [], calm: false, largeText: false });
  let store = { schemaVersion: 1, contentVersion: catalog.contentVersion, activeId: 'a', profiles: [profile('a'), profile('b')] };
  const initial = store;
  store = appendChoice(store, 'a', 'station', [], 0, 5);
  assert.deepEqual(store.profiles[0].picks.station, [0]);
  assert.equal(appendChoice(store, 'a', 'station', [], 1, 5), store, 'Stale double tap is ignored');
  assert.equal(appendChoice(store, 'a', 'station', [1], 1, 5), store, 'Equal-length different route is ignored');
  assert.equal(appendChoice(store, 'a', 'station', [0], 2, 5), store, 'Choice must be binary');
  store = { ...store, activeId: 'b' };
  assert.equal(appendChoice(store, 'a', 'station', [0], 1, 5), store, 'Old profile callback cannot write after switch');
  assert.deepEqual(store.profiles[1].picks.station, [], 'New child never resumes another child route');
  const restored = JSON.parse(JSON.stringify(store));
  assert.deepEqual(restored.profiles[0].picks.station, [0], 'Resume retains each profile route');
  assert.deepEqual(initial.profiles[0].picks.station, [], 'Actions never mutate an older snapshot');

  const operations = []; let durable = null, fail = true;
  const queue = createStorageQueue({
    async setItem(key, value) { operations.push(['set', key]); if (fail) { fail = false; throw new Error('disk unavailable'); } durable = value; },
    async removeItem(key) { operations.push(['remove', key]); durable = null; },
  }, 'demo');
  await assert.rejects(queue.persist({ route: [0] }), /disk unavailable/);
  const snapshot = { route: [1] };
  const first = queue.persist(snapshot); snapshot.route.push(0);
  const deletion = queue.remove();
  const last = queue.persist({ route: [1, 1] });
  await Promise.all([first, deletion, last]);
  assert.deepEqual(JSON.parse(durable), { route: [1, 1] }, 'Deletion is ordered with later writes');
  assert.deepEqual(operations.map(([operation]) => operation), ['set', 'set', 'remove', 'set']);
  console.log('Native runtime geslaagd: 13 verhalen / 403 scènes / 416 eindes; stationsacties, dubbele tik, timercleanup, profielhervatten, opslagfout en schrijf-/wisvolgorde.');
} finally { await rm(directory, { recursive: true, force: true }); }
