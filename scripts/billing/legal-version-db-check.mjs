import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { installEmailVaultTestFixture, localMigrationSql } from '../email/settings-db-fixture.mjs';
const { PGlite } = await import(process.env.FABELPAD_PGLITE_MODULE ?? '@electric-sql/pglite');
const { pgcrypto } = await import('@electric-sql/pglite/contrib/pgcrypto');
const db = new PGlite({ extensions: { pgcrypto } });
const upgrade = '20261123121009_billing_legal_documents_v20261123_1.sql', version = '2026-11-23.1';
const actor = 'c3d53744-553a-4e8c-82bf-2a3ec4288d51';
const owner = () => db.exec('reset role');
const rpc = async (name, params = []) => (await db.query(`select public.${name}(${params.map((_,i)=>'$'+(i+1)).join(',')}) result`, params)).rows[0].result;
async function identify() {
  await owner(); await db.query('insert into auth.sessions(id,user_id) values($1,$1) on conflict do nothing',[actor]);
  await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:actor,session_id:actor,amr:[{method:'otp',timestamp:Date.now()/1000}]})]); await db.exec('set role authenticated');
}
try {
  await db.exec(`create role anon nologin;create role authenticated nologin;create schema auth;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean not null default false,raw_user_meta_data jsonb not null default '{}');
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt()->>'sub','')::uuid $$;
    grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid(),auth.jwt() to anon,authenticated;`);
  await installEmailVaultTestFixture(db);
  const root = new URL('../../supabase/migrations/',import.meta.url), names=(await readdir(root)).filter(name=>name.endsWith('.sql')).sort();
  for (const name of names.filter(name=>name<upgrade)) await db.exec(localMigrationSql(await readFile(new URL(name,root),'utf8')));
  await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'synthetic-parent@example.test',now())",[actor]);
  await identify(); await rpc('complete_parent_onboarding',['2026-11-22','2026-11-23',true,true]); await rpc('consent_child_profile',['kept-child',true,true]);
  const snapshot={schemaVersion:1,family:{version:1,children:[{id:'kept-child',name:'Robin',avatar:0,birthDate:'2018-01-01'}],activeId:'kept-child'},data:{'kept-child':{prefs:{muted:false,calm:true,readingLevel:'6to8'},'story-station':{picks:[1,0,1],updatedAt:1790000000000}}}};
  await rpc('save_family_snapshot',[0,JSON.stringify(snapshot)]); await owner();
  const history=(await db.query('select * from private.legal_document_versions order by kind,version')).rows;
  const accepted=(await db.query('select * from private.parent_acceptances where parent_id=$1',[actor])).rows;
  const consents=(await db.query('select * from private.child_profile_consents where parent_id=$1',[actor])).rows;
  const gates=(await db.query('select payment_required,founders_enabled,mollie_enabled,play_enabled from private.billing_control')).rows;
  const acl=(await db.query("select oid::regprocedure::text signature,proacl::text acl from pg_proc where pronamespace='private'::regnamespace and prosrc like '%2026-11-22%' order by 1")).rows;
  await db.exec(localMigrationSql(await readFile(new URL(upgrade,root),'utf8')));
  for(const row of history) assert.deepEqual((await db.query('select * from private.legal_document_versions where kind=$1 and version=$2',[row.kind,row.version])).rows[0],row);
  assert.deepEqual((await db.query('select * from private.parent_acceptances where parent_id=$1',[actor])).rows,accepted);
  assert.deepEqual((await db.query('select * from private.child_profile_consents where parent_id=$1',[actor])).rows,consents);
  assert.deepEqual((await db.query('select payment_required,founders_enabled,mollie_enabled,play_enabled from private.billing_control')).rows,gates);
  for(const row of acl) assert.equal((await db.query('select proacl::text acl from pg_proc where oid=$1::regprocedure',[row.signature])).rows[0].acl,row.acl);
  for(const [kind,filename]of [['terms','algemene-voorwaarden.md'],['privacy','privacyverklaring.md']]) {
    const text=await readFile(new URL(`../../public/legal/${version}/${filename}`,import.meta.url),'utf8');
    const row=(await db.query('select document_text,sha256 from private.legal_document_versions where kind=$1 and version=$2',[kind,version])).rows[0];
    assert.equal(row.document_text,text);assert.equal(row.sha256,createHash('sha256').update(text).digest('hex'));
  }
  await identify(); const status=await rpc('get_account_lifecycle');assert.equal(status.termsVersion,version);assert.equal(status.privacyVersion,version);assert.equal(status.acceptedTermsVersion,'2026-11-22');
  assert.equal((await db.query('select snapshot from public.family_documents')).rows.length,0,'Current terms require a conscious parent confirmation before online family access resumes');
  await assert.rejects(rpc('complete_parent_onboarding',['2026-11-22','2026-11-23',true,true]),error=>error.message==='document_version_changed');
  await rpc('complete_parent_onboarding',[version,version,true,true]);
  assert.deepEqual((await db.query('select snapshot from public.family_documents')).rows[0].snapshot,snapshot);
  await owner();assert.equal((await db.query('select count(*)::integer count from private.parent_acceptances where parent_id=$1',[actor])).rows[0].count,2);
  assert.deepEqual((await db.query("select * from private.parent_acceptances where parent_id=$1 and terms_version='2026-11-22'",[actor])).rows,accepted);
  assert.deepEqual((await db.query('select * from private.child_profile_consents where parent_id=$1',[actor])).rows,consents);
  await db.exec('set role anon');await assert.rejects(db.query('select * from private.legal_document_versions'),error=>error.code==='42501');
  console.log('Billing legal migration: fresh schema, exact immutable document hashes, retained historical acceptances/consents/profiles, unchanged four gates and ACLs, explicit current-terms confirmation and restored family access verified locally.');
}catch(error){console.error('Billing legal migration check failed:',error.code??'',error.message,error.where??'');if(error.position&&typeof error.query==='string')console.error(error.query.slice(Math.max(0,Number(error.position)-160),Number(error.position)+160));process.exitCode=1;}finally{await db.close();}
