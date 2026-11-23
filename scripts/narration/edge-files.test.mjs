import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { narrationEdgeFiles, compactNarrationArchive } from './edge-files.mjs';
import { bundledNarrationSources, narrationSourcesFromArchives } from '../../lib/narration/bundled-sources.ts';

test('compact upload reconstructs all 26 original pinned source snapshots byte-for-byte logically', async () => {
  const packed = await narrationEdgeFiles('voorlezen-admin');
  const sources = packed.files.filter(file => file.name.startsWith('mobile/src/releases/')).map(file => JSON.parse(file.content));
  assert.deepEqual(narrationSourcesFromArchives(sources), bundledNarrationSources());
  assert.equal(narrationSourcesFromArchives(sources).length, 26);
  assert.ok(packed.totalBytes < 5_000_000);
  const transformed = packed.digests.filter(file => file.transform);
  assert.equal(transformed.length, 1); assert.equal(transformed[0].transform.name, 'omit-exact-base-9plus-v1'); assert.equal(transformed[0].transform.omittedLayers, 13);
  assert.notEqual(transformed[0].sourceSha256, transformed[0].sha256);
  for (const file of packed.files) {
    const digest = packed.digests.find(row => row.name === file.name);
    assert.equal(createHash('sha256').update(file.content).digest('hex'), digest.sha256);
    const source = await readFile(new URL('../../' + file.name, import.meta.url));
    assert.equal(createHash('sha256').update(source).digest('hex'), digest.sourceSha256);
    assert.equal(Buffer.byteLength(file.content), digest.byteLength); assert.equal(source.length, digest.sourceByteLength);
  }
  assert.deepEqual(await narrationEdgeFiles('voorlezen-admin'), packed);
});
test('a nonidentical 9plus layer aborts packaging and is never stripped', () => {
  const base = { scenes: { '': { text: 'Basisverhaal.', choices: [] } }, endings: {} };
  const original = JSON.stringify({ stories: [{ id: 'fixture', ...base, readingLevels: { '9plus': { ...base, scenes: { '': { text: 'Andere oudere lezerstekst.', choices: [] } } } } }] });
  assert.throws(() => compactNarrationArchive('mobile/src/releases/247d7d1c63cc4fa3.json', original), /Nonidentical 9plus layer preserved/u);
  assert.equal(JSON.parse(original).stories[0].readingLevels['9plus'].scenes[''].text, 'Andere oudere lezerstekst.');
  assert.equal(compactNarrationArchive('mobile/src/releases/4e48e9296a01fff5.json', original).content, original);
});
test('worker upload includes the exact compatibility archives and remains below the deployment limit', async () => {
  const packed = await narrationEdgeFiles('voorlezen-worker');
  assert.ok(packed.totalBytes < 5_000_000);
  const archives = packed.files.filter(file => file.name.startsWith('mobile/src/releases/')).map(file => JSON.parse(file.content));
  assert.deepEqual(narrationSourcesFromArchives(archives), bundledNarrationSources());
  assert.equal(packed.digests.filter(file => file.transform).length, 1);
  await assert.rejects(narrationEdgeFiles('../.env'));
});
