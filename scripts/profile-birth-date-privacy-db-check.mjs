import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { installEmailVaultTestFixture, localMigrationSql } from './email/settings-db-fixture.mjs';
const { PGlite } = await import(process.env.FABELPAD_PGLITE_MODULE ?? '@electric-sql/pglite');
const { pgcrypto } = await import('@electric-sql/pglite/contrib/pgcrypto');
const db = new PGlite({ extensions: { pgcrypto } });
const migration = '20261123003259_child_birth_date_privacy_information.sql';
const previous = '2026-11-22.1', current = '2026-11-23', terms = '2026-11-22';
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222', C = '33333333-3333-4333-8333-333333333333', D = '44444444-4444-4444-8444-444444444444';
const now = '2026-11-23T12:00:00.000Z';
const hash = value => createHash('sha256').update(value).digest('hex');
const owner = () => db.exec('reset role');
async function role(value = 'anon') { await owner(); await db.query("select set_config('request.jwt.claims','{}',false)"); await db.exec(`set role ${value}`); }
async function identity(actor, method = 'otp') {
  await owner(); await db.query('insert into auth.sessions(id,user_id) values($1,$1) on conflict do nothing', [actor]);
  await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: actor, session_id: actor, amr: [{ method, timestamp: Date.parse(now) / 1000 }] })]);
  await db.exec('set role authenticated');
}
const rpc = async (name, parameters = []) => (await db.query(`select public.${name}(${parameters.map((_, index) => '$' + (index + 1)).join(',')}) result`, parameters)).rows[0].result;
const onboard = version => rpc('complete_parent_onboarding', [terms, version, true, true]);
const begin = (nonce, channel = 'otp', email = 'parent-b@example.test', version = current) => rpc('begin_parent_registration', [hash(nonce), channel, channel === 'otp' ? hash(email) : null, terms, version, true, true]);
const complete = (nonce, channel = 'otp') => rpc('complete_parent_registration', [hash(nonce), channel]);
const reject = promise => assert.rejects(promise, error => error.code === '22023' && error.message === 'document_version_changed');
const snapshot = { schemaVersion: 1, family: { version: 1, children: [{ id: 'kept-child', name: 'Robin', avatar: 0, birthDate: '2019-05-14' }], activeId: 'kept-child' }, data: { 'kept-child': { prefs: { muted: false, calm: true, readingLevel: 'under6' }, 'story-station': { picks: [1, 0], updatedAt: 1790000000000 } } } };
try {
  await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean not null default false,raw_user_meta_data jsonb not null default '{}');
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt()->>'sub','')::uuid $$;
    grant usage on schema public,auth to anon,authenticated; grant execute on function auth.uid(),auth.jwt() to anon,authenticated;`);
  await installEmailVaultTestFixture(db);
  const root = new URL('../supabase/migrations/', import.meta.url);
  const names = (await readdir(root)).filter(name => name.endsWith('.sql')).sort(); assert.ok(names.includes(migration));
  for (const name of names.filter(name => name < migration)) await db.exec(localMigrationSql(await readFile(new URL(name, root), 'utf8')));
  await db.exec(`create or replace function private.lifecycle_now() returns timestamptz language sql volatile set search_path='' as $$ select '${now}'::timestamptz $$;`);
  await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'parent-a@example.test',now()),($2,'parent-b@example.test',now()),($3,'parent-c@example.test',now()),($4,'parent-d@example.test',now())", [A, B, C, D]);
  await identity(A); await onboard(previous); await rpc('consent_child_profile', ['kept-child', true, true]);
  assert.equal((await rpc('save_family_snapshot', [0, JSON.stringify(snapshot)])).saved, true);
  // One completed and one unconsumed old proof exercise both post-upgrade cases.
  await role(); await begin('completed-before-upgrade', 'otp', 'parent-a@example.test', previous);
  await identity(A); assert.equal((await complete('completed-before-upgrade')).completed, true);
  await role(); await begin('unconsumed-before-upgrade', 'otp', 'parent-b@example.test', previous);
  await owner();
  const catalogBefore = (await db.query('select * from private.legal_document_versions order by kind,version')).rows;
  const acceptanceBefore = (await db.query('select * from private.parent_acceptances where parent_id=$1', [A])).rows;
  const familyBefore = (await db.query('select * from public.family_documents')).rows;
  const consentBefore = (await db.query('select * from private.child_profile_consents')).rows;
  const functions = [
    'private.get_account_lifecycle()', 'private.complete_parent_onboarding(text,text,boolean,boolean,text)', 'private.consent_child_profile(text,boolean,boolean)',
    'private.begin_parent_registration(text,text,text,text,text,boolean,boolean)', 'private.complete_parent_registration(text,text)',
  ];
  const definitions = async signatures => (await db.query('select oid::regprocedure::text signature,pg_get_functiondef(oid) definition,proacl::text acl from pg_proc where oid=any($1::regprocedure[]) order by 1', [signatures])).rows;
  const beforeDefinitions = await definitions(functions);
  const publicSignatures = ['public.get_account_lifecycle()', 'public.complete_parent_onboarding(text,text,boolean,boolean,text)', 'public.consent_child_profile(text,boolean,boolean)', 'public.begin_parent_registration(text,text,text,text,text,boolean,boolean)', 'public.complete_parent_registration(text,text)'];
  const publicBefore = await definitions(publicSignatures);
  await db.exec(localMigrationSql(await readFile(new URL(migration, root), 'utf8')));
  for (const row of catalogBefore) assert.deepEqual((await db.query('select * from private.legal_document_versions where kind=$1 and version=$2', [row.kind, row.version])).rows[0], row, 'Every historical offered document retains exact bytes and hash');
  assert.deepEqual((await db.query('select * from private.parent_acceptances where parent_id=$1', [A])).rows, acceptanceBefore, 'A real 22.1 acceptance is not reaccepted, redated or replaced');
  assert.deepEqual((await db.query('select * from public.family_documents')).rows, familyBefore, 'Informational update does not rewrite child profiles or routes');
  assert.deepEqual((await db.query('select * from private.child_profile_consents')).rows, consentBefore, 'Informational update does not fabricate new child consent');
  assert.deepEqual(await definitions(publicSignatures), publicBefore, 'Existing public invoker wrappers and privileges remain intact');
  const normalize = text => text.replaceAll(previous, current).replace(/\s+/g, ' ').trim();
  const afterDefinitions = await definitions(functions);
  for (const before of beforeDefinitions) {
    const after = afterDefinitions.find(row => row.signature === before.signature);
    assert.equal(normalize(after.definition), normalize(before.definition), `${before.signature} keeps its latest security/registration body except privacy version`);
    assert.equal(after.acl, before.acl, `${before.signature} privileges remain unchanged`);
  }
  const currentDocument = (await db.query("select document_text,sha256 from private.legal_document_versions where kind='privacy' and version=$1", [current])).rows[0];
  const publicBytes = await readFile(new URL(`../public/legal/${current}/privacyverklaring.md`, import.meta.url), 'utf8');
  assert.equal(currentDocument.document_text, publicBytes); assert.equal(currentDocument.sha256, hash(publicBytes));
  assert.match(publicBytes, /geboortedatum/u);
  await identity(A);
  const status = await rpc('get_account_lifecycle'); assert.equal(status.state, 'active'); assert.equal(status.privacyVersion, current); assert.equal(status.shownPrivacyVersion, previous); assert.equal(status.acceptedTermsVersion, terms);
  assert.deepEqual((await db.query('select snapshot from public.family_documents')).rows[0].snapshot, snapshot, 'Existing 22.1 account retains family access without another declaration');
  assert.equal((await complete('completed-before-upgrade')).completed, true, 'An already consumed own proof remains idempotent');
  await reject(onboard(previous));
  await rpc('consent_child_profile', ['new-after-upgrade', true, true]);
  await owner(); assert.equal((await db.query("select privacy_version from private.child_profile_consents where parent_id=$1 and child_id='new-after-upgrade'", [A])).rows[0].privacy_version, current);
  await identity(B); assert.equal((await complete('unconsumed-before-upgrade')).completed, false, 'An unfinished old declaration cannot create a newly informed account');
  await role(); await reject(begin('old-start-after-upgrade', 'otp', 'parent-b@example.test', previous));
  await begin('new-otp'); await identity(B); assert.equal((await complete('new-otp')).completed, true);
  await owner(); const otpAcceptance = (await db.query('select * from private.parent_acceptances where parent_id=$1', [B])).rows[0];
  assert.equal(otpAcceptance.privacy_version, current); assert.equal(otpAcceptance.privacy_sha256, currentDocument.sha256); assert.equal(otpAcceptance.signup_channel, 'otp'); assert.equal(new Date(otpAcceptance.registration_declared_at).toISOString(), now);
  await role(); await begin('new-google', 'google', undefined); await identity(C, 'oauth'); assert.equal((await complete('new-google', 'google')).completed, true);
  await owner(); const googleAcceptance = (await db.query('select privacy_version,privacy_sha256,signup_channel from private.parent_acceptances where parent_id=$1', [C])).rows[0];
  assert.deepEqual(googleAcceptance, { privacy_version: current, privacy_sha256: currentDocument.sha256, signup_channel: 'google' });
  await identity(D); const direct = await onboard(current); assert.equal(direct.state, 'active'); assert.equal(direct.shownPrivacyVersion, current);
  await rpc('consent_child_profile', ['direct-child', true, true]);
  await owner(); assert.equal((await db.query("select privacy_version from private.child_profile_consents where parent_id=$1 and child_id='direct-child'", [D])).rows[0].privacy_version, current);
  assert.deepEqual((await db.query('select * from private.parent_acceptances where parent_id=$1', [A])).rows, acceptanceBefore, 'Other registrations and new consents never rewrite historical evidence');
  await assert.rejects(db.exec("update private.legal_document_versions set document_text='forged' where kind='privacy' and version='2026-11-22.1'"), error => error.code === '42501');
  await assert.rejects(db.exec("delete from private.legal_document_versions where kind='privacy' and version='2026-11-23'"), error => error.code === '42501');
  for (const name of names.filter(name => name > migration)) await db.exec(localMigrationSql(await readFile(new URL(name, root), 'utf8')));
  console.log('Birth date privacy upgrade checks passed: immutable 22.1 document/acceptance/consent/profile evidence, exact newest function-body and ACL preservation, public document hash, no forced reacceptance, stale versus consumed registration proofs, new OTP/Google/direct onboarding and child-consent version/hash recording.');
  console.log('PostgreSQL/WASM fixtures use synthetic identities and intercepted provider boundaries; no hosted data was changed.');
} finally { await db.close(); }
