import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import { spawnCandidateWorker } from './release-actions.mjs';

function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'fabelpad-build-cwd-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const work = path.join(root, 'own-build-work');
  const installRoot = path.join(root, 'installed');
  for (const directory of [work, installRoot]) mkdirSync(directory);
  const profile = { build: { user: 'synthetic-build-user' }, node: process.execPath,
    installRoot, toolchainPath: path.dirname(process.execPath) + ':/usr/bin:/bin', buildHome: root };
  // A real Node subprocess checks cwd before doing any source/build work, then
  // starts a second process without cwd: the same inheritance used by the
  // candidate worker's first tar and pnpm --version invocations.
  writeFileSync(path.join(installRoot, 'candidate-worker.mjs'), `
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
const child=spawnSync(process.execPath,['-e','process.stdout.write(process.cwd())'],{encoding:'utf8'});
if(child.error||child.status!==0)throw new Error('Nested build command has no usable cwd');
writeFileSync(3,JSON.stringify({cwd:process.cwd(),nestedCwd:child.stdout,args:process.argv.slice(2),archive:readFileSync(0,'utf8')}));
`);
  return { root, work, profile };
}

// Only the Unix account-switch binary is substituted in these portable tests.
// Its exact command/user/argv and all subprocess options remain asserted; the
// worker and its nested process are real OS processes, never a mocked cwd.
function withoutAccountSwitch(command, argv, options) {
  assert.equal(command, '/usr/sbin/runuser');
  assert.deepEqual(argv.slice(0, 3), ['--user', 'synthetic-build-user', '--']);
  assert.equal(options.env.HOME, options.cwd.substring(0, options.cwd.lastIndexOf('/')));
  assert.equal(options.env.NODE_ENV, 'production');
  assert.equal(options.timeout, 40 * 60 * 1000);
  assert.deepEqual(options.stdio, ['pipe', 'inherit', 'inherit', 'pipe']);
  assert.equal(options.shell, undefined);
  return spawnSync(argv[3], argv.slice(4), { ...options, stdio: ['pipe', 'pipe', 'pipe', 'pipe'] });
}

test('buildworker and its first subprocess use the own workmap, not the caller checkout', t => {
  const { work, profile } = fixture(t);
  assert.notEqual(process.cwd(), work);
  const args = ['--sha', 'a'.repeat(40), '--config-id', 'synthetic'];
  const result = spawnCandidateWorker(profile, work, args, Buffer.from('synthetic archive'), withoutAccountSwitch);
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.output[3].toString()), {
    cwd: work, nestedCwd: work, args, archive: 'synthetic archive',
  });
});

test('unusable inherited caller cwd cannot break initial builder commands', t => {
  const { root, work, profile } = fixture(t);
  const caller = path.join(root, 'removed-runner-checkout');
  mkdirSync(caller);
  const driver = path.join(root, 'caller.mjs');
  const module = pathToFileURL(fileURLToPath(new URL('./release-actions.mjs', import.meta.url))).href;
  writeFileSync(driver, `
import {spawnSync} from 'node:child_process';
import {rmSync} from 'node:fs';
import {spawnCandidateWorker} from ${JSON.stringify(module)};
const profile=${JSON.stringify(profile)};
process.chdir(${JSON.stringify(caller)});rmSync(${JSON.stringify(caller)},{recursive:true});
// Negative control: the former inherited-cwd options really fail in this fixture.
const inherited=spawnCandidateWorker(profile,${JSON.stringify(work)},[],Buffer.from('synthetic archive'),
 (command,args,options)=>{const {cwd,...legacy}=options;return spawnSync(args[3],args.slice(4),{...legacy,stdio:['pipe','pipe','pipe','pipe']});});
if(!inherited.error&&inherited.status===0)throw new Error('Regression fixture failed to reject the former inherited cwd');
const result=spawnCandidateWorker(profile,${JSON.stringify(work)},[],Buffer.from('synthetic archive'),
 (command,args,options)=>spawnSync(args[3],args.slice(4),{...options,stdio:['pipe','pipe','pipe','pipe']}));
if(result.error||result.status!==0)throw new Error('Build command inherited the unusable runner cwd');
process.stdout.write(result.output[3]);
`);
  const result = spawnSync(process.execPath, [driver], { encoding: 'utf8' });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, 'A deleted caller cwd must not be inherited by the buildworker');
  assert.deepEqual(JSON.parse(result.stdout), { cwd: work, nestedCwd: work, args: [], archive: 'synthetic archive' });
});
