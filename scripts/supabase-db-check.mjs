import assert from 'node:assert/strict';
import { readFile, readdir, mkdtemp, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { compileSource } from './source-test-loader.mjs';
import { installEmailVaultTestFixture } from './email/settings-db-fixture.mjs';
const { PGlite } = await import(process.env.FABELPAD_PGLITE_MODULE ?? '@electric-sql/pglite');
const db = new PGlite();
const temp = await mkdtemp(join(tmpdir(), 'fabelpad-db-content-'));
const parentA = '11111111-1111-4111-8111-111111111111';
const parentB = '22222222-2222-4222-8222-222222222222';
const administrator = '33333333-3333-4333-8333-333333333333';
const bootstrapAdministrator = '44444444-4444-4444-8444-444444444444';
const pendingAdministrator = '55555555-5555-4555-8555-555555555555';
const fixture = name => ({ schemaVersion: 1, family: { version: 1, children: [{ id: 'shared-child-id', name, avatar: 0 }], activeId: 'shared-child-id' }, data: { 'shared-child-id': { favorites: ['station'], started: ['station'], completed: {}, prefs: { muted: false, calm: true }, 'story-station': { picks: [0], updatedAt: 1790000000000, contentVersion: 'a'.repeat(16), storyId: 'station', revision: 1 }, memory: { version: 1, encounters: [], items: [], openThreads: [], events: [] } } } });
async function identity(id, role = 'authenticated', extra = {}) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: id, ...extra })]);
  await db.exec(`set role ${role}`);
}
async function save(revision, snapshot) { return (await db.query('select public.save_family_snapshot($1, $2::jsonb) as result', [revision, JSON.stringify(snapshot)])).rows[0].result; }
async function denied(sql, params = []) { await assert.rejects(db.query(sql, params), error => error.code === '42501'); }
try {
  // Auth and Vault's API are stubbed here. PostgreSQL executes real grants,
  // RLS, functions, constraints, triggers and atomic write predicates.
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz,
      is_anonymous boolean not null default false, raw_user_meta_data jsonb not null default '{}');
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt()->>'sub', '')::uuid $$;
    grant usage on schema public,auth to anon,authenticated;
    grant execute on function auth.uid(),auth.jwt() to anon,authenticated;
    insert into auth.users(id) values('${parentA}'),('${parentB}'),('${administrator}');
    insert into auth.users(id,email,email_confirmed_at) values('${bootstrapAdministrator}','INFO@dgwebservices.nl',now());
    create function public.rls_auto_enable() returns event_trigger language plpgsql security definer as $$ begin return; end; $$;
  `);
  await installEmailVaultTestFixture(db); // Not a cryptographic test; hosted Vault is verified separately.
  const migrationRoot = new URL('../supabase/migrations/', import.meta.url);
  for (const name of (await readdir(migrationRoot)).filter(name => name.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(name, migrationRoot), 'utf8'));
  const bootstrapGrant = async id => (await db.query('select grant_source from public.content_admins where user_id=$1', [id])).rows[0]?.grant_source;
  assert.equal(await bootstrapGrant(bootstrapAdministrator), 'bootstrap_email', 'Migration backfills only the already verified owner-approved mailbox');
  assert.equal(await bootstrapGrant(parentB), undefined);
  await db.query('update auth.users set raw_user_meta_data=$1::jsonb where id=$2', [JSON.stringify({email:'info@dgwebservices.nl',email_verified:true,admin:true,role:'admin'}),parentB]);
  assert.equal(await bootstrapGrant(parentB), undefined, 'Editable metadata cannot provision an administrator');
  await db.query('insert into auth.users(id,email) values($1,$2)', [pendingAdministrator,'info@dgwebservices.nl']);
  assert.equal(await bootstrapGrant(pendingAdministrator), undefined, 'An unconfirmed mailbox receives no grant');
  await db.query('update auth.users set email_confirmed_at=now() where id=$1', [pendingAdministrator]);
  assert.equal(await bootstrapGrant(pendingAdministrator), 'bootstrap_email');
  await db.query('update auth.users set email=$1 where id=$2', ['someone@example.test',pendingAdministrator]);
  assert.equal(await bootstrapGrant(pendingAdministrator), undefined, 'Changing away from the bootstrap mailbox revokes only its automatic grant');
  await db.query('update auth.users set email=$1,email_confirmed_at=null where id=$2', ['info@dgwebservices.nl',pendingAdministrator]);
  assert.equal(await bootstrapGrant(pendingAdministrator), undefined);
  await db.query('update auth.users set email_confirmed_at=now(),is_anonymous=true where id=$1', [pendingAdministrator]);
  assert.equal(await bootstrapGrant(pendingAdministrator), undefined, 'An anonymous account cannot bootstrap an administrator');
  await db.query('update auth.users set is_anonymous=false where id=$1', [pendingAdministrator]);
  assert.equal(await bootstrapGrant(pendingAdministrator), 'bootstrap_email');
  await db.query('update auth.users set is_anonymous=true where id=$1', [pendingAdministrator]);
  assert.equal(await bootstrapGrant(pendingAdministrator), undefined, 'Losing the trusted identity condition revokes automatic privilege');
  await db.query("insert into public.content_admins(user_id,grant_source) values($1,'manual')", [pendingAdministrator]);
  await db.query('update auth.users set email=$1,email_confirmed_at=null where id=$2', ['different@example.test',pendingAdministrator]);
  assert.equal(await bootstrapGrant(pendingAdministrator), 'manual', 'The bootstrap trigger preserves independent manual grants');
  for (const role of ['anon','authenticated']) {
    assert.equal((await db.query('select has_function_privilege($1,$2,$3) as allowed', [role,'private.provision_verified_bootstrap_admin()','EXECUTE'])).rows[0].allowed,false);
    assert.equal((await db.query('select has_function_privilege($1,$2,$3) as allowed', [role,'public.rls_auto_enable()','EXECUTE'])).rows[0].allowed,false);
  }
  await identity(parentB);
  await denied('select private.provision_verified_bootstrap_admin()');
  await denied("update public.content_admins set grant_source='manual'");
  await db.exec('reset role');
  await db.query('delete from auth.users where id=$1', [bootstrapAdministrator]);
  assert.equal(await bootstrapGrant(bootstrapAdministrator), undefined, 'Deleting Auth identity cascades its admin grant');
  const { buildStoryRelease } = await import(await compileSource(new URL('../lib/server/contentRelease.ts', import.meta.url), temp));
  const { canonicalContentJson } = await import(await compileSource(new URL('../lib/contentHash.ts', import.meta.url), temp));
  const { advanceStoryMemory, emptyStoryMemory } = await import(await compileSource(new URL('../src/storyMemory.ts', import.meta.url), temp));
  const { validateFamilySnapshot } = await import(await compileSource(new URL('../lib/familyValidation.ts', import.meta.url), temp));
  for (const story of ['station','dream','toy','weather','moonbakery','ocean','garden','clock','library','balloon','forest','snow','stars']) {
    const { metadata, parts, nameToken, scenes, endings, contentVersion } = buildStoryRelease(story);
    const payload = { metadata, parts, nameToken, scenes, endings };
    const canonical = (await db.query('select private.canonical_content_json($1::jsonb) as text', [JSON.stringify(payload)])).rows[0].text;
    assert.equal(canonical, canonicalContentJson(payload), 'PostgreSQL and JS must produce identical canonical release bytes');
    assert.equal(createHash('sha256').update(canonical).digest('hex').slice(0,16), contentVersion);
  }
  await identity(parentA);
  assert.deepEqual(await save(0, fixture('Mila')), { saved: true, revision: 1, snapshot: fixture('Mila') });
  await identity(parentB);
  assert.equal((await db.query('select * from public.family_documents')).rows.length, 0, 'B cannot read A even without an explicit owner filter');
  assert.equal((await save(0, fixture('Bo'))).saved, true);
  await denied('update public.family_documents set snapshot=$1::jsonb where parent_id=$2', [JSON.stringify(fixture('Hijack')), parentA]);
  await denied('insert into public.content_admins(user_id) values($1)', [parentB]);
  await denied('select public.save_content_draft($1,0,$2::jsonb)', ['station', JSON.stringify({ metadata: {}, chapters: {} })]);
  assert.equal((await db.query('select * from public.content_drafts')).rows.length, 0);
  await identity(parentA);
  const attempts = await Promise.all([save(1, fixture('First')), save(1, fixture('Second'))]);
  assert.deepEqual(attempts.map(value => value.saved).sort(), [false, true]);
  assert.equal(attempts[0].revision, 2); assert.equal(attempts[1].revision, 2);
  assert.equal((await save(1, fixture('Replay'))).saved, false, 'Replaying a stale revision never increments the server');
  let bad = fixture('Invalid'); bad.data['foreign-child'] = {};
  await assert.rejects(save(2, bad), error => error.code === '22023');
  bad = fixture('Invalid'); bad.data['shared-child-id']['story-station'].storyId = 'ocean';
  await assert.rejects(save(2, bad), error => error.code === '22023');
  const mutations = [
    snapshot => { snapshot.data['shared-child-id']['story-station'].storyId = null; },
    snapshot => { snapshot.data['shared-child-id'].completed = { station: { ending: null, date: null } }; },
    snapshot => { snapshot.data['shared-child-id'].completed = { station: { ending: 'Einde', date: 'geen datum' } }; },
    snapshot => { snapshot.data['shared-child-id'].memory.events = [{}]; },
    snapshot => { snapshot.family.children[0].name = '🙂'.repeat(11); },
    snapshot => { snapshot.family.children[0].name = '\t\u00a0'; },
  ];
  for (const mutate of mutations) {
    bad = fixture('Invalid'); mutate(bad);
    assert.equal(validateFamilySnapshot(bad).ok, false);
    await assert.rejects(save(2,bad), error => error.code === '22023', 'Direct RPC calls cannot poison a readable family snapshot');
  }
  const remembered = fixture('Mila');
  let memory = emptyStoryMemory();
  for (const id of ['station','dream','toy','weather','moonbakery','ocean','garden','clock','library','balloon','forest','snow','stars']) memory = advanceStoryMemory(memory,id,[0,1,0,1,0],'Mila');
  memory = advanceStoryMemory(memory,'station',[1],'Mila');
  remembered.data['shared-child-id'].memory = memory;
  remembered.data['shared-child-id'].completed = { station: { ending: 'Een mooi einde', date: '2026-11-04T12:00:00.000Z' } };
  assert.equal(validateFamilySnapshot(remembered).ok, true);
  assert.equal((await save(2,remembered)).saved,true,'Real generated memories remain compatible with the database boundary');
  for (const alter of [
    value => { value.events[0].source = null; },
    value => { value.events[0].worldId = 'foreign-world'; },
    value => { value.encounters[0].facts = [null]; },
    value => { value.events.push(structuredClone(value.events[0])); },
  ]) {
    bad = structuredClone(remembered); alter(bad.data['shared-child-id'].memory);
    assert.equal(validateFamilySnapshot(bad).ok,false);
    await assert.rejects(save(3,bad), error => error.code === '22023');
  }
  await identity(parentB);
  assert.equal((await db.query('select snapshot from public.family_documents')).rows[0].snapshot.family.children[0].name, 'Bo');
  await identity(null, 'anon');
  await denied('select * from public.family_documents');
  await denied('select public.save_family_snapshot(0,$1::jsonb)', [JSON.stringify(fixture('Anonymous'))]);
  await identity(parentA, 'authenticated', { is_anonymous: true });
  await denied('select public.save_family_snapshot(2,$1::jsonb)', [JSON.stringify(fixture('Anonymous auth'))]);
  await db.exec('reset role');
  await db.query('insert into public.content_admins(user_id) values($1)', [administrator]);
  await identity(administrator);
  const draft = { metadata: { title: 'Titel', description: 'Een verhaal', image: '/images/station.webp' }, chapters: {}, updatedAt: '' };
  const saved = (await db.query('select public.save_content_draft($1,0,$2::jsonb) as result', ['station', JSON.stringify(draft)])).rows[0].result;
  assert.equal(saved.saved, true);
  assert.equal((await db.query('select public.save_content_draft($1,0,$2::jsonb) as result', ['station', JSON.stringify(draft)])).rows[0].result.saved, false);
  const scenes = {}, endings = {};
  for (let part = 0; part < 5; part++) for (let n = 0; n < 2 ** part; n++) scenes[part ? n.toString(2).padStart(part, '0') : ''] = { title: 'Scène', text: 'Tekst', choices: [{ label: 'A', hint: 'A', icon: 'heart' }, { label: 'B', hint: 'B', icon: 'moon' }] };
  for (let n = 0; n < 32; n++) endings[n.toString(2).padStart(5, '0')] = { title: 'Einde', text: 'Klaar', keepsake: 'Schat' };
  const payload = { metadata: draft.metadata, parts: 5, nameToken: '__FABELPAD_CHILD__', scenes, endings };
  const publish = async () => (await db.query('select public.publish_content_release($1,1,$2::jsonb) as result', ['station', JSON.stringify(payload)])).rows[0].result;
  const first = await publish(), replay = await publish();
  assert.equal(first.saved, true); assert.equal(replay.release.content_version, first.release.content_version);
  assert.equal(first.release.content_version, createHash('sha256').update(canonicalContentJson(payload)).digest('hex').slice(0,16));
  assert.equal((await db.query('select count(*)::int as count from public.content_releases')).rows[0].count, 1);
  await denied("update public.content_releases set payload='{}'::jsonb");
  await db.exec('reset role');
  await denied("update public.content_releases set payload='{}'::jsonb");
  await denied('delete from public.content_releases');
  await identity(parentB);
  assert.equal((await db.query('select * from public.content_drafts')).rows.length, 0, 'A published release never exposes the draft');
  await identity(null, 'anon');
  assert.equal((await db.query('select * from public.content_releases')).rows.length, 1);
  await denied('select * from public.content_drafts');
  await db.exec('reset role');
  // Keep the regression larger than Supabase's default Data API maximum.
  await db.query("insert into public.content_releases(story_id,content_version,payload,published_at) select 'station',lpad(n::text,16,'0'),$1::jsonb,now() + n * interval '1 second' from generate_series(1,1001) n",[JSON.stringify(payload)]);
  await db.query("insert into public.content_releases(story_id,content_version,payload,published_at) values('ocean','aaaaaaaaaaaaaaaa',$1::jsonb,'2025-01-01T00:00:00Z')",[JSON.stringify(payload)]);
  await identity(null,'anon');
  const catalog = (await db.query('select * from public.get_content_catalog()')).rows;
  assert.equal(catalog.length,2,'The catalog returns every story despite more than 1000 retained releases');
  assert.equal(catalog.find(row => row.story_id === 'station').content_version,'0000000000001001');
  assert.deepEqual(Object.keys(catalog[0]).sort(),['content_version','metadata','published_at','story_id']);
  await db.exec('reset role');
  await db.query('delete from auth.users where id=$1',[administrator]);
  assert.equal((await db.query("select editor_id from public.content_drafts where story_id='station'")).rows[0].editor_id,null);
  assert.equal((await db.query('select count(*)::int as count from public.content_releases')).rows[0].count,1003,'Deleting a content author preserves published adventures');
  console.log('Supabase PostgreSQL checks passed: migration, RLS with two parents and same child ID, forged writes, concurrent CAS, replay, anonymous sessions, explicit admin grant, draft isolation, immutable and idempotent publication.');
  console.log('Regression checks passed: direct-RPC snapshot validation, generated story memories, UTF-16 name limits, metadata catalog after 1000+ releases and author deletion without release loss.');
  console.log('Administrator bootstrap checks passed: verified exact mailbox only, case normalization, no metadata escalation, confirmation/anonymous gating, grant revocation, manual grant preservation, cascade and private helper/event-trigger execution revokes.');
  console.log('Supabase Auth/network/Storage/Edge/mailgateway and true multi-connection contention are not covered by this local PostgreSQL WASM test.');
} finally { await db.close(); await rm(temp, { recursive: true, force: true }); }
