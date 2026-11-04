import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { compileSource } from './source-test-loader.mjs';

const temp = await mkdtemp(join(tmpdir(), 'fabelpad-story-content-'));
const words = value => value.trim().split(/\s+/u).length;
const serialized = value => JSON.stringify(value);
try {
  const { worlds } = await import(await compileSource(new URL('../src/worlds.ts', import.meta.url), temp));
  const { getScene, getEnding } = await import(await compileSource(new URL('../src/storyData.ts', import.meta.url), temp));
  const added = worlds.filter(world => world.isNew);
  assert.equal(added.length, 10, 'Exactly ten new worlds supplement the original three');
  assert.equal(worlds.length, 13);
  assert.equal(new Set(worlds.map(world => world.id)).size, worlds.length);
  const imageHashes = new Set();
  const sceneTitles = new Set();
  const report = [];
  let scenesChecked = 0;
  for (const world of added) {
    const art = await readFile(new URL(`../public${world.image}`, import.meta.url));
    assert.ok(art.byteLength > 25_000, `${world.id}: generated illustration missing`);
    assert.equal(art.subarray(0, 4).toString(), 'RIFF');
    assert.equal(art.subarray(8, 12).toString(), 'WEBP');
    imageHashes.add(createHash('sha256').update(art).digest('hex'));
    const endings = new Set();
    let minWords = Infinity, maxWords = 0;
    for (let route = 0; route < 32; route++) {
      const picks = Array.from({ length: 5 }, (_, bit) => (route >> bit) & 1);
      for (let step = 0; step < 5; step++) {
        const prefix = picks.slice(0, step);
        const scene = getScene(world.id, step, prefix, 'Noor');
        assert.ok(scene && scene.title && scene.text, `${world.id}/${step}: missing part`);
        assert.ok(!/undefined|\bNaN\b|\[object Object\]|\$\{/u.test(scene.text), `${world.id}/${step}: broken interpolation`);
        assert.ok(words(scene.text) >= 90, `${world.id}/${step}: only ${words(scene.text)} words`);
        minWords = Math.min(minWords, words(scene.text)); maxWords = Math.max(maxWords, words(scene.text));
        assert.equal(scene.choices.length, 2);
        assert.notEqual(scene.choices[0].label, scene.choices[1].label);
        for (const choice of scene.choices) {
          assert.ok(choice.label && choice.hint);
          assert.ok(['heart', 'sparkles', 'music', 'moon', 'leaf', 'compass'].includes(choice.icon));
        }
        assert.equal(serialized(scene), serialized(getScene(world.id, step, picks, 'Noor')), `${world.id}/${step}: future choices leak into the present`);
        const left = [...prefix, 0], right = [...prefix, 1];
        const nextLeft = step < 4 ? getScene(world.id, step + 1, left, 'Noor') : getEnding(world.id, left, 'Noor');
        const nextRight = step < 4 ? getScene(world.id, step + 1, right, 'Noor') : getEnding(world.id, right, 'Noor');
        assert.notEqual(nextLeft.text, nextRight.text, `${world.id}/${step}: choice has no visible consequence`);
        scenesChecked++;
      }
      const ending = getEnding(world.id, picks, 'Noor');
      assert.ok(words(ending.text) >= 45, `${world.id}: ending is too slight`);
      assert.ok(ending.title && ending.keepsake && !/undefined|\[object Object\]/.test(ending.text));
      endings.add(ending.title);
    }
    const titles = Array.from({ length: 5 }, (_, step) => getScene(world.id, step, Array(step).fill(0), 'Noor').title);
    assert.equal(new Set(titles).size, 5, `${world.id}: five distinct parts required`);
    for (const title of titles) sceneTitles.add(title);
    assert.ok(getScene(world.id, 0, [], 'Noor').text.includes('Noor'));
    assert.ok(endings.size >= 2, `${world.id}: alternative endings required`);
    report.push({ id: world.id, parts: 5, routes: 32, endings: endings.size, wordsPerPart: `${minWords}–${maxWords}` });
  }
  assert.equal(imageHashes.size, 10, 'Every new story has its own generated illustration');
  assert.equal(sceneTitles.size, 50, 'All fifty parts have distinct titles');
  console.log(JSON.stringify(report, null, 2));
  console.log(`Story catalogue checks passed: ten illustrated stories, fifty distinct parts, 320 complete routes and ${scenesChecked} scene evaluations; choices change the following part without leaking future choices.`);
} finally { await rm(temp, { recursive: true, force: true }); }
