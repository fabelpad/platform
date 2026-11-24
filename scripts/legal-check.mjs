import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
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
  assert.equal(TERMS_VERSION, '2026-11-23.1'); assert.equal(PRIVACY_VERSION, '2026-11-24');
  for (const document of Object.values(LEGAL_DOCUMENTS)) {
    assert.match(document.sha256, /^[a-f0-9]{64}$/);
    const file = await readFile(new URL(`../public${document.downloadUrl}`, import.meta.url));
    assert.equal(createHash('sha256').update(file).digest('hex'), document.sha256, 'Accepted hash must identify the exact downloadable bytes.');
    assert.doesNotMatch(file.toString(), /<!--|\[INVULLEN\]|TODO|BTW[- :]|btw-identificatie/i, 'Publication documents contain no internal instructions, placeholders or business details outside the owner’s scope.');
  }
  const historicalHashes = {
    'algemene-voorwaarden.md': '8da71baa717f1e98b393320532670b4ebbddacbd390a14dba3c4cc144b394840',
    'privacyverklaring.md': '97673d3103443115097def26e20e6c677650dcb760d095de900ae3c5c5961cb7',
    'manifest.json': 'c90cde47311eb92c59c4fe2e84df391e3c9b0176eeac6eb2294fab4de398a82e',
    'herroepingsformulier.txt': '69c36bd1489d82b038d590e14de8491d3c54a709fb352e53d8ecc4c419d6b79b',
  };
  const assertHistory = async () => {
    for (const [filename, hash] of Object.entries(historicalHashes)) {
      const body = await readFile(new URL(`../public/legal/2026-11-22/${filename}`, import.meta.url));
      assert.equal(createHash('sha256').update(body).digest('hex'), hash, `Previously supplied legal bytes are immutable: ${filename}`);
    }
  };
  await assertHistory();
  assert.equal(createHash('sha256').update(await readFile(new URL('../public/legal/2026-11-22.1/privacyverklaring.md', import.meta.url))).digest('hex'), 'c3f6186be703dda5320b70227070fea79e395eac225dbbbde0420913c57727e4');
  const privacyText = await readFile(new URL(`../public${LEGAL_DOCUMENTS.privacy.downloadUrl}`, import.meta.url), 'utf8');
  for (const fact of ['Stackmail', 'maximaal twaalf maanden na afsluiting', 'uiterlijk na 180 dagen', 'geen bewaartermijn voor actieve account- of kindgegevens', 'maximaal 210 dagen', 'staat momenteel uit', 'voordat de herstelde omgeving gebruikersverkeer ontvangt', 'aantoonbaar nodig', 'periodieke herbeoordeling', 'geboortedatum als kalenderdatum', 'handmatige leesniveauvoorkeur', '1 maart']) assert.ok(privacyText.includes(fact), `Current privacy text includes the confirmed safeguard: ${fact}`);
  assert.equal(createHash('sha256').update(await readFile(new URL('../public/legal/2026-11-23/privacyverklaring.md', import.meta.url))).digest('hex'), 'f108fc40b0aa5fc3d99c754eb71abacd234c05b4611c383c40a8a0b3505539e3');
  const latestManifest = JSON.parse(await readFile(new URL('../public/legal/2026-11-23.1/manifest.json', import.meta.url), 'utf8'));
  assert.deepEqual(Object.keys(latestManifest), ['terms', 'privacy'], 'Billing updates explicitly version both offered documents.');
  assert.equal(latestManifest.privacy.version, '2026-11-23.1', 'Previously offered billing privacy remains historical.');
  assert.equal(latestManifest.privacy.sha256, '9978e5f47fc6588724cb67d32a253cb53541b51b1614d545b278db4c0510aca6');
  const privacyManifest = JSON.parse(await readFile(new URL(`../public/legal/${PRIVACY_VERSION}/manifest.json`, import.meta.url), 'utf8'));
  assert.deepEqual(Object.keys(privacyManifest), ['privacy'], 'A voluntary email choice updates privacy information alone.');
  assert.equal(privacyManifest.privacy.version, PRIVACY_VERSION);
  assert.equal(privacyManifest.privacy.sha256, LEGAL_DOCUMENTS.privacy.sha256);
  assert.doesNotMatch(privacyText, /Er is geen marketingmailinglijst/u);
  for (const fact of ['afzonderlijke, vrijwillige toestemming', 'Deze keuze staat standaard uit', 'Bestaande accounts worden niet automatisch aangemeld', 'de getoonde toestemmingsverklaring en versie', 'via Account of support@fabelpad.nl', 'bij definitieve accountverwijdering verwijderd', 'Voor promotionele berichten gebruiken we geen open- of kliktracking']) assert.ok(privacyText.includes(fact), `Current privacy describes the separate email choice: ${fact}`);
  const checked = spawnSync(process.execPath, ['scripts/legal-documents.mjs', '--check'], { cwd: new URL('../', import.meta.url), encoding: 'utf8' });
  assert.equal(checked.status, 0, checked.stderr);
  const regenerated = spawnSync(process.execPath, ['scripts/legal-documents.mjs', '--write'], { cwd: new URL('../', import.meta.url), encoding: 'utf8' });
  assert.equal(regenerated.status, 0, regenerated.stderr);
  await assertHistory();

  // Exercise the actual writer against isolated files. A damaged historical
  // download must fail before a new version or mutable catalog is written.
  const fixture = path.join(temporary, 'immutable-output');
  for (const directory of ['src', 'scripts', 'lib/legal', 'public/legal']) await mkdir(path.join(fixture, directory), { recursive: true });
  await symlink(new URL('../node_modules', import.meta.url).pathname, path.join(fixture, 'node_modules'), 'dir');
  for (const filename of ['src/legalContent.ts', 'src/privacyContent.ts', 'scripts/legal-documents.mjs', 'scripts/source-test-loader.mjs']) await cp(new URL(`../${filename}`, import.meta.url), path.join(fixture, filename));
  await cp(new URL('../public/legal/2026-11-22', import.meta.url), path.join(fixture, 'public/legal/2026-11-22'), { recursive: true });
  const sentinel = 'A mutable catalog must stay untouched when immutable output conflicts.\n';
  await writeFile(path.join(fixture, 'lib/legal/documentHashes.ts'), sentinel);
  await writeFile(path.join(fixture, 'public/legal/2026-11-22/algemene-voorwaarden.md'), 'Synthetic conflicting historical bytes.\n');
  const rejected = spawnSync(process.execPath, ['scripts/legal-documents.mjs', '--write'], { cwd: fixture, encoding: 'utf8' });
  assert.notEqual(rejected.status, 0, 'The generator must refuse to overwrite conflicting existing downloads.');
  assert.match(rejected.stderr, /Historische juridische download wijkt af|Juridische weergave en download verschillen/);
  assert.equal(await readFile(path.join(fixture, 'lib/legal/documentHashes.ts'), 'utf8'), sentinel);
  await assert.rejects(readFile(path.join(fixture, `public/legal/${PRIVACY_VERSION}/privacyverklaring.md`)), { code: 'ENOENT' }, 'A failed preflight creates no partial new privacy version.');
  console.log('Juridische versies/hashes, onveranderde historische downloads, veilige generator, actuele privacytermijnen en offline webvoorlezen: gerichte controles geslaagd.');
} finally { await rm(temporary, { recursive: true, force: true }); }
