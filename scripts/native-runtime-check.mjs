import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { compileSource } from './source-test-loader.mjs';

const directory = await mkdtemp(path.join(tmpdir(), 'fabelpad-native-runtime-'));
try {
  const nativeRequire = createRequire(new URL('../mobile/package.json', import.meta.url));
  const metro = nativeRequire('./metro.config.cjs');
  for (const origin of ['../mobile/App.tsx', '../src/storyPersonalization.ts', '../mobile/node_modules/react-native/index.js']) {
    for (const request of ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime']) {
      const resolved = metro.resolver.resolveRequest({ originModulePath: new URL(origin, import.meta.url).pathname, resolveRequest: (_context, target) => target }, request, 'android');
      assert.equal(resolved, nativeRequire.resolve(request), 'Shared/native/renderer imports must use one mobile React dispatcher');
    }
  }
  assert.equal(metro.resolver.resolveRequest({ resolveRequest: (_context, target) => target }, './readerProgress', 'android'), './readerProgress', 'Normal Metro module resolution remains delegated');
  const { createStationInteraction } = await import(await compileSource(new URL('../mobile/src/stationInteraction.ts', import.meta.url), directory));
  const { appendChoice } = await import(await compileSource(new URL('../mobile/src/readerProgress.ts', import.meta.url), directory));
  const { createStorageQueue } = await import(await compileSource(new URL('../mobile/src/storageQueue.ts', import.meta.url), directory));
  const { storiesForProfile, normalizeStoryVersions } = await import(await compileSource(new URL('../mobile/src/storyReleases.ts', import.meta.url), directory));
  const { normalizeReadingLevel, normalizeReadingHistory, readingContent, withCompatibleReading, completedRoute, completedVersion, completedCount, amsterdamDate, automaticReadingLevel, effectiveReadingLevel, isValidBirthDate, nextAmsterdamDayDelay, profileWithReadingSettings, profileReadingLevel } = await import(await compileSource(new URL('../mobile/src/readingLevels.ts', import.meta.url), directory));
  const { getReadingScene, getReadingEnding } = await import(await compileSource(new URL('../src/storyReadingLevels.ts', import.meta.url), directory));
  const { PARENT_SESSION_MS, parentSessionIsActive, parentYearAllowsAccess } = await import(await compileSource(new URL('../mobile/src/parentAccess.ts', import.meta.url), directory));
  const { isParentScreen, nativeBackAction, nativeTabs, needsParentGate, selectedNativeTab } = await import(await compileSource(new URL('../mobile/src/parentNavigation.ts', import.meta.url), directory));
  const catalog = JSON.parse(await readFile(new URL('../mobile/src/content.json', import.meta.url), 'utf8'));
  assert.equal(catalog.stories.length, 13);
  assert.equal(catalog.stories.reduce((sum, story) => sum + Object.keys(story.scenes).length, 0), 403);
  assert.equal(catalog.stories.reduce((sum, story) => sum + Object.keys(story.endings).length, 0), 416);
  assert.equal(catalog.parts, 5);
  let readingScenes = 0, readingEndings = 0;
  for (const story of catalog.stories) {
    for (const level of ['under6', '6to8', '9plus']) {
      const variant = readingContent(story, level);
      assert.equal(Object.keys(variant.scenes).length, 31, `${story.id}/${level}: all chapter variants`);
      assert.equal(Object.keys(variant.endings).length, 32, `${story.id}/${level}: all endings`);
      for (const [route, scene] of Object.entries(variant.scenes)) {
        assert.equal(scene.choices.length, 2, `${story.id}/${route}/${level}: exactly two choices`);
        assert.deepEqual(scene, getReadingScene(story.id, route.length, [...route].map(Number), catalog.nameToken, level), 'Bundled chapter is the actual web-source variant');
        readingScenes += 1;
      }
      for (const [route, ending] of Object.entries(variant.endings)) {
        assert.deepEqual(ending, getReadingEnding(story.id, [...route].map(Number), catalog.nameToken, level), 'Bundled ending is the actual web-source variant');
        assert.equal(ending.keepsake, story.endings[route].keepsake, 'A reading level never changes the earned keepsake');
        readingEndings += 1;
      }
    }
    assert.deepEqual(story.scenes, story.readingLevels['9plus'].scenes);
    assert.deepEqual(story.endings, story.readingLevels['9plus'].endings);
    for (let step = 0; step < 5; step += 1) {
      const art = story.id === 'station' && step < 2 ? '/art/play/station-platform.webp' : story.playImage || story.image;
      assert(catalog.assets[art], `${story.id}/${step}: a bundled play illustration exists`);
    }
  }
  assert.equal(readingScenes, 1209); assert.equal(readingEndings, 1248);
  for (const [asset, hash] of Object.entries(catalog.assets)) {
    assert.equal(createHash('sha256').update(await readFile(new URL(`../mobile/assets${asset}`, import.meta.url))).digest('hex'), hash, `Bundled illustration matches its immutable content checksum: ${asset}`);
  }
  const versions = (await readdir(new URL('../mobile/src/releases/', import.meta.url))).filter(name => /^[a-f0-9]{16}\.json$/.test(name));
  for (const filename of versions) {
    const release = JSON.parse(await readFile(new URL(`../mobile/src/releases/${filename}`, import.meta.url), 'utf8'));
    assert.equal(createHash('sha256').update(JSON.stringify({ stories: release.stories, checksums: release.assets })).digest('hex').slice(0, 16), release.contentVersion, 'Archived content keeps its hashed payload');
    for (const [asset, hash] of Object.entries(release.assets)) assert.equal(createHash('sha256').update(await readFile(new URL(`../mobile/assets${asset}`, import.meta.url))).digest('hex'), hash, 'Older releases retain their original illustration bytes');
    for (const legacy of release.stories) {
      const current = catalog.stories.find(story => story.id === legacy.id);
      if (JSON.stringify(legacy.scenes) === JSON.stringify(current?.scenes) && JSON.stringify(legacy.endings) === JSON.stringify(current?.endings)) {
        assert.deepEqual(withCompatibleReading(legacy, current).readingLevels, current.readingLevels, 'Unchanged legacy routes can use current presentation rewrites');
      }
    }
  }

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
  assert.equal(normalizeReadingLevel(undefined), '6to8');
  assert.equal(normalizeReadingLevel('unknown'), '6to8');
  assert.equal(parentYearAllowsAccess('2000', '2026-11-23'), true, 'A synthetic adult can enter local parent settings');
  for (const answer of ['', '20', '2020', '1899', 'abcd']) assert.equal(parentYearAllowsAccess(answer, '2026-11-23'), false);
  const sessionStart = 123_000;
  assert.equal(parentSessionIsActive(0, sessionStart), false);
  assert.equal(parentSessionIsActive(sessionStart + PARENT_SESSION_MS, sessionStart), true);
  assert.equal(parentSessionIsActive(sessionStart + PARENT_SESSION_MS, sessionStart + PARENT_SESSION_MS), false, 'Parent access ends at the session boundary');
  assert.equal(parentSessionIsActive(0, sessionStart + 1), false, 'Backgrounding invalidates a previously valid session');
  assert.deepEqual(nativeTabs.map(tab => tab.label), ['Ontdek', 'Schatkist', 'Wie speelt?', 'Ouders']);
  const unlockedUntil = sessionStart + PARENT_SESSION_MS;
  for (const destination of ['parent', 'profile-settings']) {
    assert.equal(isParentScreen(destination), true);
    assert.equal(needsParentGate(destination, 0, sessionStart), true, `Cold/direct ${destination} access requires the parent gate`);
    assert.equal(needsParentGate(destination, unlockedUntil, sessionStart), false);
    assert.equal(selectedNativeTab(destination), 'parent', 'Editing and parent navigation keep the Ouders tab selected');
    assert.equal(needsParentGate(destination, unlockedUntil, unlockedUntil), true, `An open ${destination} screen locks at the five-minute boundary`);
    assert.equal(needsParentGate(destination, 0, sessionStart + 1), true, 'Returning from the background cannot restore parent access');
  }
  let parentDestination = 'profile-settings', menuOpen = true;
  const firstBack = nativeBackAction(parentDestination, menuOpen);
  assert.equal(firstBack, 'close-menu', 'Back closes the menu before leaving the unsaved profile form');
  menuOpen = false;
  parentDestination = nativeBackAction(parentDestination, menuOpen);
  assert.equal(parentDestination, 'parent', 'The next Back returns to the parent overview');
  assert.equal(needsParentGate(parentDestination, unlockedUntil, unlockedUntil), true, 'Back does not bypass an expired gate');
  assert.equal(nativeBackAction(parentDestination, false), 'library');
  assert.equal(nativeBackAction('parent-gate', false), 'library');
  assert.equal(selectedNativeTab('parent-gate'), 'parent');
  for (const destination of ['library', 'connected-library', 'reader', 'profiles', 'treasures']) {
    assert.equal(needsParentGate(destination, 0, sessionStart), false, 'Existing child destinations remain available without unlocking parent settings');
  }
  assert.equal(selectedNativeTab('connected-library'), 'library');
  assert.equal(nativeBackAction('library', false), null, 'Root Back remains the native system action');
  const birthday = { ...profile('birthday'), readingLevel: '9plus', picks: { station: [1, 0, 1] } };
  for (const invalid of ['', '2026-04-31', '2025-02-29', '2026-11-24']) {
    assert.equal(isValidBirthDate(invalid, '2026-11-23'), false);
    assert.throws(() => profileWithReadingSettings(birthday, invalid, undefined, true, '2026-11-23'), /geboortedatum/);
  }
  assert.equal(isValidBirthDate('2024-02-29', '2026-11-23'), true);
  assert.equal(profileWithReadingSettings(birthday, '2024-02-29', undefined, true, '2026-11-23').birthDate, '2024-02-29');
  for (const [birthDate, dates, expected] of [
    ['2020-11-23', ['2026-11-22', '2026-11-23', '2026-11-24'], ['under6', '6to8', '6to8']],
    ['2017-11-23', ['2026-11-22', '2026-11-23', '2026-11-24'], ['6to8', '9plus', '9plus']],
    ['2020-02-29', ['2029-02-28', '2029-03-01', '2029-03-02'], ['6to8', '9plus', '9plus']],
  ]) dates.forEach((today, index) => assert.equal(automaticReadingLevel(birthDate, today), expected[index]));
  assert.equal(amsterdamDate(new Date('2026-11-22T23:01:00Z')), '2026-11-23', 'Android and server use Dutch midnight, regardless of device timezone');
  assert.equal(nextAmsterdamDayDelay(new Date('2026-11-22T22:59:59.000Z')), 1020, 'An active app refreshes just after Dutch midnight');
  assert.equal(nextAmsterdamDayDelay(new Date('2026-03-28T23:00:00.000Z')), 23 * 3600000 + 20, 'Dutch spring transition is a 23-hour calendar day');
  assert.equal(nextAmsterdamDayDelay(new Date('2026-10-24T22:00:00.000Z')), 25 * 3600000 + 20, 'Dutch autumn transition is a 25-hour calendar day');
  normalizeReadingHistory(birthday);
  assert.equal(birthday.birthDate, undefined, 'Legacy profiles get no invented birthday');
  assert.equal(birthday.readingLevelOverride, undefined, 'A former reader selection is no explicit parent override');
  assert.equal(profileReadingLevel(birthday, '2026-11-23'), '9plus', 'A valid old category remains readable until a date is supplied');
  const invalidSavedDate = { ...birthday, birthDate: '2026-04-31', readingLevelOverride: 'unknown' };
  normalizeReadingHistory(invalidSavedDate);
  assert.equal(invalidSavedDate.birthDate, undefined);
  assert.equal(invalidSavedDate.readingLevelOverride, undefined);
  assert.deepEqual(invalidSavedDate.picks.station, birthday.picks.station, 'Invalid added metadata never discards a legacy route');
  const automatic = profileWithReadingSettings(birthday, '2019-11-23', undefined, false, '2026-11-23');
  assert.equal(profileReadingLevel(automatic, '2026-11-23'), '6to8', 'A supplied birthday supersedes an old reader setting immediately');
  assert.deepEqual(automatic.picks.station, [1, 0, 1], 'A date edit keeps the route and chapter');
  const manual = profileWithReadingSettings(automatic, automatic.birthDate, '9plus', false, '2026-11-23');
  const restoredManual = JSON.parse(JSON.stringify(manual));
  assert.equal(profileReadingLevel(restoredManual, '2026-11-23'), '9plus', 'An explicit parent choice survives saving and reopening');
  const dateEditedManual = profileWithReadingSettings(restoredManual, '2022-01-01', restoredManual.readingLevelOverride, false, '2026-11-23');
  assert.equal(profileReadingLevel(dateEditedManual, '2026-11-23'), '9plus', 'Date changes preserve an explicit override');
  const resetAutomatic = profileWithReadingSettings(dateEditedManual, dateEditedManual.birthDate, undefined, false, '2026-11-23');
  assert.equal(profileReadingLevel(resetAutomatic, '2026-11-23'), 'under6', 'Removing the override immediately restores the birthday category');
  assert.equal(effectiveReadingLevel({}, undefined, '2026-11-23'), '6to8');
  const switchedProfiles = ['2021-11-23', '2019-11-23', '2017-11-23'].map((birthDate, index) => ({ ...profile(`age-${index}`), birthDate, picks: { station: [index % 2] } }));
  assert.deepEqual(switchedProfiles.map(p => profileReadingLevel(p, '2026-11-23')), ['under6', '6to8', '9plus']);
  assert.deepEqual(switchedProfiles.map(p => p.picks.station), [[0], [1], [0]], 'Switching between age categories never merges child progress');
  const migrated = { ...profile('migrated'), picks: { station: [1, 0, 1, 0, 1] }, storyVersions: { station: 'legacy-version' }, readingLevel: 'malformed', lastCompletedPicks: { invalid: [0] } };
  normalizeReadingHistory(migrated);
  assert.equal(migrated.readingLevel, '6to8');
  assert.deepEqual(completedRoute(migrated, 'station'), [1, 0, 1, 0, 1]);
  assert.equal(completedVersion(migrated, 'station'), 'legacy-version');
  assert.equal(completedCount(migrated), 1);
  assert(!migrated.lastCompletedPicks.invalid, 'Malformed history does not discard valid progress');
  const editedLegacy = structuredClone(catalog.stories[0]); delete editedLegacy.readingLevels;
  editedLegacy.scenes[''].text = 'An earlier different editorial release';
  assert.equal(withCompatibleReading(editedLegacy, catalog.stories[0]), editedLegacy, 'A different old story never borrows the current reading text');
  assert.equal(readingContent(editedLegacy, 'under6'), editedLegacy, 'An incompatible pinned release retains its original text');

  for (const story of catalog.stories) for (let route = 0; route < 32; route += 1) for (const readingLevel of ['under6', '6to8', '9plus']) {
    const choices = Array.from({ length: 5 }, (_, index) => (route >> (4 - index)) & 1);
    let progress = { schemaVersion: 1, contentVersion: catalog.contentVersion, activeId: 'route', profiles: [{ ...profile('route'), picks: { [story.id]: [] }, storyVersions: { [story.id]: catalog.contentVersion }, readingLevel }] };
    for (const [step, choice] of choices.entries()) {
      const before = progress.profiles[0];
      const differentLevel = { ...before, readingLevel: readingLevel === 'under6' ? '9plus' : 'under6' };
      assert.deepEqual(differentLevel.picks, before.picks, 'Switching level preserves the active route and chapter');
      progress = appendChoice(progress, 'route', story.id, choices.slice(0, step), choice, 5);
      if (step < 4) assert.equal(completedRoute(progress.profiles[0], story.id), undefined, 'A keepsake is not granted before the fifth choice');
    }
    const finished = progress.profiles[0];
    assert.deepEqual(finished.lastCompletedPicks[story.id], choices);
    assert.equal(finished.lastCompletedStoryVersions[story.id], catalog.contentVersion);
    const restarted = { ...finished, picks: { ...finished.picks, [story.id]: [] }, storyVersions: { ...finished.storyVersions, [story.id]: 'next-version' } };
    assert.deepEqual(completedRoute(restarted, story.id), choices, 'Restart retains the last completed route');
    assert.equal(completedVersion(restarted, story.id), catalog.contentVersion, 'A saved keepsake keeps its original content release');
    assert.equal(completedCount(restarted), 1);
  }
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
  console.log('Native runtime geslaagd: verplichte geldige geboortedatum voor nieuwe persoonlijke profielen, 6e/9e verjaardag, schrikkeldag op 1 maart, Nederlandse middernacht en zomertijd, bestaande profielen zonder verzonnen datum, handmatige oudervoorkeur en terug naar automatisch, profielwissel met routebehoud; 13 verhalen / 65 hoofdstukken / 403 scènes / 416 eindroutes × 3 leesniveaus (1209 scènes / 1248 eindes); 20 gecontroleerde runtime-illustraties, onveranderlijke releases, vijfdekeuze/aandenken en laatstvoltooide route; stationsacties, dubbele tik, timercleanup, profielhervatten, versievaste verhalen/eindes na updates, opslagfout en schrijf-/wisvolgorde. Geen toesteltest.');
} finally { await rm(directory, { recursive: true, force: true }); }
