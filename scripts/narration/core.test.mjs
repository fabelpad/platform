import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileSource } from '../source-test-loader.mjs';
import { FixtureSocket, fixturePCM } from './fixtures.mjs';

const directory = await mkdtemp(join(tmpdir(), 'fabelpad-narration-core-'));
const source = name => new URL(`../../lib/narration/${name}.ts`, import.meta.url);
const compiler = await import(await compileSource(source('compiler'), directory));
const contract = await import(await compileSource(source('contracts'), directory));
const provider = await import(await compileSource(source('provider'), directory));
const quality = await import(await compileSource(source('quality'), directory));
test.after(() => rm(directory, { recursive: true, force: true }));
const presets = structuredClone(contract.DEFAULT_NARRATION_PRESETS);
const story = () => ({ storyId: 'fixture-story', contentVersion: 'a'.repeat(16), parts: 1,
  scenes: { '': { title: 'Het kompas', text: 'Kom mee, {{naam}}. De wind waait over de brug.', choices: [{ label: 'Loop over de brug', hint: 'Kijk naar het kompas' }, { label: 'Blijf bij de boom', hint: 'Wacht rustig' }] }, unreachable: { text: 'MAG NIET IN AUDIO', choices: [] } },
  endings: { 0: { title: 'Aan de overkant', text: '__FABELPAD_CHILD__ vindt de schat.', keepsake: 'Een gouden veer.' }, 1: { title: 'Onder de boom', text: 'De vos komt naar je toe.' } } });

test('exact reachable graph, all three layers/five voices, original choice indices and complete endings', async () => {
  const plan = await compiler.compileNarrationSource(story(), presets);
  assert.equal(plan.manifests.length, 15);
  for (const manifest of plan.manifests) {
    assert.deepEqual(Object.keys(manifest.scenes), ['']);
    assert.deepEqual(Object.keys(manifest.endings), ['0', '1']);
    assert.deepEqual(manifest.scenes[''].choices.map(c => c.choiceIndex), [0, 1]);
    for (const id of contract.referencedNarrationAssets(manifest)) assert.equal(manifest.assets[id].id, id);
  }
  assert.ok(plan.items.some(i => i.text.includes('Kijk naar het kompas')));
  assert.ok(plan.items.some(i => i.text.includes('Een gouden veer.')));
  assert.ok(!plan.items.some(i => /MAG NIET|__FABELPAD_CHILD__|\{\{naam\}\}/u.test(i.text)));
  assert.equal(plan.uniqueItems, new Set(plan.items.map(i => i.fingerprint)).size);
  assert.ok(plan.uniqueItems < plan.expectedItems);
});
test('approved whole cue only; legacy names in prose become generic Avonturier', async () => {
  const plan = await compiler.compileNarrationSource(story(), presets), manifest = plan.manifests[0];
  assert.ok(manifest.scenes[''].segments.some(s => s.kind === 'nameCue' && s.cueId === 'kom-mee'));
  assert.ok(plan.items.some(i => i.kind === 'ending' && i.text.includes('Avonturier vindt de schat.')));
  const renamed = story(); renamed.scenes[''].text = 'Zachtjes zegt {{naam}} iets.';
  assert.ok((await compiler.compileNarrationSource(renamed, presets)).manifests.every(m => m.scenes[''].segments.every(s => s.kind === 'asset')));
});
test('stable canonical fingerprints, changed punctuation/style/model/encoding invalidate reuse', async () => {
  const plan = await compiler.compileNarrationSource(story(), presets);
  assert.deepEqual(plan, await compiler.compileNarrationSource(story(), presets));
  const changed = story(); changed.scenes[''].text = changed.scenes[''].text.replace('waait', 'waait!');
  assert.notEqual(plan.sourceFingerprint, (await compiler.compileNarrationSource(changed, presets)).sourceFingerprint);
  const altered = structuredClone(presets); altered[0].instructions += ' Spreek langzamer.'; altered[0].presetVersion++;
  const second = await compiler.compileNarrationSource(story(), altered);
  assert.notEqual(plan.items[0].fingerprint, second.items[0].fingerprint);
  assert.equal(plan.items.find(i => i.preset.slotId === 'stem-2').fingerprint, second.items.find(i => i.preset.slotId === 'stem-2').fingerprint);
});
test('future non-five chapter graphs and explicit reading rewrites; missing branches fail closed', async () => {
  const source = story(); source.scenes[0] = { text: 'Nog een stap.', choices: ['Naar het licht', 'Naar de maan'] }; delete source.endings[0]; source.endings['00'] = { text: 'Licht.' }; source.endings['01'] = { text: 'Maan.' };
  source.readingLevels = { under6: { scenes: structuredClone(source.scenes), endings: structuredClone(source.endings) } };
  source.readingLevels.under6.scenes[''].text = 'Kijk. Een brug.';
  const plan = await compiler.compileNarrationSource(source, presets);
  assert.ok(plan.items.some(i => i.readingLevel === 'under6' && i.text.includes('Kijk. Een brug.')));
  assert.deepEqual(Object.keys(plan.manifests[0].endings).sort(), ['00', '01', '1']);
  delete source.endings['01'];
  await assert.rejects(compiler.compileNarrationSource(source, presets), /narration_missing_route/u);
});
test('shared library contains every cue/name/pronunciation in every slot independent of a selected profile', async () => {
  const library = await compiler.compileNarrationLibrary(presets);
  assert.equal(library.cuePacks.length, 5); assert.equal(Object.keys(library.samples).length, 5);
  for (const pack of library.cuePacks) for (const cue of pack.cues) for (const name of pack.catalogue) for (const p of name.pronunciations) assert.ok(pack.assets[pack.variants[cue.id][name.id][p.id]]);
  const plan = await compiler.compileNarrationSource(story(), presets);
  assert.equal(plan.manifests[0].cuePack.packId, library.cuePacks[0].packId);
  assert.deepEqual(compiler.estimateNarrationCatalogue([story()], presets), compiler.estimateNarrationCost([...plan.items, ...library.items]));
  assert.equal(contract.findNarrationName('  CÉLINE ', contract.DEFAULT_NAME_CATALOGUE)?.id, 'n-celine');
  assert.equal(contract.findNarrationName('Celine', contract.DEFAULT_NAME_CATALOGUE), null);
  assert.equal(contract.findNarrationName('Onbekend kind', contract.DEFAULT_NAME_CATALOGUE), null);
});
function fakeProvider(mode = 'complete', extra = {}) {
  let socket, destination;
  return { adapter: provider.createRealtimeNarrationProvider({ apiKey: 'test-only-not-a-secret', timeoutMs: 15, connect(url, options) { destination = { url, options }; socket = new FixtureSocket({ mode, ...extra }); return socket; } }), get socket() { return socket; }, get destination() { return destination; } };
}
const input = () => ({ text: 'Kom mee, Avonturier.', preset: presets[0], requestId: 'fixture-1', maxOutputTokens: 1024 });
test('Realtime isolated server socket requests fixed voice/audio and collects fully correlated output+usage', async () => {
  const fake = fakeProvider(), result = await fake.adapter.generate(input());
  assert.equal(result.complete, true); assert.equal(result.transcript, input().text); assert.deepEqual(result.pcm, fixturePCM());
  assert.equal(result.usage.known, true); assert.equal(fake.socket.closed, true);
  assert.equal(fake.destination.url, 'wss://api.openai.com/v1/realtime?model=gpt-realtime-2.1-mini');
  assert.equal(new URL(fake.destination.url).searchParams.has('key'), false);
  assert.equal(fake.socket.sent.find(e => e.type === 'session.update').session.audio.output.voice, 'marin');
  assert.equal(fake.socket.sent.find(e => e.type === 'conversation.item.create').item.content[0].text, input().text);
  assert.equal(JSON.stringify(fake.socket.sent).includes('test-only-not-a-secret'), false);
});
for (const mode of ['401', '429', 'partial', 'truncated', 'mixed', 'timeout']) test(`provider ${mode} fails safely; no partial asset or provider secret is exposed`, async () => {
  const fake = fakeProvider(mode);
  await assert.rejects(fake.adapter.generate(input()), error => {
    assert.equal(error.message.includes('SENSITIVE_PROVIDER_DETAIL'), false);
    if (mode === '429') assert.equal(error.retryable, true);
    return error instanceof provider.NarrationProviderError;
  });
  assert.equal(fake.socket.closed, true);
});
test('cancellation closes socket, unknown usage stays unknown, model host cannot be overridden', async () => {
  const fake = fakeProvider('timeout'), controller = new AbortController();
  const pending = fake.adapter.generate(input(), controller.signal); controller.abort();
  await assert.rejects(pending, /cancelled/u); assert.equal(fake.socket.closed, true);
  assert.equal(provider.narrationUsageCents(provider.readNarrationUsage({}), presets[0].model), null);
  await assert.rejects(fake.adapter.generate({ ...input(), preset: { ...presets[0], model: 'https://attacker.invalid' } }), /invalid_input/u);
});
test('PCM -> WAV checksum/duration/signal; transcript mismatch and implausible duration require review', async () => {
  const result = await quality.encodeNarrationAudio(fixturePCM(), input().text, input().text);
  assert.equal(new TextDecoder().decode(result.bytes.slice(0, 4)), 'RIFF');
  assert.equal(result.durationMs, 1660); assert.equal(result.byteLength, 44 + 79680); assert.equal(result.quality, 'pass');
  assert.equal(result.sha256, await compiler.narrationHash(result.bytes));
  assert.equal((await quality.encodeNarrationAudio(fixturePCM(), 'Ander verhaal.', input().text)).quality, 'review');
  assert.ok((await quality.encodeNarrationAudio(fixturePCM(), 'woord '.repeat(100), 'woord '.repeat(100))).reasons.includes('implausible_duration'));
  await assert.rejects(quality.encodeNarrationAudio(new Uint8Array(48000), '', ''), /silent_audio/u);
  await assert.rejects(quality.encodeNarrationAudio(new Uint8Array(49), '', ''), /invalid_pcm/u);
  assert.equal(quality.checkNarrationTranscript('De 2 vossen lopen.', 'De twee vossen lopen!').matches, true);
  assert.equal(quality.checkNarrationTranscript('Céline loopt.', 'Celine loopt.').matches, false);
});
