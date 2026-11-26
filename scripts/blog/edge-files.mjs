import { readFile, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
const repository = fileURLToPath(new URL('../../', import.meta.url));
const entrypoint_path = 'supabase/functions/blog-runtime/index.ts', import_map_path = 'supabase/functions/blog-runtime/deno.json';
const external = new Set(['node:buffer','node:zlib','node:dns/promises','node:net','node:https','pngjs','jpeg-js','markdown-it']);
const sha256 = value => createHash('sha256').update(value).digest('hex');
/** Read-only package: exact entrypoint/config/lock plus explicitly imported, approved source. */
export async function blogEdgeFiles() {
  const root = await realpath(repository), files = new Map();
  async function visit(pathname) {
    const actual = await realpath(pathname), name = relative(root, actual).split(sep).join('/');
    if (!/^(?:lib\/(?:blog|socialhero)\/[a-zA-Z0-9_-]+\.ts|supabase\/functions\/blog-runtime\/(?:index\.ts|deno\.json|deno\.lock))$/u.test(name)) throw new Error('Unapproved blog Edge dependency: ' + name);
    if (files.has(name)) return;
    const content = new TextDecoder('utf-8', { fatal: true }).decode(await readFile(actual)); files.set(name, { name, content });
    if (!name.endsWith('.ts')) return;
    const source = ts.createSourceFile(name, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS), dependencies = new Set();
    const add = node => {
      if (!ts.isStringLiteral(node)) throw new Error('Unreviewed dynamic dependency');
      const specifier = node.text;
      if (!specifier.startsWith('.')) { if (!external.has(specifier)) throw new Error('Unreviewed external import: ' + specifier); return; }
      if (!/^\.\.?\/[a-zA-Z0-9_./-]+\.ts$/u.test(specifier)) throw new Error('Use explicit relative TS dependencies');
      dependencies.add(specifier);
    };
    const walk = node => { if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) add(node.moduleSpecifier); if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) { if (node.arguments.length !== 1) throw new Error('Unreviewed dynamic dependency'); add(node.arguments[0]); } ts.forEachChild(node, walk); }; walk(source);
    for (const dependency of [...dependencies].sort()) await visit(resolve(dirname(actual), dependency));
  }
  for (const name of [entrypoint_path, import_map_path, 'supabase/functions/blog-runtime/deno.lock']) await visit(resolve(root, name));
  const config = JSON.parse(files.get(import_map_path).content), expected = { pngjs: 'npm:pngjs@7.0.0', 'jpeg-js': 'npm:jpeg-js@0.4.4', 'markdown-it': 'npm:markdown-it@15.0.3', 'markdown-it/': 'npm:markdown-it@15.0.3/' };
  if (JSON.stringify(config.imports) !== JSON.stringify(expected)) throw new Error('Review changed Deno imports before upload');
  const ordered = [...files.values()].sort((a,b) => a.name.localeCompare(b.name));
  const digests = ordered.map(({ name, content }) => ({ name, byteLength: Buffer.byteLength(content), sha256: sha256(content) }));
  return { name: 'blog-runtime', entrypoint_path, import_map_path, files: ordered, digests, totalBytes: digests.reduce((sum,file) => sum + file.byteLength, 0), sha256: sha256(JSON.stringify(digests)) };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await blogEdgeFiles();
  if (process.argv.slice(2).some(arg => arg !== '--metadata')) throw new Error('Usage: node scripts/blog/edge-files.mjs [--metadata]');
  const { files, ...metadata } = result; process.stdout.write(JSON.stringify(process.argv.includes('--metadata') ? { ...metadata, fileCount: files.length } : result) + '\n');
}
