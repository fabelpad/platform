import { readCredential } from './host-runtime.mjs';
import { invariant } from './release-contract.mjs';
import { activate, buildCandidate, rollback } from './release-actions.mjs';

// Private implementation entry, deliberately absent from sudoers. Public
// entries invoke it only while flock holds the shared build or own release lock.
try {
  invariant(process.getuid() === 0, 'De dispatcher vereist root.');
  const operation = process.argv[2];
  invariant(['build', 'activate', 'rollback'].includes(operation), 'Onbekende bewerking.');
  const token = await readCredential();
  await ({ build: buildCandidate, activate, rollback })[operation](process.argv.slice(3), token);
} catch (error) {
  console.error(`Releasebewerking gestopt: ${error.message}`);
  process.exitCode = 1;
}
