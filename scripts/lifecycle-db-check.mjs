import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {installEmailVaultTestFixture,localMigrationSql} from './email/settings-db-fixture.mjs';
const {PGlite}=await import(process.env.FABELPAD_PGLITE_MODULE??'@electric-sql/pglite');
const {pgcrypto}=await import('@electric-sql/pglite/contrib/pgcrypto');
const db=new PGlite({extensions:{pgcrypto}});
const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222', ADMIN='33333333-3333-4333-8333-333333333333', LEGACY='44444444-4444-4444-8444-444444444444', ABORTED='55555555-5555-4555-8555-555555555555';
const SESSION='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
let clock='2026-11-22T12:00:00.000Z';let id=0;
const event=()=>`bbbbbbbb-bbbb-4bbb-8bbb-${String(++id).padStart(12,'0')}`;
const fixture=(ids=['child-a'])=>({schemaVersion:1,family:{version:1,children:ids.map((id,i)=>({id,name:'Bijnaam',avatar:i%4})),activeId:ids[0]??''},data:Object.fromEntries(ids.map(id=>[id,{favorites:['station'],prefs:{muted:false,calm:true}}]))});
const owner=async()=>db.exec('reset role');
async function tick(value){clock=value;await owner();await db.exec(`create or replace function private.lifecycle_now() returns timestamptz language sql volatile set search_path='' as $$ select '${value}'::timestamptz $$`);}
async function identity(actor,{fresh=true,session=true,anonymous=false,method='otp'}={}){
 await owner();if(session)await db.query('insert into auth.sessions(id,user_id) values($1,$2) on conflict(id) do update set user_id=excluded.user_id',[SESSION,actor]);
 await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:actor,session_id:SESSION,is_anonymous:anonymous,amr:[{method,timestamp:Date.parse(clock)/1000-(fresh?0:301)}]})]);await db.exec('set role authenticated');
}
async function service(){await owner();await db.query("select set_config('request.jwt.claims','{}',false)");await db.exec('set role service_role');}
async function rpc(name,args=[]){return(await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as result`,args)).rows[0].result;}
async function denied(name,args=[],code='42501'){await assert.rejects(rpc(name,args),e=>e.code===code);}
const onboard=()=>rpc('complete_parent_onboarding',['2026-11-22','2026-11-22',true,true]);
const save=(rev,snapshot)=>rpc('save_family_snapshot',[rev,JSON.stringify(snapshot)]);
const consent=id=>rpc('consent_child_profile',[id,true,true]);
try{
 await db.exec(`create role anon nologin;create role authenticated nologin;create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean not null default false,raw_user_meta_data jsonb not null default '{}');
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 create function auth.uid() returns uuid language sql stable as $$select nullif(auth.jwt()->>'sub','')::uuid$$;
 grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid(),auth.jwt() to anon,authenticated;
 insert into auth.users(id,email,email_confirmed_at) values('${LEGACY}','old@example.test',now());`);
 await installEmailVaultTestFixture(db);
 for(const file of(await readdir(new URL('../supabase/migrations/',import.meta.url))).filter(x=>x.endsWith('.sql')).sort())await db.exec(localMigrationSql(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8')));
 for(const [kind,file] of [['terms','algemene-voorwaarden.md'],['privacy','privacyverklaring.md']]) {
  const actual=await readFile(new URL('../public/legal/2026-11-22/'+file,import.meta.url),'utf8');
  const stored=(await db.query('select sha256,document_text from private.legal_document_versions where kind=$1',[kind])).rows[0];
  assert.equal(stored.document_text,actual);assert.equal(stored.sha256,createHash('sha256').update(actual).digest('hex'));
 }
 await assert.rejects(db.exec("update private.legal_document_versions set version='forged'"),e=>e.code==='42501');
 await tick(clock);
 await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'a@example.test',now()),($2,'b@example.test',now()),($3,'admin@example.test',now()),($4,'aborted@example.test',now())",[A,B,ADMIN,ABORTED]);
 await db.query('insert into public.content_admins(user_id) values($1)',[ADMIN]);
 await identity(A);
 assert.equal((await rpc('get_account_lifecycle')).state,'onboarding');
 await denied('save_family_snapshot',[0,JSON.stringify(fixture())]);
 await denied('complete_parent_onboarding',['wrong','2026-11-22',true,true],'22023');
 await denied('complete_parent_onboarding',['2026-11-22','2026-11-22',false,true],'22023');
 await denied('complete_parent_onboarding',['2026-11-22','2026-11-22',true,false],'22023');
 await denied('consent_child_profile',['child-a',true,true]);
 await assert.rejects(db.exec("update private.account_lifecycle set state='active'"),e=>e.code==='42501');
 const accepted=await rpc('complete_parent_onboarding',['2026-11-22','2026-11-22',true,true,'google']);
 assert.equal(accepted.state,'active');assert.equal(accepted.acceptedTermsVersion,'2026-11-22');
 await owner();let row=(await db.query('select * from private.parent_acceptances where parent_id=$1',[A])).rows[0];assert.equal(row.signup_channel,'otp','Editable channel cannot forge OAuth evidence');assert.equal(new Date(row.accepted_at).toISOString(),clock);
 await identity(A);await onboard();await owner();assert.equal((await db.query('select count(*)::int n from private.parent_acceptances where parent_id=$1',[A])).rows[0].n,1,'Acceptance retry is idempotent, never retroactive');
 await identity(ADMIN);await denied('save_content_draft',['station',0,'{"metadata":{},"chapters":{}}']);await denied('get_email_settings');await onboard();assert.equal((await rpc('get_email_settings')).revision,0);
 await identity(A);await denied('save_family_snapshot',[0,JSON.stringify(fixture())]);await denied('consent_child_profile',['child-a',true,false],'22023');await consent('child-a');await consent('child-b');
 assert.equal((await save(0,fixture(['child-a','child-b']))).saved,true);
 await identity(B);await onboard();await consent('child-a');assert.equal((await db.query('select * from public.family_documents')).rows.length,0,'Family B cannot see A');assert.equal((await save(0,fixture())).saved,true);
 // Withdrawal scrubs only its subject, bumps the CAS, and a stale offline blob
 // cannot recreate it even with a current access token or corrected revision.
 await identity(A);await rpc('consent_child_profile',['child-a',false,false]);
 let f=(await db.query('select snapshot,revision from public.family_documents')).rows[0];assert.equal(f.revision,2);assert.deepEqual(f.snapshot.family.children.map(c=>c.id),['child-b']);assert.equal(f.snapshot.data['child-a'],undefined);
 await denied('save_family_snapshot',[2,JSON.stringify(fixture(['child-a','child-b']))]);await denied('consent_child_profile',['child-a',true,true]);
 await rpc('consent_child_profile',['child-b',false,false]);f=(await db.query('select snapshot,revision from public.family_documents')).rows[0];assert.equal(f.revision,3);assert.deepEqual(f.snapshot,fixture([]));
 await identity(B);assert.deepEqual((await db.query('select snapshot from public.family_documents')).rows[0].snapshot,fixture(),'Other family with same child ID remains intact');
 // Explicit activity is validated and deduplicated; saving/empty sync cannot
 // silently postpone account retention. Older/future events do not extend it.
 await identity(A);await consent('new-child');assert.equal((await save(3,fixture(['new-child']))).saved,true);
 const t0=(await rpc('get_account_lifecycle')).lastActivityAt;
 await tick('2026-11-23T12:00:00.000Z');await identity(A);await save(4,fixture(['new-child']));assert.equal((await rpc('get_account_lifecycle')).lastActivityAt,t0,'Passive CAS save is not activity');
 const activity=event();let result=await rpc('record_family_activity',[activity,'reading','new-child','2026-11-23T11:00:00Z']);assert.equal(result.recorded,true);const activityTime=result.lastActivityAt;
 await tick('2026-11-24T12:00:00.000Z');await identity(A);assert.equal((await rpc('record_family_activity',[activity,'reading','new-child','2026-11-24T12:00:00Z'])).recorded,false);assert.equal((await rpc('get_account_lifecycle')).lastActivityAt,activityTime);
 await rpc('record_family_activity',[event(),'reading','new-child','2026-11-23T10:00:00Z']);assert.equal((await rpc('get_account_lifecycle')).lastActivityAt,activityTime);
 await denied('record_family_activity',[event(),'reading','new-child','2026-11-26T12:00:00Z'],'22023');await denied('record_family_activity',[event(),'heartbeat',null,null],'22023');await denied('record_family_activity',[event(),'reading','child-b',null]);
 // Profile route is immediately blocked with a firm 30-day server deadline.
 await identity(A,{fresh:false});await denied('request_account_deletion',[],'28000');await identity(A);result=await rpc('request_account_deletion');assert.equal(result.state,'deletion_pending');assert.equal(Date.parse(result.deletionDeadline)-Date.parse(clock),30*86400000);
 assert.equal((await db.query('select * from public.family_documents')).rows.length,0,'A retained old JWT is denied after session revocation');await denied('save_family_snapshot',[5,JSON.stringify(fixture(['new-child']))]);await denied('get_account_lifecycle');
 await identity(A);const pending=await rpc('get_account_lifecycle');assert.equal(pending.state,'deletion_pending');assert.deepEqual(pending.consents,[]);await denied('save_family_snapshot',[5,JSON.stringify(fixture(['new-child']))]);
 // A duplicate does not extend the first deadline. A login does not restore.
 const originalDeadline=pending.deletionDeadline;await tick('2026-11-25T12:00:00.000Z');await identity(A);assert.equal((await rpc('request_account_deletion')).deletionDeadline,originalDeadline);assert.equal((await rpc('get_account_lifecycle')).state,'deletion_pending');
 await tick('2026-12-24T11:59:59.999Z');await identity(A);assert.equal((await rpc('restore_account')).state,'active');assert.equal((await rpc('get_account_lifecycle')).deletionDeadline,null);
 await tick('2026-12-24T12:00:00.000Z');await identity(A);result=await rpc('request_account_deletion');const deadline30=result.deletionDeadline;
 await tick(new Date(Date.parse(deadline30)-1).toISOString());await identity(A);assert.equal((await rpc('get_account_lifecycle')).state,'deletion_pending');
 await tick(new Date(Date.parse(deadline30)).toISOString());await identity(A);await denied('restore_account');await service();let jobs=await rpc('claim_lifecycle_jobs',[10]);assert.ok(jobs.some(j=>j.kind==='delete_account'&&j.parentId===A));
 await identity(A);await denied('restore_account');await denied('save_family_snapshot',[5,JSON.stringify(fixture(['new-child']))]);
 // Accepted old terms cannot bypass updated web onboarding via direct RPC.
 await owner();await db.query("update private.account_lifecycle set terms_version='old-fixture' where parent_id=$1",[B]);await identity(B);assert.equal((await db.query('select * from public.family_documents')).rows.length,0);await denied('save_family_snapshot',[1,JSON.stringify(fixture())]);await denied('consent_child_profile',['old-terms',true,true]);await onboard();
 // 90-day automation stays off until a documented candidate/transition audit.
 await owner();await db.query("update private.account_lifecycle set last_activity_at='2026-11-01T12:00:00Z',transition_deadline=null where parent_id=$1",[B]);
 await tick('2027-01-30T12:00:00.000Z');await service();await rpc('claim_lifecycle_jobs',[3]);await owner();assert.equal((await db.query('select state from private.account_lifecycle where parent_id=$1',[B])).rows[0].state,'active');
 await assert.rejects(db.exec('update private.lifecycle_controls set inactivity_enabled=true'),e=>e.code==='23514');
 await db.exec("update private.lifecycle_controls set inactivity_enabled=true,transition_reviewed_at=clock_timestamp(),staging_evidence='synthetic-staging-audit-0001'");
 // Rewind only the isolated test clock: exercise warning cancellation and the
 // exact 90-day boundary without creating a spoofable production API.
 await tick('2027-01-16T12:00:00.000Z');await service();await rpc('claim_lifecycle_jobs',[3]);await owner();assert.ok((await db.query("select id from private.lifecycle_outbox where parent_id=$1 and kind='inactivity_14'",[B])).rows.length);
 await tick('2027-01-16T13:00:00.000Z');await identity(B);await rpc('record_family_activity',[event(),'parent_login']);await owner();assert.equal((await db.query("select count(*)::int n from private.lifecycle_outbox where parent_id=$1 and kind='inactivity_14' and state='cancelled'",[B])).rows[0].n,1);
 await db.query("update private.account_lifecycle set last_activity_at='2026-11-01T12:00:00Z' where parent_id=$1",[B]);
 await tick('2027-01-30T11:59:59.999Z');await identity(B);assert.equal((await rpc('get_account_lifecycle')).state,'active');assert.equal((await db.query('select * from public.family_documents')).rows.length,1);
 await tick('2027-01-30T12:00:00.000Z');await identity(B);await denied('record_family_activity',[event(),'parent_login']);assert.equal((await db.query('select * from public.family_documents')).rows.length,0);await denied('consent_child_profile',['too-late',true,true]);await denied('save_family_snapshot',[1,JSON.stringify(fixture())]);await denied('request_account_deletion');
 await service();jobs=await rpc('claim_lifecycle_jobs',[3]);await owner();row=(await db.query('select * from private.account_lifecycle where parent_id=$1',[B])).rows[0];assert.equal(row.state,'deleting');assert.equal(row.deletion_reason,'inactivity');assert.equal(new Date(row.deletion_deadline).toISOString(),clock,'90 days has no extra 30-day grace');
 // A parent request made before day 90 keeps its own 30-day deadline even
 // when the inactivity boundary occurs inside that window.
 await tick('2027-01-01T12:00:00.000Z');await identity(ADMIN);await owner();await db.query("update private.account_lifecycle set last_activity_at='2026-10-04T12:00:00Z',transition_deadline=null where parent_id=$1",[ADMIN]);await identity(ADMIN);const mixed=await rpc('request_account_deletion');await tick('2027-01-03T12:00:00.000Z');await service();await rpc('claim_lifecycle_jobs',[10]);await owner();row=(await db.query('select state,deletion_deadline from private.account_lifecycle where parent_id=$1',[ADMIN])).rows[0];assert.equal(row.state,'deletion_pending');assert.equal(Date.parse(row.deletion_deadline),Date.parse(mixed.deletionDeadline));await identity(ADMIN);await rpc('restore_account');
 // Session existence is enforced independently of JWT expiry/user_metadata.
 await tick('2027-01-01T12:00:00.000Z');await identity(ADMIN);await owner();await db.query('delete from auth.sessions where user_id=$1',[ADMIN]);await identity(ADMIN,{session:false});await denied('get_email_settings');await denied('save_content_draft',['station',0,'{"metadata":{},"chapters":{}}']);
 await owner();await db.query("insert into auth.sessions(id,user_id,not_after) values($1,$2,$3) on conflict(id) do update set user_id=excluded.user_id,not_after=excluded.not_after",[SESSION,ADMIN,clock]);await identity(ADMIN,{session:false});await denied('get_account_lifecycle');await denied('get_email_settings');await owner();await db.query('update auth.sessions set not_after=null where id=$1',[SESSION]);
 // Legacy identities never gain fabricated acceptance or 7-day cleanup.
 await owner();row=(await db.query('select * from private.account_lifecycle where parent_id=$1',[LEGACY])).rows[0];assert.equal(row.accepted_at,null);assert.equal(row.legacy_account,true);assert.equal(row.last_activity_at,null);
 await db.query("update private.account_lifecycle set created_at='2026-11-01' where parent_id=$1",[ABORTED]);await service();await rpc('claim_lifecycle_jobs',[3]);await owner();assert.equal((await db.query('select state from private.account_lifecycle where parent_id=$1',[ABORTED])).rows[0].state,'deleting');assert.equal((await db.query('select state from private.account_lifecycle where parent_id=$1',[LEGACY])).rows[0].state,'onboarding');
 // Restricted support cases use calendar months and child-only erasure. A
 // 12-year-old's own request never requires that child's parent to log in.
 await identity(ADMIN);await rpc('record_family_activity',[event(),'parent_login']);await identity(LEGACY);await onboard();await consent('scope-a');await consent('scope-b');await save(0,fixture(['scope-a','scope-b']));
 await tick('2027-01-31T12:00:00.000Z');await identity(ADMIN);const privacy=await rpc('register_privacy_request',['CASE_000123','erasure','child',LEGACY,'scope-a']);assert.equal(Date.parse(privacy.responseDueAt),Date.parse('2027-02-28T12:00:00Z'),'A calendar month is not a fixed 30 days');
 await denied('manage_privacy_request',[privacy.id,'execute_erasure',null,null]);await rpc('manage_privacy_request',[privacy.id,'verify','proportionate_support',null]);await denied('manage_privacy_request',[privacy.id,'complete',null,null],'22023');assert.equal((await rpc('manage_privacy_request',[privacy.id,'execute_erasure',null,null])).state,'completed');
 await identity(LEGACY);f=(await db.query('select snapshot,revision from public.family_documents')).rows[0];assert.deepEqual(f.snapshot.family.children.map(c=>c.id),['scope-b']);assert.equal((await rpc('get_account_lifecycle')).state,'active');
 await identity(ADMIN);const erase=await rpc('register_privacy_request',['CASE_000124','erasure','parent',LEGACY,null]);await rpc('manage_privacy_request',[erase.id,'verify','proportionate_support',null]);await denied('manage_privacy_request',[erase.id,'complete',null,null],'22023');await rpc('manage_privacy_request',[erase.id,'execute_erasure',null,null]);await identity(LEGACY);await denied('restore_account');
 await owner();assert.equal((await db.query('select deletion_reason from private.account_lifecycle where parent_id=$1',[LEGACY])).rows[0].deletion_reason,'privacy');
 // The case list is minimal, administrator-only and explicitly paginated.
 await identity(ADMIN);const unknown=await rpc('register_privacy_request',['CASE_UNKNOWN','access','child',null,null]);await denied('manage_privacy_request',[unknown.id,'verify','proportionate_support',null],'22023');await rpc('manage_privacy_request',[unknown.id,'bind_subject',null,null,ADMIN,null]).then(()=>assert.fail('Child scope cannot bind whole family'),e=>assert.equal(e.code,'22023'));await rpc('manage_privacy_request',[unknown.id,'bind_subject',null,null,ADMIN,'unknown']).then(()=>assert.fail('Unknown child cannot be bound'),e=>assert.equal(e.code,'22023'));
 await rpc('manage_privacy_request',[unknown.id,'bind_subject',null,null,LEGACY,'scope-b']);await rpc('manage_privacy_request',[unknown.id,'verify','proportionate_support',null]);await denied('manage_privacy_request',[unknown.id,'bind_subject',null,null,ADMIN,'unknown'],'22023');
 const list=await rpc('list_privacy_requests',[1,0]);assert.equal(list.cases.length,1);assert.equal(list.total,3);assert.equal(list.nextOffset,1);assert.equal(list.truncated,true);assert.equal('email' in list.cases[0],false);const list2=await rpc('list_privacy_requests',[1,2]);assert.equal(list2.nextOffset,null);await denied('list_privacy_requests',[101,0],'22023');await identity(A);await denied('list_privacy_requests');
 // Claim/ack receipts are protected by leases and actual provider state.
 await service();jobs=await rpc('claim_lifecycle_jobs',[10]);let deletion=jobs.find(j=>j.kind==='delete_account');
 if(!deletion){await owner();await db.exec("update private.lifecycle_outbox set locked_until='2000-01-01',available_at='2000-01-01' where kind='delete_account' and state='working'");await service();deletion=(await rpc('claim_lifecycle_jobs',[10])).find(j=>j.kind==='delete_account');}
 assert.ok(deletion);await denied('complete_lifecycle_job',[deletion.id,deletion.leaseId,null,true,true],'22023');
 await owner();await db.query('insert into storage.objects(bucket_id,name,owner_id) values($1,$2,$3)',['private-profile','avatar.png',deletion.parentId]);await db.query('delete from auth.users where id=$1',[deletion.parentId]);await service();let context=await rpc('get_lifecycle_job_context',[deletion.id,deletion.leaseId]);assert.equal(context.alreadyDeleted,true);assert.equal(context.objects.length,1,'Auth disappearance does not hide leftover Storage');await denied('complete_lifecycle_job',[deletion.id,deletion.leaseId,null,true,true],'22023');
 await owner();await db.query('delete from storage.objects where owner_id=$1',[deletion.parentId]);await service();assert.equal(await rpc('complete_lifecycle_job',[deletion.id,deletion.leaseId,null,true,true]),true);assert.equal(await rpc('complete_lifecycle_job',[deletion.id,deletion.leaseId,null,true,true]),false,'Duplicate ack is harmless');
 await owner();row=(await db.query('select parent_id,payload from private.lifecycle_outbox where id=$1',[deletion.id])).rows[0];assert.equal(row.parent_id,null);assert.equal(row.payload.delivery,undefined);assert.equal((await db.query('select count(*)::int n from private.deletion_receipts where operation_id=$1',[deletion.id])).rows[0].n,1);
 for(const role of ['anon','authenticated']){await owner();await db.exec(`set role ${role}`);await denied('claim_lifecycle_jobs',[3]);await denied('verify_lifecycle_worker',['a'.repeat(64)]);await assert.rejects(db.exec('select private.lifecycle_now()'),e=>e.code==='42501');await assert.rejects(db.exec('select * from private.privacy_requests'),e=>e.code==='42501');}
 console.log('Lifecycle PostgreSQL checks passed: current-version onboarding, no retroactive agreement, current-session enforcement, administrator gates, explicit child consent, scoped withdrawal/CAS and resurrection denial, family isolation, validated/deduplicated activity, 30-day fresh-auth deletion/restore boundaries, 90-day warnings/boundary with no extra grace, safe legacy transition, abandoned cleanup, child-scoped AVG erasure and calendar-month response, durable deletion lease and actual Auth/Storage receipt checks.');
 console.log('Test clock is replaced only by the PostgreSQL fixture owner; no public clock API exists. PGlite executes SQL/RLS/transactions; true multi-connection contention, provider APIs, mailbox delivery and backup restoration require hosted verification.');
} catch(error){console.error('Lifecycle DB check failed:',error.code??error.name,error.message,error.where??'');process.exitCode=1;} finally{await db.close();}
