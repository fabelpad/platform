import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { hostProfile, checkCapacity, cleanEnvironment, run } from './host-runtime.mjs';
import { candidateId, invariant, parseArgs, readBuildConfig, treeDigest, validateArchiveEntries } from './release-contract.mjs';

// Only this unprivileged worker executes archive contents, dependency scripts
// and Next.js. It cannot read runtime-configs or sealed candidates/releases.
try {
  process.umask(0o027);
  const args = parseArgs(process.argv.slice(2), ['sha', 'config-id', 'run-id', 'run-attempt', 'ci-run-id', 'ci-run-attempt', 'ci-job-id']);
  const profile = hostProfile({ privileged: false });
  const id = candidateId(args.sha, args['run-id'], args['run-attempt']);
  const work = `${profile.buildRoot}/work/${id}`;
  invariant(lstatSync(work).isDirectory() && lstatSync(work).uid === profile.build.uid, 'Werkmap ontbreekt of heeft de verkeerde eigenaar.');
  const artifact = `${work}/artifact`;
  invariant(!existsSync(artifact), 'Deze buildwerkmap is al gebruikt.');
  mkdirSync(artifact, { mode: 0o750 });
  checkCapacity(profile, work);
  const archive = readFileSync(0);
  invariant(archive.length > 0 && archive.length < 256 * 1024 ** 2, 'Bronarchief ontbreekt of overschrijdt de limiet.');
  const listing = run('/bin/tar', ['--list', '--gzip', '--file=-'], { profile, input: archive, capture: true }).toString();
  validateArchiveEntries(listing);
  run('/bin/tar', ['--extract', '--gzip', '--strip-components=1', '--file=-', '--no-same-owner', '--no-same-permissions', '--directory', artifact], { profile, input: archive });
  for (const name of readdirSync(artifact)) invariant(!name.startsWith('.env') || name === '.env.example', 'Het bronarchief bevat een omgevingsbestand.');
  const packageJson = JSON.parse(readFileSync(`${artifact}/package.json`, 'utf8'));
  invariant(readFileSync(`${artifact}/.nvmrc`, 'utf8').trim() === profile.nodeVersion
    && packageJson.packageManager === `pnpm@${profile.pnpmVersion}`
    && packageJson.scripts.build === 'next build'
    && packageJson.scripts.start === 'next start --hostname 127.0.0.1', 'Broncode heeft een afwijkend toolchain-, build- of startcontract.');
  const { config, digest } = readBuildConfig(profile, args['config-id']);
  const env = {
    ...cleanEnvironment(profile, { build: true }), ...config,
    FABELPAD_DEPLOY_ENV: 'staging', FABELPAD_RELEASE_SHA: args.sha,
  };
  const pnpmVersion = run(profile.node, [profile.pnpm, '--version'], { profile, env, capture: true }).toString().trim();
  invariant(pnpmVersion === profile.pnpmVersion, 'De actieve pnpm-versie wijkt af van het hostprofiel.');
  // Copy package contents instead of hard-linking the shared pnpm store. The
  // immutable candidate must remain independent of mutable package caches.
  run(profile.node, [profile.pnpm, 'install', '--frozen-lockfile', '--prod=false', '--package-import-method=copy'], { profile, env, cwd: artifact, timeout: 15 * 60 * 1000 });
  run(profile.node, ['scripts/local-preflight.mjs'], { profile, env, cwd: artifact });
  run(profile.node, ['scripts/config-check.mjs', '--target=staging', '--no-env-files'], { profile, env, cwd: artifact });
  for (const script of ['typecheck', 'check:content', 'check:backend', 'check:native', 'check:deploy', 'build']) {
    run(profile.node, [profile.pnpm, script], { profile, env, cwd: artifact, timeout: 20 * 60 * 1000 });
  }
  for (const name of ['.next/BUILD_ID', '.next/server', '.next/static', 'public', 'node_modules/next']) invariant(existsSync(`${artifact}/${name}`), `Benodigde buildoutput ontbreekt: ${name}.`);
  const artifactDigest = treeDigest(artifact);
  const manifest = {
    version: 1, id, siteId: profile.siteId, repository: profile.repository, branch: profile.branch,
    hostname: profile.hostname, machineId: profile.machineId, environment: 'staging', sha: args.sha,
    configId: args['config-id'], buildConfigDigest: digest, artifactDigest,
    runId: args['run-id'], runAttempt: args['run-attempt'],
    ciRunId: args['ci-run-id'], ciRunAttempt: args['ci-run-attempt'], ciJobId: args['ci-job-id'],
    nodeVersion: process.versions.node, pnpmVersion,
    lockfileDigest: createHash('sha256').update(readFileSync(`${artifact}/pnpm-lock.yaml`)).digest('hex'),
    buildCommand: 'pnpm build', startCommand: 'pnpm start', builtAt: new Date().toISOString(),
  };
  // Dedicated pipe inherited only from the trusted dispatcher. Package scripts
  // do not inherit this descriptor, and root never reads builder-owned paths
  // as a JSON manifest.
  writeFileSync(3, `${JSON.stringify(manifest)}\n`);
  console.log(`Build gereed voor kandidaat ${id}; nog niet verzegeld of geactiveerd.`);
} catch (error) {
  console.error(`Buildworker gestopt: ${error.message}`);
  process.exitCode = 1;
}
