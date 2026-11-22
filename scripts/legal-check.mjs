import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { compileSource } from './source-test-loader.mjs';

const temporary = await mkdtemp(path.join(tmpdir(), 'fabelpad-legal-tests-'));
try {
  const { selectLocalDutchVoice, privateSpeechText } = await import(await compileSource(new URL('../src/offlineSpeech.ts', import.meta.url), temporary));
  const online = { lang: 'nl-NL', localService: false, name: 'Online NL' };
  const local = { lang: 'nl-BE', localService: true, name: 'Local NL' };
  const english = { lang: 'en-US', localService: true, name: 'Local EN' };
  assert.equal(selectLocalDutchVoice([online, english, local]), local, 'The first Dutch online voice must never win over an explicit local voice.');
  assert.equal(selectLocalDutchVoice([online, english]), null, 'An online voice is not a fallback.');
  assert.equal(selectLocalDutchVoice([{ lang: 'nl-NL', name: 'Missing local flag' }]), null, 'An unknown provider must fail closed.');
  assert.equal(selectLocalDutchVoice([{ lang: 'nlx', localService: true }]), null, 'A similar language prefix is not Dutch.');
  assert.equal(selectLocalDutchVoice([]), null);
  assert.equal(privateSpeechText('Luna vond een ster. LUNA koos een pad.', 'Luna'), 'Avonturier vond een ster. Avonturier koos een pad.');
  assert.equal(privateSpeechText('A.* koos een pad. A.* vond een boek.', 'A.*'), 'Avonturier koos een pad. Avonturier vond een boek.', 'Names are literal text, not regular expressions.');
  assert.equal(privateSpeechText('Een onveranderd verhaal.', ''), 'Een onveranderd verhaal.');
  const { LEGAL_DOCUMENTS, TERMS_VERSION, PRIVACY_VERSION } = await import(await compileSource(new URL('../lib/legal/documents.ts', import.meta.url), temporary));
  assert.equal(TERMS_VERSION, '2026-11-22'); assert.equal(PRIVACY_VERSION, '2026-11-22');
  for (const document of Object.values(LEGAL_DOCUMENTS)) {
    assert.match(document.sha256, /^[a-f0-9]{64}$/);
    const file = await readFile(new URL(`../public${document.downloadUrl}`, import.meta.url));
    assert.equal(createHash('sha256').update(file).digest('hex'), document.sha256, 'Accepted hash must identify the exact downloadable bytes.');
    assert.doesNotMatch(file.toString(), /<!--|\[INVULLEN\]|TODO|BTW[- :]|btw-identificatie/i, 'Publication documents contain no internal instructions, placeholders or business details outside the owner’s scope.');
  }
  const checked = spawnSync(process.execPath, ['scripts/legal-documents.mjs', '--check'], { cwd: new URL('../', import.meta.url), encoding: 'utf8' });
  assert.equal(checked.status, 0, checked.stderr);
  console.log('Juridische versie/hashes, productiepublicatietekst en offline webvoorlezen: gerichte controles geslaagd.');
} finally { await rm(temporary, { recursive: true, force: true }); }
