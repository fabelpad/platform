import assert from 'node:assert/strict';
import { readFile, readdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { compileSource } from '../source-test-loader.mjs';
import { installEmailVaultTestFixture, localMigrationSql } from './settings-db-fixture.mjs';

const { PGlite } = await import(process.env.FABELPAD_PGLITE_MODULE ?? '@electric-sql/pglite');
const {pgcrypto}=await import('@electric-sql/pglite/contrib/pgcrypto');
const db = new PGlite({extensions:{pgcrypto}});
const temporary = await mkdtemp(join(tmpdir(), 'fabelpad-email-settings-db-'));
const administrator = '11111111-1111-4111-8111-111111111111';
const otherAdministrator = '22222222-2222-4222-8222-222222222222';
const parent = '33333333-3333-4333-8333-333333333333';
const anonymous = '44444444-4444-4444-8444-444444444444';
const unconfirmed = '55555555-5555-4555-8555-555555555555';
const syntheticKey = 're_synthetic_fixture_only';
const rotatedKey = 're_rotated_synthetic_fixture_only';
let counter = 0;
const request = () => `aaaaaaaa-aaaa-4aaa-8aaa-${String(++counter).padStart(12, '0')}`;

async function identity(id, role='authenticated', metadata={}) {
  await db.exec('reset role');
  if (id && role==='authenticated') await db.query('insert into auth.sessions(id,user_id) values($1,$1) on conflict do nothing',[id]);
  await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({sub:role==='service_role'?null:id,session_id:id,amr:[{method:'otp',timestamp:Math.floor(Date.now()/1000)}],...metadata})]);
  await db.exec(`set role ${role}`);
}
async function rpc(name, parameters=[]) {
  const argumentsSQL = parameters.map((_, index) => `$${index+1}`).join(',');
  return (await db.query(`select public.${name}(${argumentsSQL}) as result`,parameters)).rows[0].result;
}
async function denied(sql,parameters=[]) {
  await assert.rejects(db.query(sql,parameters),error=>error.code==='42501');
}
async function owner(callback) {
  await db.exec('reset role');
  return callback();
}
async function expireCooldown(actor=administrator) {
  await owner(()=>db.query("update private.email_delivery_tests set reserved_at=clock_timestamp()-interval '31 seconds' where actor_id=$1",[actor]));
  await identity(actor,'service_role');
}
const save = (expected,settings,key,receipt,requestId,actor=administrator) => rpc('save_email_settings',[actor,expected,JSON.stringify(settings),key,receipt,requestId]);
try {
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,
      is_anonymous boolean not null default false,raw_user_meta_data jsonb not null default '{}');
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt()->>'sub','')::uuid $$;
    grant usage on schema public,auth to anon,authenticated;
    grant execute on function auth.uid(),auth.jwt() to anon,authenticated;
  `);
  await installEmailVaultTestFixture(db);
  const migrationRoot = new URL('../../supabase/migrations/',import.meta.url);
  for (const name of (await readdir(migrationRoot)).filter(name=>name.endsWith('.sql')).sort()) {
    await db.exec(localMigrationSql(await readFile(new URL(name,migrationRoot),'utf8')));
  }
  await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now()),($3,$4,now()),($5,$6,now())',
    [administrator,'admin@example.test',otherAdministrator,'admin2@example.test',parent,'parent@example.test']);
  await db.query('insert into auth.users(id,email,email_confirmed_at,is_anonymous) values($1,$2,now(),true)',[anonymous,'anonymous@example.test']);
  await db.query('insert into auth.users(id,email) values($1,$2)',[unconfirmed,'unconfirmed@example.test']);
  await db.query('insert into public.content_admins(user_id) values($1),($2),($3),($4)',[administrator,otherAdministrator,anonymous,unconfirmed]);

  for (const id of [administrator,otherAdministrator,parent]) {
    await identity(id); await rpc('complete_parent_onboarding',['2026-11-22','2026-11-22',true,true]);
  }
  await db.exec('reset role');

  const {DEFAULT_EMAIL_SETTINGS,parseEmailSettings,parseResendApiKey,EMAIL_TEMPLATE_ACTIONS,EMAIL_TEMPLATE_IDS} = await import(await compileSource(new URL('../../lib/email/settings.ts',import.meta.url),temporary));
  const {AUTH_EMAIL_CATALOG} = await import(await compileSource(new URL('../../lib/email/templates.ts',import.meta.url),temporary));
  assert.deepEqual([...EMAIL_TEMPLATE_ACTIONS].sort(),Object.keys(AUTH_EMAIL_CATALOG).sort());
  assert.equal(EMAIL_TEMPLATE_IDS.length,17);
  const defaults=parseEmailSettings(DEFAULT_EMAIL_SETTINGS);
  assert.deepEqual((await db.query('select private.email_settings_defaults() as result')).rows[0].result,defaults);
  assert.equal(parseResendApiKey(` ${syntheticKey} `),syntheticKey);
  for (const key of ['invalid',syntheticKey+'\nBcc: private@example.test',null]) assert.throws(()=>parseResendApiKey(key));
  const malformed = [null,[],{},'invalid',1,true, {...defaults,apiKey:syntheticKey}, {...defaults,fromName:'Fabelpad\r\nBcc: injected'},
    {...defaults,fromEmail:'invalid'}, {...defaults,footerText:'<script>injected</script>'},
    {...defaults,templates:{unknown:{subject:'S',title:'T',intro:'I'}}},
    {...defaults,templates:{magiclink:{subject:'S',title:'T',intro:'I',html:'<b>not allowed</b>'}}},
    {...defaults,templates:{magiclink:{subject:'🙂'.repeat(161),title:'T',intro:'I'}}},
  ];
  for (const value of malformed) {
    assert.throws(()=>parseEmailSettings(value));
    assert.equal((await db.query('select private.valid_email_settings($1::jsonb) as valid',[JSON.stringify(value)])).rows[0].valid,false,'Direct RPC payloads cannot bypass the client contract');
  }
  const settings=parseEmailSettings({...defaults,fromName:'Fabelpad Familie',templates:{magiclink:{subject:'Je persoonlijke inlogcode',title:'Welkom terug',intro:'Vul je code in om verder te lezen.'}}});
  assert.equal((await db.query('select private.valid_email_settings($1::jsonb) as valid',[JSON.stringify(settings)])).rows[0].valid,true);
  const multiline=parseEmailSettings({...settings,footerText:'Servicebericht\r\nVragen? Neem contact op.',templates:{magiclink:{...settings.templates.magiclink,intro:'Welkom terug.\r\nVul je code in.'}}});
  assert.equal(multiline.footerText,'Servicebericht\nVragen? Neem contact op.');
  assert.equal((await db.query('select private.valid_email_settings($1::jsonb) as valid',[JSON.stringify(multiline)])).rows[0].valid,true,'Plain-text textarea newlines remain valid after normalization');
  const allTemplates=parseEmailSettings({...settings,templates:Object.fromEntries(EMAIL_TEMPLATE_IDS.map(id=>[id,{subject:'Onderwerp',title:'Titel',intro:'Inleiding'}]))});
  assert.equal((await db.query('select private.valid_email_settings($1::jsonb) as valid',[JSON.stringify(allTemplates)])).rows[0].valid,true,'All 13 Auth and 4 application templates can be edited');

  for (const id of [parent,anonymous,unconfirmed]) {
    await identity(id,'authenticated',{user_metadata:{admin:true,role:'admin',email_verified:true}});
    await denied('select public.get_email_settings()');
  }
  await identity(administrator);
  assert.deepEqual(await rpc('get_email_settings'),{revision:0,settings:defaults,keyConfigured:false,lastTestAt:null,lastTestProviderId:null});
  for (const role of ['anon','authenticated']) {
    await identity(administrator,role);
    await denied('select public.get_email_delivery_config()');
    await denied('select public.save_email_settings($1,0,$2::jsonb,$3,$4,$5)',[administrator,JSON.stringify(settings),syntheticKey,'synthetic-receipt',request()]);
    await denied('select public.reserve_email_test($1,$2)',[administrator,request()]);
    await denied('select public.record_email_test($1,0,$2,$3)',[administrator,'synthetic-receipt',request()]);
    await denied('select * from private.email_delivery_settings');
    await denied('select * from vault.decrypted_secrets');
  }
  await identity(administrator,'service_role');
  assert.equal(await rpc('get_email_delivery_config'),null,'Only an absent saved configuration permits the initial environment fallback');
  await denied('select * from private.email_delivery_settings');
  for (const id of [parent,anonymous,unconfirmed]) await assert.rejects(rpc('reserve_email_test',[id,request()]),error=>error.code==='42501');

  const first=request();
  assert.deepEqual(await rpc('reserve_email_test',[administrator,first]),{allowed:true,retryAfter:0});
  assert.equal((await rpc('reserve_email_test',[administrator,first])).allowed,false,'A repeated request cannot be reused with a changed message');
  const throttled=await rpc('reserve_email_test',[administrator,request()]);
  assert.equal(throttled.allowed,false); assert.ok(throttled.retryAfter>0&&throttled.retryAfter<=30);
  await assert.rejects(save(0,settings,null,'synthetic-receipt',first),error=>error.code==='22023');
  await assert.rejects(save(0,settings,syntheticKey,'synthetic-receipt',request()),error=>error.code==='22023');
  await assert.rejects(save(0,settings,syntheticKey,'synthetic-receipt',first,otherAdministrator),error=>error.code==='22023','One administrator cannot consume another administrator\'s accepted test');
  const initial=await save(0,settings,syntheticKey,'synthetic-receipt',first);
  assert.equal(initial.saved,true); assert.equal(initial.revision,1); assert.equal(initial.keyConfigured,true);
  assert.equal(JSON.stringify(initial).includes(syntheticKey),false);
  const runtime=await rpc('get_email_delivery_config');
  assert.equal(runtime.apiKey,syntheticKey); assert.deepEqual(runtime.settings,settings);
  await assert.rejects(save(1,settings,rotatedKey,'another-receipt',first),error=>error.code==='22023','A consumed test cannot authorize a second save');

  await expireCooldown();
  const staleRequest=request();
  assert.equal((await rpc('reserve_email_test',[administrator,staleRequest])).allowed,true);
  const stale=await save(0,settings,rotatedKey,'stale-receipt',staleRequest);
  assert.equal(stale.saved,false); assert.equal(stale.revision,1);
  assert.equal((await rpc('get_email_delivery_config')).apiKey,syntheticKey,'A stale editor never rotates the Vault key');
  assert.equal((await owner(()=>db.query('select count(*)::integer as count from vault.test_writes'))).rows[0].count,1);

  await identity(administrator,'service_role');
  const rotated=await save(1,settings,rotatedKey,'rotation-receipt',staleRequest);
  assert.equal(rotated.revision,2); assert.equal(rotated.saved,true);
  assert.equal((await rpc('get_email_delivery_config')).apiKey,rotatedKey);
  assert.equal((await owner(()=>db.query('select count(*)::integer as count from vault.secrets'))).rows[0].count,1,'Rotating a key updates its existing Vault slot');

  await expireCooldown();
  const keepRequest=request();
  assert.equal((await rpc('reserve_email_test',[administrator,keepRequest])).allowed,true);
  const edited=parseEmailSettings({...settings,replyTo:'help@example.test'});
  assert.equal((await save(2,edited,null,'keep-key-receipt',keepRequest)).revision,3);
  assert.equal((await rpc('get_email_delivery_config')).apiKey,rotatedKey,'An empty password editor preserves the existing key');
  assert.equal((await owner(()=>db.query('select count(*)::integer as count from vault.test_writes'))).rows[0].count,2,'Keeping a key performs no Vault mutation');

  await expireCooldown();
  const expiredRequest=request(); await rpc('reserve_email_test',[administrator,expiredRequest]);
  await owner(()=>db.query("update private.email_delivery_tests set reserved_at=clock_timestamp()-interval '6 minutes' where request_id=$1",[expiredRequest]));
  await identity(administrator,'service_role');
  await assert.rejects(save(3,settings,syntheticKey,'expired-receipt',expiredRequest),error=>error.code==='22023','An expired test cannot authorize a later configuration change');

  await expireCooldown();
  const revokedRequest=request();
  await rpc('reserve_email_test',[administrator,revokedRequest]);
  await owner(()=>db.query('update auth.users set email_confirmed_at=null where id=$1',[administrator]));
  await identity(administrator,'service_role');
  await assert.rejects(save(3,settings,syntheticKey,'revoked-receipt',revokedRequest),error=>error.code==='42501','Authorization is checked again after sending');
  await owner(()=>db.query('update auth.users set email_confirmed_at=now() where id=$1',[administrator]));
  await identity(administrator,'service_role');
  const beforeTest=(await rpc('get_email_delivery_config')).revision;
  const tested=await rpc('record_email_test',[administrator,beforeTest,'confirmed-test-receipt',revokedRequest]);
  assert.equal(tested.saved,true); assert.equal(tested.revision,beforeTest); assert.equal(tested.lastTestProviderId,'confirmed-test-receipt');

  await expireCooldown(administrator);
  const requestA=request(); await rpc('reserve_email_test',[administrator,requestA]);
  await identity(otherAdministrator,'service_role');
  const requestB=request(); await rpc('reserve_email_test',[otherAdministrator,requestB]);
  const contenders=await Promise.all([
    save(3,settings,null,'race-receipt-A',requestA),
    save(3,edited,null,'race-receipt-B',requestB,otherAdministrator),
  ]);
  assert.deepEqual(contenders.map(result=>result.saved).sort(),[false,true]);
  assert.deepEqual(contenders.map(result=>result.revision),[4,4],'Competing editors cannot overwrite a newer tested configuration');

  await identity(administrator);
  const masked=await rpc('get_email_settings');
  assert.equal(masked.revision,4); assert.equal(masked.keyConfigured,true);
  assert.equal(Object.hasOwn(masked,'apiKey'),false); assert.equal(JSON.stringify(masked).includes(rotatedKey),false);
  await owner(()=>db.exec(`
    -- A local, synthetic rotation between two reads in one SQL statement exposes
    -- a VOLATILE getter's fresh-snapshot bug without needing a second server.
    create function private.test_rotate_email_snapshot() returns boolean language plpgsql volatile security definer set search_path='' as $$ begin
      update vault.secrets set secret='re_snapshot_synthetic_fixture_only';
      update private.email_delivery_settings set revision=revision+1,settings=jsonb_set(settings,'{fromName}','"Snapshot rotation"'::jsonb);
      return true;
    end $$;
    revoke all on function private.test_rotate_email_snapshot() from public,anon,authenticated;
    grant execute on function private.test_rotate_email_snapshot() to service_role;
  `));
  await identity(administrator,'service_role');
  const consistent=(await db.query(`
    with initial as materialized(select public.get_email_delivery_config() as config),
      rotated as materialized(select private.test_rotate_email_snapshot() from initial),
      observed as materialized(select public.get_email_delivery_config() as config from rotated)
    select initial.config as initial,observed.config as observed from initial cross join observed
  `)).rows[0];
  assert.equal(consistent.initial.revision,4);
  assert.deepEqual(consistent.observed,consistent.initial,'One SQL statement retains one revision/settings/key snapshot even when a volatile rotation runs between reads');
  const following=await rpc('get_email_delivery_config');
  assert.equal(following.revision,5); assert.equal(following.settings.fromName,'Snapshot rotation'); assert.equal(following.apiKey,'re_snapshot_synthetic_fixture_only','The next statement sees the complete newly committed combination');
  await owner(async()=>{
    await db.exec('drop function private.test_rotate_email_snapshot()');
    for (const role of ['anon','authenticated']) {
      const functions=(await db.query("select p.oid::regprocedure::text as name,has_function_privilege($1,p.oid,'EXECUTE') as allowed from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.prosecdef and p.proname like '%email%'",[role])).rows;
      assert.deepEqual(functions.filter(value=>value.allowed).map(value=>value.name),role==='authenticated'?['private.get_email_settings()']:[]);
    }
    const publicDefiners=(await db.query("select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and p.proname like '%email%'" )).rows;
    assert.equal(publicDefiners.length,0,'Exposed RPC wrappers never become SECURITY DEFINER');
    await db.exec('delete from vault.secrets');
  });
  await identity(administrator,'service_role');
  await assert.rejects(rpc('get_email_delivery_config'),error=>error.code==='55000','A missing saved key fails closed; old environment credentials cannot take over');
  await identity(administrator);
  assert.equal((await rpc('get_email_settings')).keyConfigured,false);
  console.log('Email settings: real SQL permissions, verified-admin checks, Vault boundary, CAS, key rotation, test receipts and persistent throttling passed. Vault encryption itself is tested by Supabase, not the local stub.');
} finally {
  await db.close();
  await rm(temporary,{recursive:true,force:true});
}
