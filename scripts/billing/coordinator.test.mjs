import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileSource } from '../source-test-loader.mjs';
import { DEFAULT_EMAIL_SETTINGS } from '../../lib/email/settings.ts';
const temp = await mkdtemp(join(tmpdir(), 'fabelpad-billing-coordinator-')); after(() => rm(temp, { recursive: true, force: true }));
const { createBillingCoordinator } = await import(await compileSource(new URL('../../lib/billing/coordinator.ts', import.meta.url), temp));
const jobId='11111111-1111-4111-8111-111111111111',lease='22222222-2222-4222-8222-222222222222';
const env={SUPABASE_URL:'https://tlwfpivafcokcjyjwgmq.supabase.co',FABELPAD_APP_ORIGIN:'https://staging.fabelpad.nl',FABELPAD_ENVIRONMENT:'staging'};
const job=(changes={})=>({id:jobId,leaseToken:lease,kind:'send_billing_email',provider:null,environment:'staging',mode:'test',attempt:1,firstAttemptAt:'2026-11-23T11:59:00Z',idempotencyKey:jobId,payload:{},...changes});
function fixture(options={}){
 const calls=[],sends=[],frozen=new Map();let settings=DEFAULT_EMAIL_SETTINGS,completionFails=options.completionFails??false;
 const backend={async rpc(name,args={}){
  calls.push({name,args});
  if(name==='prepare_billing_jobs')return{queued:0};
  if(name==='claim_billing_jobs')return options.jobs??[job()];
  if(name==='get_billing_email_context')return options.obsolete?null:{recipient:'parent@example.test',subject:'Je Fabelpad-jaar',title:'Je gratis jaar',paragraphs:['Je gratis toegang eindigt op 2027-11-23.','Er is geen automatische afschrijving.'],actionPath:options.actionPath??'/profiel/abonnement'};
  if(name==='get_email_delivery_config')return{revision:1,settings,apiKey:'re_synthetic_only_billing_mail'};
  if(name==='freeze_billing_email'){if(!frozen.has(args.p_job_id))frozen.set(args.p_job_id,structuredClone(args.p_delivery));return frozen.get(args.p_job_id);}
  if(name==='complete_billing_job'){if(completionFails)throw new Error('private DB content');return{completed:true};}
  if(name==='fail_billing_job')return{updated:true};
  throw new Error('Unexpected RPC');
 }};
 const fetcher=async(url,init)=>{assert.equal(url,'https://api.resend.com/emails');sends.push(structuredClone({body:init.body,headers:init.headers}));if(options.providerFails)return new Response('private provider response',{status:503});return Response.json({id:'synthetic-provider-receipt'});};
 const tick=createBillingCoordinator({...env,...options.environment},{backend,fetch:fetcher,play:options.play,now:()=>new Date('2026-11-23T12:00:00Z')});
 return{tick,calls,sends,frozen,changeSettings(value){settings=value;},allowCompletion(){completionFails=false;}};
}
test('one coordinator claim dispatches Play once and does not duplicate provider-owned completion',async()=>{
 let handled=0;const app=fixture({jobs:[job({provider:'play',kind:'play_cancel'})],play:{async handleJob(){handled++;}}});
 assert.deepEqual(await app.tick(),{completed:1,deferred:0});assert.equal(handled,1);assert.deepEqual(app.calls.map(c=>c.name),['prepare_billing_jobs','claim_billing_jobs']);assert.deepEqual(app.calls[1].args,{p_limit:3});
});
test('overlapping fast path and scheduler invocations share one claim in an isolate',async()=>{
 let finish;const pending=new Promise(resolve=>{finish=resolve;});const app=fixture({jobs:[job({provider:'play',kind:'play_verify'})],play:{handleJob:()=>pending}});
 const a=app.tick(),b=app.tick();assert.equal(a,b);await Promise.resolve();finish({});await a;assert.equal(app.calls.filter(c=>c.name==='claim_billing_jobs').length,1);
});
test('a swapped hosting target cannot claim or process billing jobs',async()=>{
 const app=fixture({environment:{FABELPAD_APP_ORIGIN:'https://fabelpad.nl'}});await assert.rejects(app.tick(),/target/);assert.equal(app.calls.length,0);
});
test('mail freezes exact rendered bytes before delivery and persists only its provider receipt',async()=>{
 const app=fixture();assert.deepEqual(await app.tick(),{completed:1,deferred:0});assert.equal(app.sends.length,1);
 const sent=JSON.parse(app.sends[0].body);assert.match(sent.subject,/^\[TEST\]/u);assert.match(sent.from,/Staging/u);assert.match(sent.html,/2027-11-23/u);
 assert.equal(app.sends[0].headers['Idempotency-Key'],`fabelpad-billing/${jobId}`);assert.ok(app.calls.findIndex(c=>c.name==='freeze_billing_email')<app.calls.findIndex(c=>c.name==='complete_billing_job'));
 assert.deepEqual(app.calls.at(-1).args.p_result,{providerId:'synthetic-provider-receipt'});assert.equal(JSON.stringify(app.calls).includes('re_synthetic'),false);
});
test('lost receipt retries use identical provider bytes and key even after template changes',async()=>{
 const app=fixture({completionFails:true});assert.deepEqual(await app.tick(),{completed:0,deferred:1});
 app.changeSettings({...DEFAULT_EMAIL_SETTINGS,fromName:'Andere naam',templates:{'service-notice':{subject:'Andere tekst',title:'Anders',intro:'Veranderd'}}});app.allowCompletion();
 assert.deepEqual(await app.tick(),{completed:1,deferred:0});assert.deepEqual(app.sends[0],app.sends[1]);assert.equal(app.calls.find(c=>c.name==='fail_billing_job').args.p_uncertain,false);
});
test('custom mail introduction cannot remove the frozen campaign expiry or payment terms',async()=>{
 const app=fixture();app.changeSettings({...DEFAULT_EMAIL_SETTINGS,templates:{'service-notice':{subject:'Nieuw',title:'Nieuw',intro:'Andere introductie'}}});await app.tick();const sent=JSON.parse(app.sends[0].body);assert.match(sent.html,/2027-11-23/u);assert.match(sent.html,/geen automatische afschrijving/u);
});
test('email outside the idempotency window becomes a visible uncertain task without a resend',async()=>{
 const app=fixture({jobs:[job({firstAttemptAt:'2026-11-22T12:00:00Z'})]});assert.deepEqual(await app.tick(),{completed:0,deferred:1});assert.equal(app.sends.length,0);assert.equal(app.calls.at(-1).args.p_error_code,'billing_email_idempotency_expired');assert.equal(app.calls.at(-1).args.p_uncertain,true);
});
test('obsolete/deleted-family mail context completes without sending personal data',async()=>{
 const app=fixture({obsolete:true});assert.deepEqual(await app.tick(),{completed:1,deferred:0});assert.equal(app.sends.length,0);assert.equal(app.calls.some(c=>c.name==='get_email_delivery_config'),false);
});
test('public withdrawal confirmation uses the exact private one-use link and an appropriate action',async()=>{
 const app=fixture({actionPath:'/herroepen#token='+'a'.repeat(64)});assert.deepEqual(await app.tick(),{completed:1,deferred:0});
 const sent=JSON.parse(app.sends[0].body);assert.match(sent.html,/Bevestig je herroepingsverzoek/u);assert.match(sent.html,/\/herroepen#token=aaaa/u);
 const denied=fixture({actionPath:'https://attacker.test/herroepen#token='+'a'.repeat(64)});assert.deepEqual(await denied.tick(),{completed:0,deferred:1});assert.equal(denied.sends.length,0);
});
