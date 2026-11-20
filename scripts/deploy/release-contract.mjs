import { createHash } from 'node:crypto';
import { constants, lstatSync, readFileSync, readdirSync, readlinkSync, realpathSync } from 'node:fs';
import path from 'node:path';

export const REPOSITORY = 'fabelpad/platform';
export const BRANCH = 'main';
export const HOSTNAME = 'dg-vps-08';
export const MACHINE_ID = '05db94b99eca4c3d815f6585ef8ed517';
export const DEFAULT_PROFILE = '/etc/dg-webservices/fabelpad-vps08-staging/host.json';
export const SHA = /^[a-f0-9]{40}$/;
export const ID = /^[a-z0-9][a-z0-9-]{0,62}$/;
export const PUBLIC_CONFIG_NAMES = new Set([
  'FABELPAD_APP_ORIGIN', 'FABELPAD_DATA_MODE',
  'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
]);
export const RUNTIME_CONFIG_NAMES = new Set([
  ...PUBLIC_CONFIG_NAMES, 'FABELPAD_DEPLOY_ENV', 'FABELPAD_RELEASE_SHA', 'PORT',
  'FABELPAD_AUTH_EMAIL_ENABLED', 'FABELPAD_AUTH_GOOGLE_ENABLED',
]);

export function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

export function parseArgs(argv, required, optional = []) {
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index]?.replace(/^--/, '');
    invariant(argv[index]?.startsWith('--') && [...required, ...optional].includes(name), 'Onbekend argument.');
    invariant(result[name] === undefined && argv[index + 1] && !argv[index + 1].startsWith('--'), `Ontbrekend of dubbel argument: ${name}.`);
    result[name] = argv[index + 1];
  }
  for (const name of required) invariant(result[name], `Argument ontbreekt: ${name}.`);
  return result;
}

export function safePath(value, name) {
  invariant(typeof value === 'string' && value.startsWith('/') && value === path.normalize(value)
    && !/[\s\x00-\x1f]/.test(value) && value !== '/', `${name}: verwacht een absoluut, genormaliseerd pad.`);
  return value;
}

export function below(parent, child) {
  return child.startsWith(`${parent}/`) && child === path.normalize(child);
}

export function validateProfile(profile) {
  invariant(profile.version === 1 && profile.repository === REPOSITORY && profile.branch === BRANCH, 'Profiel: verkeerde versie, repository of integratiebranch.');
  invariant(profile.hostname === HOSTNAME && profile.machineId === MACHINE_ID && profile.environment === 'staging', 'Profiel: verkeerde hostidentiteit of doelomgeving.');
  invariant(profile.siteId === 'fabelpad-vps08-staging', 'Profiel: uitsluitend de nieuwe doelidentiteit fabelpad-vps08-staging is toegestaan.');
  invariant(profile.port === 4188, 'Profiel: de geverifieerde eigen loopbackpoort is 4188.');
  for (const role of ['runner', 'build', 'app']) {
    const account = profile[role];
    invariant(account && /^[a-z][a-z0-9-]*$/.test(account.user)
      && Number.isInteger(account.uid) && account.uid > 0 && Number.isInteger(account.gid) && account.gid > 0, `Profiel: account ${role} ontbreekt.`);
  }
  invariant(new Set(['runner', 'build', 'app'].map(role => profile[role].uid)).size === 3, 'Profiel: runner, build en app moeten aparte UID’s hebben.');
  for (const name of ['siteRoot', 'buildRoot', 'sourceWorkspace', 'configRoot', 'installRoot', 'node', 'pnpm', 'buildHome', 'sharedBuildLock', 'activationLock']) safePath(profile[name], name);
  invariant(typeof profile.toolchainPath === 'string', 'Profiel: toolchainPath ontbreekt.');
  for (const directory of profile.toolchainPath.split(':')) safePath(directory, 'toolchainPath');
  invariant(profile.siteRoot === `/srv/sites/${profile.siteId}`
    && profile.configRoot === `/etc/dg-webservices/${profile.siteId}`
    && profile.installRoot === `/usr/local/libexec/${profile.siteId}`
    && below('/var/lib/dg-build', profile.buildRoot), 'Profiel: paden vallen buiten de nieuwe doelidentiteit.');
  invariant(profile.sharedBuildLock === '/var/lock/dg-build.lock' || profile.sharedBuildLock === '/run/lock/dg-build.lock', 'Profiel: afwijkend gedeeld build-lock.');
  invariant(profile.activationLock === `${profile.configRoot}/activation.lock`, 'Profiel: activatielock hoort bij dit doel.');
  invariant(profile.service === `${profile.siteId}.service`, 'Profiel: afwijkende systemd-service.');
  invariant(profile.nodeVersion === '24.18.0' && profile.pnpmVersion === '11.25.0', 'Profiel: toolchain wijkt af van de gecommitte pins.');
  invariant(Number.isSafeInteger(profile.minimumFreeBytes) && profile.minimumFreeBytes >= 4 * 1024 ** 3
    && Number.isSafeInteger(profile.minimumFreeInodes) && profile.minimumFreeInodes >= 50000, 'Profiel: onvoldoende capaciteitsdrempels.');
  return profile;
}

// A privileged entry point may only load reviewed code and configuration from
// paths whose complete parent chain is root-owned and cannot be replaced by a
// runner, builder or app. Symlinks are deliberately forbidden for these paths.
export function assertRootPath(file, { directory = false, privateFile = false } = {}) {
  safePath(file, 'Vertrouwd pad');
  let current = '/';
  for (const part of file.split('/').filter(Boolean)) {
    current = path.join(current, part);
    const metadata = lstatSync(current);
    invariant(!metadata.isSymbolicLink() && metadata.uid === 0 && !(metadata.mode & 0o022), 'Vertrouwd pad is niet root-owned of is schrijfbaar door een ander account.');
    if (current !== file) invariant(metadata.isDirectory(), 'Vertrouwd bovenliggend pad is geen map.');
  }
  const metadata = lstatSync(file);
  invariant(directory ? metadata.isDirectory() : metadata.isFile() && metadata.nlink === 1, 'Vertrouwd pad heeft een ongeldig bestandstype of hardlink.');
  if (privateFile) invariant(!(metadata.mode & 0o007), 'Configuratie mag niet wereldleesbaar zijn.');
  return metadata;
}

export function loadProfile(file = DEFAULT_PROFILE) {
  // Host identities, accounts and paths contain no secrets. Builders need this
  // metadata, while build-configs and runtime-configs remain disjoint 0640 files.
  assertRootPath(file);
  return validateProfile(JSON.parse(readFileSync(file, 'utf8')));
}

export function parseEnv(text, names = PUBLIC_CONFIG_NAMES) {
  const result = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const match = /^([A-Z][A-Z0-9_]*)=([^\s'"`$\\\x00-\x1f]*)$/.exec(line);
    invariant(match && names.has(match[1]), 'Configuratie: ongeldig formaat of niet-toegestane naam; waarden worden niet getoond.');
    invariant(result[match[1]] === undefined, `Configuratie: dubbele naam ${match[1]}.`);
    result[match[1]] = match[2];
  }
  return result;
}

export function validatePublicConfig(config) {
  invariant(config && Object.keys(config).length === 4 && Object.keys(config).every(name => PUBLIC_CONFIG_NAMES.has(name)), 'Buildconfiguratie vereist uitsluitend de vier afgesproken publieke namen.');
  for (const name of PUBLIC_CONFIG_NAMES) invariant(typeof config[name] === 'string' && !/[\s'"`$\\\x00-\x1f]/.test(config[name]), `Buildconfiguratie: ${name} ontbreekt of bevat onveilige tekens.`);
  invariant(['local', 'supabase'].includes(config.FABELPAD_DATA_MODE), 'Buildconfiguratie: FABELPAD_DATA_MODE moet local of supabase zijn.');
  for (const name of ['FABELPAD_APP_ORIGIN', ...(config.FABELPAD_DATA_MODE === 'supabase' ? ['NEXT_PUBLIC_SUPABASE_URL'] : [])]) {
    let origin;
    try { origin = new URL(config[name]); } catch { throw new Error(`Buildconfiguratie: ${name} is geen geldige HTTPS-origin.`); }
    invariant(origin.protocol === 'https:' && !origin.username && !origin.password && !origin.search && !origin.hash
      && ['', '/'].includes(origin.pathname), `Buildconfiguratie: ${name} is geen geldige HTTPS-origin.`);
  }
  if (config.FABELPAD_DATA_MODE === 'supabase') invariant(/^sb_publishable_[A-Za-z0-9_-]{7,}$/.test(config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY), 'Buildconfiguratie: publishable key ontbreekt of heeft een ongeldig type.');
  else invariant(config.NEXT_PUBLIC_SUPABASE_URL === '' && config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY === '', 'Buildconfiguratie: local vereist beide Supabase-waarden leeg.');
  return config;
}

export function configurationDigest(config) {
  return createHash('sha256').update(JSON.stringify(Object.fromEntries(Object.entries(config).sort(([a], [b]) => a.localeCompare(b))))).digest('hex');
}

export function readBuildConfig(profile, configId) {
  invariant(ID.test(configId), 'Ongeldige configuratie-identificatie.');
  const file = `${profile.configRoot}/build-configs/${configId}.env`;
  assertRootPath(file, { privateFile: true });
  const config = validatePublicConfig(parseEnv(readFileSync(file, 'utf8')));
  return { config, digest: configurationDigest(config), file };
}

export function validateRuntimePair(profile, manifest, text) {
  const config = parseEnv(text, RUNTIME_CONFIG_NAMES);
  const publicConfig = Object.fromEntries([...PUBLIC_CONFIG_NAMES].map(name => [name, config[name]]));
  validatePublicConfig(publicConfig);
  invariant(configurationDigest(publicConfig) === manifest.buildConfigDigest, 'Runtimeconfiguratie past niet bij de ingebakken buildconfiguratie.');
  invariant(config.FABELPAD_DEPLOY_ENV === 'staging' && config.FABELPAD_RELEASE_SHA === manifest.sha
    && config.PORT === String(profile.port), 'Runtimeconfiguratie: omgeving, SHA of poort wijkt af.');
  for (const name of ['FABELPAD_AUTH_EMAIL_ENABLED', 'FABELPAD_AUTH_GOOGLE_ENABLED']) invariant(config[name] === undefined || ['true', 'false'].includes(config[name]), 'Ongeldige host-authinstelling.');
  return config;
}

export function candidateId(sha, runId, attempt) {
  invariant(SHA.test(sha) && /^[1-9][0-9]{0,19}$/.test(runId) && /^[1-9][0-9]{0,5}$/.test(attempt), 'Ongeldige SHA of workflowrun-identificatie.');
  return `${sha}-${runId}-${attempt}`;
}

// Hash a whole candidate, including package symlinks, with stable names and no
// excluded runtime files. Links may only resolve inside this candidate. This
// digest is rechecked after copying to an immutable release, closing a mutation
// between validation and copying without following attacker-controlled links.
export function treeDigest(root) {
  invariant(lstatSync(root).isDirectory() && !lstatSync(root).isSymbolicLink(), 'Artefactroot moet een echte map zijn.');
  const canonicalRoot = realpathSync(root);
  const hash = createHash('sha256');
  const visit = (directory) => {
    for (const name of readdirSync(directory).sort()) {
      const file = path.join(directory, name);
      const relative = path.relative(root, file);
      const metadata = lstatSync(file);
      invariant(!metadata.isSocket() && !metadata.isFIFO() && !metadata.isBlockDevice() && !metadata.isCharacterDevice(), 'Artefact bevat een speciaal bestand.');
      if (metadata.isSymbolicLink()) {
        const link = readlinkSync(file);
        invariant(!path.isAbsolute(link) && below(canonicalRoot, realpathSync(file)), 'Artefact bevat een externe of ongeldige symlink.');
        hash.update(`L\0${relative}\0${link}\0`);
      } else if (metadata.isDirectory()) {
        hash.update(`D\0${relative}\0`);
        visit(file);
      } else {
        invariant(metadata.isFile() && metadata.nlink === 1 && !(metadata.mode & 0o6000), 'Artefact bevat een hardlink of geprivilegieerd bestand.');
        hash.update(`F\0${relative}\0${metadata.size}\0`);
        hash.update(readFileSync(file));
      }
    }
  };
  visit(root);
  return hash.digest('hex');
}

export function validateManifest(profile, manifest, id) {
  invariant(manifest.version === 1 && manifest.siteId === profile.siteId && manifest.repository === REPOSITORY
    && manifest.branch === BRANCH && manifest.environment === 'staging' && manifest.hostname === HOSTNAME
    && manifest.machineId === MACHINE_ID, 'Kandidaatmanifest: verkeerde identiteit.');
  invariant(candidateId(manifest.sha, manifest.runId, manifest.runAttempt) === id && manifest.id === id, 'Kandidaatmanifest: release-identificatie wijkt af.');
  invariant(ID.test(manifest.configId) && /^[a-f0-9]{64}$/.test(manifest.buildConfigDigest)
    && /^[a-f0-9]{64}$/.test(manifest.artifactDigest) && /^[a-f0-9]{64}$/.test(manifest.lockfileDigest), 'Kandidaatmanifest: ontbrekende configuratie- of artefactbinding.');
  for (const name of ['ciRunId', 'ciRunAttempt', 'ciJobId']) invariant(/^[1-9][0-9]{0,19}$/.test(String(manifest[name])), `Kandidaatmanifest: ${name} ontbreekt.`);
  invariant(manifest.nodeVersion === profile.nodeVersion && manifest.pnpmVersion === profile.pnpmVersion
    && manifest.buildCommand === 'pnpm build' && manifest.startCommand === 'pnpm start', 'Kandidaatmanifest: toolchain of opdracht wijkt af.');
  invariant(SHA.test(manifest.workflowSha) && Number.isSafeInteger(manifest.workflowJobId) && manifest.workflowJobId > 0, 'Kandidaatmanifest: geverifieerde workflowcode/job ontbreekt.');
  invariant(Array.isArray(manifest.ciChecks) && manifest.ciChecks.length === 2, 'Kandidaatmanifest: beide vereiste CI-bewijzen ontbreken.');
  for (const [index, workflow] of ['verify.yml', 'fabelpad-android-ci.yml'].entries()) {
    const proof = manifest.ciChecks[index];
    invariant(proof?.workflow === workflow && ['workflowId','runId','runAttempt','jobId'].every(name => Number.isSafeInteger(proof[name]) && proof[name] > 0), 'Kandidaatmanifest: ongeldig CI-bewijs.');
  }
  invariant(String(manifest.ciChecks[0].runId) === String(manifest.ciRunId) && String(manifest.ciChecks[0].runAttempt) === String(manifest.ciRunAttempt) && String(manifest.ciChecks[0].jobId) === String(manifest.ciJobId), 'Kandidaatmanifest: primaire CI-binding wijkt af.');
  return manifest;
}

export function validateCurrentTarget(profile, target) {
  const releaseRoot = `${profile.siteRoot}/releases`;
  const absolute = path.resolve(profile.siteRoot, target);
  invariant(below(releaseRoot, absolute) && path.dirname(absolute) === releaseRoot
    && /^[a-f0-9]{40}-[1-9][0-9]{0,19}-[1-9][0-9]{0,5}$/.test(path.basename(absolute)), 'Current/previous wijst buiten de eigen releases.');
  return absolute;
}

export function validateArchiveEntries(listing) {
  const entries = listing.split('\n').filter(Boolean);
  invariant(entries.length > 0, 'GitHub-bronarchief is leeg.');
  let prefix;
  for (const entry of entries) {
    invariant(!entry.startsWith('/') && !entry.includes('\\') && !/[\x00-\x1f]/.test(entry), 'Bronarchief bevat een onveilig pad.');
    const parts = entry.replace(/\/$/, '').split('/');
    invariant(parts.every(part => part && part !== '.' && part !== '..'), 'Bronarchief bevat een ontsnappend pad.');
    invariant(/^fabelpad-platform-[a-f0-9]{7,40}$/.test(parts[0]), 'Bronarchief heeft een onverwachte repositoryprefix.');
    prefix ??= parts[0];
    invariant(parts[0] === prefix, 'Bronarchief bevat meerdere roots.');
  }
  return prefix;
}

export async function downloadSourceArchive(sha, token, request = fetch) {
  invariant(SHA.test(sha) && typeof token === 'string' && token.length > 0, 'Bronarchief vereist een volledige SHA en een leestoken.');
  const response = await request(`https://api.github.com/repos/${REPOSITORY}/tarball/${sha}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    redirect: 'manual', signal: AbortSignal.timeout(30000),
  });
  invariant(response.status === 302, 'GitHub heeft geen geverifieerde bronarchiefredirect geleverd.');
  let destination;
  try { destination = new URL(response.headers.get('location')); } catch { throw new Error('GitHub-bronarchiefredirect ontbreekt.'); }
  invariant(destination.protocol === 'https:' && destination.hostname === 'codeload.github.com'
    && !destination.username && !destination.password && !destination.port && !destination.hash
    && (destination.search === '' || (destination.searchParams.size === 1
      && destination.searchParams.has('token') && destination.searchParams.get('token').length > 0))
    && [`/fabelpad/platform/legacy.tar.gz/${sha}`, `/fabelpad/platform/tar.gz/${sha}`].includes(destination.pathname), 'GitHub-bronarchiefredirect wijkt af van de vaste repository/SHA.');
  // Deliberately omit Authorization on the cross-origin codeload request. The
  // short-lived token never enters the worker environment or archive stream.
  const archive = await request(destination.href, { redirect: 'error', signal: AbortSignal.timeout(120000) });
  invariant(archive.status === 200 && archive.body, 'GitHub-bronarchief kon niet worden gelezen.');
  const limit = 256 * 1024 ** 2;
  invariant(Number(archive.headers.get('content-length') ?? 0) < limit, 'Bronarchief overschrijdt de limiet.');
  const chunks = [];
  let size = 0;
  for await (const chunk of archive.body) {
    size += chunk.length;
    invariant(size < limit, 'Bronarchief overschrijdt de limiet.');
    chunks.push(Buffer.from(chunk));
  }
  invariant(size > 0, 'GitHub-bronarchief is leeg.');
  return Buffer.concat(chunks);
}

export async function switchWithRecovery({ current, next, switchTo, restart, check, stop, clear, committed }) {
  let switched = false;
  try {
    await switchTo(next);
    switched = true;
    await restart();
    await check(next);
    await committed();
  } catch (error) {
    if (switched) {
      if (current) {
        await switchTo(current);
        await restart();
        await check(current);
      } else {
        await stop();
        await clear();
      }
    }
    throw error;
  }
}

export function assertSharedLock(file) {
  // /var/lock is a host-owned symlink to /run/lock on this verified host.
  const actual = realpathSync(file);
  invariant(actual === '/run/lock/dg-build.lock', 'Afwijkend gedeeld build-lock.');
  const metadata = lstatSync(actual);
  invariant(metadata.isFile() && metadata.nlink === 1 && metadata.uid === 0 && !(metadata.mode & 0o007), 'Gedeeld build-lock is onveilig.');
  return actual;
}

export const ROOT_NOFOLLOW = constants.O_NOFOLLOW;
