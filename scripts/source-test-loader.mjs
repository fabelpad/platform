import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const compilations = new Map();
/** Compile actual relative TS dependencies for Node-based domain tests.
 * Query parameters remain on the returned module URL, so fixtures can request
 * separate module state without duplicating the compiled source on disk.
 */
export async function compileSource(sourceURL, temporaryDir) {
  const source = sourceURL instanceof URL ? new URL(sourceURL.href) : new URL(sourceURL);
  if (source.protocol !== 'file:') throw new Error('Domain tests only compile local file sources.');
  const directory = path.resolve(temporaryDir);
  let files = compilations.get(directory);
  if (!files) { files = new Map(); compilations.set(directory, files); }
  const build = async (input, ancestors = new Set()) => {
    const sourcePath = fileURLToPath(input);
    const previous = files.get(sourcePath);
    if (previous) {
      if (!ancestors.has(sourcePath)) await previous.ready;
      return previous.destination;
    }
    const hash = createHash('sha256').update(sourcePath).digest('hex').slice(0, 16);
    const destination = path.join(directory, `${path.basename(sourcePath).replace(/\.(?:[cm]?tsx?|jsx?)$/, '')}-${hash}.mjs`);
    let finish, fail;
    const ready = new Promise((resolve, reject) => { finish = resolve; fail = reject; });
    // The recursion caller observes errors; avoid an unhandled secondary promise.
    ready.catch(() => {});
    files.set(sourcePath, { destination, ready });
    try {
      const lineage = new Set(ancestors); lineage.add(sourcePath);
      let code = ts.transpileModule(await readFile(sourcePath, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
      code=code.replace(/(['"])@supabase\/supabase-js\1/gu,JSON.stringify(import.meta.resolve('@supabase/supabase-js')));
      const imports = [...code.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)].map(match => match[1]).filter(specifier => specifier.startsWith('.'));
      for (const specifier of new Set(imports)) {
        const dependencyURL = new URL(specifier, input);
        if(dependencyURL.pathname.endsWith('.json')) { const data=JSON.parse(await readFile(dependencyURL,'utf8'));const jsonPath=path.join(directory,createHash('sha256').update(dependencyURL.href).digest('hex').slice(0,16)+'.mjs');await mkdir(directory,{recursive:true});await writeFile(jsonPath,'export default '+JSON.stringify(data)+';\n');code=code.replaceAll(`'${specifier}'`,JSON.stringify(pathToFileURL(jsonPath).href)).replaceAll(`"${specifier}"`,JSON.stringify(pathToFileURL(jsonPath).href));code=code.replace(/(from\s+["']file:\/\/[^"']+\.mjs["'])\s+with\s*\{\s*type:\s*["']json["']\s*\}/gu,'$1');continue;}
        if (!/\.(?:[cm]?tsx?|jsx?)$/.test(dependencyURL.pathname)) dependencyURL.pathname += '.ts';
        const compiled = pathToFileURL(await build(dependencyURL, lineage));
        compiled.search = dependencyURL.search;
        compiled.hash = dependencyURL.hash;
        code = code.replaceAll(`'${specifier}'`, JSON.stringify(compiled.href)).replaceAll(`"${specifier}"`, JSON.stringify(compiled.href));
      }
      await mkdir(directory, { recursive: true });
      await writeFile(destination, code);
      finish();
      return destination;
    } catch (error) { fail(error); throw error; }
  };
  const result = pathToFileURL(await build(source));
  result.search = source.search;
  result.hash = source.hash;
  return result.href;
}
