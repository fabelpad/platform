/** Real multi-session PostgreSQL locks, isolated temporary container. No hosted DB. */
import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {randomUUID} from 'node:crypto';import {installBillingFixture} from './database-fixture.mjs';
const name=`fabelpad-billing-locks-${process.pid}`,image=process.env.FABELPAD_TEST_POSTGRES_IMAGE??'postgres:17-bookworm';
function command(args,input=''){return new Promise((resolve,reject)=>{const p=spawn('docker',args,{stdio:['pipe','pipe','pipe']});let out='',err='';p.stdout.on('data',x=>out+=x);p.stderr.on('data',x=>err+=x);p.on('error',reject);p.on('close',code=>code===0?resolve(out):reject(new Error(`Local PostgreSQL check failed (${code}): ${err.slice(-4000)}`)));p.stdin.end(input);});}
const sql=s=>command(['exec','-i',name,'psql','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-Atq'],s);
const quote=s=>"'"+String(s).replaceAll("'","''")+"'";
function claims(id){return quote(JSON.stringify({sub:id,session_id:id,amr:[{method:'otp',timestamp:Math.floor(Date.now()/1000)}]}));}
const admin=randomUUID();let started=false;
try{
 await command(['run','--rm','--detach','--name',name,'--network','none','--env','POSTGRES_PASSWORD=synthetic-local-only',image]);started=true;
 let ready=false;for(let i=0;i<100;i++){try{await command(['exec',name,'pg_isready','-U','postgres']);ready=true;break;}catch{await new Promise(r=>setTimeout(r,100));}}assert.ok(ready,'Own local PostgreSQL container starts');
 await sql('create schema extensions;create extension pgcrypto with schema extensions;');
 await installBillingFixture({exec:sql});
 const versions=JSON.parse((await sql("select jsonb_build_object('terms',(select max(version) from private.legal_document_versions where kind='terms'),'privacy',(select max(version) from private.legal_document_versions where kind='privacy'));" )).trim());
 await sql(`insert into auth.users(id,email,email_confirmed_at) values('${admin}','admin@example.test',clock_timestamp());insert into auth.sessions(id,user_id) values('${admin}','${admin}');insert into public.content_admins(user_id) values('${admin}');begin;select set_config('request.jwt.claims',${claims(admin)},true);set local role authenticated;select public.complete_parent_onboarding(${quote(versions.terms)},${quote(versions.privacy)},true,true);commit;`);
 await sql(`update private.billing_control set settings=jsonb_set(jsonb_set(jsonb_set(settings,'{termsVersion}',to_jsonb(${quote(versions.terms)}::text)),'{privacyVersion}',to_jsonb(${quote(versions.privacy)}::text)),'{founders,startsAt}',to_jsonb((clock_timestamp()-interval '1 second')::text)),campaign_started_at=clock_timestamp()-interval '1 second',payment_required=true,founders_enabled=true;`);
 const ids=Array.from({length:51},()=>randomUUID());
 await sql(ids.map(id=>`insert into auth.users(id,email,email_confirmed_at) values('${id}','synthetic-${id}@example.test',clock_timestamp());insert into auth.sessions(id,user_id) values('${id}','${id}');`).join('\n'));
 const complete=id=>sql(`begin;select set_config('request.jwt.claims',${claims(id)},true);set local role authenticated;select public.complete_parent_onboarding(${quote(versions.terms)},${quote(versions.privacy)},true,true);commit;`);
 await Promise.all(ids.slice(0,49).map(complete));assert.equal((await sql('select awarded from private.billing_control;')).trim(),'49');
 // Two independent sessions really contend on the final stock row/transaction lock.
 await Promise.all([complete(ids[49]),complete(ids[50]),complete(ids[49])]);
 assert.equal((await sql('select awarded from private.billing_control;')).trim(),'50');assert.equal((await sql('select count(*) from private.billing_founders_awards;')).trim(),'50');assert.equal((await sql('select count(distinct parent_id) from private.billing_founders_awards;')).trim(),'50');
 const awarded=(await sql('select parent_id from private.billing_founders_awards order by place desc limit 1;')).trim();await sql(`delete from auth.users where id='${awarded}';`);assert.equal((await sql('select awarded from private.billing_control;')).trim(),'50');
 // Concurrent CAS settings changes can never both overwrite the same revision.
 const revision=(await sql('select revision from private.billing_control;')).trim();
 const mutate=gate=>sql(`begin;select set_config('request.jwt.claims',${claims(admin)},true);set local role authenticated;select public.set_billing_gate(${revision},'${gate}',false,false)->>'saved';commit;`);
 const outcomes=await Promise.all([mutate('foundersEnabled'),mutate('mollieEnabled')]);assert.equal(outcomes.filter(o=>o.trim().endsWith('true')).length,1);assert.equal(outcomes.filter(o=>o.trim().endsWith('false')).length,1);
 console.log('Real PostgreSQL concurrency passed: 49 committed awards, concurrent places50/51 + duplicate onboarding => exactly50, deletion never restocks, concurrent admin CAS has one winner.');
}finally{if(started)await command(['stop','--time','2',name]).catch(()=>{});}
