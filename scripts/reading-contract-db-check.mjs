import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileSource } from './source-test-loader.mjs';
import { installEmailVaultTestFixture, localMigrationSql } from './email/settings-db-fixture.mjs';

const { PGlite } = await import(process.env.FABELPAD_PGLITE_MODULE ?? '@electric-sql/pglite');
const { pgcrypto } = await import('@electric-sql/pglite/contrib/pgcrypto');
const db = new PGlite({ extensions: { pgcrypto } });
const temporary = await mkdtemp(join(tmpdir(), 'fabelpad-reading-contract-'));
const migration = '20261122233351_reading_levels_completed_routes.sql';
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const ADMIN = '33333333-3333-4333-8333-333333333333';
const id = 'shared-child';
const nameToken = '__FABELPAD_CHILD__';
const route = (value, length) => Array.from({ length }, (_, bit) => (value >> (length - 1 - bit)) & 1);
const fixture = () => ({ schemaVersion: 1, family: { version: 1, children: [{ id, name: 'Robin', avatar: 0 }], activeId: id }, data: { [id]: { prefs: { muted: false, calm: true }, 'story-station': { picks: [1, 0], updatedAt: 1790000000000 } } } });
const owner = () => db.exec('reset role');
async function identity(actor, role = 'authenticated', onboarding = true) {
  await owner();
  const privacy = (await db.query("select version from private.legal_document_versions where kind='privacy' order by version desc limit 1")).rows[0].version;
  if (actor) await db.query('insert into auth.sessions(id,user_id) values($1,$1) on conflict do nothing', [actor]);
  await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: actor, session_id: actor, amr: [{ method: 'otp', timestamp: Math.floor(Date.now() / 1000) }] })]);
  await db.exec(`set role ${role}`);
  if (actor && onboarding) {
    await db.query("select public.complete_parent_onboarding('2026-11-22',$1,true,true)", [privacy]);
    await db.query('select public.consent_child_profile($1,true,true)', [id]);
  }
}
const save = async (revision, snapshot) => (await db.query('select public.save_family_snapshot($1,$2::jsonb) result', [revision, JSON.stringify(snapshot)])).rows[0].result;
const publish = async payload => (await db.query("select public.publish_content_release('station',1,$1::jsonb) result", [JSON.stringify(payload)])).rows[0].result;
const invalid = (promise, code = '22023') => assert.rejects(promise, error => error.code === code);
const validInSql = async snapshot => (await db.query('select private.valid_family_snapshot($1::jsonb) valid', [JSON.stringify(snapshot)])).rows[0].valid;
const validLevels = async payload => (await db.query('select private.valid_content_release_reading_levels($1::jsonb) valid', [JSON.stringify(payload)])).rows[0].valid;

try {
  const source = path => compileSource(new URL(path, import.meta.url), temporary).then(url => import(url));
  const [{ validateFamilySnapshot, MAX_FAMILY_BYTES }, { getReadingScene, getReadingEnding }, { STORY_IDS }, { canonicalContentJson }] = await Promise.all([
    source('../lib/familyValidation.ts'), source('../src/storyReadingLevels.ts'), source('../src/storyCatalog.ts'), source('../lib/contentHash.ts'),
  ]);
  assert.equal(MAX_FAMILY_BYTES, 262144, 'The family document budget is unchanged');
  const payloadFor = world => {
    const readingLevels = {};
    for (const band of ['under6', '6to8', '9plus']) {
      const scenes = {}, endings = {};
      for (let step = 0; step < 5; step++) for (let n = 0; n < 2 ** step; n++) {
        const picks = route(n, step);
        scenes[picks.join('')] = getReadingScene(world, step, picks, nameToken, band);
      }
      for (let n = 0; n < 32; n++) {
        const picks = route(n, 5);
        endings[picks.join('')] = getReadingEnding(world, picks, nameToken, band);
      }
      readingLevels[band] = { scenes, endings };
    }
    return { metadata: { title: 'Verhaal', description: 'Een avontuur', image: '/art/station.webp' }, parts: 5, nameToken, ...readingLevels['9plus'], readingLevels };
  };
  const payload = payloadFor('station');
  const legacy = structuredClone(payload); delete legacy.readingLevels;

  await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean not null default false,raw_user_meta_data jsonb not null default '{}');
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
    create function auth.uid() returns uuid language sql stable as $$select nullif(auth.jwt()->>'sub','')::uuid$$;
    grant usage on schema public,auth to anon,authenticated; grant execute on function auth.uid(),auth.jwt() to anon,authenticated;
    insert into auth.users(id,email,email_confirmed_at) values('${A}','parent-a@example.test',now()),('${B}','parent-b@example.test',now()),('${ADMIN}','editor@example.test',now());`);
  await installEmailVaultTestFixture(db);
  const migrations = new URL('../supabase/migrations/', import.meta.url);
  const names = (await readdir(migrations)).filter(name => name.endsWith('.sql')).sort();
  assert.ok(names.includes(migration), 'The reading contract migration is present');
  for (const name of names.filter(name => name < migration)) await db.exec(localMigrationSql(await readFile(new URL(name, migrations), 'utf8')));

  // Exercise an actual upgrade over stored legacy data and a published release.
  await identity(A); assert.equal((await save(0, fixture())).saved, true);
  await owner(); await db.query('insert into public.content_admins(user_id) values($1)', [ADMIN]);
  await identity(ADMIN);
  await db.query("select public.save_content_draft('station',0,$1::jsonb)", [JSON.stringify({ metadata: payload.metadata, chapters: {} })]);
  const oldPublication = await publish(legacy);
  assert.equal(oldPublication.saved, true);
  await owner();
  const beforeFamily = (await db.query('select * from public.family_documents')).rows;
  const beforeReleases = (await db.query('select * from public.content_releases')).rows;
  const protectedSignatures = ['private.save_family_snapshot(bigint,jsonb)', 'private.publish_content_release(text,bigint,jsonb)', 'public.publish_content_release(text,bigint,jsonb)'];
  const protectedFunctions = async () => (await db.query('select oid::regprocedure::text signature,pg_get_functiondef(oid) definition,proacl::text acl from pg_proc where oid=any($1::regprocedure[]) order by 1', [protectedSignatures])).rows;
  const beforeFunctions = await protectedFunctions();
  await db.exec(await readFile(new URL(migration, migrations), 'utf8'));
  assert.deepEqual((await db.query('select * from public.family_documents')).rows, beforeFamily, 'Upgrade never rewrites a parent snapshot');
  assert.deepEqual((await db.query('select * from public.content_releases')).rows, beforeReleases, 'Upgrade retains immutable legacy release bytes');
  assert.deepEqual(await protectedFunctions(), beforeFunctions, 'Consent/auth wrappers, definitions and grants remain unchanged');
  for (const name of names.filter(name => name > migration)) await db.exec(localMigrationSql(await readFile(new URL(name, migrations), 'utf8')));

  let snapshotChecks = 0;
  const checkSnapshot = async (snapshot, expected) => {
    assert.equal(validateFamilySnapshot(snapshot).ok, expected, 'JS family contract');
    assert.equal(await validInSql(snapshot), expected, 'SQL family contract matches JS');
    snapshotChecks++;
  };
  await checkSnapshot(fixture(), true);
  await checkSnapshot({ schemaVersion: 1, family: { version: 1, children: [], activeId: '' }, data: {} }, true);
  for (const band of ['under6', '6to8', '9plus']) for (const previous of [undefined, [0, 1, 0, 1, 0], [1, 1, 1, 1, 1]]) {
    const snapshot = fixture(); snapshot.data[id].prefs.readingLevel = band;
    if (previous) {
      snapshot.data[id]['story-station'].picks = [];
      snapshot.data[id]['story-station'].lastCompletedPicks = previous;
      snapshot.data[id]['story-station'].lastCompletedContentVersion = 'a'.repeat(16);
    }
    await checkSnapshot(snapshot, true);
  }
  for (const length of [16, 64]) {
    const snapshot = fixture(); snapshot.data[id]['story-station'].lastCompletedPicks = [0, 0, 0, 0, 0];
    snapshot.data[id]['story-station'].lastCompletedContentVersion = 'a'.repeat(length);
    await checkSnapshot(snapshot, true);
  }
  const snapshotMutations = [
    snapshot => { snapshot.data[id].prefs.readingLevel = null; },
    snapshot => { snapshot.data[id].prefs.readingLevel = '6-8'; },
    snapshot => { snapshot.data[id].prefs.readingLevel = {}; },
    snapshot => { snapshot.data[id].prefs.unknown = true; },
    ...[null, [], [0], [0, 1, 0, 1], [0, 1, 0, 1, 0, 1], [0, 1, 2, 1, 0], [0, 1, '0', 1, 0], [0, 1, false, 1, 0], {}].map(value => snapshot => { snapshot.data[id]['story-station'].lastCompletedPicks = value; }),
    ...[null, '', 'a'.repeat(15), 'a'.repeat(65), 'A'.repeat(16), {}, 123].map(value => snapshot => { snapshot.data[id]['story-station'].lastCompletedPicks = [0, 0, 0, 0, 0]; snapshot.data[id]['story-station'].lastCompletedContentVersion = value; }),
    snapshot => { snapshot.data[id]['story-station'].lastCompletedContentVersion = 'a'.repeat(16); },
    snapshot => { snapshot.data[id]['story-station'].unknown = true; },
    snapshot => { snapshot.data[id]['story-station'].picks = [2]; },
    snapshot => { snapshot.data[id]['story-station'].storyId = 'dream'; },
    snapshot => { snapshot.data[id].prefs = JSON.parse('{"muted":false,"calm":true,"__proto__":{"polluted":true}}'); },
  ];
  for (const mutate of snapshotMutations) { const snapshot = fixture(); mutate(snapshot); await checkSnapshot(snapshot, false); }
  const inherited = fixture(); Object.setPrototypeOf(inherited.data[id].prefs, { readingLevel: 'under6' });
  assert.equal(validateFamilySnapshot(inherited).ok, false, 'Non-plain JS objects are rejected before JSON serialization');

  await identity(A);
  const completed = fixture();
  completed.data[id].prefs.readingLevel = 'under6';
  completed.data[id]['story-station'] = { picks: [], updatedAt: 1790000000001, lastCompletedPicks: [1, 0, 1, 0, 1], lastCompletedContentVersion: oldPublication.release.content_version };
  const saved = await save(1, completed);
  assert.equal(saved.saved, true); assert.deepEqual(saved.snapshot, completed, 'JSONB roundtrip retains selected level and previous complete route after restart');
  assert.equal((await save(1, completed)).saved, false, 'A stale CAS cannot overwrite current route state');
  for (const mutate of snapshotMutations) { const snapshot = fixture(); mutate(snapshot); await invalid(save(2, snapshot)); }
  const noConsent = fixture(); noConsent.family.children[0].id = 'not-consented'; noConsent.family.activeId = 'not-consented'; noConsent.data = { 'not-consented': completed.data[id] };
  await invalid(save(2, noConsent), '42501');
  await identity(B);
  assert.equal((await db.query('select * from public.family_documents')).rows.length, 0, 'Another parent cannot read the new route fields');
  await invalid(publish(payload), '42501');
  await identity(null, 'anon'); await invalid(save(0, completed), '42501'); await invalid(publish(payload), '42501');
  await owner();

  let bundleChecks = 0;
  for (const world of STORY_IDS) { assert.equal(await validLevels(payloadFor(world)), true, `${world}: all three complete level bundles validate`); bundleChecks++; }
  assert.equal(await validLevels(legacy), true, 'Historical single-level releases remain publishable');
  const bundleMutations = [
    value => { value.readingLevels = null; },
    value => { delete value.readingLevels.under6; },
    value => { value.readingLevels.extra = value.readingLevels.under6; },
    value => { value.readingLevels.under6 = null; },
    value => { value.readingLevels.under6.extra = true; },
    value => { delete value.readingLevels.under6.scenes['']; },
    value => { value.readingLevels.under6.scenes['invalid'] = value.readingLevels.under6.scenes['']; delete value.readingLevels.under6.scenes['']; },
    value => { value.readingLevels.under6.scenes[''].text = null; },
    value => { value.readingLevels.under6.scenes[''].title = ''; },
    value => { value.readingLevels.under6.scenes[''].extra = true; },
    value => { value.readingLevels.under6.scenes[''].choices.pop(); },
    value => { value.readingLevels.under6.scenes[''].choices[0] = null; },
    value => { value.readingLevels.under6.scenes[''].choices[0].label = ''; },
    value => { value.readingLevels.under6.scenes[''].choices[0].icon = 'moon'; },
    value => { value.readingLevels.under6.scenes[''].choices.reverse(); },
    value => { value.readingLevels.under6.scenes[''].choices[0].hint = null; },
    value => { value.readingLevels.under6.scenes[''].choices[0].extra = true; },
    value => { delete value.readingLevels.under6.endings['00000']; },
    value => { value.readingLevels.under6.endings['00000'].text = ' '; },
    value => { value.readingLevels.under6.endings['00000'].keepsake = 'A different reward'; },
    value => { value.readingLevels.under6.endings['00000'].title = 'Another ending'; },
    value => { value.readingLevels['9plus'] = structuredClone(value.readingLevels['9plus']); value.readingLevels['9plus'].scenes[''].text = 'A rewritten original'; },
    value => { value.readingLevels['9plus'] = structuredClone(value.readingLevels['9plus']); value.readingLevels['9plus'].endings['00000'].text = 'A rewritten original'; },
    value => { value.readingLevels.under6.scenes = JSON.parse('{"__proto__":{"polluted":true}}'); },
  ];
  for (const [index, mutate] of bundleMutations.entries()) { const value = structuredClone(payload); mutate(value); assert.equal(await validLevels(value), false, `Malformed complete-level bundle ${index + 1} is rejected`); bundleChecks++; }
  for (const role of ['anon', 'authenticated', 'service_role']) for (const signature of ['private.valid_family_snapshot_with_profiles(jsonb)', 'private.valid_content_release_reading_levels(jsonb)', 'private.publish_content_release_before_lifecycle(text,bigint,jsonb)']) {
    assert.equal((await db.query('select has_function_privilege($1,$2,\'EXECUTE\') allowed', [role, signature])).rows[0].allowed, false, `${role} cannot bypass lifecycle or admin checks`);
  }
  await identity(ADMIN);
  const published = await publish(payload), replay = await publish(payload);
  assert.equal(published.saved, true); assert.equal(replay.release.content_version, published.release.content_version, 'Three-level publication remains idempotent');
  assert.equal(published.release.content_version, createHash('sha256').update(canonicalContentJson(payload)).digest('hex').slice(0, 16), 'The content hash covers every level');
  assert.deepEqual(published.release.payload, payload, 'Published complete bundles preserve all route text');
  for (const mutate of bundleMutations) { const value = structuredClone(payload); mutate(value); await invalid(publish(value)); }
  await owner();
  assert.equal((await db.query('select count(*)::int count from public.content_releases')).rows[0].count, 2, 'Rejected variants never create a release');
  await invalid(db.exec("update public.content_releases set payload='{}'::jsonb"), '42501');
  console.log(`Reading contract checks passed: ${snapshotChecks} JS/SQL snapshot cases, ${bundleChecks} complete-bundle cases, all thirteen stories × three levels, retained legacy data/releases, real JSONB roundtrip, replay/CAS, consent and parent isolation, anonymous/admin boundaries, immutable idempotent publication, hashed variants and helper revokes.`);
  console.log('Local PostgreSQL/WASM validation does not verify hosted Auth, real network delivery or true multi-connection contention.');
} finally {
  await db.close(); await rm(temporary, { recursive: true, force: true });
}
