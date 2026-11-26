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
async function identify(parent = actor, method = 'otp') {
  await owner(); await db.query('insert into auth.sessions(id,user_id) values($1,$1) on conflict do nothing',[parent]);
  await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:parent,session_id:parent,amr:[{method,timestamp:Date.now()/1000}]})]); await db.exec('set role authenticated');
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

  // A later informational privacy version must not create another agreement.
  const privacyUpgrade = '20261124155911_marketing_privacy_information_v20261124.sql', privacyVersion = '2026-11-24';
  await owner();
  for (const name of names.filter(name => name > upgrade && name < privacyUpgrade)) await db.exec(localMigrationSql(await readFile(new URL(name,root),'utf8')));
  const hash = text => createHash('sha256').update(text).digest('hex');
  const completedNonce = hash('privacy-upgrade-consumed-proof'), unfinishedNonce = hash('privacy-upgrade-unused-proof');
  const begin = (nonce, channel = 'otp', email = 'synthetic-parent@example.test', offeredPrivacy = version) => rpc('begin_parent_registration', [nonce,channel,channel === 'otp' ? hash(email) : null,version,offeredPrivacy,true,true]);
  await db.exec('set role anon'); await begin(completedNonce); await identify();
  assert.equal((await rpc('complete_parent_registration',[completedNonce,'otp'])).completed,true);
  await owner(); await db.exec('set role anon'); await begin(unfinishedNonce); await owner();
  const previousCatalog=(await db.query('select * from private.legal_document_versions order by kind,version')).rows;
  const previousAcceptances=(await db.query('select * from private.parent_acceptances order by parent_id,terms_version')).rows;
  const previousConsents=(await db.query('select * from private.child_profile_consents order by parent_id,child_id')).rows;
  const previousFamily=(await db.query('select * from public.family_documents')).rows;
  const previousBilling=(await db.query('select * from private.billing_control')).rows[0];
  const previousHistory=(await db.query('select * from private.billing_history order by revision')).rows;
  const replacements = [
    ['private.get_account_lifecycle()', "'privacyVersion','2026-11-23.1'", "'privacyVersion','2026-11-24'"],
    ['private.complete_parent_onboarding(text,text,boolean,boolean,text)', "p_privacy_version is distinct from '2026-11-23.1'", "p_privacy_version is distinct from '2026-11-24'"],
    ['private.begin_parent_registration(text,text,text,text,text,boolean,boolean)', "p_privacy_version is distinct from '2026-11-23.1'", "p_privacy_version is distinct from '2026-11-24'"],
    ['private.complete_parent_registration(text,text)', "proof.privacy_version<>'2026-11-23.1'", "proof.privacy_version<>'2026-11-24'"],
    ['private.consent_child_profile(text,boolean,boolean)', "values(actor,p_child_id,t,'2026-11-23.1',true)", "values(actor,p_child_id,t,'2026-11-24',true)"],
    ['private.billing_defaults()', "'privacyVersion','2026-11-23.1'", "'privacyVersion','2026-11-24'"],
  ];
  const definitions = async () => (await db.query("select oid::regprocedure::text signature,pg_get_functiondef(oid) definition,proacl::text acl from pg_proc where pronamespace in ('private'::regnamespace,'public'::regnamespace) order by 1")).rows;
  const beforeDefinitions = await definitions();
  await db.exec(localMigrationSql(await readFile(new URL(privacyUpgrade,root),'utf8')));
  for (const row of previousCatalog) assert.deepEqual((await db.query('select * from private.legal_document_versions where kind=$1 and version=$2',[row.kind,row.version])).rows[0],row,'Historical document bytes and hashes stay exact');
  assert.deepEqual((await db.query('select * from private.parent_acceptances order by parent_id,terms_version')).rows,previousAcceptances,'No new, redated or rewritten agreement for privacy information');
  assert.deepEqual((await db.query('select * from private.child_profile_consents order by parent_id,child_id')).rows,previousConsents);
  assert.deepEqual((await db.query('select * from public.family_documents')).rows,previousFamily);
  const afterDefinitions = await definitions();
  for (const before of beforeDefinitions) {
    const after = afterDefinitions.find(row => row.signature === before.signature);
    const replacement = replacements.find(([signature]) => signature === before.signature);
    assert.deepEqual(after,{...before,definition:replacement ? before.definition.replaceAll(replacement[1],replacement[2]) : before.definition},`${before.signature} changes only its explicit privacy context and retains ACL/security/marketing integration`);
  }
  const afterBilling=(await db.query('select * from private.billing_control')).rows[0];
  assert.deepEqual(afterBilling.settings,{...previousBilling.settings,privacyVersion},'Only current offer privacy information changes');
  for (const gate of ['payment_required','founders_enabled','mollie_enabled','play_enabled','awarded','campaign_started_at']) assert.deepEqual(afterBilling[gate],previousBilling[gate],gate);
  assert.equal(Number(afterBilling.revision),Number(previousBilling.revision)+1);
  assert.deepEqual((await db.query('select * from private.billing_history where revision<=$1 order by revision',[previousBilling.revision])).rows,previousHistory,'Historical billing offers remain immutable');
  assert.equal((await db.query('select count(*)::integer count from private.billing_history')).rows[0].count,previousHistory.length+1);
  const privacyBytes=await readFile(new URL(`../../public/legal/${privacyVersion}/privacyverklaring.md`,import.meta.url),'utf8');
  const privacyDocument=(await db.query("select document_text,sha256 from private.legal_document_versions where kind='privacy' and version=$1",[privacyVersion])).rows[0];
  assert.equal(privacyDocument.document_text,privacyBytes);assert.equal(privacyDocument.sha256,hash(privacyBytes));
  await identify(); const informational=await rpc('get_account_lifecycle');
  assert.equal(informational.state,'active');assert.equal(informational.termsVersion,version);assert.equal(informational.privacyVersion,privacyVersion);
  assert.equal(informational.acceptedTermsVersion,version);assert.equal(informational.shownPrivacyVersion,version);
  assert.deepEqual((await db.query('select snapshot from public.family_documents')).rows[0].snapshot,snapshot,'Existing account keeps family access without another declaration');
  assert.equal((await rpc('get_billing_public_offer')).privacyVersion,privacyVersion);
  assert.equal((await rpc('complete_parent_registration',[completedNonce,'otp'])).completed,true,'Already consumed own proof stays idempotent');
  assert.equal((await rpc('complete_parent_registration',[unfinishedNonce,'otp'])).completed,false,'An unused old declaration cannot inform a new registration');
  await assert.rejects(rpc('complete_parent_onboarding',[version,version,true,true]),error=>error.message==='document_version_changed');
  await rpc('consent_child_profile',['new-information-child',true,true]);await owner();
  assert.equal((await db.query("select privacy_version from private.child_profile_consents where parent_id=$1 and child_id='new-information-child'",[actor])).rows[0].privacy_version,privacyVersion);
  const parents = ['d3d53744-553a-4e8c-82bf-2a3ec4288d51','e3d53744-553a-4e8c-82bf-2a3ec4288d51','f3d53744-553a-4e8c-82bf-2a3ec4288d51'];
  for (const [index,parent] of parents.entries()) {
    const email=`privacy-parent-${index}@example.test`, channel=index===1?'google':'otp';
    await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[parent,email]);
    if (index<2) {
      await db.exec('set role anon');await assert.rejects(begin(hash(`stale-${index}`),channel,email),error=>error.message==='document_version_changed');
      const nonce=hash(`new-${index}`);await begin(nonce,channel,email,privacyVersion);await identify(parent,index===1?'oauth':'otp');
      assert.equal((await rpc('complete_parent_registration',[nonce,channel])).completed,true);
    } else {await identify(parent);await rpc('complete_parent_onboarding',[version,privacyVersion,true,true]);}
    await owner();const accepted=(await db.query('select * from private.parent_acceptances where parent_id=$1',[parent])).rows[0];
    assert.equal(accepted.terms_version,version);assert.equal(accepted.privacy_version,privacyVersion);assert.equal(accepted.privacy_sha256,privacyDocument.sha256);
  }
  console.log('Marketing privacy-only upgrade: exact document hash, immutable agreements/consents/history, no forced acceptance, preserved routines/ACLs, current offer revision, stale/consumed proof handling, and new OTP/Google/direct declarations verified locally.');

}catch(error){console.error('Billing legal migration check failed:',error.code??'',error.message,error.where??'');if(error.position&&typeof error.query==='string')console.error(error.query.slice(Math.max(0,Number(error.position)-160),Number(error.position)+160));process.exitCode=1;}finally{await db.close();}
