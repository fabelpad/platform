import { readFile, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import ts from 'typescript';

const repository = fileURLToPath(new URL('../../', import.meta.url));
const functions = ['voorlezen-admin', 'voorlezen-worker'];
const archives = new Set(['mobile/src/releases/247d7d1c63cc4fa3.json', 'mobile/src/releases/4e48e9296a01fff5.json']);
const sha256 = content => createHash('sha256').update(content).digest('hex');
const posix = path => path.split(sep).join('/');
const compactArchive = 'mobile/src/releases/247d7d1c63cc4fa3.json';

/** Transform only the upload copy. Every removed layer must be exactly the
 * base scenes/endings; unexpected differences abort packaging. The portable
 * bundled-sources helper reconstructs the complete snapshot at runtime. */
export function compactNarrationArchive(name, sourceContent) {
  if (name !== compactArchive) return { content: sourceContent, transform: null };
  const archive = JSON.parse(sourceContent); let omittedLayers = 0;
  if (!Array.isArray(archive.stories)) throw new Error('Invalid narration archive for upload compaction.');
  for (const story of archive.stories) {
    if (!story.readingLevels || !Object.hasOwn(story.readingLevels, '9plus')) continue;
    if (!isDeepStrictEqual(story.readingLevels['9plus'], { scenes: story.scenes, endings: story.endings })) throw new Error(`Nonidentical 9plus layer preserved: ${story.id}`);
    delete story.readingLevels['9plus']; omittedLayers++;
  }
  return omittedLayers ? { content: JSON.stringify(archive), transform: { name: 'omit-exact-base-9plus-v1', omittedLayers, reconstruction: 'lib/narration/bundled-sources.ts' } } : { content: sourceContent, transform: null };
}
function permitted(name, selectedFunction) {
  if (name.split('/').some(part => part.startsWith('.') || /^(?:secrets?|credentials?)(?:\.|$)/iu.test(part))) return false;
  return name === `supabase/functions/${selectedFunction}/index.ts`
    || name === `supabase/functions/${selectedFunction}/deno.json`
    || name === `supabase/functions/${selectedFunction}/deno.jsonc`
    || name.startsWith('lib/narration/') && /^[a-zA-Z0-9/_-]+\.ts$/u.test(name)
    || archives.has(name);
}

/** Read-only packaging. Only the chosen entrypoint, its Deno configuration and
 * explicitly imported relative source files can enter the upload. No glob,
 * environment file, test fixture, credentials or unrelated app file is read. */
export async function narrationEdgeFiles(selectedFunction) {
  if (!functions.includes(selectedFunction)) throw new Error('Choose voorlezen-admin or voorlezen-worker.');
  const root = await realpath(repository), discovered = new Map();
  const visit = async pathname => {
    const actual = await realpath(pathname), name = posix(relative(root, actual));
    if (name.startsWith('../') || !permitted(name, selectedFunction)) throw new Error(`Unapproved Edge dependency: ${name}`);
    if (discovered.has(name)) return;
    const bytes = await readFile(actual); const sourceContent = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const { content, transform } = compactNarrationArchive(name, sourceContent);
    discovered.set(name, { name, content, sourceSha256: sha256(bytes), sourceByteLength: bytes.length,
      sha256: sha256(content), byteLength: Buffer.byteLength(content), transform });
    if (name.endsWith('.json') || name.endsWith('.jsonc')) return;
    const source = ts.createSourceFile(name, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS), imports = new Set();
    const add = value => {
      if (!ts.isStringLiteral(value) || !/^\.\.?\//u.test(value.text) || !/\.(?:ts|json)$/u.test(value.text) || /[?#\0\\]/u.test(value.text)) throw new Error(`Only explicit relative TS/JSON dependencies are permitted: ${name}`);
      imports.add(value.text);
    };
    const walk = node => {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) add(node.moduleSpecifier);
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) { if (node.arguments.length !== 1) throw new Error(`Unreviewed dynamic import: ${name}`); add(node.arguments[0]); }
      ts.forEachChild(node, walk);
    };
    walk(source);
    for (const specifier of [...imports].sort()) await visit(resolve(dirname(actual), specifier));
  };
  const entrypoint_path = `supabase/functions/${selectedFunction}/index.ts`;
  const import_map_path = `supabase/functions/${selectedFunction}/deno.json`;
  await visit(resolve(root, entrypoint_path)); await visit(resolve(root, import_map_path));
  const config = JSON.parse(discovered.get(import_map_path).content);
  if (!config || typeof config !== 'object' || !config.imports || Object.keys(config.imports).length) throw new Error('Review external Deno imports before packaging.');
  const ordered = [...discovered.values()].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  const digests = ordered.map(({ name, sha256, byteLength, sourceSha256, sourceByteLength, transform }) => ({ name, sha256, byteLength, sourceSha256, sourceByteLength, transform }));
  return { schemaVersion: 1, name: selectedFunction, entrypoint_path, import_map_path,
    files: ordered.map(({ name, content }) => ({ name, content })), digests,
    totalBytes: digests.reduce((sum, file) => sum + file.byteLength, 0), sourceTotalBytes: digests.reduce((sum, file) => sum + file.sourceByteLength, 0),
    sha256: sha256(JSON.stringify(digests)), sourceSha256: sha256(JSON.stringify(digests.map(({ name, sourceSha256, sourceByteLength }) => ({ name, sha256: sourceSha256, byteLength: sourceByteLength })))) };
}
function metadata(result) { const { files, ...rest } = result; return { ...rest, fileCount: files.length }; }
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), selected = args.find(arg => !arg.startsWith('--'));
  if (args.some(arg => arg !== selected && arg !== '--metadata') || selected && !functions.includes(selected)) throw new Error('Usage: node scripts/narration/edge-files.mjs [voorlezen-admin|voorlezen-worker] [--metadata]');
  // Without an explicit function, print only small metadata for both bundles.
  const results = await Promise.all((selected ? [selected] : functions).map(narrationEdgeFiles));
  process.stdout.write(JSON.stringify(selected ? args.includes('--metadata') ? metadata(results[0]) : results[0] : results.map(metadata)) + '\n');
}
