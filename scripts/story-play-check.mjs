import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { compileSource } from './source-test-loader.mjs';

const temporary = await mkdtemp(join(tmpdir(), 'fabelpad-play-'));
try {
  const { initialStationPlayState, reduceStationPlay, stationInstruction } = await import(await compileSource(new URL('../src/storyPlayLogic.ts', import.meta.url), temporary));
  for (const choice of [0, 1]) {
    let state = initialStationPlayState(0);
    const untouched = reduceStationPlay(state, { type: 'depart' });
    assert.equal(untouched, state, 'A child cannot board before completing a selected visual task');
    state = reduceStationPlay(state, { type: 'choose', choice });
    assert.equal(state.phase, choice === 0 ? 'ticket' : 'cabinet');
    assert.equal(state.choice, choice);
    const earlyDeparture = reduceStationPlay(state, { type: 'depart' });
    assert.equal(earlyDeparture, state, 'Simply selecting a picture must not count as a completed story choice');
    const changedChoice = reduceStationPlay(state, { type: 'choose', choice: choice === 0 ? 1 : 0 });
    assert.equal(changedChoice, state, 'A second quick tap cannot silently change the selected task');
    const wrongTask = reduceStationPlay(state, { type: choice === 0 ? 'unlock' : 'repair' });
    assert.equal(wrongTask, state);
    state = reduceStationPlay(state, { type: choice === 0 ? 'repair' : 'unlock' });
    assert.equal(state.phase, choice === 0 ? 'repaired' : 'map');
    assert.ok(stationInstruction(state).length > 15);
    state = reduceStationPlay(state, { type: 'depart' });
    assert.equal(state.phase, 'leaving');
    for (const action of [{ type: 'depart' }, { type: 'repair' }, { type: 'unlock' }, { type: 'choose', choice: 1 - choice }]) assert.equal(reduceStationPlay(state, action), state, 'Departure is terminal: double taps cannot dispatch another route');
  }
  for (const choice of [0, 1]) {
    let state = initialStationPlayState(1);
    assert.match(stationInstruction(state), /wissel/);
    state = reduceStationPlay(state, { type: 'choose', choice });
    assert.equal(state.phase, 'leaving');
    assert.equal(state.choice, choice);
    assert.match(stationInstruction(state), choice === 0 ? /muziekbos/ : /lichtjes/);
    assert.equal(reduceStationPlay(state, { type: 'choose', choice: 1 - choice }), state, 'A moving train retains its originally selected track');
  }
  console.log('Story play checks passed: both visual tasks gate boarding, route choices stay stable, invalid actions do not advance and departure is terminal under repeated taps.');
} finally { await rm(temporary, { recursive: true, force: true }); }
