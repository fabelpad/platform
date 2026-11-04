import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileSource } from './source-test-loader.mjs';

const temp = await mkdtemp(join(tmpdir(), 'fabelpad-story-growth-'));
const words = value => value.trim().split(/\s+/u).length;
try {
  const baseline = JSON.parse(await readFile(new URL('./fixtures/story-length-baseline.json', import.meta.url), 'utf8'));
  const stories = await import(await compileSource(new URL('../src/storyData.ts', import.meta.url), temp));
  const report = [];
  let checked = 0;
  for (const [id, previous] of Object.entries(baseline.stories)) {
    let minimum = Infinity, maximum = 0;
    for (const [prefix, original] of Object.entries(previous.scenes)) {
      const picks = Array.from(prefix, Number);
      const scene = stories.getScene(id, picks.length, picks, baseline.hero);
      const length = words(scene.text), ratio = length / original.words;
      assert.ok(ratio >= 2, `${id}/${prefix || 'opening'}: ${length} words, need at least ${original.words * 2}`);
      assert.equal(scene.title, original.title, `${id}: saved scenes retain their identity`);
      assert.deepEqual(scene.choices, original.choices, `${id}/${prefix}: choices and route meanings must stay unchanged`);
      assert.ok(scene.text.includes('\n\n'), `${id}/${prefix}: longer scenes need readable paragraphs`);
      minimum = Math.min(minimum, ratio); maximum = Math.max(maximum, ratio); checked++;
    }
    for (const [route, original] of Object.entries(previous.endings)) {
      const ending = stories.getEnding(id, Array.from(route, Number), baseline.hero);
      const ratio = words(ending.text) / original.words;
      assert.ok(ratio >= 2, `${id}/${route}: ending ${words(ending.text)} words, need at least ${original.words * 2}`);
      assert.equal(ending.title, original.title);
      assert.equal(ending.keepsake, original.keepsake);
      minimum = Math.min(minimum, ratio); maximum = Math.max(maximum, ratio); checked++;
    }
    report.push({ story: id, minGrowth: Number(minimum.toFixed(2)), maxGrowth: Number(maximum.toFixed(2)) });
  }
  console.log(JSON.stringify(report));
  console.log(`Story growth checks passed: ${checked} scenes/endings across thirteen stories are at least twice as long; choices, saved route meanings and keepsakes remain unchanged.`);
} finally { await rm(temp, { recursive: true, force: true }); }
