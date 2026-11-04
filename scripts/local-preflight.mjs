import { execFileSync } from 'node:child_process';
import { readFileSync, statfsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
if (args.some(arg => !['--android', '--capacity-only'].includes(arg))) throw new Error('Gebruik: node scripts/local-preflight.mjs [--android] [--capacity-only]');
const expectedNode = readFileSync(new URL('../.nvmrc', import.meta.url), 'utf8').trim();
const expectedPnpm = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).packageManager;
if (!args.includes('--capacity-only')) {
  if (process.versions.node !== expectedNode) throw new Error(`Gebruik Node ${expectedNode}; gevonden ${process.versions.node}`);
  const actualPnpm = execFileSync('pnpm', ['--version'], { encoding: 'utf8', cwd: root }).trim();
  if (`pnpm@${actualPnpm}` !== expectedPnpm) throw new Error(`Gebruik ${expectedPnpm}; gevonden pnpm@${actualPnpm}`);
}
const fs = statfsSync(root, { bigint: true });
const bytes = fs.bavail * fs.bsize;
const minBytes = BigInt(args.includes('--android') ? 12 : 4) * 1024n ** 3n;
const minInodes = BigInt(args.includes('--android') ? 100000 : 50000);
console.log(`Preflight: Node ${process.versions.node}; vrije bytes ${bytes}; vrije inodes ${fs.ffree}.`);
if (bytes < minBytes || fs.ffree < minInodes) throw new Error('Onvoldoende bouwruimte. Verwijder geen actieve release, herstelpunt of onbekende bestanden; stel eerst het bewaarbeleid vast.');
console.log(`Capaciteitsdrempel ${args.includes('--android') ? 'Android (12 GiB, 100.000 inodes)' : 'web (4 GiB, 50.000 inodes)'} gehaald; dit vervangt geen omgevingsspecifiek backup-/releasebudget.`);
