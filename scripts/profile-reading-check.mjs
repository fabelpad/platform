import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileSource } from './source-test-loader.mjs';

const temporary = await mkdtemp(join(tmpdir(), 'fabelpad-profile-reading-'));
try {
  const { amsterdamDate, isValidBirthDate, ageOnDate, automaticReadingLevel, effectiveReadingLevel } = await import(await compileSource(new URL('../src/profileReading.ts', import.meta.url), temporary));
  const { personalizeStoryText } = await import(await compileSource(new URL('../src/storyPersonalization.ts', import.meta.url), temporary));
  const today = '2026-11-23';
  for (const value of [undefined, null, '', '2026-04-31', '2025-02-29', '1900-02-29', '0000-01-01', '2026-11-24', '23-11-2020', '2020-1-01', '2020-01-01T00:00:00Z', {}, 20200101]) {
    assert.equal(isValidBirthDate(value, today), false, `Reject invalid/future date ${JSON.stringify(value)}`);
    assert.equal(ageOnDate(value, today), null);
    assert.equal(automaticReadingLevel(value, today), undefined);
  }
  for (const value of ['2020-02-29', '2000-02-29', '2026-11-23', '2026-04-30']) assert.equal(isValidBirthDate(value, today), true);
  for (const [birth, dates, ages, levels] of [
    ['2020-11-23', ['2026-11-22','2026-11-23','2026-11-24'], [5,6,6], ['under6','6to8','6to8']],
    ['2017-11-23', ['2026-11-22','2026-11-23','2026-11-24'], [8,9,9], ['6to8','9plus','9plus']],
    ['2020-02-29', ['2026-02-28','2026-03-01','2026-03-02'], [5,6,6], ['under6','6to8','6to8']],
    ['2020-02-29', ['2029-02-28','2029-03-01','2029-03-02'], [8,9,9], ['6to8','9plus','9plus']],
    ['2020-02-29', ['2024-02-28','2024-02-29','2024-03-01'], [3,4,4], ['under6','under6','under6']],
  ]) dates.forEach((day, i) => { assert.equal(ageOnDate(birth, day), ages[i]); assert.equal(automaticReadingLevel(birth, day), levels[i]); });
  assert.equal(amsterdamDate(new Date('2026-11-22T22:59:59.999Z')), '2026-11-22');
  assert.equal(amsterdamDate(new Date('2026-11-22T23:00:00.000Z')), '2026-11-23');
  assert.equal(amsterdamDate(new Date('2026-06-21T21:59:59.999Z')), '2026-06-21');
  assert.equal(amsterdamDate(new Date('2026-06-21T22:00:00.000Z')), '2026-06-22');
  // The runtime/host timezone cannot change the Dutch calendar day.
  for (const zone of ['UTC','Pacific/Honolulu','Asia/Tokyo','Europe/Amsterdam']) {
    const previous = process.env.TZ; process.env.TZ = zone;
    assert.equal(amsterdamDate(new Date('2026-11-22T23:30:00Z')), today);
    if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous;
  }
  const legacy = { id: 'legacy', name: 'Robin', readingLevel: 'under6', picks: { station: [1,0,1] } };
  const untouched = structuredClone(legacy);
  assert.equal(effectiveReadingLevel(legacy, legacy.readingLevel, today), 'under6');
  assert.equal(effectiveReadingLevel(legacy, undefined, today), '6to8');
  assert.equal(effectiveReadingLevel(legacy, 'bad', today), '6to8');
  assert.equal(effectiveReadingLevel({ ...legacy, birthDate: '2019-01-01' }, 'under6', today), '6to8');
  const manual = { ...legacy, birthDate: '2019-01-01', readingLevelOverride: '9plus' };
  assert.equal(effectiveReadingLevel(manual, 'under6', today), '9plus');
  assert.equal(effectiveReadingLevel({ ...manual, birthDate: '2024-01-01' }, 'under6', today), '9plus');
  assert.equal(effectiveReadingLevel({ ...manual, readingLevelOverride: undefined }, 'under6', today), '6to8');
  assert.deepEqual(legacy, untouched, 'Reading resolution never mutates routes or invents dates/overrides');
  for (const [birthDate, expected] of [['2021-01-01','under6'],['2019-01-01','6to8'],['2017-01-01','9plus']]) assert.equal(effectiveReadingLevel({birthDate}, 'under6', today), expected);
  assert.equal(personalizeStoryText('Hallo __FABELPAD_CHILD__. {{naam}} en Avonturier lezen.', ' Robin '), 'Hallo Robin. Robin en Robin lezen.');
  assert.equal(personalizeStoryText('Een avonturier en SuperAvonturier. Avonturier, kom!', 'Sam'), 'Een avonturier en SuperAvonturier. Sam, kom!');
  assert.equal(personalizeStoryText('__FABELPAD_CHILD__ en Avonturier', '$&'), '$& en $&');
  assert.equal(personalizeStoryText('__FABELPAD_CHILD__ en Avonturier', 'Avonturier Jr'), 'Avonturier Jr en Avonturier Jr');
  assert.equal(personalizeStoryText('Avonturier leest.', ''), 'Avonturier leest.');
  console.log('Gedeelde web/Android-kalenderregels: datumvalidatie, 6e/9e verjaardag, 29 februari op 1 maart, Nederlandse middernacht, legacy/override en letterlijke naamweergave geslaagd.');
} finally { await rm(temporary, { recursive: true, force: true }); }
