import { createSupabaseServerClient, getVerifiedParent } from '../supabase/server';
import { getSupabaseConfig } from '../supabase/config';
import { resolveHostedEmailTarget } from '../email/hosted-target';
import { billingJson, BillingRequestError } from '../billing/backend';
import { checkMutationOrigin, handleApiError, object, privateJson, RequestError } from './http';

export type BillingAction = 'account'|'playTrial'|'playProof'|'trial'|'trialCallback'|'deleteCredential'|'offer'|'settings'|'save'|'gate'|'impact'|'credential'|'test'|'coupons'|'saveCoupons'|'couponEnabled'|'entitlement'|'chooseFree'|'quote'|'checkout'|'purchase'|'subscriptions'|'cancel'|'operations'|'withdraw'|'confirmWithdrawal'|'playReserve'|'playVerify';
const PUBLIC_ACTIONS = new Set<BillingAction>(['offer','withdraw','confirmWithdrawal']);
function safeGatewayResult(value:unknown):void {
  if(Array.isArray(value)){for(const child of value)safeGatewayResult(child);return;}
  if(!object(value))return;
  for(const[key,child]of Object.entries(value)){if(/^(?:apiKey|api_key|secret|private_key|accessToken|refreshToken|purchaseToken|leaseToken|authorization)$/iu.test(key))throw new BillingRequestError('billing_unavailable',503);safeGatewayResult(child);}
}
async function boundedBillingJson(request:Request,limit:number):Promise<unknown>{
  if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')throw new RequestError(415,'unsupported_media_type');
  const raw=await boundedSignal(request,limit);try{return JSON.parse(raw) as unknown;}catch{throw new RequestError(400,'invalid_json');}
}
const messages:Record<string,string>={fresh_auth_required:'Bevestig deze handeling met een nieuwe e-mailcode of Google-login.',billing_quote_changed:'Het aanbod is gewijzigd. Bekijk het actuele bedrag en bevestig opnieuw.',billing_payment_disabled:'De bibliotheek is nu gratis. Een nieuwe betaling is niet nodig.',billing_channel_disabled:'Nieuwe abonnementen zijn tijdelijk niet beschikbaar.',billing_provider_unverified:'Deze betaalmethode is nog niet beschikbaar.',billing_subscription_exists:'Jullie gezin heeft al een betaald abonnement.',billing_purchase_pending:'Er staat al een betaalpoging open. Bekijk eerst de status daarvan.',billing_coupon_invalid:'Deze kortingscode kan niet worden gebruikt.',billing_coupon_expired:'Deze kortingscode is verlopen.',billing_coupon_exhausted:'Deze kortingscode is volledig gebruikt.',billing_coupon_used:'Deze kortingscode is al door jullie gezin gebruikt.',billing_revision_conflict:'Een andere beheerder heeft de instellingen gewijzigd. Laad de actuele versie opnieuw.',billing_phaseout_confirmation_required:'Bekijk en bevestig eerst welke lopende abonnementen worden stopgezet.',billing_forbidden:'Dit account heeft geen toegang tot deze handeling.',sign_in_required:'Log in als ouder om verder te gaan.',billing_unavailable:'Abonnementen en betalingen zijn tijdelijk niet bereikbaar. Probeer het later opnieuw.'};
export async function billingRequest(request:Request,action:BillingAction):Promise<Response> {
  try {
    const config=getSupabaseConfig(); if (!config) throw new RequestError(503,'billing_unavailable',messages.billing_unavailable);
    const identity=resolveHostedEmailTarget({SUPABASE_URL:config.url,FABELPAD_APP_ORIGIN:config.appUrl}); if (!identity) throw new RequestError(503,'billing_unavailable',messages.billing_unavailable);
    const bearer=request.headers.get('authorization');
    if (request.method!=='GET') checkMutationOrigin(request);
    let token:string|undefined;
    if (!PUBLIC_ACTIONS.has(action)) {
      if (bearer) { if (!/^Bearer [\x21-\x7e]{20,16384}$/u.test(bearer)) throw new RequestError(401,'sign_in_required',messages.sign_in_required); token=bearer.slice(7); }
      else { const client=await createSupabaseServerClient(); if (!await getVerifiedParent(client)) throw new RequestError(401,'sign_in_required',messages.sign_in_required); const {data:{session},error}=await client.auth.getSession(); if (error||!session?.access_token) throw new RequestError(401,'sign_in_required',messages.sign_in_required); token=session.access_token; }
    }
    const value=request.method==='GET'?{...(action==='purchase'?{reservationId:new URL(request.url).searchParams.get('id')}:{})}:await boundedBillingJson(request,160*1024);
    if(action==='withdraw'&&object(value)&&Object.hasOwn(value,'token'))action='confirmWithdrawal';
    if (!object(value) || Object.hasOwn(value,'action')) throw new RequestError(422,'billing_invalid_request');
    const response=await fetch(`${config.url}/functions/v1/billing`,{method:'POST',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(30_000),headers:{'Content-Type':'application/json',apikey:config.publishableKey,...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({...value,action})});
    const result=await billingJson(response);
    if (!response.ok) { const code=object(result)&&typeof result.error==='string'&&Object.hasOwn(messages,result.error)?result.error:'billing_unavailable'; return privateJson({error:code,message:messages[code]},[400,401,403,409,422,428,429,503].includes(response.status)?response.status:503); }
    if (!object(result)) throw new BillingRequestError('billing_unavailable',503);
    safeGatewayResult(result);
    return privateJson(result);
  } catch(error) { if(error instanceof BillingRequestError) return privateJson({error:error.code,message:messages[error.code]??messages.billing_unavailable},error.status); return handleApiError(error); }
}
/** Public provider signal. No identity, amount, price or entitlement comes from
 * the callback. The Edge worker retrieves authoritative provider evidence. */
export async function billingProviderSignal(request:Request,provider:'mollie'|'play'):Promise<Response> {
  try {
    const config=getSupabaseConfig(); if(!config||!resolveHostedEmailTarget({SUPABASE_URL:config.url,FABELPAD_APP_ORIGIN:config.appUrl})) throw new Error();
    let body:unknown;
    if(provider==='mollie') { if(!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) return privateJson({error:'invalid_request'},415); const text=await boundedSignal(request,1024); const data=new URLSearchParams(text); const id=data.get('id'); const credential=new URL(request.url).searchParams.get('credential'); if(data.getAll('id').length!==1||!id||!/^tr_[a-zA-Z0-9]{4,100}$/u.test(id)||!credential||!/^\d{1,12}$/u.test(credential)) return privateJson({error:'invalid_request'},422); body={action:'mollieWebhook',paymentId:id,credentialRevision:Number(credential)}; }
    else { const input=await boundedBillingJson(request,64*1024); body={action:'playNotification',notification:input,authorization:request.headers.get('authorization')??''}; }
    const response=await fetch(`${config.url}/functions/v1/billing`,{method:'POST',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20_000),headers:{'Content-Type':'application/json',apikey:config.publishableKey},body:JSON.stringify(body)});
    // Never reflect provider bodies, tokens or upstream diagnostics.
    await response.body?.cancel(); return privateJson(response.ok?{accepted:true}:{error:'signal_unavailable'},response.ok?200:503);
  } catch{return privateJson({error:'signal_unavailable'},503);}
}
async function boundedSignal(request:Request,limit:number):Promise<string> {
 const reader=request.body?.getReader();if(!reader)throw new RequestError(400,'invalid_request');let raw='',size=0;const decoder=new TextDecoder('utf-8',{fatal:true});let timer:ReturnType<typeof setTimeout>|undefined;
 const read=async()=>{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>limit)throw new RequestError(413,'payload_too_large');raw+=decoder.decode(part.value,{stream:true});}return raw+decoder.decode();};
 try{return await Promise.race([read(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{reject(new RequestError(408,'request_timeout'));void reader.cancel().catch(()=>{});},2000);})]);}
 finally{if(timer)clearTimeout(timer);void reader.cancel().catch(()=>{});}
}
