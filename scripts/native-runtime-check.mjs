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
  const { storiesForProfile, normalizeStoryVersions } = await import(await compileSource(new URL('../mobile/src/storyReleases.ts', import.meta.url), directory));
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

  // Updating bundled stories must preserve a child's existing route and keepsake.
  const older = structuredClone(catalog);
  const newer = structuredClone(catalog);
  newer.contentVersion = 'new-test-release';
  newer.stories[0].title = 'A changed station';
  newer.stories[0].endings['00000'].keepsake = 'A different keepsake';
  const releases = { [older.contentVersion]: older, [newer.contentVersion]: newer };
  const returningChild = { ...profile('returning'), picks: { station: [0, 0, 0, 0, 0] } };
  returningChild.storyVersions = normalizeStoryVersions(returningChild, older.contentVersion);
  const restoredChild = JSON.parse(JSON.stringify(returningChild));
  const oldStation = storiesForProfile(newer.stories, releases, restoredChild).find(story => story.id === 'station');
  assert.equal(oldStation.title, older.stories[0].title, 'An app update does not replace a started story');
  assert.equal(oldStation.endings['00000'].keepsake, older.stories[0].endings['00000'].keepsake, 'A completed adventure keeps its original ending');
  const unstartedChild = { ...profile('new'), picks: {} };
  assert.equal(storiesForProfile(newer.stories, releases, unstartedChild)[0].title, 'A changed station', 'New adventures use the current release');
  const restartedChild = { ...restoredChild, picks: { station: [] }, storyVersions: { station: newer.contentVersion } };
  assert.equal(storiesForProfile(newer.stories, releases, restartedChild)[0].title, 'A changed station', 'An explicit restart opts into the latest release');
  assert(storiesForProfile(newer.stories.slice(1), releases, restoredChild).some(story => story.id === 'station'), 'A removed library entry remains available to a child who started it');
  assert(!storiesForProfile(newer.stories, { [newer.contentVersion]: newer }, restoredChild).some(story => story.id === 'station'), 'A missing old release never falls back to edited story text');
  assert.deepEqual(normalizeStoryVersions({ ...restoredChild, storyVersions: { station: older.contentVersion, stale: 'unused' } }, newer.contentVersion), { station: older.contentVersion }, 'Version migration preserves valid existing pins and drops unused pins');

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
  console.log('Native runtime geslaagd: 13 verhalen / 403 scènes / 416 eindes; stationsacties, dubbele tik, timercleanup, profielhervatten, versievaste verhalen/eindes na updates, opslagfout en schrijf-/wisvolgorde.');
} finally { await rm(directory, { recursive: true, force: true }); }
