import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { installEmailVaultTestFixture, localMigrationSql } from './email/settings-db-fixture.mjs';
const { PGlite } = await import(process.env.FABELPAD_PGLITE_MODULE ?? '@electric-sql/pglite');
const { pgcrypto } = await import('@electric-sql/pglite/contrib/pgcrypto');
const db = new PGlite({ extensions: { pgcrypto } });
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222', C = '33333333-3333-4333-8333-333333333333';
const SID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const hash = value => createHash('sha256').update(value).digest('hex');
let clock = '2026-11-22T12:00:00.000Z', count = 0;
let currentPrivacyVersion;
const owner = () => db.exec('reset role');
async function tick(value) { clock = value; await owner(); await db.exec(`create or replace function private.lifecycle_now() returns timestamptz language sql volatile set search_path='' as $$ select '${value}'::timestamptz $$`); }
async function role(value = 'anon') { await owner(); await db.query("select set_config('request.jwt.claims','{}',false)"); await db.exec(`set role ${value}`); }
async function identity(actor, { method = 'otp', age = 0, session = true } = {}) {
  await owner();
  if (session) await db.query('insert into auth.sessions(id,user_id) values($1,$2) on conflict(id) do update set user_id=excluded.user_id', [SID, actor]);
  else await db.query('delete from auth.sessions where id=$1', [SID]);
  await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: actor, session_id: SID, amr: [{ method, timestamp: Date.parse(clock) / 1000 - age }] })]);
  await db.exec('set role authenticated');
}
async function rpc(name, args = []) { return (await db.query(`select public.${name}(${args.map((_, i) => '$' + (i + 1)).join(',')}) as result`, args)).rows[0].result; }
const begin = (nonce, channel = 'otp', email = 'parent-a@example.test', terms = '2026-11-22', privacy = currentPrivacyVersion, guardian = true, accepted = true) => rpc('begin_parent_registration', [hash(nonce), channel, channel === 'otp' ? hash(email) : null, terms, privacy, guardian, accepted]);
const complete = (nonce, channel = 'otp') => rpc('complete_parent_registration', [hash(nonce), channel]);
const state = async actor => { await owner(); return (await db.query('select * from private.account_lifecycle where parent_id=$1', [actor])).rows[0]; };
const proof = async nonce => { await owner(); return (await db.query('select * from private.parent_registration_proofs where nonce_hash=$1', [hash(nonce)])).rows[0]; };
try {
  await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean not null default false,raw_user_meta_data jsonb not null default '{}');
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt()->>'sub','')::uuid $$;
    grant usage on schema public,auth to anon,authenticated; grant execute on function auth.uid(),auth.jwt() to anon,authenticated;`);
  await installEmailVaultTestFixture(db);
  const migrationRoot = new URL('../supabase/migrations/', import.meta.url);
  let registrationApplied = false;
  for (const name of (await readdir(migrationRoot)).filter(name => name.endsWith('.sql')).sort()) {
    const sql = localMigrationSql(await readFile(new URL(name, migrationRoot), 'utf8'));
    if (name.endsWith('_parent_registration_proof.sql')) {
      // Warm the pre-existing worker immediately before the original wrapper.
      // Apply later privacy migrations chronologically so they are not replaced
      // by an old registration function at the end of the fixture.
      await tick(clock);
      await role('service_role'); await rpc('claim_lifecycle_jobs', [1]);
      await owner(); registrationApplied = true;
    }
    await db.exec(sql);
  }
  assert.ok(registrationApplied);
  currentPrivacyVersion = (await db.query("select version from private.legal_document_versions where kind='privacy' order by version desc limit 1")).rows[0].version;
  await tick(clock);
  await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,' Parent-A@Example.Test ',now()),($2,'parent-b@example.test',now()),($3,'parent-c@example.test',now())", [A, B, C]);
  const expired = hash('expired-worker-proof');
  await db.query("insert into private.parent_registration_proofs(nonce_hash,channel,email_hash,terms_version,privacy_version,parent_declaration,accept_terms,declared_at,expires_at) values($1,'otp',$2,'2026-11-22','2026-11-22.1',true,true,$3::timestamptz-interval '31 minutes',$3::timestamptz-interval '1 minute')", [expired, hash('worker@example.test'), clock]);
  await role('service_role'); await rpc('claim_lifecycle_jobs', [1]);
  await owner(); assert.equal((await db.query('select count(*)::int n from private.parent_registration_proofs where nonce_hash=$1', [expired])).rows[0].n, 0, 'The warmed existing worker must clean expired proofs without another registration'); count++;

  for (const caller of ['anon', 'authenticated', 'service_role']) {
    await role(caller);
    await assert.rejects(db.exec('select * from private.parent_registration_proofs'), e => e.code === '42501');
    await assert.rejects(db.exec('select private.cleanup_parent_registrations()'), e => e.code === '42501');
    await assert.rejects(db.exec('select private.lifecycle_now()'), e => e.code === '42501'); count++;
  }
  await owner();
  for (const name of ['begin_parent_registration', 'complete_parent_registration']) assert.equal((await db.query("select prosecdef from pg_proc where oid=($1)::regprocedure", [name === 'begin_parent_registration' ? 'public.begin_parent_registration(text,text,text,text,text,boolean,boolean)' : 'public.complete_parent_registration(text,text)'])).rows[0].prosecdef, false);
  await role();
  for (const [terms, privacy, guardian, accepted] of [['old', currentPrivacyVersion, true, true], ['2026-11-22', '2026-11-22', true, true], ['2026-11-22', '2026-11-22.1', true, true], ['2026-11-22', currentPrivacyVersion, false, true], ['2026-11-22', currentPrivacyVersion, true, false]]) { await assert.rejects(begin('bad-' + count++, 'otp', 'parent-a@example.test', terms, privacy, guardian, accepted), e => e.code === '22023'); }
  await assert.rejects(complete('missing'), e => e.code === '42501'); count++;
  const issued = await begin('otp-proof'); const same = await begin('otp-proof'); assert.deepEqual(same, issued, 'Identical starts cannot extend proof lifetime'); count++;
  await identity(B); assert.equal((await complete('otp-proof')).completed, false); assert.equal((await state(B)).state, 'onboarding'); count++;
  await identity(A, { method: 'oauth' }); assert.equal((await complete('otp-proof')).completed, false); count++;
  await identity(A, { age: 301 }); await assert.rejects(complete('otp-proof'), e => e.code === '28000'); count++;
  await identity(A, { session: false }); await assert.rejects(complete('otp-proof'), e => e.code === '42501'); count++;
  await identity(A); assert.equal((await complete('otp-proof')).completed, true); assert.equal((await state(A)).state, 'active'); count++;
  const firstProof = await proof('otp-proof');
  await owner(); const acceptance = (await db.query('select * from private.parent_acceptances where parent_id=$1', [A])).rows[0];
  assert.equal(new Date(acceptance.registration_declared_at).toISOString(), clock); assert.equal(acceptance.signup_channel, 'otp');
  await tick('2026-11-22T12:01:00.000Z'); await identity(A); assert.equal((await complete('otp-proof')).completed, true); assert.deepEqual(await proof('otp-proof'), firstProof, 'Same-parent completion is idempotent without extending evidence'); count++;
  await identity(B); assert.equal((await complete('otp-proof')).completed, false); assert.equal((await state(B)).state, 'onboarding'); count++;
  await role(); await begin('google-proof', 'google');
  await identity(B); assert.equal((await complete('google-proof', 'google')).completed, false, 'An existing fresh OTP session cannot consume a Google proof'); count++;
  await identity(B, { method: 'oauth' }); assert.equal((await complete('google-proof', 'google')).completed, true); assert.equal((await state(B)).state, 'active'); count++;
  await owner(); assert.equal((await db.query('select signup_channel from private.parent_acceptances where parent_id=$1', [B])).rows[0].signup_channel, 'google');
  await role(); await begin('expired-proof', 'otp', 'parent-c@example.test');
  await tick('2026-11-22T12:31:00.000Z'); await identity(C); assert.equal((await complete('expired-proof')).completed, false); assert.equal((await state(C)).state, 'onboarding'); count++;
  await role(); await begin('stale-version-proof', 'otp', 'parent-c@example.test');
  await owner(); await db.query("update private.parent_registration_proofs set privacy_version='old' where nonce_hash=$1", [hash('stale-version-proof')]);
  await identity(C); assert.equal((await complete('stale-version-proof')).completed, false); assert.equal((await state(C)).state, 'onboarding'); count++;
  await role(); await begin('already-complete', 'otp', 'parent-a@example.test');
  await identity(A); assert.equal((await complete('already-complete')).completed, true);
  await owner(); assert.deepEqual((await db.query('select * from private.parent_acceptances where parent_id=$1', [A])).rows[0], acceptance, 'An existing completed account is never re-accepted or backdated'); count++;
  await identity(A); await rpc('request_account_deletion'); const pending = await state(A);
  await role(); await begin('pending-proof', 'otp', 'parent-a@example.test');
  await identity(A); assert.equal((await complete('pending-proof')).completed, false); assert.deepEqual(await state(A), pending, 'Registration completion never restores a pending deletion or moves its deadline'); count++;
  await role();
  for (let i = 0; i < 5; i++) await begin('rate-' + i, 'otp', 'rate@example.test');
  await assert.rejects(begin('rate-overflow', 'otp', 'rate@example.test'), e => e.message === 'registration_rate_limited'); count++;
  // Fill synthetic rows as database owner to exercise exact bounds cheaply.
  await owner(); await db.exec('delete from private.parent_registration_proofs');
  await db.query("insert into private.parent_registration_proofs(nonce_hash,channel,terms_version,privacy_version,parent_declaration,accept_terms,declared_at,expires_at) select lpad(to_hex(n),64,'0'),'google','2026-11-22','2026-11-22.1',true,true,$1,$1::timestamptz+interval '30 minutes' from generate_series(1,100) n", [clock]);
  await role(); await assert.rejects(begin('minute-overflow', 'google'), e => e.message === 'registration_rate_limited'); count++;
  await owner(); await db.exec('delete from private.parent_registration_proofs');
  await db.query("insert into private.parent_registration_proofs(nonce_hash,channel,terms_version,privacy_version,parent_declaration,accept_terms,declared_at,expires_at) select lpad(to_hex(n),64,'0'),'google','2026-11-22','2026-11-22.1',true,true,$1::timestamptz-interval '2 minutes',$1::timestamptz+interval '28 minutes' from generate_series(1,1000) n", [clock]);
  await role(); await assert.rejects(begin('global-overflow', 'google'), e => e.message === 'registration_rate_limited'); count++;
  await tick('2026-11-22T13:02:00.000Z'); await role('service_role'); await rpc('claim_lifecycle_jobs', [1]); await owner(); assert.equal((await db.query('select count(*)::int n from private.parent_registration_proofs')).rows[0].n, 0); count++;
  console.log(`Registration DB checks passed: ${count} real-SQL scenarios, current declarations, verified email/channel/session binding, once-only completion, replay/pending-delete protection, private grants, bounded anonymous admission and warmed-worker expiry cleanup.`);
} finally { await db.close(); }
