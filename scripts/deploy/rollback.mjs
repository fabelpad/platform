#!/opt/dg-toolchains/fabelpad-vps08-staging/node-v24.18.0-linux-x64/bin/node
import { hostProfile, lockOperation, readCredential } from './host-runtime.mjs';
import { invariant, parseArgs, SHA } from './release-contract.mjs';

try {
  const args = parseArgs(process.argv.slice(2), ['sha', 'run-id', 'run-attempt']);
  invariant(SHA.test(args.sha), 'Rollback vereist de volledige SHA van de vorige gezonde release.');
  const profile = hostProfile();
  const token = await readCredential();
  lockOperation(profile, 'rollback', process.argv.slice(2), token);
} catch (error) {
  console.error(`Rollback geweigerd: ${error.message}`);
  process.exitCode = 1;
}
