import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateProjectConfiguration } from '../lib/projectConfiguration.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
if (args.some(arg => !arg.startsWith('--target=') && arg !== '--no-env-files') || args.filter(arg => arg.startsWith('--target=')).length > 1) {
  console.error('Gebruik: node scripts/config-check.mjs [--target=local|staging|production] [--no-env-files]');
  process.exit(64);
}
if (!args.includes('--no-env-files')) {
  for (const name of ['.env.local', '.env']) {
    const file = path.join(root, name);
    if (existsSync(file)) process.loadEnvFile(file);
  }
}
const target = args.find(arg => arg.startsWith('--target='))?.slice('--target='.length)
  ?? process.env.FABELPAD_DEPLOY_ENV ?? 'local';
const result = validateProjectConfiguration(process.env, { target, requireReleaseIdentity: true });
if (!result.ok) {
  console.error(`Configuratie afgewezen (${target}); alleen namen en redenen worden getoond:\n${result.errors.map(error => `- ${error}`).join('\n')}`);
  process.exit(78);
}
console.log(`Configuratie geldig voor ${target}: expliciete datamodus ${result.configuration.dataMode}; externe werking niet getest. Geen configuratiewaarden getoond.`);
