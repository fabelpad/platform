import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileSource } from './source-test-loader.mjs';

const temporary = await mkdtemp(join(tmpdir(), 'fabelpad-platform-'));
const values = new Map();
const target = new EventTarget();
globalThis.window = target;
globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
const entries = new Map();
const cache = { async put(key, value) { entries.set(key, value); }, async match(key) { return entries.get(key); }, async delete(key) { return entries.delete(key); } };
globalThis.caches = { async open() { return cache; } };
window.caches = caches;
let failing = false;
globalThis.fetch = async () => { if (failing) throw new TypeError('offline'); return new Response('image-bytes', { headers: { 'Content-Type': 'image/webp' } }); };
try {
  const access = await import(await compileSource(new URL('../src/prototypeAccess.ts', import.meta.url), temporary));
  assert.equal(access.getStoryPreviewLimit('weather'), undefined, 'Existing content remains available until access testing is explicitly enabled.');
  localStorage.setItem('fabelpad-prototype-access-v1', JSON.stringify({ testAccess: true, freeStory: 'weather', plan: 'free' }));
  assert.equal(access.getStoryPreviewLimit('weather'), undefined);
  assert.equal(access.getStoryPreviewLimit('dream'), 1);
  assert.equal(access.getStoryPreviewLimit('station'), 0);
  localStorage.setItem('fabelpad-prototype-access-v1', JSON.stringify({ testAccess: true, freeStory: 'weather', plan: 'family' }));
  assert.equal(access.getStoryPreviewLimit('station'), undefined);
  assert.equal(access.getPrototypePreviewIds('dream').length, 2);
  assert.ok(!access.getPrototypePreviewIds('dream').includes('dream'));
  const { validateFamilySnapshot } = await import(await compileSource(new URL('../lib/familyValidation.ts', import.meta.url), temporary));
  const snapshot = { schemaVersion: 1, family: { version: 1, children: [{ id: 'child-test', name: 'Test', avatar: 0 }], activeId: 'child-test' }, data: { 'child-test': { prefs: { muted: false, calm: false, textSize: 'large' } } } };
  assert.equal(validateFamilySnapshot(snapshot).ok, true, 'New optional text-size preferences remain accepted by the family contract.');
  snapshot.data['child-test'].prefs.textSize = 'invalid';
  assert.equal(validateFamilySnapshot(snapshot).ok, false);
  delete snapshot.data['child-test'].prefs.textSize;
  assert.equal(validateFamilySnapshot(snapshot).ok, true, 'Existing preference records without textSize remain valid.');
  const editorial = await import(await compileSource(new URL('../src/editorialStore.ts', import.meta.url), temporary));
  const draft = editorial.getEditorialDraft('station');
  draft.chapters['0'] = { text: '{{naam}} ziet een nieuwe trein.' };
  assert.equal(editorial.saveEditorialDraft('station', draft), true);
  assert.equal(editorial.getPublishedScene('station', 0), undefined, 'Autosaved drafts must not leak to the reader.');
  const invalid = structuredClone(draft); invalid.chapters['1'] = { text: '  ' };
  assert.ok(editorial.publishEditorialDraft('station', invalid).errors.length > 0);
  assert.equal(editorial.getPublishedMetadata('station'), undefined);
  assert.equal(editorial.publishEditorialDraft('station', draft).publication.version, 1);
  assert.equal(editorial.getPublishedScene('station', 0).text, '{{naam}} ziet een nieuwe trein.');
  assert.equal(editorial.getPublishedScene('station', 1), undefined, 'Unedited branch-dependent scenes stay intact.');
  const downloads = await import(await compileSource(new URL('../src/prototypeDownloads.ts', import.meta.url), temporary));
  await downloads.downloadStory('station');
  assert.deepEqual(downloads.getDownloads(), ['station']);
  assert.ok(await cache.match('/art/play/train.webp'));
  const bundle = await (await cache.match('/art/download-station.json')).json();
  assert.equal(Object.keys(bundle.scenes).length, 31);
  assert.equal(Object.keys(bundle.endings).length, 32);
  assert.deepEqual(Object.keys(bundle.readingLevels).sort(), ['6to8', '9plus', 'under6']);
  assert.ok(await cache.match('/art/play/station-scene.webp'));
  failing = true;
  await assert.rejects(downloads.downloadStory('dream'));
  assert.deepEqual(downloads.getDownloads(), ['station'], 'Failed downloads never become ready.');
  await downloads.removeDownload('station');
  assert.deepEqual(downloads.getDownloads(), []);
  assert.equal(await cache.match('/art/play/train.webp'), undefined);
  failing = false;
  const { worlds } = await import(await compileSource(new URL('../src/worlds.ts', import.meta.url), temporary));
  const { storyPlayArt } = await import(await compileSource(new URL('../src/storyPlayArt.ts', import.meta.url), temporary));
  for (const world of worlds) {
    await downloads.downloadStory(world.id);
    const saved = await (await cache.match(`/art/download-${world.id}.json`)).json();
    assert.ok(await cache.match(world.image));
    if (storyPlayArt[world.id]) assert.ok(await cache.match(storyPlayArt[world.id].image));
    for (const band of ['under6', '6to8', '9plus']) {
      assert.equal(Object.keys(saved.readingLevels[band].scenes).length, 31);
      assert.equal(Object.keys(saved.readingLevels[band].endings).length, 32);
      assert.equal(saved.readingLevels[band].endings['01010'].keepsake, saved.endings['01010'].keepsake);
    }
    await downloads.removeDownload(world.id);
  }
  console.log('Platform checks passed: explicit access testing, draft/publication isolation, unchanged branching, real cached assets, all download routes and failure cleanup.');
} finally { await rm(temporary, { recursive: true, force: true }); }
