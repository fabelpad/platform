import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, chownSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, realpathSync, renameSync, rmSync, statfsSync, symlinkSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertRootPath, assertSharedLock, below, invariant, loadProfile, MACHINE_ID, validateCurrentTarget } from './release-contract.mjs';

export function hostProfile({ privileged = true } = {}) {
  const profile = loadProfile();
  invariant(hostname() === profile.hostname && readFileSync('/etc/machine-id', 'utf8').trim() === MACHINE_ID, 'Deze adapter hoort bij een andere host.');
  invariant(process.getuid() === (privileged ? 0 : profile.build.uid), 'Verkeerd uitvoeringsaccount.');
  if (privileged) invariant(!process.env.SUDO_USER || process.env.SUDO_USER === profile.runner.user, 'Alleen de eigen runner of een rechtstreekse rootbeheerder mag deze adapter starten.');
  invariant(path.dirname(fileURLToPath(import.meta.url)) === profile.installRoot, 'Gebruik uitsluitend de geïnstalleerde root-owned adapter.');
  for (const file of ['release-contract.mjs', 'host-runtime.mjs', 'candidate-build.mjs', 'candidate-build.sh', 'candidate-worker.mjs', 'locked-operation.mjs', 'bounded-operation.py', 'activate.mjs', 'rollback.mjs', 'release-actions.mjs', 'seal-artifact.py', 'verify-release-sha.mjs']) assertRootPath(`${profile.installRoot}/${file}`);
  for (const file of [profile.node, profile.pnpm]) assertRootPath(realpathSync(file));
  invariant(process.versions.node === profile.nodeVersion, 'De actieve Node-versie wijkt af van het hostprofiel.');
  return profile;
}

export function cleanEnvironment(profile, { build = false } = {}) {
  return {
    PATH: profile.toolchainPath,
    HOME: build ? profile.buildHome : '/root',
    LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8',
    NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', CI: 'true',
    ...(process.env.SUDO_USER && !build ? { SUDO_USER: process.env.SUDO_USER } : {}),
  };
}

export async function readCredentialRequest(stream = process.stdin, { allowPublicConfig = false } = {}) {
  let text = '';
  for await (const data of stream) {
    text += data;
    invariant(Buffer.byteLength(text) <= 16384, 'Credentialinvoer overschrijdt de limiet.');
  }
  let input;
  try { input = JSON.parse(text); } catch { throw new Error('Verwacht een kortlevend GitHub-leestoken via JSON op stdin.'); }
  invariant(input && Object.keys(input).every(name => ['githubToken', ...(allowPublicConfig ? ['publicConfig'] : [])].includes(name))
    && Object.keys(input).length === (allowPublicConfig ? 2 : 1) && typeof input.githubToken === 'string'
    && input.githubToken.length > 0 && !/[\r\n\x00]/.test(input.githubToken), 'Ongeldige credentialinvoer; waarden worden niet getoond.');
  if (allowPublicConfig) invariant(input.publicConfig && !Array.isArray(input.publicConfig) && typeof input.publicConfig === 'object', 'Publieke buildconfiguratie ontbreekt.');
  return input;
}

export async function readCredential(stream = process.stdin) { return (await readCredentialRequest(stream)).githubToken; }

export function run(command, args, { profile, env, cwd, input, capture = false, timeout = 120000 } = {}) {
  const result = spawnSync(command, args, {
    cwd, input, env: env ?? cleanEnvironment(profile), timeout,
    stdio: [input === undefined ? 'ignore' : 'pipe', capture ? 'pipe' : 'inherit', capture ? 'pipe' : 'inherit'],
    maxBuffer: 256 * 1024 ** 2,
  });
  invariant(!result.error && result.status === 0, `Opdracht ${path.basename(command)} is mislukt (status ${result.status ?? 'onbekend'}).`);
  return result.stdout;
}

export function lockOperation(profile, operation, args, token, publicConfig) {
  invariant(['build', 'activate', 'rollback'].includes(operation), 'Onbekende lockoperatie.');
  const lock = operation === 'build' ? assertSharedLock(profile.sharedBuildLock) : profile.activationLock;
  if (operation !== 'build') assertRootPath(lock, { privateFile: true });
  const result = spawnSync('/usr/bin/python3', ['-I', `${profile.installRoot}/bounded-operation.py`, lock, '2700', String(process.pid),
    profile.node, `${profile.installRoot}/locked-operation.mjs`, operation, ...args], {
    env: cleanEnvironment(profile), input: JSON.stringify({ githubToken: token, ...(publicConfig ? { publicConfig } : {}) }),
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  if (result.status === 75) throw new Error('Het gedeelde build-lock of eigen activatielock is bezet; er is niets geactiveerd.');
  invariant(!result.error && result.status === 0, 'De releasebewerking is mislukt; controleer de niet-geheime uitvoer.');
}

export function checkCapacity(profile, directory) {
  const free = statfsSync(directory, { bigint: true });
  invariant(free.bavail * free.bsize >= BigInt(profile.minimumFreeBytes)
    && free.ffree >= BigInt(profile.minimumFreeInodes), 'Onvoldoende vrije bytes of inodes voor deze build.');
}

export function makeDirectory(file, uid, gid, mode = 0o750) {
  mkdirSync(file, { mode });
  chownSync(file, uid, gid);
  chmodSync(file, mode);
}

export function sealTree(root, appGid) {
  const visit = file => {
    const metadata = lstatSync(file);
    if (metadata.isSymbolicLink()) return;
    if (metadata.isDirectory()) for (const entry of readdirSync(file)) visit(path.join(file, entry));
    chownSync(file, 0, appGid);
    chmodSync(file, metadata.isDirectory() || metadata.mode & 0o100 ? 0o750 : 0o640);
  };
  visit(root);
  // cp -a preserves symlinks. Change their own ownership without following them.
  execFileSync('/usr/bin/chown', ['-hR', `0:${appGid}`, '--', root], { env: { PATH: '/usr/bin:/bin' }, stdio: ['ignore', 'ignore', 'pipe'] });
}

export function readLink(profile, name) {
  const file = `${profile.siteRoot}/${name}`;
  if (!existsSync(file)) {
    try { lstatSync(file); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  }
  invariant(lstatSync(file).isSymbolicLink(), 'Releaseverwijzing moet een symlink zijn.');
  return validateCurrentTarget(profile, readlinkSync(file));
}

export function atomicLink(profile, name, target) {
  validateCurrentTarget(profile, target);
  invariant(['current', 'previous'].includes(name), 'Ongeldige releaseverwijzing.');
  const temporary = `${profile.siteRoot}/.${name}-${process.pid}`;
  invariant(!existsSync(temporary), 'Tijdelijke releaseverwijzing bestaat al.');
  symlinkSync(path.relative(profile.siteRoot, target), temporary);
  renameSync(temporary, `${profile.siteRoot}/${name}`);
}

export function removeLink(profile, name) {
  if (readLink(profile, name)) rmSync(`${profile.siteRoot}/${name}`);
}

export function writeJson(file, value, gid = 0) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o640 });
  chownSync(file, 0, gid);
}

export async function health(profile, manifest) {
  const response = await fetch(`http://127.0.0.1:${profile.port}/api/health`, {
    signal: AbortSignal.timeout(3000), redirect: 'error', headers: { Accept: 'application/json' },
  });
  invariant(response.status === 200, 'Loopbackhealth heeft geen status 200.');
  const data = await response.json();
  invariant(data.ok === true && data.service === 'fabelpad' && data.runtime === 'nextjs-node'
    && data.environment === 'staging' && data.revision === manifest.sha, 'Loopbackhealth past niet bij de release-SHA en doelomgeving.');
}

export async function waitForHealth(profile, manifest) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { await health(profile, manifest); return; } catch (error) { if (attempt === 19) throw error; }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

export function assertSiteDirectory(profile, directory) {
  invariant(below(profile.siteRoot, directory), 'Pad valt buiten het eigen doel.');
  assertRootPath(directory, { directory: true });
}
