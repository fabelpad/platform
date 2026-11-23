import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileSource } from '../source-test-loader.mjs';
const temporary=await mkdtemp(join(tmpdir(),'fabelpad-billing-gateway-'));
const stateKey=Symbol.for('fabelpad.billing.gateway.test'),beforeState=globalThis[stateKey],beforeFetch=globalThis.fetch,beforeEnvironment={...process.env};
after(async()=>{globalThis.fetch=beforeFetch;if(beforeState===undefined)delete globalThis[stateKey];else globalThis[stateKey]=beforeState;for(const name of Object.keys(process.env))if(!(name in beforeEnvironment))delete process.env[name];Object.assign(process.env,beforeEnvironment);await rm(temporary,{recursive:true,force:true});});
for(const name of Object.keys(process.env))if(/^(NEXT_PUBLIC_|FABELPAD_|APP_URL$)/u.test(name))delete process.env[name];
Object.assign(process.env,{FABELPAD_DEPLOY_ENV:'local',FABELPAD_DATA_MODE:'supabase',FABELPAD_APP_ORIGIN:'https://staging.fabelpad.nl',NEXT_PUBLIC_SUPABASE_URL:'https://tlwfpivafcokcjyjwgmq.supabase.co',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_synthetic_billing_test'});
const apiURL=await compileSource(new URL('../../lib/server/billing.ts',import.meta.url),temporary);
const serverURL=await compileSource(new URL('../../lib/supabase/server.ts',import.meta.url),temporary);
await writeFile(new URL(serverURL),`const state=()=>globalThis[Symbol.for('fabelpad.billing.gateway.test')]; export async function createSupabaseServerClient(){state().auth.push('createClient');return{auth:{async getSession(){state().auth.push('getSession');return{data:{session:state().session},error:null};}}};}export async function getVerifiedParent(){state().auth.push('getVerifiedParent');return state().parent;}`);
const {billingRequest,billingProviderSignal}=await import(apiURL);
const {POST:productionPlayProof}=await import(await compileSource(new URL('../../app/api/admin/billing/play-proof/route.ts',import.meta.url),temporary));
const token='synthetic-only-parent-access-token',id='11111111-1111-4111-8111-111111111111';
function fixture(options={}){
 const calls=[];globalThis[stateKey]={auth:[],parent:options.anonymous?null:{id},session:options.anonymous?null:{access_token:token}};
 globalThis.fetch=async(url,init)=>{calls.push({url,init,body:JSON.parse(init.body)});assert.equal(url,'https://tlwfpivafcokcjyjwgmq.supabase.co/functions/v1/billing');assert.equal(init.redirect,'error');assert.equal(init.headers.apikey,'sb_publishable_synthetic_billing_test');return Response.json(options.result??{received:true},{status:options.status??200});};
 return{calls,state:globalThis[stateKey]};
}
const request=(body={},headers={},method='POST',suffix='')=>new Request(`https://staging.fabelpad.nl/api/billing${suffix}`,{method,headers:{...(method==='GET'?{}:{'Content-Type':'application/json',Origin:'https://staging.fabelpad.nl'}),...headers},...(method==='GET'?{}:{body:JSON.stringify(body)})});
test('cookie gateway verifies the parent before reading transport session and forwards only a user credential',async()=>{
 const app=fixture();const response=await billingRequest(request({}, {},'GET'),'entitlement');assert.equal(response.status,200);assert.deepEqual(app.state.auth,['createClient','getVerifiedParent','getSession']);
 assert.equal(app.calls[0].init.headers.Authorization,`Bearer ${token}`);assert.deepEqual(app.calls[0].body,{action:'entitlement'});assert.equal(response.headers.get('Cache-Control'),'private, no-store');assert.equal(response.headers.get('Vary'),'Cookie, Authorization');
});
test('missing cookie identity and foreign origins cannot reach the privileged Edge gateway',async()=>{
 const unauth=fixture({anonymous:true});assert.equal((await billingRequest(request({}, {},'GET'),'settings')).status,401);assert.equal(unauth.calls.length,0);assert.equal(unauth.state.auth.includes('getSession'),false);
 const cross=fixture();assert.equal((await billingRequest(request({},{Origin:'https://attacker.test'}),'checkout')).status,403);assert.equal(cross.calls.length,0);
});
test('native bearer token is forwarded for independent Edge Auth verification and cannot select a server action',async()=>{
 const app=fixture({status:401,result:{error:'sign_in_required'}});const response=await billingRequest(request({},{Authorization:`Bearer ${token}`}),'checkout');assert.equal(response.status,401);assert.equal(app.state.auth.length,0);assert.equal(app.calls[0].init.headers.Authorization,`Bearer ${token}`);
 const forged=fixture();assert.equal((await billingRequest(request({action:'gate'},{Authorization:`Bearer ${token}`}),'checkout')).status,422);assert.equal(forged.calls.length,0);
});
test('the administrator Play proof route forwards the fixed proof action under verified cookie or native identity',async()=>{
 for(const [body,headers]of [[{credentialRevision:9},{}],[{proofId:id,purchaseToken:'synthetic-only-license-token'},{Authorization:`Bearer ${token}`} ]]){
  const app=fixture({result:{saved:true,proofOnly:true,serverVerificationVerified:true}});const response=await productionPlayProof(request(body,headers));assert.equal(response.status,200);
  assert.deepEqual(app.calls[0].body,{...body,action:'playProof'});assert.equal(app.calls[0].init.headers.Authorization,`Bearer ${token}`);assert.equal(app.calls[0].init.headers.apikey,'sb_publishable_synthetic_billing_test');assert.equal(JSON.stringify(await response.json()).includes('synthetic-only-license-token'),false);
 }
 const unauth=fixture({anonymous:true});assert.equal((await productionPlayProof(request({credentialRevision:9}))).status,401);assert.equal(unauth.calls.length,0);
 const foreign=fixture();assert.equal((await productionPlayProof(request({credentialRevision:9},{Origin:'https://attacker.test'}))).status,403);assert.equal(foreign.calls.length,0);
 const forged=fixture();assert.equal((await productionPlayProof(request({action:'gate',credentialRevision:9}))).status,422);assert.equal(forged.calls.length,0);
});
test('a public withdrawal does not require or forward an account credential',async()=>{
 const app=fixture({anonymous:true});const response=await billingRequest(request({email:'parent@example.test',reference:'tr_synthetic',requestId:id}),'withdraw');assert.equal(response.status,200);assert.equal(app.state.auth.length,0);assert.equal(app.calls[0].init.headers.Authorization,undefined);assert.equal(app.calls[0].body.action,'withdraw');
});
test('swapped project URL fails before cookie Auth or Edge transport',async()=>{
 const app=fixture();const original=process.env.NEXT_PUBLIC_SUPABASE_URL;process.env.NEXT_PUBLIC_SUPABASE_URL='https://aptprpkosqctwrzeetgs.supabase.co';try{assert.equal((await billingRequest(request({}, {},'GET'),'offer')).status,503);assert.equal(app.calls.length,0);assert.equal(app.state.auth.length,0);}finally{process.env.NEXT_PUBLIC_SUPABASE_URL=original;}
});
test('gateway keeps CAS and fresh-auth status while hiding unexpected provider diagnostics',async()=>{
 for(const [status,error]of [[409,'billing_revision_conflict'],[428,'fresh_auth_required']]){const app=fixture({status,result:{error,private:'synthetic-upstream-secret'}});const response=await billingRequest(request({}, {},'GET'),'settings');assert.equal(response.status,status);assert.equal(JSON.stringify(await response.json()).includes('synthetic-upstream-secret'),false);assert.equal(app.calls.length,1);}
});
test('Mollie gateway discards caller status/amount, forwards only one payment ID and fixed credential revision',async()=>{
 const app=fixture({result:{private:'provider-body-never-reflected'}});
 const incoming=new Request('https://staging.fabelpad.nl/api/billing/mollie/webhook?credential=2',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'id=tr_synthetic&status=paid&amount=0.01&parentId=forged'});
 const response=await billingProviderSignal(incoming,'mollie');assert.equal(response.status,200);assert.deepEqual(app.calls[0].body,{action:'mollieWebhook',paymentId:'tr_synthetic',credentialRevision:2});assert.deepEqual(await response.json(),{accepted:true});assert.equal(app.calls[0].init.headers.Authorization,undefined);
});
test('duplicate IDs, invalid provider IDs, wrong media and forged credential selectors cannot queue signals',async()=>{
 for(const [body,suffix,media]of [['id=tr_one&id=tr_two','2','application/x-www-form-urlencoded'],['id=../other','2','application/x-www-form-urlencoded'],['id=tr_synthetic','2&other=bad','application/json'],['id=tr_synthetic','not-a-revision','application/x-www-form-urlencoded']]){
  const app=fixture();const incoming=new Request(`https://staging.fabelpad.nl/api/billing/mollie/webhook?credential=${suffix}`,{method:'POST',headers:{'Content-Type':media},body});assert.ok((await billingProviderSignal(incoming,'mollie')).status>=400);assert.equal(app.calls.length,0);
 }
});
test('unexpected successful Edge payload cannot expose a secret through the public Next gateway',async()=>{
 const app=fixture({result:{offer:{nested:[{apiKey:'synthetic-upstream-secret'}]}}});const response=await billingRequest(request({}, {},'GET'),'offer');assert.equal(response.status,503);assert.equal(JSON.stringify(await response.json()).includes('synthetic-upstream-secret'),false);assert.equal(app.calls.length,1);
});
test('a held-open provider signal cannot hold the public gateway indefinitely',async()=>{
 const app=fixture();let canceled=false;
 const incoming=new Request('https://staging.fabelpad.nl/api/billing/mollie/webhook?credential=2',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Content-Length':'1'},duplex:'half',body:new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('id='));},cancel(){canceled=true;}})});
 const started=Date.now();assert.equal((await billingProviderSignal(incoming,'mollie')).status,503);assert.ok(Date.now()-started<3500);assert.equal(canceled,true);assert.equal(app.calls.length,0);
});
