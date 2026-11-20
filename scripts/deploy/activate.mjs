#!/opt/dg-toolchains/fabelpad-vps08-staging/node-v24.18.0-linux-x64/bin/node
import { hostProfile, lockOperation, readCredential } from './host-runtime.mjs';
import { ID, invariant, parseArgs } from './release-contract.mjs';

try {
  const args = parseArgs(process.argv.slice(2), ['candidate', 'config-id', 'run-id', 'run-attempt']);
  invariant(/^[a-f0-9]{40}-[1-9][0-9]{0,19}-[1-9][0-9]{0,5}$/.test(args.candidate) && ID.test(args['config-id']), 'Ongeldige kandidaat of configuratie-identificatie.');
  const profile = hostProfile();
  const token = await readCredential();
  lockOperation(profile, 'activate', process.argv.slice(2), token);
} catch (error) {
  console.error(`Activering geweigerd: ${error.message}`);
  process.exitCode = 1;
}
