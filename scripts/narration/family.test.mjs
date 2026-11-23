import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileSource } from '../source-test-loader.mjs';

const directory = await mkdtemp(join(tmpdir(), 'fabelpad-narration-family-'));
const { validateFamilySnapshot } = await import(await compileSource(new URL('../../lib/familyValidation.ts', import.meta.url), directory));
test.after(() => rm(directory, { recursive: true, force: true }));
const snapshot = () => ({ schemaVersion: 1, family: { version: 1, children: [{ id: 'synthetic-child', name: 'Testkind', avatar: 0 }], activeId: 'synthetic-child' }, data: { 'synthetic-child': { prefs: { muted: false, calm: true } } } });

test('all five stable voice slots and older preferences pass the real family validator', () => {
  assert.equal(validateFamilySnapshot(snapshot()).ok, true);
  for (const voiceSlot of ['stem-1', 'stem-2', 'stem-3', 'stem-4', 'stem-5']) { const value = snapshot(); value.data['synthetic-child'].prefs.voiceSlot = voiceSlot; assert.equal(validateFamilySnapshot(value).ok, true, voiceSlot); }
});
test('family synchronization rejects provider voices, arbitrary slots and personal narration settings', () => {
  for (const fields of [{ voiceSlot: 'marin' }, { voiceSlot: 'stem-6' }, { voiceSlot: null }, { voiceSlot: 1 }, { nameMode: 'name' }, { catalogueId: 'n-noor' }, { pronunciationId: 'nl' }, { recording: 'personal-audio' }]) {
    const value = snapshot(); Object.assign(value.data['synthetic-child'].prefs, fields); assert.equal(validateFamilySnapshot(value).ok, false, JSON.stringify(fields));
  }
  for (const field of ['narration', 'recordings', 'nameChoice']) { const value = snapshot(); value.data['synthetic-child'][field] = { personal: true }; assert.equal(validateFamilySnapshot(value).ok, false, field); }
});
