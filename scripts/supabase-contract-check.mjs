import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { compileSource } from './source-test-loader.mjs';
const temp = await mkdtemp(join(tmpdir(), 'fabelpad-supabase-contract-'));
const original = { ...process.env };
try {
  const root = new URL('../', import.meta.url);
  const configuration = await import(await compileSource(new URL('lib/supabase/config.ts', root), temp));
  const { GET: health } = await import(await compileSource(new URL('app/api/health/route.ts', root), temp));
  const { validateProjectConfiguration } = await import(await compileSource(new URL('lib/projectConfiguration.ts', root), temp));
  const { safeNext, readJson, checkMutationOrigin, handleApiError, RequestError } = await import(await compileSource(new URL('lib/server/http.ts', root), temp));
  const { buildStoryRelease, validateServerDraft } = await import(await compileSource(new URL('lib/server/contentRelease.ts', root), temp));
  const { canonicalContentJson } = await import(await compileSource(new URL('lib/contentHash.ts', root), temp));
  const { localRelease } = await import(await compileSource(new URL('src/contentClient.ts', root), temp));
  const { validateFamilySnapshot } = await import(await compileSource(new URL('lib/familyValidation.ts', root), temp));
  for (const name of Object.keys(process.env)) if (/^(NEXT_PUBLIC_|FABELPAD_|APP_URL$)/u.test(name)) delete process.env[name];
  assert.equal(configuration.getSupabaseConfig(), null);
  assert.deepEqual(configuration.getBackendStatus().providers, { email: false, google: false });
  const unavailable = handleApiError(new configuration.BackendConfigurationError());
  assert.equal(unavailable.status, 503); assert.equal((await unavailable.json()).error, 'backend_not_configured');
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.example.test';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test_only';
  assert.throws(() => configuration.getSupabaseConfig(), configuration.BackendConfigurationError, 'Public values alone must not silently enable cloud mode');
  process.env.FABELPAD_DATA_MODE = 'supabase';
  process.env.FABELPAD_APP_ORIGIN = 'https://fabelpad.example.test';
  assert.ok(configuration.getSupabaseConfig());
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_secret_must_never_be_accepted';
  assert.throws(() => configuration.getSupabaseConfig(), configuration.BackendConfigurationError);
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test_only';
  process.env.FABELPAD_APP_ORIGIN = 'http://public.example.test'; assert.throws(() => configuration.getSupabaseConfig(), configuration.BackendConfigurationError);
  process.env.FABELPAD_APP_ORIGIN = 'https://fabelpad.example.test';
  const cloud = {
    FABELPAD_APP_ORIGIN: 'https://fabelpad.example.test', FABELPAD_DATA_MODE: 'supabase',
    NEXT_PUBLIC_SUPABASE_URL: 'https://project.example.test', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_only',
    FABELPAD_RELEASE_SHA: '1'.repeat(40), FABELPAD_DEPLOY_ENV: 'staging',
  };
  const healthWith = async environment => {
    const before = { ...process.env }, fetchBefore = globalThis.fetch;
    let networkAttempts = 0;
    try {
      for (const name of Object.keys(process.env)) if (/^(NEXT_PUBLIC_|FABELPAD_|APP_URL$)/u.test(name)) delete process.env[name];
      Object.assign(process.env, environment);
      globalThis.fetch = async () => { networkAttempts++; throw new Error('Health must not contact a backend'); };
      const response = await health();
      assert.equal(networkAttempts, 0, 'Health checks configuration, without claiming or testing database readiness');
      assert.equal(response.headers.get('cache-control'), 'no-store');
      return { status: response.status, body: await response.json() };
    } finally {
      globalThis.fetch = fetchBefore;
      for (const name of Object.keys(process.env)) if (!(name in before)) delete process.env[name];
      Object.assign(process.env, before);
    }
  };
  const localHealth = await healthWith({ FABELPAD_DATA_MODE: 'local' });
  assert.equal(localHealth.status, 200);
  assert.deepEqual(localHealth.body, { ok: true, service: 'fabelpad', runtime: 'nextjs-node', environment: 'local', revision: null, backend: 'not-configured', scope: 'process-liveness-only' });
  const cloudHealth = await healthWith(cloud);
  assert.equal(cloudHealth.status, 200);
  assert.equal(cloudHealth.body.backend, 'configured-unverified');
  assert.equal(cloudHealth.body.environment, 'staging');
  assert.equal(cloudHealth.body.revision, cloud.FABELPAD_RELEASE_SHA);
  assert.equal(cloudHealth.body.scope, 'process-liveness-only');
  const invalidHealth = await healthWith({ ...cloud, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_private-health-sentinel' });
  assert.equal(invalidHealth.status, 503);
  assert.equal(invalidHealth.body.ok, false);
  assert.equal(invalidHealth.body.backend, 'configuration-invalid');
  assert.equal(invalidHealth.body.error, 'backend_not_configured');
  assert.equal(invalidHealth.body.environment, 'staging');
  assert.equal(invalidHealth.body.revision, cloud.FABELPAD_RELEASE_SHA);
  assert.equal(invalidHealth.body.scope, 'process-liveness-only');
  assert.equal(JSON.stringify(invalidHealth.body).includes('private-health-sentinel'), false);
  for (const name of ['FABELPAD_APP_ORIGIN', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY']) {
    assert.equal((await healthWith({ ...cloud, [name]: '' })).status, 503);
  }
  const malformedMetadataHealth = await healthWith({ ...cloud, FABELPAD_DEPLOY_ENV: 'private-environment-sentinel', FABELPAD_RELEASE_SHA: 'private-revision-sentinel' });
  assert.equal(malformedMetadataHealth.status, 503);
  assert.equal(malformedMetadataHealth.body.environment, 'unknown');
  assert.equal(malformedMetadataHealth.body.revision, null);
  assert.equal(JSON.stringify(malformedMetadataHealth.body).includes('private-'), false);
  const validate = env => validateProjectConfiguration(env, { requireReleaseIdentity: true });
  assert.equal(validate(cloud).ok, true);
  assert.equal(validate({ ...cloud, FABELPAD_DATA_MODE: '' }).ok, false, 'A hosted target must choose its data mode explicitly');
  for (const missing of ['FABELPAD_APP_ORIGIN', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'FABELPAD_RELEASE_SHA']) {
    assert.equal(validate({ ...cloud, [missing]: '' }).ok, false, `${missing} must not be silently defaulted on a cloud target`);
  }
  for (const origin of ['http://public.example.test', 'http://localhost:3000', 'https://user:pass@example.test', 'https://example.test/path', 'https://example.test?token=private-value', 'https://example.test#fragment']) {
    assert.equal(validate({ ...cloud, FABELPAD_APP_ORIGIN: origin }).ok, false);
    assert.equal(validate({ ...cloud, NEXT_PUBLIC_SUPABASE_URL: origin }).ok, false);
  }
  for (const key of ['sb_secret_private-value', 'eyJhbGciOiJIUzI1NiJ9.private-value', 'sb_publishable_ short']) {
    const invalid = validate({ ...cloud, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key });
    assert.equal(invalid.ok, false);
    assert.equal(JSON.stringify(invalid).includes(key), false, 'Errors must not disclose rejected key values');
  }
  assert.equal(validate({ ...cloud, APP_URL: cloud.FABELPAD_APP_ORIGIN }).ok, false, 'Deprecated APP_URL must not override the canonical origin');
  assert.equal(validate({ ...cloud, NEXT_PUBLIC_SERVER_SECRET: 'private-value' }).ok, false);
  assert.equal(validate({ ...cloud, FABELPAD_AUTH_GOOGLE_ENABLED: 'yes' }).ok, false);
  assert.equal(validate({ ...cloud, FABELPAD_RELEASE_SHA: 'short' }).ok, false);
  const local = { FABELPAD_DATA_MODE: 'local', FABELPAD_APP_ORIGIN: 'http://127.0.0.1:3000' };
  assert.equal(validate(local).ok, true);
  assert.equal(validate({ ...local, NEXT_PUBLIC_SUPABASE_URL: cloud.NEXT_PUBLIC_SUPABASE_URL }).ok, false, 'A local configuration cannot accidentally target an existing backend');
  assert.equal(validate({ ...local, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: cloud.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY }).ok, false);
  assert.equal(validate({ ...local, FABELPAD_AUTH_EMAIL_ENABLED: 'true' }).ok, false);
  assert.equal(validate({ ...cloud, FABELPAD_DEPLOY_ENV: 'local', FABELPAD_APP_ORIGIN: 'http://localhost:3000', NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321' }).ok, true, 'An explicitly configured isolated local Supabase remains possible');
  const command = (...args) => spawnSync(process.execPath, [new URL('scripts/config-check.mjs', root).pathname, '--no-env-files', ...args], { encoding: 'utf8', env: { ...cloud } });
  assert.equal(command('--target=staging').status, 0);
  assert.equal(command('--target=unknown').status, 78);
  const rejected = spawnSync(process.execPath, [new URL('scripts/config-check.mjs', root).pathname, '--no-env-files', '--target=staging'], {
    encoding: 'utf8', env: { ...cloud, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_private-cli-sentinel' },
  });
  assert.equal(rejected.status, 78);
  assert.equal(`${rejected.stdout}${rejected.stderr}`.includes('private-cli-sentinel'), false, 'The CLI may report names and reasons, never values');
  for (const target of ['https://evil.test','//evil.test','/\\evil.test','/\nevil.test','/api/auth/signout','/auth/callback']) assert.equal(safeNext(target), '/gezin');
  assert.equal(safeNext('/gezin?view=children#child'), '/gezin?view=children#child');
  assert.equal(safeNext('/%2f%2fevil.test'), '/%2f%2fevil.test');
  const req = (body, headers = {}) => new Request('https://fabelpad.example.test/api/test', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body });
  assert.throws(() => checkMutationOrigin(req('{}', { origin: 'https://other.test' })), error => error.status === 403);
  assert.throws(() => checkMutationOrigin(req('{}', { 'sec-fetch-site': 'cross-site' })), error => error.status === 403);
  checkMutationOrigin(req('{}', { origin: 'https://fabelpad.example.test' }));
  await assert.rejects(readJson(req(' '.repeat(1025), { 'content-length': '1' }), 1024), error => error.status === 413);
  await assert.rejects(readJson(req('{')), error => error.status === 400);
  await assert.rejects(readJson(req('{}', { 'content-type': 'text/plain' })), error => error.status === 415);
  assert.deepEqual(await readJson(req('{"ok":true}')), { ok: true });
  const hidden = handleApiError(new Error('private-provider-diagnostic'));
  assert.equal(hidden.status, 503); assert.equal(JSON.stringify(await hidden.json()).includes('private-provider-diagnostic'), false);
  assert.equal(handleApiError(new RequestError(401,'not_authenticated')).status, 401);
  const stories = ['station','dream','toy','weather','moonbakery','ocean','garden','clock','library','balloon','forest','snow','stars'];
  for (const storyId of stories) {
    const release = buildStoryRelease(storyId), browserRelease = await localRelease(storyId);
    assert.deepEqual(release, browserRelease, 'Browser and server must materialize identical content, routes and release hash');
    assert.equal(Object.keys(release.scenes).length, 31); assert.equal(Object.keys(release.endings).length, 32);
    const { metadata, parts, nameToken, scenes, endings } = release;
    assert.equal(createHash('sha256').update(canonicalContentJson({ endings, scenes, nameToken, parts, metadata })).digest('hex').slice(0,16), release.contentVersion);
    assert.ok(scenes[''].text.includes(nameToken));
  }
  const base = buildStoryRelease('station');
  const draft = { metadata: base.metadata, chapters: { '0': { title: 'Nieuwe titel', text: 'Hallo {{naam}}.' } }, updatedAt: '' };
  assert.deepEqual(validateServerDraft('station', draft).errors, []);
  const modified = buildStoryRelease('station', draft);
  assert.notEqual(modified.contentVersion, base.contentVersion);
  assert.equal(modified.scenes[''].text, 'Hallo __FABELPAD_CHILD__.');
  assert.equal(Object.keys(modified.endings).length, 32);
  assert.ok(validateServerDraft('station', { ...draft, chapters: { '9': { text: 'bad' } } }).errors.length);
  const fixture = { schemaVersion: 1, family: { version: 1, children: [{ id: 'one', name: 'Sam', avatar: 0 }], activeId: 'one' }, data: { one: { 'story-station': { picks: [1], updatedAt: 1 } } } };
  assert.equal(validateFamilySnapshot(fixture).ok, true, 'Previous mobile story records stay compatible');
  Object.assign(fixture.data.one['story-station'], { storyId: 'station', contentVersion: base.contentVersion, revision: 1 });
  assert.equal(validateFamilySnapshot(fixture).ok, true);
  fixture.data.one['story-station'].storyId = 'ocean'; assert.equal(validateFamilySnapshot(fixture).ok, false);
  console.log('Supabase contract checks passed: explicit local/supabase data mode, four-input configuration, safe health 200/503 without network or value disclosure, hosted config fails closed, public-key-only config, redirect/origin/body boundaries, 13 identical browser/server releases (403 scenes, 416 endings), immutable hash identity, versioned and legacy family records.');
  console.log('Live OTP delivery, OAuth redirects/cookies, hosted RLS and signed DG mailgateway require project credentials and remain untested.');
} finally {
  for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key];
  Object.assign(process.env, original);
  await rm(temp, { recursive: true, force: true });
}
