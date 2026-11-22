import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {compileSource} from './source-test-loader.mjs';
const temp=await mkdtemp(join(tmpdir(),'fabelpad-lifecycle-worker-'));after(()=>rm(temp,{recursive:true,force:true}));
const {createLifecycleWorker}=await import(await compileSource(new URL('../lib/lifecycle/worker.ts',import.meta.url),temp));
const {createLifecycleSupabaseBackend}=await import(await compileSource(new URL('../lib/lifecycle/supabase-backend.ts',import.meta.url),temp));
const {DEFAULT_EMAIL_SETTINGS}=await import(await compileSource(new URL('../lib/email/settings.ts',import.meta.url),temp));
const TOKEN='a'.repeat(64), JOB='11111111-1111-4111-8111-111111111111', LEASE='22222222-2222-4222-8222-222222222222', PARENT='33333333-3333-4333-8333-333333333333';
const environment={FABELPAD_APP_ORIGIN:'https://fabelpad.example.test',FABELPAD_ENVIRONMENT:'production',RESEND_API_KEY:'re_synthetic_worker_secret',FABELPAD_EMAIL_FROM:'Fabelpad <noreply@example.test>',FABELPAD_EMAIL_REPLY_TO:'support@example.test'};
const proof={nonce:'66666666-6666-4666-8666-666666666666',issuedAt:1795348800,signature:'b'.repeat(64)};
const req=(body=proof)=>new Request('https://project.supabase.co/functions/v1/account-maintenance',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
function fixture(options={}){
 const events=[],sends=[],frozen=new Map();let objects=structuredClone(options.objects??[]),exists=options.alreadyDeleted?false:true;
 const job={id:JOB,leaseId:LEASE,parentId:PARENT,kind:options.kind??'deletion_requested',payload:{deadline:'2026-12-22T12:00:00Z'}};
 const backend={
  async rpc(name,args={}){
   events.push([name,structuredClone(args)]);
   if(name==='verify_lifecycle_worker_request')return args.p_nonce===proof.nonce&&args.p_issued_at===proof.issuedAt&&args.p_signature===proof.signature&&!options.denied;
   if(name==='claim_lifecycle_jobs')return options.jobs??[job];
   if(name==='get_lifecycle_job_context')return options.context===null?null:{parentId:options.wrongParent?'44444444-4444-4444-8444-444444444444':PARENT,kind:job.kind,alreadyDeleted:!exists,recipient:'parent@example.test',objects:structuredClone(objects),payload:job.payload};
   if(name==='get_email_delivery_config'){
    if(options.malformedConfig)return {apiKey:'private-untrusted-secret',settings:{}};
    return options.config??null;
   }
   if(name==='freeze_lifecycle_email'){
    if(options.freezeDenied)return null;
    if(!frozen.has(args.p_job_id))frozen.set(args.p_job_id,structuredClone(args.p_delivery));
    return frozen.get(args.p_job_id);
   }
   if(name==='complete_lifecycle_job'){
    if(options.ackFails)throw new Error('private database content');
    if(job.kind==='delete_account')assert.equal(exists,false);
    return true;
   }
   if(name==='fail_lifecycle_job')return true;
   throw new Error('Unexpected RPC');
  },
  async removeStorage(bucket,names){events.push(['storage',bucket,names]);if(options.storageFails)throw new Error('private bucket content');objects=objects.filter(item=>item.bucket!==bucket||!names.includes(item.name));},
  async deleteAuth(id){events.push(['deleteAuth',id]);if(options.authFails)throw new Error('private user content');exists=false;},
  async authExists(id){events.push(['authExists',id]);return exists;},
 };
 const fetcher=async(url,init)=>{assert.equal(url,'https://api.resend.com/emails');sends.push({headers:structuredClone(init.headers),body:JSON.parse(init.body)});if(options.providerFails)return Response.json({private:'secret-and-recipient'},{status:503});return Response.json({id:'synthetic-provider-id'});};
 return {handler:createLifecycleWorker({...environment,...options.environment},{backend,fetch:fetcher}),backend,events,sends,frozen};
}
test('worker rejects missing/malformed proof without DB work, reusable bearer and other methods',async()=>{
 const app=fixture();assert.equal((await app.handler(req({}))).status,401);assert.equal(app.events.length,0);
 assert.equal((await app.handler(req({...proof,signature:'not-a-signature'}))).status,401);assert.equal(app.events.length,0);
 const bearer=req();bearer.headers.set('Authorization','Bearer '+TOKEN);assert.equal((await app.handler(bearer)).status,401);assert.equal(app.events.length,0);
 assert.equal((await app.handler(new Request('https://example.test',{method:'GET'}))).status,405);assert.equal(app.events.length,0);
});
test('an invalid, expired or already-consumed signed proof cannot claim jobs or access provider settings',async()=>{
 const app=fixture({denied:true});assert.equal((await app.handler(req())).status,401);assert.deepEqual(app.events.map(e=>e[0]),['verify_lifecycle_worker_request']);assert.equal(app.sends.length,0);
});
test('HTTP accepts no owner, scope, recipient, clock or arbitrary job input',async()=>{
 for(const body of [{parentId:PARENT},{now:'2099-01-01'},{recipient:'attack@example.test'},[],null]){const app=fixture();assert.equal((await app.handler(req(body))).status,422);assert.equal(app.events.some(e=>e[0]==='claim_lifecycle_jobs'),false);}
 const app=fixture();const request=req();request.headers.set('Content-Type','text/plain');assert.equal((await app.handler(request)).status,415);
});
test('bounded body stops a forged-length or held-open upload before claiming',async()=>{
 const app=fixture();assert.equal((await app.handler(req({padding:'x'.repeat(3000)}))).status,422);
 let cancelled=false;
 const request=new Request('https://example.test',{method:'POST',headers:{'Content-Type':'application/json','Content-Length':'1'},duplex:'half',body:new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('{'));},cancel(){cancelled=true;}})});
 const started=Date.now();assert.equal((await app.handler(request)).status,422);assert.ok(Date.now()-started<1500);assert.equal(cancelled,true);
});
test('deletion confirmation freezes exact sender/recipient/body before provider send, then records only a receipt',async()=>{
 const app=fixture();const response=await app.handler(req());assert.equal(response.status,200);assert.deepEqual(await response.json(),{completed:1,deferred:0});
 assert.equal(app.sends.length,1);assert.deepEqual(app.sends[0].body.to,['parent@example.test']);assert.equal(app.sends[0].headers['Idempotency-Key'],'fabelpad-lifecycle/'+JOB);
 const html=app.sends[0].body.html;assert.match(html,/22 december 2026/);assert.match(html,/13:00/);assert.match(html,/profiel\/account\/herstellen/);assert.match(html,/Alleen inloggen/);assert.match(html,/eerder laten wissen/);assert.doesNotMatch(html,/child-a|child-b|tracking|<script/i);
 assert.ok(app.events.findIndex(e=>e[0]==='freeze_lifecycle_email')<app.events.findIndex(e=>e[0]==='complete_lifecycle_job'));
 assert.doesNotMatch(JSON.stringify(await app.handler(req()).then(r=>r.json())),/parent@example|re_synthetic|private/);
});
test('admin template edits cannot remove fixed deadlines and restoration instructions',async()=>{
 const settings={...DEFAULT_EMAIL_SETTINGS,templates:{'service-notice':{subject:'Eigen onderwerp',title:'Eigen titel',intro:'Eigen introductie'}}};
 const app=fixture({config:{revision:1,settings,apiKey:'re_synthetic_vault_key',keyConfigured:true,lastTestAt:null,lastTestProviderId:null}});assert.equal((await app.handler(req())).status,200);
 assert.equal(app.sends[0].body.subject,'Eigen onderwerp');assert.match(app.sends[0].body.html,/22 december 2026/);assert.match(app.sends[0].body.html,/vóór/);assert.match(app.sends[0].body.html,/herstelroute/);
});
test('saved malformed configuration fails closed, without using stale environment provider key',async()=>{
 const app=fixture({malformedConfig:true});assert.deepEqual(await(await app.handler(req())).json(),{completed:0,deferred:1});assert.equal(app.sends.length,0);assert.equal(app.events.find(e=>e[0]==='fail_lifecycle_job')[1].p_error,'configuration_unavailable');
});
test('a failed provider leaves a durable retry and sanitizes all diagnostics',async()=>{
 const app=fixture({providerFails:true});const response=await app.handler(req());assert.deepEqual(await response.json(),{completed:0,deferred:1});assert.equal(app.frozen.size,1);assert.equal(app.events.some(e=>e[0]==='complete_lifecycle_job'),false);assert.equal(app.events.find(e=>e[0]==='fail_lifecycle_job')[1].p_error,'provider_unavailable');
 await app.handler(req());assert.deepEqual(app.sends[0],app.sends[1],'Retries preserve exact message bytes and provider idempotency key');
});
test('uncertain ack retries use the frozen provider message even after templates change',async()=>{
 const app=fixture({ackFails:true});await app.handler(req());await app.handler(req());assert.deepEqual(app.sends[0],app.sends[1]);
});
test('cancelled/obsolete job context causes no mail or deletion',async()=>{
 const app=fixture({context:null});assert.deepEqual(await(await app.handler(req())).json(),{completed:0,deferred:0});assert.equal(app.sends.length,0);assert.equal(app.events.some(e=>e[0]==='deleteAuth'),false);
});
test('wrong parent context cannot direct a leased operation at another family',async()=>{
 const app=fixture({kind:'delete_account',wrongParent:true});assert.deepEqual(await(await app.handler(req())).json(),{completed:0,deferred:1});assert.equal(app.events.some(e=>e[0]==='deleteAuth'||e[0]==='storage'),false);
});
test('permanent deletion removes Storage first, verifies inventory, deletes Auth, verifies absence then acknowledges',async()=>{
 const app=fixture({kind:'delete_account',objects:[{bucket:'profile-media',name:'folder/avatar.png'},{bucket:'profile-media',name:'other.png'}]});assert.deepEqual(await(await app.handler(req())).json(),{completed:1,deferred:0});
 const names=app.events.map(e=>e[0]);assert.ok(names.indexOf('storage')<names.indexOf('deleteAuth'));assert.ok(names.indexOf('deleteAuth')<names.indexOf('authExists'));assert.ok(names.indexOf('authExists')<names.indexOf('complete_lifecycle_job'));assert.equal(app.sends.length,0);assert.equal(app.events.filter(e=>e[0]==='get_lifecycle_job_context').length,2);
});
test('unexpected Storage failure prevents Auth deletion and is retried with a safe code',async()=>{
 const app=fixture({kind:'delete_account',objects:[{bucket:'profile-media',name:'avatar.png'}],storageFails:true});assert.deepEqual(await(await app.handler(req())).json(),{completed:0,deferred:1});assert.equal(app.events.some(e=>e[0]==='deleteAuth'||e[0]==='complete_lifecycle_job'),false);assert.equal(app.events.find(e=>e[0]==='fail_lifecycle_job')[1].p_error,'storage_unverified');
});
test('Auth provider failure cannot become a completed deletion',async()=>{
 const app=fixture({kind:'delete_account',authFails:true});assert.deepEqual(await(await app.handler(req())).json(),{completed:0,deferred:1});assert.equal(app.events.some(e=>e[0]==='complete_lifecycle_job'),false);assert.equal(app.events.find(e=>e[0]==='fail_lifecycle_job')[1].p_error,'auth_unavailable');
});
test('retry after Auth deletion still removes leftover Storage and records actual absence',async()=>{
 const app=fixture({kind:'delete_account',alreadyDeleted:true,objects:[{bucket:'profile-media',name:'leftover.png'}]});assert.deepEqual(await(await app.handler(req())).json(),{completed:1,deferred:0});assert.equal(app.events.some(e=>e[0]==='storage'),true);assert.equal(app.events.some(e=>e[0]==='deleteAuth'),false);
});
test('inactivity email has a precise local deadline and states there is no extra 30-day grace',async()=>{
 const app=fixture({kind:'inactivity_3'});await app.handler(req());assert.match(app.sends[0].body.html,/22 december 2026/);assert.match(app.sends[0].body.html,/geen extra wachttijd van 30 dagen/);assert.match(app.sends[0].body.html,/e-mail openen/);
});
test('staging uses the standard TEST subject and Staging sender from Vault settings',async()=>{
 const app=fixture({environment:{FABELPAD_ENVIRONMENT:'staging'},config:{revision:1,settings:DEFAULT_EMAIL_SETTINGS,apiKey:'re_synthetic_vault_key'}});await app.handler(req());assert.match(app.sends[0].body.subject,/^\[TEST\]/);assert.match(app.sends[0].body.from,/ Staging </);
});
test('service adapter pins provider origin, RPC allowlist, Storage method and idempotent Auth 404',async()=>{
 const calls=[];const backend=createLifecycleSupabaseBackend({SUPABASE_URL:'https://tlwfpivafcokcjyjwgmq.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service-only'},async(url,init)=>{calls.push({url,init});if(init.method==='GET')return Response.json({id:PARENT});return Response.json({result:true});});
 await backend.rpc('claim_lifecycle_jobs',{p_limit:3});await backend.removeStorage('profile-media',['a.png']);await backend.deleteAuth(PARENT);assert.equal(await backend.authExists(PARENT),true);
 assert.equal(calls[1].init.method,'DELETE');assert.deepEqual(JSON.parse(calls[1].init.body),{prefixes:['a.png']});assert.equal(calls[2].init.method,'DELETE');assert.equal(calls[3].init.method,'GET');assert.ok(calls.every(c=>c.url.startsWith('https://tlwfpivafcokcjyjwgmq.supabase.co/')));
 await assert.rejects(backend.rpc('execute_arbitrary_sql',{}),/Maintenance backend unavailable/);
 const absent=createLifecycleSupabaseBackend({SUPABASE_URL:'https://tlwfpivafcokcjyjwgmq.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service-only'},async()=>new Response(null,{status:404}));await absent.deleteAuth(PARENT);assert.equal(await absent.authExists(PARENT),false);
});
