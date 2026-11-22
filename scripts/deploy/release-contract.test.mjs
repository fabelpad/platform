import assert from 'node:assert/strict';
import { chmodSync, linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { candidateId, configurationDigest, downloadSourceArchive, MACHINE_ID, parseArgs, parseEnv, switchWithRecovery, treeDigest, validateArchiveEntries, validateCurrentTarget, validateManifest, validateProfile, validatePublicConfig, validateRuntimePair, validateEmailReadiness, installedTarget } from './release-contract.mjs';
import { cleanEnvironment, readCredential } from './host-runtime.mjs';

const sha = 'a'.repeat(40);
const profile = {
  version: 1, repository: 'fabelpad/platform', branch: 'main', hostname: 'dg-vps-08', machineId: MACHINE_ID,
  siteId: 'fabelpad-vps08-staging', environment: 'staging', port: 4188,
  runner: { user: 'run-fab-v08-stg', uid: 1001, gid: 1001 },
  build: { user: 'build-fab-v08-stg', uid: 1002, gid: 1002 },
  app: { user: 'app-fab-v08-stg', uid: 1003, gid: 1003 },
  siteRoot: '/srv/sites/fabelpad-vps08-staging', configRoot: '/etc/dg-webservices/fabelpad-vps08-staging',
  buildRoot: '/var/lib/dg-build/fabelpad-vps08-staging', sourceWorkspace: '/opt/actions-runner/fabelpad-vps08-staging/_work/platform/platform',
  installRoot: '/usr/local/libexec/fabelpad-vps08-staging', node: '/opt/dg-toolchains/fabelpad-vps08-staging/node-v24.18.0-linux-x64/bin/node',
  pnpm: '/opt/dg-toolchains/fabelpad-vps08-staging/pnpm/11.25.0/lib/node_modules/pnpm/bin/pnpm.mjs',
  toolchainPath: '/opt/dg-toolchains/fabelpad-vps08-staging/node-v24.18.0-linux-x64/bin:/opt/dg-toolchains/fabelpad-vps08-staging/pnpm/11.25.0/bin:/usr/bin:/bin',
  buildHome: '/var/lib/dg-build/fabelpad-vps08-staging/home', sharedBuildLock: '/run/lock/dg-build.lock',
  activationLock: '/etc/dg-webservices/fabelpad-vps08-staging/activation.lock',
  service: 'fabelpad-vps08-staging.service', nodeVersion: '24.18.0', pnpmVersion: '11.25.0',
  minimumFreeBytes: 4 * 1024 ** 3, minimumFreeInodes: 50000,
};
const config = {
  FABELPAD_APP_ORIGIN: 'https://new-staging.example.test', FABELPAD_DATA_MODE: 'supabase', NEXT_PUBLIC_SUPABASE_URL: 'https://new-project.example.test',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture_public_only',
};
const manifest = {
  version: 1, id: candidateId(sha, '12', '1'), sha, runId: '12', runAttempt: '1', workflowSha: 'e'.repeat(40), workflowJobId: 22,
  siteId: profile.siteId, repository: profile.repository, branch: profile.branch, environment: 'staging',
  hostname: profile.hostname, machineId: profile.machineId, configId: 'fixture-config',
  buildConfigDigest: configurationDigest(config), artifactDigest: 'c'.repeat(64), lockfileDigest: 'd'.repeat(64),
  ciRunId: '10', ciRunAttempt: '1', ciJobId: '11', ciChecks: [{workflow:'verify.yml',workflowId:1,runId:10,runAttempt:1,jobId:11},{workflow:'fabelpad-android-ci.yml',workflowId:2,runId:20,runAttempt:1,jobId:21}], nodeVersion: '24.18.0', pnpmVersion: '11.25.0',
  buildCommand: 'pnpm build', startCommand: 'pnpm start',
};

function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'fabelpad-release-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

test('profile accepts only distinct accounts, verified host and the new target namespace', () => {
  assert.equal(validateProfile(profile), profile);
  for (const change of [
    { repository: 'other/platform' }, { branch: 'develop' }, { hostname: 'other' }, { machineId: '0'.repeat(32) },
    { environment: 'production' }, { siteId: 'fabelpad-staging' }, { build: profile.runner },
    { siteRoot: '/srv/sites/fabelpad-staging' }, { service: 'milobingo-staging.service' },
    { activationLock: '/tmp/lock' }, { sharedBuildLock: '/tmp/shared' }, { minimumFreeBytes: 1 },
    { configRoot: '/etc/dg-webservices/fabelpad-vps08-staging/../existing' }, { nodeVersion: '24.17.0' },
  ]) assert.throws(() => validateProfile({ ...profile, ...change }));
});

test('arguments and candidate IDs reject duplicate, path, abbreviated SHA and shell inputs', () => {
  assert.deepEqual(parseArgs(['--sha', sha], ['sha']), { sha });
  for (const args of [['--sha'], ['--sha', sha, '--sha', sha], ['--other', sha], ['--sha', '--other']]) assert.throws(() => parseArgs(args, ['sha']));
  for (const args of [['a'.repeat(7), '12', '1'], [sha, '../12', '1'], [sha, '12', '0'], [sha, '12;touch', '1']]) assert.throws(() => candidateId(...args));
});

test('build allowlist rejects secrets, expansion and shell syntax without printing values', () => {
  const env = Object.entries(config).map(([key, value]) => `${key}=${value}`).join('\n');
  assert.deepEqual(validatePublicConfig(parseEnv(env)), config);
  for (const extra of ['SERVICE_ROLE_KEY=secretvalue', 'NEXT_PUBLIC_SECRET=secretvalue', 'FABELPAD_APP_ORIGIN=$(touch-owned)', 'FABELPAD_APP_ORIGIN="https://example.test"', 'FABELPAD_APP_ORIGIN=https://example.test\nFABELPAD_APP_ORIGIN=https://second.test']) {
    assert.throws(() => parseEnv(extra), error => !error.message.includes('secretvalue'));
  }
  assert.throws(() => validatePublicConfig({ ...config, FABELPAD_APP_ORIGIN: 'https://user:secretvalue@example.test' }), error => !error.message.includes('secretvalue'));
  assert.throws(() => validatePublicConfig({ ...config, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_fixture' }));
});

test('build digest is stable and runtime configuration is bound to public values, SHA and port', () => {
  assert.equal(configurationDigest(config), configurationDigest(Object.fromEntries(Object.entries(config).reverse())));
  const runtime = { ...config, FABELPAD_DEPLOY_ENV: 'staging', FABELPAD_RELEASE_SHA: sha, PORT: '4188' };
  const serialize = value => Object.entries(value).map(([name, value]) => `${name}=${value}`).join('\n');
  assert.deepEqual(validateRuntimePair(profile, manifest, serialize(runtime)), runtime);
  for (const change of [{ FABELPAD_APP_ORIGIN: 'https://other.test' }, { FABELPAD_RELEASE_SHA: 'b'.repeat(40) }, { FABELPAD_DEPLOY_ENV: 'production' }, { PORT: '4173' }, { FABELPAD_DATA_MODE: 'local' }]) {
    assert.throws(() => validateRuntimePair(profile, manifest, serialize({ ...runtime, ...change })));
  }
});

test('manifest and current/previous references cannot cross repositories, config IDs or release directories', () => {
  assert.equal(validateManifest(profile, manifest, manifest.id), manifest);
  for (const change of [{ sha: 'b'.repeat(40) }, { configId: '../other' }, { ciJobId: null }, { artifactDigest: '' }, { repository: 'other/platform' }, { nodeVersion: '25.0.0' }]) assert.throws(() => validateManifest(profile, { ...manifest, ...change }, manifest.id));
  assert.equal(validateCurrentTarget(profile, `releases/${manifest.id}`), `${profile.siteRoot}/releases/${manifest.id}`);
  for (const target of ['/srv/sites/milobingo-staging/releases/id', '../../elsewhere', `releases/${manifest.id}/artifact`, `releases/../${manifest.id}`]) assert.throws(() => validateCurrentTarget(profile, target));
});

test('tree digest binds file contents and internal symlinks while refusing external links and hardlinks', t => {
  const root = fixture(t);
  mkdirSync(`${root}/node_modules`);
  writeFileSync(`${root}/node_modules/package.txt`, 'original');
  symlinkSync('package.txt', `${root}/node_modules/link`);
  const first = treeDigest(root);
  writeFileSync(`${root}/node_modules/package.txt`, 'changed');
  assert.notEqual(treeDigest(root), first);
  symlinkSync('/etc/passwd', `${root}/escape`);
  assert.throws(() => treeDigest(root));
  rmSync(`${root}/escape`);
  linkSync(`${root}/node_modules/package.txt`, `${root}/hardlink`);
  assert.throws(() => treeDigest(root));
});

test('tree digest refuses dangling links, devices/FIFOs and privileged files', t => {
  const root = fixture(t);
  symlinkSync('missing', `${root}/dangling`);
  assert.throws(() => treeDigest(root));
  rmSync(`${root}/dangling`);
  execFileSync('/usr/bin/mkfifo', [`${root}/pipe`]);
  assert.throws(() => treeDigest(root));
  rmSync(`${root}/pipe`);
  writeFileSync(`${root}/program`, 'fixture');
  chmodSync(`${root}/program`, 0o4750);
  assert.throws(() => treeDigest(root));
});

test('GitHub archive rejects path escapes, multiple roots and other repositories', () => {
  assert.equal(validateArchiveEntries('fabelpad-platform-abcdef0/\nfabelpad-platform-abcdef0/package.json\n'), 'fabelpad-platform-abcdef0');
  for (const text of ['', '/etc/passwd', 'other-platform-abcdef0/file', 'fabelpad-platform-abcdef0/../secret', 'fabelpad-platform-abcdef0/file\nfabelpad-platform-abcdef1/file']) assert.throws(() => validateArchiveEntries(text));
});

test('private source download accepts only exact SHA codeload redirects and never forwards bearer', async () => {
  const calls = [];
  const archive = await downloadSourceArchive(sha, 'fixture-credential', async (url, options) => {
    calls.push({ url, options });
    if (calls.length === 1) return new Response(null, { status: 302, headers: { location: `https://codeload.github.com/fabelpad/platform/legacy.tar.gz/${sha}?token=temporary-fixture` } });
    return new Response('fixture-archive');
  });
  assert.equal(archive.toString(), 'fixture-archive');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer fixture-credential');
  assert.equal(calls[1].options.headers, undefined);
  assert.equal(calls[1].options.redirect, 'error');
  for (const destination of [`https://evil.test/fabelpad/platform/legacy.tar.gz/${sha}`, `https://codeload.github.com/other/platform/legacy.tar.gz/${sha}`, `https://codeload.github.com/fabelpad/platform/legacy.tar.gz/${'b'.repeat(40)}`, `https://codeload.github.com/fabelpad/platform/legacy.tar.gz/${sha}?token=a&extra=b`, `https://codeload.github.com/fabelpad/platform/legacy.tar.gz/${sha}?token=a&token=b`]) {
    await assert.rejects(() => downloadSourceArchive(sha, 'fixture', async () => new Response(null, { status: 302, headers: { location: destination } })));
  }
});

test('credentials stay out of build environment and stdin parsing is bounded', async () => {
  const env = cleanEnvironment(profile, { build: true });
  assert.equal(env.GH_TOKEN, undefined);
  assert.equal(env.GITHUB_TOKEN, undefined);
  assert.equal(env.SUDO_USER, undefined);
  assert.equal(env.HOME, profile.buildHome);
  async function* stream(text) { yield text; }
  assert.equal(await readCredential(stream('{"githubToken":"fixture"}')), 'fixture');
  for (const text of ['not-json', '{"githubToken":"fixture","unexpected":"value"}', 'x'.repeat(17000)]) await assert.rejects(() => readCredential(stream(text)));
});

test('failed activation restores the prior app/config bundle and checks it before reporting failure', async () => {
  const events = [];
  await assert.rejects(() => switchWithRecovery({
    current: 'healthy-old', next: 'new', switchTo: value => events.push(`switch:${value}`), restart: () => events.push('restart'),
    check: value => { events.push(`check:${value}`); if (value === 'new') throw new Error('fixture failed'); },
    committed: () => events.push('commit'),
  }), /fixture failed/);
  assert.deepEqual(events, ['switch:new', 'restart', 'check:new', 'switch:healthy-old', 'restart', 'check:healthy-old']);
});

test('failed first installation stops only its own app and removes its own current reference', async () => {
  const events = [];
  await assert.rejects(() => switchWithRecovery({
    current: null, next: 'new', switchTo: value => events.push(`switch:${value}`), restart: () => { throw new Error('fixture failed'); },
    check: () => {}, stop: () => events.push('stop'), clear: () => events.push('clear'), committed: () => events.push('commit'),
  }));
  assert.deepEqual(events, ['switch:new', 'stop', 'clear']);
});

test('successful activation records previous only after health; failed pointer change does not restart anything', async () => {
  const events = [];
  await switchWithRecovery({ current: 'old', next: 'new', switchTo: () => events.push('switch'), restart: () => events.push('restart'), check: () => events.push('health'), committed: () => events.push('previous') });
  assert.deepEqual(events, ['switch', 'restart', 'health', 'previous']);
  await assert.rejects(() => switchWithRecovery({ current: 'old', next: 'new', switchTo: () => { throw new Error('no pointer'); }, restart: () => assert.fail('unexpected restart') }));
});

test('descriptor-based sealing handles package symlinks, rejects hardlinks/FIFO, and never follows source symlinks', t => {
  const root = fixture(t);
  const helper = path.resolve('scripts/deploy/seal-artifact.py');
  execFileSync('/usr/bin/python3', ['-c', `
import importlib.util, os, pathlib, stat, sys
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('seal', ${JSON.stringify(helper)})
seal = importlib.util.module_from_spec(spec); spec.loader.exec_module(seal)
root = pathlib.Path(${JSON.stringify(root)})
source = root / 'source'; source.mkdir(); (source / 'package').mkdir(); (source / 'package' / 'file').write_text('fixture')
(source / 'link').symlink_to('package/file')
seal.copy_artifact(str(source), str(root / 'sealed'), os.getuid(), os.getgid(), os.getuid())
assert (root / 'sealed' / 'link').read_text() == 'fixture'
assert stat.S_IMODE((root / 'sealed' / 'package' / 'file').stat().st_mode) == 0o640
os.link(source / 'package' / 'file', source / 'hardlink')
try: seal.copy_artifact(str(source), str(root / 'hardlink-copy'), os.getuid(), os.getgid(), os.getuid())
except ValueError: pass
else: raise AssertionError('hardlink accepted')
(source / 'hardlink').unlink(); (source / 'external').symlink_to('/etc/passwd')
try: seal.copy_artifact(str(source), str(root / 'external-copy'), os.getuid(), os.getgid(), os.getuid())
except ValueError: pass
else: raise AssertionError('external symlink accepted')
(source / 'external').unlink(); os.mkfifo(source / 'fifo')
try: seal.copy_artifact(str(source), str(root / 'fifo-copy'), os.getuid(), os.getgid(), os.getuid())
except ValueError: pass
else: raise AssertionError('fifo accepted')
`], { stdio: ['ignore', 'pipe', 'pipe'] });
});

test('bounded supervisor holds the flock through timeout cleanup and kills a forked grandchild', t => {
  const root = fixture(t);
  const helper = path.resolve('scripts/deploy/bounded-operation.py');
  execFileSync('/usr/bin/python3', ['-c', `
import importlib.util, os, pathlib, signal, stat, subprocess, sys, time
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('bounded', ${JSON.stringify(helper)})
bounded = importlib.util.module_from_spec(spec); spec.loader.exec_module(bounded)
root = pathlib.Path(${JSON.stringify(root)}); lock = root / 'lock'; lock.touch(mode=0o600)
grandchild = "import os,signal,subprocess,time; signal.signal(signal.SIGTERM, signal.SIG_IGN); open(" + repr(str(root / 'grandchild')) + ",'w').write(str(os.getpid())); time.sleep(0.25); status=subprocess.run(['/usr/bin/flock','-n'," + repr(str(lock)) + ",'/usr/bin/true']).returncode; open(" + repr(str(root / 'lock-status')) + ",'w').write(str(status)); time.sleep(60)"
parent = "import subprocess,sys,time; subprocess.Popen([sys.executable,'-c'," + repr(grandchild) + "]); time.sleep(60)"
start = time.monotonic()
result = bounded.run_locked(str(lock), 0.2, [sys.executable, '-c', parent], expected_uid=os.getuid(), grace_seconds=0.3)
assert result == 124 and time.monotonic() - start < 3
assert (root / 'lock-status').read_text() == '1', 'flock released during cleanup'
pid = int((root / 'grandchild').read_text())
try:
    state = pathlib.Path('/proc') / str(pid) / 'stat'
    assert not state.exists() or state.read_text().split()[2] == 'Z'
finally:
    try: os.kill(pid, signal.SIGKILL)
    except ProcessLookupError: pass
assert bounded.run_locked(str(lock), 2, [sys.executable, '-c', 'pass'], expected_uid=os.getuid(), grace_seconds=0.1) == 0
`], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 5000 });
});

test('local mode explicitly has no Supabase values; partial cloud configuration never silently becomes local', () => {
  const local = {...config,FABELPAD_DATA_MODE:'local',NEXT_PUBLIC_SUPABASE_URL:'',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:''};
  assert.equal(validatePublicConfig(local),local);
  for (const change of [{FABELPAD_DATA_MODE:'unknown'},{NEXT_PUBLIC_SUPABASE_URL:config.NEXT_PUBLIC_SUPABASE_URL},{NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY},{EXTRA:'value'}]) assert.throws(()=>validatePublicConfig({...local,...change}));
  assert.throws(()=>validatePublicConfig({...config,NEXT_PUBLIC_SUPABASE_URL:''}));
});


test('production identity is separate and staging paths, accounts or manifests cannot cross it', () => {
  const production = JSON.parse(JSON.stringify(profile).replaceAll('staging','production').replaceAll('-v08-stg','-v08-prd'));
  production.port = 4189;
  assert.equal(validateProfile(production), production);
  assert.deepEqual(installedTarget(production.installRoot), {environment:'production',siteId:'fabelpad-vps08-production',port:4189,suffix:'prd'});
  for (const change of [{port:4188},{runner:profile.runner},{configRoot:profile.configRoot},{buildRoot:profile.buildRoot},{sourceWorkspace:profile.sourceWorkspace},{node:profile.node}]) {
    assert.throws(() => validateProfile({...production,...change}));
  }
  assert.throws(() => installedTarget('/tmp/fabelpad-vps08-production'));
  assert.throws(() => validateManifest(production, manifest, manifest.id));
});

test('OTP is enabled only after a receipt for the same environment, project and origin with a verified Resend hook', () => {
  const receipt = {version:1,environment:'staging',siteId:profile.siteId,provider:'resend',emailOtpVerified:true,sendEmailHookVerified:true,
    appOrigin:config.FABELPAD_APP_ORIGIN,supabaseUrl:config.NEXT_PUBLIC_SUPABASE_URL,verifiedAt:'2026-11-22T12:00:00Z'};
  assert.equal(validateEmailReadiness(profile,config,receipt),receipt);
  for (const change of [{environment:'production'},{siteId:'fabelpad-vps08-production'},{provider:'smtp'},{emailOtpVerified:false},{sendEmailHookVerified:false},
    {appOrigin:'https://other.example.test'},{supabaseUrl:'https://other.example.test'},{verifiedAt:''}]) assert.throws(() => validateEmailReadiness(profile,config,{...receipt,...change}));
  assert.throws(() => validateEmailReadiness(profile,{...config,FABELPAD_DATA_MODE:'local'},receipt));
});
