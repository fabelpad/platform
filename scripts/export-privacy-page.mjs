import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { compileSource } from './source-test-loader.mjs';
const root = path.resolve(import.meta.dirname, '..');
const temporary = await mkdtemp(path.join(tmpdir(), 'fabelpad-privacy-'));
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
try {
  const { privacy } = await import(await compileSource(pathToFileURL(path.join(root, 'src/privacyContent.ts')), temporary));
  const body = `<h1>${escape(privacy.title)}</h1><p><strong>Fabelpad · DG Webservices</strong><br>Bijgewerkt op ${escape(privacy.updated)}</p><p>${escape(privacy.introduction)}</p><p><a href="#verwijderen">Lokale appgegevens wissen</a> · <a href="#mail-verwijderen">Verwijderverzoek indienen</a> · <a href="mailto:support@fabelpad.nl">support@fabelpad.nl</a></p><nav aria-label="Inhoud"><ol>${privacy.sections.map(section => `<li><a href="#${section.id}">${escape(section.title)}</a></li>`).join('')}</ol></nav>${privacy.sections.map(section => `<section id="${section.id}"><h2>${escape(section.title)}</h2>${section.paragraphs.map(text => `<p>${escape(text)}</p>`).join('')}</section>`).join('')}`;
  const html = `<!doctype html><html lang="nl"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="Privacy en gegevens verwijderen voor Fabelpad voor Android"><title>Privacy en gegevens verwijderen — Fabelpad</title><style>html{color-scheme:light;scroll-behavior:smooth}body{font:18px/1.75 system-ui,sans-serif;color:#214e3d;background:#fcf9ef;margin:0}main{max-width:820px;margin:auto;padding:40px 22px 80px}h1{font-size:clamp(2rem,6vw,3rem);line-height:1.15}h2{font-size:1.45rem;line-height:1.3;margin-top:2rem}a{color:#245a43;text-underline-offset:3px}li{margin:.3rem 0}section{scroll-margin-top:24px}</style><main>${body}</main></html>`;
  const directory = path.join(root, 'artifacts/privacy');
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'index.html'), html);
  console.log('Zelfstandige privacypagina: artifacts/privacy/index.html (nog niet publiek geplaatst).');
} finally { await rm(temporary, { recursive: true, force: true }); }
