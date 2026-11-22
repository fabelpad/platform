import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { compileSource } from './source-test-loader.mjs';

const root = path.resolve(import.meta.dirname, '..');
const directory = await mkdtemp(path.join(tmpdir(), 'fabelpad-legal-'));
const check = process.argv.includes('--check');
if (!check && !process.argv.includes('--write')) throw new Error('Gebruik --check of --write. Een bestaande aanvaarde documentversie mag niet worden overschreven.');
try {
  const { terms } = await import(await compileSource(new URL('../src/legalContent.ts', import.meta.url), directory));
  const { privacy } = await import(await compileSource(new URL('../src/privacyContent.ts', import.meta.url), directory));
  const entries = [['terms', 'algemene-voorwaarden.md', terms], ['privacy', 'privacyverklaring.md', privacy]];
  const catalog = {};
  const outputs = [];
  for (const [key, filename, document] of entries) {
    if (!/^\d{4}-\d{2}-\d{2}(?:\.\d+)?$/.test(document.version)) throw new Error('Een document heeft een ongeldige versie.');
    const blocks = [`# ${document.title}`, `Versie: ${document.version}\nIngangsdatum: ${document.updated}`, document.introduction, 'Aanbieder: DG Webservices\nVestigingsplaats: Den Haag (\'S-Gravenhage)\nKVK-nummer: 88135713\nAlgemeen contact: info@dgwebservices.nl\nWebsite: https://www.dgwebservices.nl\nFabelpad-support en privacy: support@fabelpad.nl\nBedrijfsgegevens: https://fabelpad.nl/bedrijfsgegevens'];
    for (const section of document.sections) blocks.push(`## ${section.title}`, ...section.paragraphs);
    if (key === 'privacy') blocks.push('## Privacyinformatie van dienstverleners', '- Supabase DPA: https://supabase.com/legal/customer-resources/data-processing-addendum\n- Supabase subverwerkers: https://supabase.com/legal/subprocessors\n- Resend DPA: https://resend.com/legal/dpa\n- Resend subverwerkers: https://resend.com/legal/subprocessors\n- Google: https://policies.google.com/privacy?hl=nl');
    const text = `${blocks.join('\n\n')}\n`;
    const sha256 = createHash('sha256').update(text).digest('hex');
    catalog[key] = { version: document.version, filename, sha256 };
    outputs.push([`public/legal/${document.version}/${filename}`, text]);
  }

  // A shared historical manifest may contain an older privacy document alongside
  // the still-current terms. Validate it, but never replace it with today's catalog.
  const manifests = new Map();
  for (const version of new Set(Object.values(catalog).map(document => document.version))) {
    const filename = `public/legal/${version}/manifest.json`;
    let existing;
    try { existing = await readFile(path.join(root, filename), 'utf8'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const currentEntries = Object.fromEntries(Object.entries(catalog).filter(([, document]) => document.version === version));
    if (existing !== undefined) {
      const manifest = JSON.parse(existing);
      for (const [key, document] of Object.entries(currentEntries)) {
        const saved = manifest[key];
        if (!saved || saved.version !== document.version || saved.filename !== document.filename || saved.sha256 !== document.sha256) {
          throw new Error(`Bestaand juridisch manifest is onveranderlijk: ${filename}. Gebruik een nieuwe documentversie.`);
        }
      }
      manifests.set(version, manifest);
    } else {
      manifests.set(version, currentEntries);
      outputs.push([filename, `${JSON.stringify(currentEntries, null, 2)}\n`]);
    }
  }
  // Check every retained historical manifest against its original download, too.
  for (const entry of await readdir(path.join(root, 'public/legal'), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const version = entry.name;
    const manifest = manifests.get(version) ?? JSON.parse(await readFile(path.join(root, `public/legal/${version}/manifest.json`), 'utf8'));
    manifests.set(version, manifest);
    for (const [key, document] of Object.entries(manifest)) {
      const expectedFilename = entries.find(([name]) => name === key)?.[1];
      if (!expectedFilename || document.filename !== expectedFilename || document.version !== version || !/^[a-f0-9]{64}$/.test(document.sha256)) {
        throw new Error(`Ongeldig historisch juridisch manifest: ${version}.`);
      }
      const relative = `public/legal/${version}/${document.filename}`;
      const pending = outputs.find(([filename]) => filename === relative);
      const body = pending?.[1] ?? await readFile(path.join(root, relative));
      if (createHash('sha256').update(body).digest('hex') !== document.sha256) throw new Error(`Historische juridische download wijkt af: ${relative}.`);
    }
  }
  outputs.push([`public/legal/${terms.version}/herroepingsformulier.txt`, 'Aan DG Webservices, via support@fabelpad.nl\n\nIk laat hierbij weten dat ik mijn overeenkomst voor het volgende Fabelpad-abonnement herroep.\n\nAbonnement en eventueel bestelnummer:\nDatum waarop ik het abonnement afsloot:\nNaam van de accounthouder:\nAdres van de accounthouder:\nE-mailadres waarmee ik heb besteld:\nDatum van dit bericht:\nHandtekening, alleen als dit formulier op papier wordt verstuurd:\n']);

  // Preflight all immutable files before creating anything. --write never changes
  // an accepted download or manifest, including when the source was edited by mistake.
  const missing = [];
  for (const [filename, body] of outputs) {
    const target = path.join(root, filename);
    let actual;
    try { actual = await readFile(target, 'utf8'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (actual === undefined) {
      if (check) throw new Error(`Versiegebonden juridisch bestand ontbreekt: ${filename}`);
      missing.push([target, body]);
    } else if (actual !== body) throw new Error(`Juridische weergave en download verschillen: ${filename}. Maak een nieuwe versie als de aangeboden tekst al is aanvaard.`);
  }
  const hashesTarget = path.join(root, 'lib/legal/documentHashes.ts');
  const hashesBody = `/** SHA-256 of the exact UTF-8 downloads. Generated by scripts/legal-documents.mjs. */\nexport const LEGAL_DOCUMENT_HASHES = ${JSON.stringify(Object.fromEntries(Object.entries(catalog).map(([key, value]) => [key, value.sha256])), null, 2)} as const;\n`;
  if (check) {
    if (await readFile(hashesTarget, 'utf8') !== hashesBody) throw new Error('De actuele juridische hashcatalogus wijkt af.');
  } else {
    for (const [target, body] of missing) {
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, body, { flag: 'wx' });
    }
    await mkdir(path.dirname(hashesTarget), { recursive: true });
    await writeFile(hashesTarget, hashesBody);
  }
  console.log(`Juridische documenten ${check ? 'gecontroleerd' : 'gegenereerd'}: voorwaarden ${terms.version}, privacy ${privacy.version}; exacte UTF-8-hashes en historische downloads behouden.`);
} finally { await rm(directory, { recursive: true, force: true }); }
