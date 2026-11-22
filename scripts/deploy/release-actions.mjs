import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, renameSync, rmSync, writeFileSync, chownSync, chmodSync } from 'node:fs';
import path from 'node:path';
import { assertRootPath, candidateId, downloadSourceArchive, ID, invariant, parseArgs, readBuildConfig, switchWithRecovery, treeDigest, validateManifest, validateRuntimePair, validatePublicConfig, validateEmailReadiness } from './release-contract.mjs';
import { atomicLink, assertSiteDirectory, checkCapacity, cleanEnvironment, health, hostProfile, makeDirectory, readLink, removeLink, run, sealTree, waitForHealth, writeJson } from './host-runtime.mjs';
import { githubApi, verifyActivationEnvironment, verifyGitHubRelease, verifyManualDispatch, verifyUnchangedManualDispatch } from './verify-release-sha.mjs';

function buildArgs(argv) {
  return parseArgs(argv, ['sha', 'config-id', 'run-id', 'run-attempt', 'ci-run-id', 'ci-run-attempt', 'ci-job-id']);
}

function readManifest(profile, directory, id) {
  assertSiteDirectory(profile, directory);
  assertRootPath(`${directory}/manifest.json`, { privateFile: true });
  return validateManifest(profile, JSON.parse(readFileSync(`${directory}/manifest.json`, 'utf8')), id);
}

function assertArtifact(directory, manifest) {
  invariant(treeDigest(`${directory}/artifact`) === manifest.artifactDigest, 'Artefactdigest wijkt af van het verzegelde manifest.');
}

function serviceState(profile) {
  const state = run('/usr/bin/systemctl', ['show', profile.service,
    '--property=User,Group,WorkingDirectory,EnvironmentFiles,ActiveState,SubState', '--no-pager'], { profile, capture: true }).toString();
  const value = name => state.split('\n').find(line => line.startsWith(`${name}=`))?.slice(name.length + 1);
  invariant(value('User') === profile.app.user && value('Group') === profile.app.user
    && value('WorkingDirectory') === `${profile.siteRoot}/current/artifact`
    && value('EnvironmentFiles') === `${profile.siteRoot}/current/runtime.env (ignore_errors=no)`, 'Systemd-service wijkt af van het eigen versiegebonden runtimecontract.');
  return { active: value('ActiveState'), sub: value('SubState') };
}

function runtimeFile(profile, manifest) {
  const file = `${profile.configRoot}/runtime-configs/${manifest.configId}/${manifest.sha}.env`;
  assertRootPath(file, { privateFile: true });
  invariant(lstatSync(file).gid === profile.app.gid && (lstatSync(file).mode & 0o777) === 0o640, 'Runtimeconfiguratie moet root:app 0640 zijn.');
  const text = readFileSync(file, 'utf8');
  validateRuntimePair(profile, manifest, text);
  return { file, text, digest: createHash('sha256').update(text).digest('hex') };
}

function verifySealedRuntime(profile, directory, manifest) {
  assertRootPath(`${directory}/runtime.env`, { privateFile: true });
  const text = readFileSync(`${directory}/runtime.env`, 'utf8');
  invariant(createHash('sha256').update(text).digest('hex') === manifest.runtimeConfigDigest, 'Verzegelde runtimeconfiguratie wijkt af.');
  validateRuntimePair(profile, manifest, text);
}

function healthyReceipt(profile, directory, manifest) {
  assertRootPath(`${directory}/healthy.json`, { privateFile: true });
  const receipt = JSON.parse(readFileSync(`${directory}/healthy.json`, 'utf8'));
  invariant(receipt.sha === manifest.sha && receipt.artifactDigest === manifest.artifactDigest
    && receipt.runtimeConfigDigest === manifest.runtimeConfigDigest, 'Vorige release heeft geen passend bewijs van gezonde app/configuratie.');
}

async function verifyRelease(token, sha, { activation = false, environment = 'staging' } = {}) {
  const api = githubApi(token);
  if (activation) await verifyActivationEnvironment(api, environment);
  return verifyGitHubRelease({ sha, api });
}

// Snapshot public GitHub variables into exclusively new, root-owned files.
// No .env source or runtime secret is ever inherited by the build account.
function provisionPublicConfiguration(profile, configId, sha, rawConfig) {
  const config = validatePublicConfig(rawConfig);
  const readinessFile = `${profile.configRoot}/email-readiness.json`;
  assertRootPath(readinessFile, {privateFile:true});
  const readiness = validateEmailReadiness(profile, config, JSON.parse(readFileSync(readinessFile, 'utf8')));
  const text = [...Object.keys(config).sort().map(name => `${name}=${config[name]}`), ''].join('\n');
  const writeImmutable = (file, content, gid) => {
    if (existsSync(file)) {
      assertRootPath(file, { privateFile: true });
      invariant(lstatSync(file).gid === gid && (lstatSync(file).mode & 0o777) === 0o640
        && readFileSync(file, 'utf8') === content, 'Configuratie-ID is al gebruikt met andere waarden of rechten; kies een nieuwe ID.');
      return;
    }
    writeFileSync(file, content, { flag: 'wx', mode: 0o640 });
    chownSync(file, 0, gid); chmodSync(file, 0o640);
  };
  for (const [directory, gid] of [[`${profile.configRoot}/build-configs`, profile.build.gid], [`${profile.configRoot}/runtime-configs`, profile.app.gid]]) {
    const meta = assertRootPath(directory, {directory: true});
    invariant(meta.gid === gid && (meta.mode & 0o777) === 0o750, 'Configuratiedirectory heeft onjuiste rechten.');
  }
  writeImmutable(`${profile.configRoot}/build-configs/${configId}.env`, text, profile.build.gid);
  const runtimeDirectory = `${profile.configRoot}/runtime-configs/${configId}`;
  if (!existsSync(runtimeDirectory)) makeDirectory(runtimeDirectory, 0, profile.app.gid);
  assertRootPath(runtimeDirectory, {directory: true});
  const runtimeText = `${text}FABELPAD_DEPLOY_ENV=${profile.environment}\nFABELPAD_RELEASE_SHA=${sha}\nPORT=${profile.port}\nFABELPAD_AUTH_EMAIL_ENABLED=true\nFABELPAD_AUTH_GOOGLE_ENABLED=${readiness.version === 2 && readiness.googleProviderConfigured === true}\n`;
  writeImmutable(`${runtimeDirectory}/${sha}.env`, runtimeText, profile.app.gid);
}

export function spawnCandidateWorker(profile, work, argv, archive, spawn = spawnSync) {
  return spawn('/usr/sbin/runuser', ['--user', profile.build.user, '--', profile.node,
    `${profile.installRoot}/candidate-worker.mjs`, ...argv], {
    // The caller is the runner account; its checkout is deliberately unreadable
    // to the builder. Enter the freshly created own build workmap before the
    // account switch so even the worker's first tar/pnpm version calls have a
    // readable cwd instead of inheriting the runner's private checkout.
    cwd: work, env: cleanEnvironment(profile, { build: true }), input: archive, timeout: 40 * 60 * 1000,
    stdio: ['pipe', 'inherit', 'inherit', 'pipe'], maxBuffer: 65536,
  });
}

export async function buildCandidate(argv, token, publicConfig) {
  const args = buildArgs(argv);
  const profile = hostProfile();
  const id = candidateId(args.sha, args['run-id'], args['run-attempt']);
  invariant(ID.test(args['config-id']), 'Ongeldige configuratie-identificatie.');
  const dispatch = await verifyManualDispatch({api: githubApi(token), operation: 'build', runId: args['run-id'], runAttempt: args['run-attempt'],environment:profile.environment});
  const proof = await verifyRelease(token, args.sha);
  for (const [flag, field] of [['ci-run-id', 'ciRunId'], ['ci-run-attempt', 'ciRunAttempt'], ['ci-job-id', 'ciJobId']]) {
    invariant(args[flag] === String(proof[field]), 'De aangeleverde CI-identificatie is niet de actuele geslaagde controle.');
  }
  provisionPublicConfiguration(profile, args['config-id'], args.sha, publicConfig);
  const buildConfig = readBuildConfig(profile, args['config-id']);
  const candidates = `${profile.siteRoot}/candidates`;
  assertSiteDirectory(profile, candidates);
  const destination = `${candidates}/${id}`;
  const pending = `${candidates}/.${id}.pending`;
  invariant(!existsSync(destination) && !existsSync(pending), 'Deze kandidaat bestaat al; bestaande kandidaten worden niet overschreven.');
  checkCapacity(profile, profile.buildRoot);
  const work = `${profile.buildRoot}/work/${id}`;
  invariant(!existsSync(work), 'De werkmap voor deze workflowrun bestaat al.');
  makeDirectory(work, profile.build.uid, profile.build.gid);

  // Download the exact, API-approved source directly. The privileged adapter
  // never invokes Git or executes anything from a runner-writable worktree.
  const archive = await downloadSourceArchive(args.sha, token);
  const result = spawnCandidateWorker(profile, work, argv, archive);
  invariant(!result.error && result.status === 0 && result.output[3]?.length > 0, 'Buildworker heeft geen geldig resultaat opgeleverd.');
  let value;
  try { value = JSON.parse(result.output[3].toString()); } catch { throw new Error('Workerresultaat is geen geldig JSON-manifest; inhoud wordt niet getoond.'); }
  const manifest = validateManifest(profile, { ...value, ciChecks: proof.ciChecks, workflowSha: dispatch.workflowSha, workflowJobId: dispatch.jobId }, id);
  invariant(manifest.sha === args.sha && manifest.configId === args['config-id']
    && manifest.buildConfigDigest === buildConfig.digest, 'Workerresultaat heeft een afwijkende bron- of configuratiebinding.');
  for (const field of ['ciRunId', 'ciRunAttempt', 'ciJobId']) invariant(String(manifest[field]) === String(proof[field]), 'Workerresultaat heeft een afwijkende CI-binding.');
  makeDirectory(pending, 0, 0, 0o700);
  run('/usr/bin/python3', ['-I', `${profile.installRoot}/seal-artifact.py`, `${work}/artifact`, `${pending}/artifact`, String(profile.build.uid), String(profile.app.gid)], { profile, timeout: 10 * 60 * 1000 });
  // Verify the COPY, not the mutable source, before root seals it.
  invariant(treeDigest(`${pending}/artifact`) === manifest.artifactDigest, 'Artefact is tijdens het kopiëren gewijzigd; kandidaat is niet verzegeld.');
  invariant(readBuildConfig(profile, manifest.configId).digest === manifest.buildConfigDigest, 'Buildconfiguratie is tijdens het bouwen gewijzigd.');
  invariant(JSON.stringify((await verifyRelease(token, manifest.sha)).ciChecks) === JSON.stringify(proof.ciChecks), 'CI-pogingen wijzigden tijdens de build; kandidaat niet verzegeld.');
  await verifyUnchangedManualDispatch({api:githubApi(token),operation:'build',proof:dispatch,environment:profile.environment});
  writeJson(`${pending}/manifest.json`, { ...manifest, sealedAt: new Date().toISOString() }, profile.app.gid);
  sealTree(pending, profile.app.gid);
  renameSync(pending, destination);
  console.log(JSON.stringify({ status: 'candidate-sealed', id, sha: manifest.sha, configId: manifest.configId,
    buildConfigDigest: manifest.buildConfigDigest, ciRunId: manifest.ciRunId, activated: false }));
}

export async function activate(argv, token) {
  const args = parseArgs(argv, ['candidate', 'config-id', 'run-id', 'run-attempt']);
  const profile = hostProfile();
  const dispatch = await verifyManualDispatch({api:githubApi(token),operation:'activate',runId:args['run-id'],runAttempt:args['run-attempt'],environment:profile.environment});
  invariant(/^[a-f0-9]{40}-[1-9][0-9]{0,19}-[1-9][0-9]{0,5}$/.test(args.candidate) && ID.test(args['config-id']), 'Ongeldige kandidaat of configuratie-identificatie.');
  const candidate = `${profile.siteRoot}/candidates/${args.candidate}`;
  const manifest = readManifest(profile, candidate, args.candidate);
  invariant(manifest.configId === args['config-id'], 'Kandidaat hoort bij een andere configuratie-identificatie.');
  await verifyRelease(token, manifest.sha, { activation: true, environment: profile.environment });
  assertArtifact(candidate, manifest);
  invariant(readBuildConfig(profile, manifest.configId).digest === manifest.buildConfigDigest, 'De buildconfiguratie is gewijzigd; een nieuwe kandidaatbuild is vereist.');
  const runtime = runtimeFile(profile, manifest);
  const releases = `${profile.siteRoot}/releases`;
  assertSiteDirectory(profile, releases);
  const release = `${releases}/${manifest.id}`;
  invariant(!existsSync(release), 'Deze release bestaat al; hervatten vereist afzonderlijke beoordeling.');
  const old = readLink(profile, 'current');
  let oldManifest;
  const state = serviceState(profile);
  if (old) {
    oldManifest = readManifest(profile, old, path.basename(old));
    verifySealedRuntime(profile, old, oldManifest);
    healthyReceipt(profile, old, oldManifest);
    invariant(state.active === 'active' && state.sub === 'running', 'De bestaande eigen appservice is niet gezond actief; activering is gestopt.');
    await health(profile, oldManifest);
  } else {
    invariant(['inactive', 'failed'].includes(state.active), 'Eerste installatie verwacht een gestopte eigen appservice.');
  }
  const pending = `${releases}/.${manifest.id}.pending`;
  invariant(!existsSync(pending), 'Er staat een onvoltooide release; beoordeel die eerst.');
  makeDirectory(pending, 0, 0, 0o700);
  run('/usr/bin/cp', ['--archive', '--reflink=auto', '--no-preserve=ownership', '--', `${candidate}/artifact`, `${pending}/artifact`], { profile, timeout: 10 * 60 * 1000 });
  invariant(treeDigest(`${pending}/artifact`) === manifest.artifactDigest, 'Gekopieerde release wijkt af van de kandidaat.');
  run('/usr/bin/cp', ['--no-preserve=ownership', '--', runtime.file, `${pending}/runtime.env`], { profile });
  const releaseManifest = { ...manifest, runtimeConfigDigest: runtime.digest, preparedAt: new Date().toISOString() };
  verifySealedRuntime(profile, pending, releaseManifest);
  sealTree(pending, profile.app.gid);
  writeJson(`${pending}/manifest.json`, releaseManifest, profile.app.gid);
  renameSync(pending, release);
  // Re-read external approval and CI immediately before the first mutation of
  // current. Build config and runtime snapshot are now an immutable bundle.
  await verifyRelease(token, manifest.sha, { activation: true, environment: profile.environment });
  await verifyUnchangedManualDispatch({api:githubApi(token),operation:'activate',proof:dispatch,environment:profile.environment});
  await switchWithRecovery({
    current: old, next: release,
    switchTo: target => atomicLink(profile, 'current', target),
    restart: () => run('/usr/bin/systemctl', ['restart', profile.service], { profile }),
    check: target => waitForHealth(profile, target === release ? manifest : oldManifest),
    stop: () => run('/usr/bin/systemctl', ['stop', profile.service], { profile }),
    clear: () => removeLink(profile, 'current'),
    committed: () => {
      writeJson(`${release}/healthy.json`, {
      sha: manifest.sha, artifactDigest: manifest.artifactDigest, runtimeConfigDigest: runtime.digest,
      checkedAt: new Date().toISOString(), scope: 'loopback-process-liveness-only',
      }, profile.app.gid);
      if (old) atomicLink(profile, 'previous', old);
      else removeLink(profile, 'previous');
    },
  });
  console.log(JSON.stringify({ status: 'activated', id: manifest.id, sha: manifest.sha, configId: manifest.configId,
    previous: old ? path.basename(old) : null, scope: 'loopback-process-liveness-only' }));
}

export async function rollback(argv, token) {
  const args = parseArgs(argv, ['sha', 'run-id', 'run-attempt']);
  const profile = hostProfile();
  const dispatch = await verifyManualDispatch({api:githubApi(token),operation:'rollback',runId:args['run-id'],runAttempt:args['run-attempt'],environment:profile.environment});
  const current = readLink(profile, 'current');
  const previous = readLink(profile, 'previous');
  invariant(current && previous && current !== previous, 'Er is geen afzonderlijke vorige gezonde release beschikbaar.');
  const currentManifest = readManifest(profile, current, path.basename(current));
  const previousManifest = readManifest(profile, previous, path.basename(previous));
  invariant(args.sha === previousManifest.sha, 'Rollback-SHA is niet de vorige gezonde release.');
  await verifyRelease(token, previousManifest.sha, { activation: true, environment: profile.environment });
  assertArtifact(previous, previousManifest);
  verifySealedRuntime(profile, previous, previousManifest);
  healthyReceipt(profile, previous, previousManifest);
  serviceState(profile);
  await verifyUnchangedManualDispatch({api:githubApi(token),operation:'rollback',proof:dispatch,environment:profile.environment});
  await switchWithRecovery({
    current, next: previous,
    switchTo: target => atomicLink(profile, 'current', target),
    restart: () => run('/usr/bin/systemctl', ['restart', profile.service], { profile }),
    check: target => waitForHealth(profile, target === previous ? previousManifest : currentManifest),
    committed: () => atomicLink(profile, 'previous', current),
  });
  console.log(JSON.stringify({ status: 'rolled-back', id: previousManifest.id, sha: previousManifest.sha,
    configId: previousManifest.configId, scope: 'loopback-process-liveness-only' }));
}
