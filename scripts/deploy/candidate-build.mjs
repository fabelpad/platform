import { hostProfile, lockOperation, readCredential } from './host-runtime.mjs';
import { candidateId, ID, invariant, parseArgs } from './release-contract.mjs';

try {
  const args = parseArgs(process.argv.slice(2), ['sha', 'config-id', 'run-id', 'run-attempt', 'ci-run-id', 'ci-run-attempt', 'ci-job-id']);
  candidateId(args.sha, args['run-id'], args['run-attempt']);
  invariant(ID.test(args['config-id']), 'Ongeldige configuratie-identificatie.');
  for (const name of ['ci-run-id', 'ci-run-attempt', 'ci-job-id']) invariant(/^[1-9][0-9]{0,19}$/.test(args[name]), 'Ongeldige CI-identificatie.');
  const profile = hostProfile();
  const token = await readCredential();
  lockOperation(profile, 'build', process.argv.slice(2), token);
} catch (error) {
  console.error(`Kandidaatbuild geweigerd: ${error.message}`);
  process.exitCode = 1;
}
