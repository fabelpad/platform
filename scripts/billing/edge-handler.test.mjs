import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileSource } from '../source-test-loader.mjs';
const temporary=await mkdtemp(join(tmpdir(),'fabelpad-billing-edge-'));after(()=>rm(temporary,{recursive:true,force:true}));
const {createBillingHandler}=await import(await compileSource(new URL('../../lib/billing/edge-handler.ts',import.meta.url),temporary));
const {createBillingBackend,BillingRequestError}=await import(await compileSource(new URL('../../lib/billing/backend.ts',import.meta.url),temporary));
const {defaultBillingSettings}=await import(await compileSource(new URL('../../lib/billing/settings.ts',import.meta.url),temporary));
const environment={SUPABASE_URL:'https://tlwfpivafcokcjyjwgmq.supabase.co',FABELPAD_APP_ORIGIN:'https://staging.fabelpad.nl',FABELPAD_ENVIRONMENT:'staging'};
const token='synthetic-only-parent-access-token',parentId='11111111-1111-4111-8111-111111111111',requestId='22222222-2222-4222-8222-222222222222';
const secret='test_SyntheticOnlyNeverARealMollieKey';
const metadata={fabelpadContractId:parentId,fabelpadOperationId:requestId,fabelpadAttemptId:parentId};
const payment={id:'tr_synthetic',mode:'test',profileId:'pfl_synthetic',customerId:'cst_synthetic',sequenceType:'first',status:'open',amount:{currency:'EUR',value:'4.99'},metadata};
const snapshot=()=>({revision:3,settings:defaultBillingSettings('staging'),gates:Object.fromEntries(['paymentRequired','foundersEnabled','mollieEnabled','playEnabled'].map(gate=>[gate,{configured:false,effective:false,reason:'paused'}])),founders:{awarded:0,remaining:50,maximum:50,durationMonths:12,startsAt:null,status:'paused'},credentials:[]});
const request=(body,authenticated=true)=>new Request('https://project.supabase.co/functions/v1/billing',{method:'POST',headers:{'Content-Type':'application/json',...(authenticated?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});
const checkout=(changes={})=>({action:'checkout',period:'month',requestId,expectedRevision:3,expectedAmountCents:499,termsVersion:'2026-11-23.1',acceptTerms:true,acceptRecurring:true,...changes});
function fixture(options={}){
 const calls=[],provider=[],ticks=[];
 const backend={
  async authenticate(value){calls.push({name:'authenticate',value});return options.anonymous?null:{id:parentId,email:'parent@example.test'};},
  async publicRpc(name,args={}){calls.push({name,args});return options.offer??{paymentRequired:false,gates:snapshot().gates};},
  async rpc(name,args={},accessToken){calls.push({name,args,accessToken});if(options.rpc){const result=await options.rpc(name,args,accessToken);if(result!==undefined)return result;}
   if(name==='get_billing_settings')return snapshot();
   if(name==='get_billing_mollie_trial')return null;
   if(name==='get_billing_provider_config')return{revision:2,provider:'mollie',environment:'staging',mode:'test',apiKey:secret,profileId:'pfl_synthetic',settingsRevision:3,config:{...defaultBillingSettings('staging'),mollie:{mode:'test',firstMethods:['ideal'],expectedProfileId:'pfl_synthetic',description:'Fabelpad Gezin'}}};
   if(name==='record_billing_provider_event')return{recorded:true};
   if(name==='authorize_billing_admin')return true;
   throw new Error('Unconfigured synthetic RPC');
  },
 };
 const fetcher=async(url,init)=>{provider.push({url,init});if(options.fetch)return options.fetch(url,init);assert.equal(url,'https://api.mollie.com/v2/payments/tr_synthetic');return Response.json(payment);};
 return{calls,provider,ticks,handler:createBillingHandler({...environment,...options.environment},{backend,fetch:fetcher,tick:async()=>{ticks.push(true);}})};
}
test('missing or rejected current Auth identity cannot reach an authenticated billing RPC',async()=>{
 const missing=fixture();assert.equal((await missing.handler(request({action:'settings'},false))).status,401);assert.equal(missing.calls.length,0);
 const rejected=fixture({anonymous:true});assert.equal((await rejected.handler(request({action:'settings'}))).status,401);assert.deepEqual(rejected.calls.map(c=>c.name),['authenticate']);
});
test('admin role remains a current database decision and cannot be supplied as a client claim',async()=>{
 const denied=fixture({rpc:name=>{if(name==='get_billing_settings')throw new BillingRequestError('billing_forbidden',403);}});
 assert.equal((await denied.handler(request({action:'settings'}))).status,403);assert.equal(denied.calls.at(-1).accessToken,token);assert.equal(denied.provider.length,0);
 const forged=fixture();assert.equal((await forged.handler(request({action:'settings',role:'admin',parentId}))).status,422);assert.deepEqual(forged.calls.map(c=>c.name),['authenticate']);
});
test('provider secret access and nontransaction probes require a fresh DB admin preflight',async()=>{
 for(const code of ['billing_forbidden','fresh_auth_required']){
  const app=fixture({rpc:name=>{if(name==='authorize_billing_admin')throw new BillingRequestError(code,code==='fresh_auth_required'?428:403);}});
  assert.equal((await app.handler(request({action:'test',provider:'mollie',mode:'test',credentialRevision:2}))).status,code==='fresh_auth_required'?428:403);
  assert.deepEqual(app.calls.map(c=>c.name),['authenticate','authorize_billing_admin']);assert.equal(app.provider.length,0);
 }
});
test('staging Play trials require a fresh current administrator and use only the user-authorized reservation RPC',async()=>{
 const body={action:'playTrial',period:'month',requestId};
 for(const status of [403,428]){
  const denied=fixture({rpc:name=>{if(name==='authorize_billing_admin')throw new BillingRequestError(status===403?'billing_forbidden':'fresh_auth_required',status);}});
  assert.equal((await denied.handler(request(body))).status,status);assert.deepEqual(denied.calls.map(c=>c.name),['authenticate','authorize_billing_admin']);assert.equal(denied.provider.length,0);
 }
 const allowed=fixture({rpc:name=>name==='reserve_billing_play_trial'?{id:parentId,provider:'play',mode:'test',adminTrial:true}:undefined});
 const response=await allowed.handler(request(body));assert.equal(response.status,200);
 assert.deepEqual(allowed.calls.map(c=>c.name),['authenticate','authorize_billing_admin','reserve_billing_play_trial']);assert.deepEqual(allowed.calls[1].args,{p_fresh:true});assert.equal(allowed.calls.at(-1).accessToken,token);assert.deepEqual(allowed.calls.at(-1).args,{p_period:'month',p_request_id:requestId});assert.equal(allowed.provider.length,0);
});
test('production cannot reserve an administrator Play trial or bypass the environment using a body field',async()=>{
 const production={SUPABASE_URL:'https://aptprpkosqctwrzeetgs.supabase.co',FABELPAD_APP_ORIGIN:'https://fabelpad.nl',FABELPAD_ENVIRONMENT:'production'};
 for(const extra of [{},{environment:'staging'},{mode:'test'}]){
  const app=fixture({environment:production});assert.equal((await app.handler(request({action:'playTrial',period:'month',requestId,...extra}))).status,422);
  assert.deepEqual(app.calls.map(c=>c.name),['authenticate']);assert.equal(app.provider.length,0);
 }
});
test('a swapped project/origin target cannot authenticate, read secrets or contact a provider',async()=>{
 const app=fixture({environment:{FABELPAD_APP_ORIGIN:'https://fabelpad.nl'}});assert.equal((await app.handler(request({action:'settings'}))).status,503);assert.equal(app.calls.length,0);assert.equal(app.provider.length,0);
});
test('CAS conflicts are 409 and never appear as a successful save',async()=>{
 const app=fixture({rpc:name=>name==='save_billing_settings'?{saved:false,...snapshot()}:undefined});
 const response=await app.handler(request({action:'save',baseRevision:3,settings:defaultBillingSettings('staging')}));assert.equal(response.status,409);assert.deepEqual(await response.json(),{error:'billing_revision_conflict'});
});
test('all-off checkout rejection in SQL cannot be bypassed by direct API calls or stale browser state',async()=>{
 const app=fixture({rpc:name=>{if(name==='reserve_billing_purchase')throw new BillingRequestError('billing_channel_disabled',422);}});
 const response=await app.handler(request(checkout()));assert.equal(response.status,422);assert.equal(app.calls.at(-1).name,'reserve_billing_purchase');assert.equal(app.provider.length,0);assert.equal(app.ticks.length,0);
});
test('forged mode, price evidence, provider identifiers or entitlement fields never reach a privileged operation',async()=>{
 for(const body of [checkout({mode:'live'}),checkout({provider:'play'}),checkout({providerPaymentId:'tr_forged'}),checkout({state:'active'}),{action:'playVerify',purchaseToken:'synthetic-token',parentId:'somebody-else'},{action:'applyEvidence',state:'active'},checkout({acceptTerms:false})]){
  const app=fixture();assert.equal((await app.handler(request(body))).status,422);assert.equal(app.calls.some(c=>c.name!=='authenticate'),false);assert.equal(app.provider.length,0);
 }
});
test('a zero-price gift bypasses Mollie and durable provider processing completely',async()=>{
 const app=fixture({rpc:name=>name==='reserve_billing_purchase'?{gift:true,entitlement:{plan:'coupon',fullLibrary:true}}:undefined});
 const response=await app.handler(request(checkout({couponCode:'GEZIN-100',expectedAmountCents:0,acceptRecurring:false})));assert.equal(response.status,200);assert.equal((await response.json()).gift,true);
 assert.equal(app.provider.length,0);assert.equal(app.ticks.length,0);assert.equal(app.calls.some(c=>c.name==='get_billing_provider_config'||c.name==='recheck_billing_purchase'),false);
});
test('public offer and nested snapshots cannot leak secret-labelled fields from an unexpected backend response',async()=>{
 for(const offer of [{apiKey:secret},{gates:{nested:[{private_key:secret}]}},{credentials:[{accessToken:secret}]}]){
  const app=fixture({offer}),response=await app.handler(request({action:'offer'},false));assert.equal(response.status,503);assert.equal(JSON.stringify(await response.json()).includes(secret),false);
 }
});
test('ordinary Mollie webhook is an authoritative GET followed only by a queued signal, never a client-granted right',async()=>{
 const app=fixture(),response=await app.handler(request({action:'mollieWebhook',paymentId:'tr_synthetic',credentialRevision:2},false));assert.equal(response.status,200);
 assert.equal(app.provider.length,1);assert.equal(app.provider[0].init.method,'GET');assert.equal(app.calls.some(c=>c.name==='apply_billing_provider_evidence'),false);
 const event=app.calls.find(c=>c.name==='record_billing_provider_event');assert.deepEqual(event.args.p_payload,{paymentId:'tr_synthetic',credentialRevision:2});assert.equal(event.accessToken,undefined);
 const forged=fixture();assert.equal((await forged.handler(request({action:'mollieWebhook',paymentId:'tr_synthetic',credentialRevision:2,status:'paid',amountCents:499},false))).status,422);assert.equal(forged.calls.length,0);
});
test('unsafe media, oversize payload and transport errors are rejected without exposing diagnostics',async()=>{
 const app=fixture();const media=request({action:'offer'},false);media.headers.set('Content-Type','text/plain');assert.equal((await app.handler(media)).status,415);
 assert.equal((await app.handler(request({action:'offer',padding:'x'.repeat(170*1024)},false))).status,413);
 const unavailable=fixture({rpc:name=>{if(name==='get_billing_settings')throw new Error(secret);}});const response=await unavailable.handler(request({action:'settings'}));assert.equal(response.status,503);assert.equal(JSON.stringify(await response.json()).includes(secret),false);
});
test('Edge backend allows only actual wire RPCs under the correct public/user/service credential',async()=>{
 const calls=[],env={...environment,SUPABASE_SERVICE_ROLE_KEY:'synthetic-service-only',SUPABASE_ANON_KEY:'synthetic-public-only'};
 const backend=createBillingBackend(env,async(url,init)=>{calls.push({url,init});return Response.json({ok:true});});
 for(const name of ['get_billing_mollie_binding','get_billing_mollie_job_context','record_billing_mollie_customer','recheck_billing_renewal','get_billing_mollie_trial','record_billing_mollie_trial','get_billing_play_binding','get_billing_play_reservation','freeze_billing_email'])await backend.rpc(name,{});
 assert.ok(calls.every(c=>c.init.headers.Authorization==='Bearer synthetic-service-only'));
 await backend.rpc('prepare_billing_mollie_trial',{},token);assert.equal(calls.at(-1).init.headers.Authorization,`Bearer ${token}`);assert.equal(calls.at(-1).init.headers.apikey,'synthetic-public-only');
 const before=calls.length;await assert.rejects(backend.rpc('get_billing_provider_config',{},token));await assert.rejects(backend.rpc('execute_sql',{}));await assert.rejects(backend.publicRpc('get_billing_settings'));assert.equal(calls.length,before);
});
test('held-open and forged-length bodies are stopped before Auth, secret reads or provider work',async()=>{
 const app=fixture();let canceled=false;
 const incoming=new Request('https://project.supabase.co/functions/v1/billing',{method:'POST',headers:{'Content-Type':'application/json','Content-Length':'1'},duplex:'half',body:new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('{'));},cancel(){canceled=true;}})});
 const started=Date.now();assert.equal((await app.handler(incoming)).status,422);assert.ok(Date.now()-started<3500);assert.equal(canceled,true);assert.equal(app.calls.length,0);
});
