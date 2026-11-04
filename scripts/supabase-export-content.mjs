import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { compileSource } from './source-test-loader.mjs';
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--output' || !args[1].endsWith('.sql')) throw new Error('Gebruik: node scripts/supabase-export-content.mjs --output /absoluut/pad/broncontent.sql');
const temp = await mkdtemp(join(tmpdir(), 'fabelpad-content-seed-'));
try {
  const { buildStoryRelease } = await import(await compileSource(new URL('../lib/server/contentRelease.ts', import.meta.url), temp));
  const ids = ['station','dream','toy','weather','moonbakery','ocean','garden','clock','library','balloon','forest','snow','stars'];
  const literal = value => `'${value.replaceAll("'", "''")}'`;
  const rows = ids.map(id => {
    const { storyId, contentVersion, metadata, parts, nameToken, scenes, endings } = buildStoryRelease(id);
    return `insert into public.content_releases(story_id,content_version,payload) values (${literal(storyId)},${literal(contentVersion)},${literal(JSON.stringify({ metadata, parts, nameToken, scenes, endings }))}::jsonb) on conflict(story_id,content_version) do nothing;`;
  });
  const output = resolve(args[1]);
  await writeFile(output, '-- Immutable source releases. Review and apply only after backup and migration approval.\n-- Import before a source update changes bundled release hashes. Replaying preserves existing rows.\nbegin;\nset standard_conforming_strings = on;\n' + rows.join('\n') + '\ncommit;\n', { flag: 'wx' });
  console.log(JSON.stringify({ output, stories: ids.length, scenes: ids.length * 31, endings: ids.length * 32, applied: false }));
} finally { await rm(temp, { recursive: true, force: true }); }
