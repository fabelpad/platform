import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { installBillingFixture } from './billing/database-fixture.mjs';
import { currentLegalVersions } from './legal-fixture.mjs';
import { compileSource } from './source-test-loader.mjs';

// Execute the real chronological migrations and real SQL privileges. Only Auth
// sessions, the wall clock and unavailable hosted extensions are fixture-owned.
test('optional marketing consent: verified evidence, isolation, withdrawal and deletion', async t => {
 const db = new PGlite({ extensions: { pgcrypto } });
 const temporary = await mkdtemp(join(tmpdir(), 'fabelpad-marketing-sql-'));
 const { MARKETING_CONSENT_VERSION: version, MARKETING_CONSENT_TEXT: wording } = await import(await compileSource(new URL('../lib/email/marketingConsent.ts', import.meta.url), temporary));
 const ids = Array.from({ length: 7 }, (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`);
 const [A,B,C,D,E,F,G] = ids, sid = '99999999-9999-4999-8999-999999999999';
 const hash = value => createHash('sha256').update(value).digest('hex');
 let clock = '2026-11-24T16:00:00.000Z', terms, privacy;
 const owner = () => db.exec('reset role');
 const tick = async value => { clock = value; await owner(); await db.exec(`create or replace function private.lifecycle_now() returns timestamptz language sql volatile set search_path='' as $$ select '${value}'::timestamptz $$`); };
 const identity = async (id, { method='otp', age=0, session=true }={}) => {
  await owner(); await db.query('delete from auth.sessions where id=$1',[sid]);
  if (session) await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[sid,id]);
  await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id,session_id:sid,amr:[{method,timestamp:Date.parse(clock)/1000-age}]})]);
  await db.exec('set role authenticated');
 };
 const anonymous = async () => { await owner(); await db.query("select set_config('request.jwt.claims','{}',false)"); await db.exec('set role anon'); };
 const rpc = async (name,args=[]) => (await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args)).rows[0].result;
 const begin = (nonce,id,consent,channel='otp') => rpc('begin_parent_registration_with_marketing',[hash(nonce),channel,channel==='otp'?hash(`parent-${ids.indexOf(id)}@example.test`):null,terms,privacy,true,true,consent]);
 const complete = (nonce,channel='otp') => rpc('complete_parent_registration',[hash(nonce),channel]);
 const onboarding = consent => rpc('complete_parent_onboarding_with_marketing',[terms,privacy,true,true,consent]);
 const prefs = () => rpc('get_parent_email_preferences');
 const rows = async (table,id) => { await owner(); return (await db.query(`select * from private.${table} where parent_id=$1 order by ${table==='parent_email_preferences'?'updated_at':'recorded_at'}`,[id])).rows; };
 try {
  await installBillingFixture(db); ({terms,privacy}=await currentLegalVersions(db)); await tick(clock);
  for (const [index,id] of ids.entries()) await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,$3)',[id,`parent-${index}@example.test`,clock]);
  await t.test('no backfill, private tables/helper, explicit RPC grants and invoker wrappers', async () => {
   assert.equal((await db.query('select count(*)::int n from private.parent_email_preferences')).rows[0].n,0);
   const signatures=['begin_parent_registration_with_marketing(text,text,text,text,text,boolean,boolean,boolean)','complete_parent_onboarding_with_marketing(text,text,boolean,boolean,boolean)','get_parent_email_preferences()','set_parent_email_preferences(boolean)'];
   for (const signature of signatures) {
    assert.equal((await db.query('select prosecdef from pg_proc where oid=$1::regprocedure',[`public.${signature}`])).rows[0].prosecdef,false);
    for (const role of ['anon','authenticated','service_role']) {
     const allowed=role==='authenticated'||role==='anon'&&signature.startsWith('begin_');
     for(const schema of ['private','public']) assert.equal((await db.query('select has_function_privilege($1,$2,\'execute\') yes',[role,`${schema}.${signature}`])).rows[0].yes,allowed,`${role}:${schema}.${signature}`);
    }
   }
   for(const role of ['anon','authenticated','service_role']) {
    await owner(); await db.exec(`set role ${role}`);
    for(const table of ['parent_email_preferences','parent_marketing_consent_events']) await assert.rejects(db.exec(`select * from private.${table}`),e=>e.code==='42501');
    await assert.rejects(db.query('select private.initialize_parent_email_preferences($1,true,\'account\',now(),$2,$3)',[A,version,wording]),e=>e.code==='42501');
   }
   await anonymous(); for(const [name,args] of [['get_parent_email_preferences',[]],['set_parent_email_preferences',[true]],['complete_parent_onboarding_with_marketing',[terms,privacy,true,true,true]]]) await assert.rejects(rpc(name,args),e=>e.code==='42501');
  });
  await t.test('legacy proof defaults false and creates no invented checkbox evidence', async () => {
   await owner(); await db.query('update auth.users set raw_user_meta_data=$1 where id=$2',[{marketingConsent:true,marketing_consent:true},A]);
   await anonymous(); await rpc('begin_parent_registration',[hash('legacy'), 'otp',hash('parent-0@example.test'),terms,privacy,true,true]);
   await identity(A); assert.equal((await complete('legacy')).completed,true); assert.deepEqual(await prefs(),{marketingConsent:false,updatedAt:null});
   assert.equal((await rows('parent_marketing_consent_events',A)).length,0);
  });
  await t.test('choice is immutable, no preference before verified identity/channel/email', async () => {
   await anonymous(); const first=await begin('optin',B,true); assert.deepEqual(await begin('optin',B,true),first);
   await assert.rejects(begin('optin',B,false),e=>e.code==='22023');
   await owner(); assert.equal((await db.query('select count(*)::int n from private.parent_email_preferences')).rows[0].n,0);
   await identity(C); assert.equal((await complete('optin')).completed,false);
   await identity(B,{method:'oauth'}); assert.equal((await complete('optin')).completed,false);
   await identity(B,{age:301}); await assert.rejects(complete('optin'),e=>e.code==='28000');
   await identity(B,{session:false}); await assert.rejects(complete('optin'),e=>e.code==='42501');
   await identity(B); assert.equal((await complete('optin')).completed,true); assert.equal((await prefs()).marketingConsent,true);
   const [preference]=await rows('parent_email_preferences',B); assert.equal(preference.consent_version,version); assert.equal(preference.consent_text,wording); assert.equal(preference.channel,'otp'); assert.equal(preference.declared_at.toISOString(),clock); assert.ok(preference.granted_at); assert.equal(preference.withdrawn_at,null);
   assert.equal((await rows('parent_marketing_consent_events',B)).length,1);
  });
  await t.test('withdrawal is durable and idempotent; replay/new registration/reaccept cannot re-opt-in', async () => {
   await tick('2026-11-24T16:01:00.000Z'); await identity(B); let result=await rpc('set_parent_email_preferences',[false]); assert.equal(result.marketingConsent,false);
   const [withdrawn]=await rows('parent_email_preferences',B); assert.equal(withdrawn.withdrawn_at.toISOString(),clock); assert.ok(withdrawn.granted_at);
   await identity(B); assert.deepEqual(await rpc('set_parent_email_preferences',[false]),result);
   assert.equal((await complete('optin')).completed,true); assert.deepEqual(await prefs(),result);
   await anonymous(); await begin('new-active-proof',B,true); await identity(B); assert.equal((await complete('new-active-proof')).completed,true); assert.deepEqual(await prefs(),result);
   await onboarding(true); assert.deepEqual(await prefs(),result);
   assert.equal((await rows('parent_marketing_consent_events',B)).length,2);
  });
  await t.test('Google proof must be consumed by fresh OAuth and preserves original declaration time', async () => {
   await anonymous(); await begin('google',C,true,'google'); await tick('2026-11-24T16:02:00.000Z');
   await identity(C); assert.equal((await complete('google','google')).completed,false);
   await identity(C,{method:'oauth'}); assert.equal((await complete('google','google')).completed,true); assert.equal((await prefs()).marketingConsent,true);
   const [p]=await rows('parent_email_preferences',C); assert.equal(p.channel,'google'); assert.equal(p.declared_at.toISOString(),'2026-11-24T16:01:00.000Z'); assert.equal(p.granted_at.toISOString(),clock);
  });
  await t.test('unchecked declaration does not block registration; server-verified fallback supports either choice', async () => {
   await anonymous(); await begin('unchecked',D,false); await identity(D); assert.equal((await complete('unchecked')).completed,true); assert.equal((await prefs()).marketingConsent,false);
   await identity(E,{age:301}); await assert.rejects(onboarding(true),e=>e.code==='28000');
   await identity(E); await onboarding(true); assert.equal((await prefs()).marketingConsent,true);
   await identity(F); await onboarding(false); assert.equal((await prefs()).marketingConsent,false);
   assert.equal((await rows('parent_email_preferences',E))[0].channel,'onboarding');
  });
  await t.test('own-actor preferences cannot leak or change another parent; malformed/null RPC choice rejected', async () => {
   await identity(A); assert.deepEqual(await prefs(),{marketingConsent:false,updatedAt:null});
   await rpc('set_parent_email_preferences',[true]); assert.equal((await prefs()).marketingConsent,true);
   await identity(B); assert.equal((await prefs()).marketingConsent,false);
   await assert.rejects(rpc('set_parent_email_preferences',[null]),e=>e.code==='22023');
   await anonymous(); await assert.rejects(begin('null-choice',G,null),e=>e.code==='22023');
  });
  await t.test('terms reacceptance retains current preference/evidence, including active accounts with no row', async () => {
   await identity(A); await rpc('set_parent_email_preferences',[false]);
   const before=await rows('parent_email_preferences',A); await owner(); await db.query("update private.account_lifecycle set terms_version='historical-terms' where parent_id=$1",[A]);
   await identity(A); await onboarding(true); assert.deepEqual(await rows('parent_email_preferences',A),before);
   await identity(G); await rpc('complete_parent_onboarding',[terms,privacy,true,true]); await onboarding(true); assert.deepEqual(await prefs(),{marketingConsent:false,updatedAt:null});
  });
  await t.test('pending deletion and revoked/anonymous sessions fail; definitive Auth deletion cascades all evidence', async () => {
   await identity(C); await rpc('request_account_deletion'); await identity(C);
   await assert.rejects(prefs(),e=>e.code==='42501'); await assert.rejects(rpc('set_parent_email_preferences',[false]),e=>e.code==='42501');
   await identity(B,{session:false}); await assert.rejects(prefs(),e=>e.code==='42501');
   await identity(D); await owner(); const claims=(await db.query('select auth.jwt() claims')).rows[0].claims;
   await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({...claims,is_anonymous:true})]); await db.exec('set role authenticated'); await assert.rejects(prefs(),e=>e.code==='42501');
   await owner(); await db.query('delete from auth.users where id=$1',[B]);
   for(const table of ['parent_email_preferences','parent_marketing_consent_events']) assert.equal((await rows(table,B)).length,0);
   await identity(B,{session:false}); await assert.rejects(prefs(),e=>e.code==='42501');
  });
 } finally { await db.close(); await rm(temporary,{recursive:true,force:true}); }
});
