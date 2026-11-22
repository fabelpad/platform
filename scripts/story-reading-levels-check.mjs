import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileSource } from './source-test-loader.mjs';

const temporary = await mkdtemp(join(tmpdir(), 'fabelpad-reading-levels-'));
try {
  const source = file => compileSource(new URL(`../src/${file}.ts`, import.meta.url), temporary).then(url => import(url));
  const [{ STORY_IDS, STORY_PARTS }, { getScene, getEnding }, { getReadingScene, getReadingEnding }, readingLevels, { youngChapterLabels }] = await Promise.all([
    source('storyCatalog'), source('storyData'), source('storyReadingLevels'), source('readingLevel'), source('youngChapterLabels'),
  ]);
  assert.equal(STORY_IDS.length, 13, 'The release contains thirteen adventures');
  assert.equal(new Set(STORY_IDS).size, 13, 'Story IDs are unique');
  assert.equal(STORY_PARTS, 5, 'An adventure closes after its fifth choice');
  assert.equal(readingLevels.DEFAULT_READING_LEVEL, '6to8', 'An absent profile preference defaults to 6–8');
  assert.deepEqual(readingLevels.READING_LEVELS.map(level => level.id), ['under6', '6to8', '9plus']);
  assert.deepEqual(readingLevels.READING_LEVELS.map(level => level.label), ['5 jaar en jonger', '6 t/m 8 jaar', '9+ jaar']);
  for (const value of ['under6', '6to8', '9plus']) assert.equal(readingLevels.isReadingLevel(value), true);
  for (const value of [undefined, null, '', '6-8', 'invalid', 6, {}]) assert.equal(readingLevels.isReadingLevel(value), false);
  const bands = ['under6', '6to8'];
  const words = text => text.trim().split(/\s+/u).length;
  const ratios = { under6: [], '6to8': [] };
  const routeRatios = { under6: [], '6to8': [] };
  const route = (value, length) => Array.from({ length }, (_, bit) => (value >> (length - 1 - bit)) & 1);
  const name = 'Robin';
  const chapterVariants = new Set();
  const completeRoutes = new Set();
  const endingTitles = new Set();
  const allBands = [...bands, '9plus'];
  const validProse = (text, context) => {
    assert.equal(typeof text, 'string', context);
    assert.ok(text.trim().length > 0, `${context}: text must not be empty`);
    assert.ok(!/undefined|\bNaN\b|\[object Object\]|\$\{/u.test(text), `${context}: broken interpolation`);
  };
  function checkText(text, original, band, context) {
    const ratio = words(text) / words(original);
    validProse(text, `${context}, ${band}`);
    assert.ok(ratio >= .9 && ratio <= 1.1, `${context}: ${band} has ${words(text)} words for ${words(original)} original words (${ratio.toFixed(2)})`);
    assert.ok(text.split(/\n\s*\n/u).length >= 5, `${context}: ${band} needs short reading blocks`);
    assert.notEqual(text, original, `${context}: ${band} must use adapted prose`);
    ratios[band].push(ratio);
  }

  for (const id of STORY_IDS) {
    assert.equal(youngChapterLabels[id]?.length, STORY_PARTS, `${id}: five complete young-reader label sets`);
    for (let step = 0; step < STORY_PARTS; step++) {
      for (let n = 0; n < 2 ** step; n++) {
        const picks = route(n, step);
        const context = `${id}, chapter ${step + 1}, route ${picks.join('') || 'start'}`;
        chapterVariants.add(`${id}/${picks.join('')}`);
        const original = getScene(id, step, picks, name);
        validProse(original.text, `${context}, 9plus`);
        assert.equal(original.choices.length, 2, `${context}: exactly two canonical choices`);
        assert.deepEqual(getReadingScene(id, step, picks, name, '9plus'), original);
        const readings = bands.map(band => {
          const adapted = getReadingScene(id, step, picks, name, band);
          checkText(adapted.text, original.text, band, context);
          assert.equal(adapted.choices.length, 2, context);
          assert.ok(adapted.title.trim().length > 0, `${context}: missing chapter title`);
          assert.ok(adapted.choices.every(choice => choice.label.trim().length > 0), `${context}: empty choice label`);
          assert.notEqual(adapted.choices[0].label, adapted.choices[1].label, `${context}: distinguishable choices`);
          assert.deepEqual(adapted.choices.map(choice => choice.icon), original.choices.map(choice => choice.icon), context);
          assert.deepEqual(getReadingScene(id, step, [...picks, 1, 0, 1], name, band), adapted, `${context}: later choices changed the chapter`);
          return adapted.text;
        });
        assert.notEqual(...readings, `${context}: the two age versions must differ`);
        for (const band of allBands) {
          const before = [...picks];
          const current = getReadingScene(id, step, picks, name, band);
          assert.deepEqual(picks, before, `${context}: reading must not mutate route choices`);
          assert.deepEqual(getReadingScene(id, step, picks, ` ${name} `, band), current, `${context}: profile name is trimmed`);
          assert.deepEqual(getReadingScene(id, step, picks, '', band), getReadingScene(id, step, picks, 'Avonturier', band), `${context}: missing name uses the existing fallback`);
          // Re-reading a completed route must show the same chapter as the
          // original visit: future choices cannot leak into current prose.
          for (let future = 0; future < 2 ** (STORY_PARTS - step); future++) {
            assert.deepEqual(getReadingScene(id, step, [...picks, ...route(future, STORY_PARTS - step)], name, band), current, `${context}: ${band} changed after later choices`);
          }
          const next = choice => step < STORY_PARTS - 1
            ? getReadingScene(id, step + 1, [...picks, choice], name, band)
            : getReadingEnding(id, [...picks, choice], name, band);
          assert.notEqual(next(0).text, next(1).text, `${context}: ${band} choices must retain their distinct consequences`);
        }
      }
    }
    for (let n = 0; n < 2 ** STORY_PARTS; n++) {
      const picks = route(n, STORY_PARTS);
      const context = `${id}, ending ${picks.join('')}`;
      completeRoutes.add(`${id}/${picks.join('')}`);
      const original = getEnding(id, picks, name);
      endingTitles.add(original.title);
      validProse(original.text, `${context}, 9plus`);
      assert.deepEqual(getReadingEnding(id, picks, name, '9plus'), original);
      const chapters = Array.from({ length: STORY_PARTS }, (_, step) => picks.slice(0, step));
      const originalRouteLength = words(original.text) + chapters.reduce((sum, prefix, step) => sum + words(getScene(id, step, prefix, name).text), 0);
      const readings = bands.map(band => {
        const ending = getReadingEnding(id, picks, name, band);
        checkText(ending.text, original.text, band, context);
        assert.equal(ending.title, original.title, context);
        assert.equal(ending.keepsake, original.keepsake, context);
        const routeLength = words(ending.text) + chapters.reduce((sum, prefix, step) => sum + words(getReadingScene(id, step, prefix, name, band).text), 0);
        const routeRatio = routeLength / originalRouteLength;
        assert.ok(routeRatio >= .95 && routeRatio <= 1.05, `${context}: ${band} has ${routeLength} words for ${originalRouteLength} original words`);
        routeRatios[band].push(routeRatio);
        return ending.text;
      });
      assert.notEqual(...readings, `${context}: the two endings must use age-specific prose`);
      for (const band of allBands) {
        const before = [...picks];
        const ending = getReadingEnding(id, picks, name, band);
        assert.deepEqual(picks, before, `${context}: ending must not mutate the completed route`);
        assert.equal(ending.title, original.title, `${context}: ${band} retains the canonical ending identity`);
        assert.equal(ending.keepsake, original.keepsake, `${context}: ${band} awards the canonical keepsake`);
      }
    }
  }

  assert.equal(chapterVariants.size, 403, 'All unique chapter variants are covered');
  assert.equal(completeRoutes.size, 416, 'All thirteen × thirty-two final routes are covered');
  assert.equal(endingTitles.size, 34, 'All existing final-route identities remain available');
  for (const band of bands) {
    assert.equal(ratios[band].length, 403 + 416, `${band}: every chapter variant and ending was checked`);
    assert.equal(routeRatios[band].length, 416, `${band}: every complete route is within 5% of its original prose length`);
  }

  const observed = Object.fromEntries(bands.map(band => [band, {
    passages: ratios[band].length,
    shortest: `${(100 * Math.min(...ratios[band])).toFixed(1)}%`,
    longest: `${(100 * Math.max(...ratios[band])).toFixed(1)}%`,
    fullRouteRange: `${(100 * Math.min(...routeRatios[band])).toFixed(1)}–${(100 * Math.max(...routeRatios[band])).toFixed(1)}%`,
  }]));
  console.log('Story reading levels checked: thirteen adventures, five chapters and two choices each; 403 chapter variants, 416 complete routes, 34 ending identities; exact keepsakes, all future-choice combinations, unchanged route arrays, and profile-default contract:', observed);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
