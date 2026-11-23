import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileSource } from '../source-test-loader.mjs';
const temporary = await mkdtemp(join(tmpdir(), 'fabelpad-narration-catalogue-'));
const load = async file => import(await compileSource(new URL(`../../${file}`, import.meta.url), temporary));
const { buildStoryRelease } = await load('lib/server/contentRelease.ts');
const { bundledNarrationSources, withCompatibleNarrationReading } = await load('lib/narration/bundled-sources.ts');
const { compileNarrationSource } = await load('lib/narration/compiler.ts');
const { DEFAULT_NARRATION_PRESETS } = await load('lib/narration/contracts.ts');
const { STORY_IDS } = await load('src/storyCatalog.ts');
test.after(() => rm(temporary, { recursive: true, force: true }));
test('actual current and two historical native catalogues compile without rewriting pinned source', async () => {
  const archives = bundledNarrationSources(); assert.equal(archives.length, 26);
  assert.deepEqual([...new Set(archives.map(source => source.contentVersion))].sort(), ['247d7d1c63cc4fa3', '4e48e9296a01fff5']);
  const fingerprints = new Set(); let expectedItems = 0, sourceScenes = 0, sourceChoices = 0, sourceEndings = 0;
  for (const [index, release] of [...STORY_IDS.map(id => buildStoryRelease(id)), ...archives.map(({ storyId, contentVersion, payload }) => ({ storyId, contentVersion, ...payload }))].entries()) {
    const before = JSON.stringify(release), plan = await compileNarrationSource(withCompatibleNarrationReading(release), DEFAULT_NARRATION_PRESETS);
    assert.equal(JSON.stringify(release), before);
    assert.equal(plan.contentVersion, release.contentVersion);
    assert.equal(plan.manifests.length, 15);
    assert.ok(Buffer.byteLength(JSON.stringify(plan)) < 32 * 1024 * 1024, 'Each durable plan fits the database installation limit');
    assert.equal(Object.keys(plan.manifests[0].scenes).length, 31);
    assert.equal(Object.keys(plan.manifests[0].endings).length, 32);
    assert.ok(plan.items.every(item => !item.text.includes('__FABELPAD_CHILD__') && !item.text.includes('{{naam}}')));
    if (index < 13) {
      sourceScenes += Object.keys(release.scenes).length;
      sourceChoices += Object.values(release.scenes).reduce((sum, scene) => sum + scene.choices.length, 0);
      sourceEndings += Object.keys(release.endings).length;
      expectedItems += plan.expectedItems;
      for (const item of plan.items) fingerprints.add(item.fingerprint);
    }
  }
  assert.deepEqual({ sourceScenes, sourceChoices, sourceEndings }, { sourceScenes: 403, sourceChoices: 806, sourceEndings: 416 });
  console.log(JSON.stringify({ fixture: true, realGeneration: false, currentStories: 13, historicalStoryVersions: 26, readingLevels: 3, voices: 5, sourceScenes, sourceChoices, sourceEndings, logicalCombinations: (sourceScenes + sourceChoices + sourceEndings) * 15, plannedCurrentFragments: expectedItems, uniqueCurrentFragments: fingerprints.size }));
});
