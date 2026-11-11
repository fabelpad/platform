#!/opt/node-v24.18.0-linux-x64/bin/node
import { hostProfile, lockOperation, readCredential } from './host-runtime.mjs';
import { invariant } from './release-contract.mjs';

try {
  invariant(process.argv.length === 2, 'Rollback accepteert geen vrij pad of release-ID.');
  const profile = hostProfile();
  const token = await readCredential();
  lockOperation(profile, 'rollback', [], token);
} catch (error) {
  console.error(`Rollback geweigerd: ${error.message}`);
  process.exitCode = 1;
}
