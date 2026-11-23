import { BillingRequestError, type BillingBackend } from './backend.ts';
import { parseBillingSettings } from './settings.ts';
import type { BillingCredential, BillingSnapshot } from './types.ts';
import { createMollieClient } from './mollie.ts';
import { startMollieCheckout } from './mollie-service.ts';
import { startMollieTrial, verifyMollieTrial, verifyMollieTrialWebhook } from './mollie-trial.ts';
import { createPlayBillingService } from './play-service.ts';
import { createPlayCredentialAccessToken } from './play.ts';
import { resolveHostedEmailTarget } from '../email/hosted-target.ts';

type Environment=Record<string,string|undefined>;
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const invalid=():never=>{throw new BillingRequestError('billing_invalid_request',422);};
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(v);
const integer=(v:unknown):v is number=>Number.isSafeInteger(v)&&(v as number)>=0;
const text=(v:unknown,max=500):v is string=>typeof v==='string'&&v.length<=max&&!/[\u0000-\u001f\u007f]/u.test(v);
const secretFields=/^(?:apiKey|api_key|secret|private_key|accessToken|refreshToken|purchaseToken|leaseToken|authorization)$/iu;
async function readBillingBody(request:Request):Promise<unknown>{
  const reader=request.body?.getReader();if(!reader)invalid();let raw='',size=0;const decoder=new TextDecoder('utf-8',{fatal:true});let timer:ReturnType<typeof setTimeout>|undefined;
  const read=async()=>{while(true){const part=await reader!.read();if(part.done)break;size+=part.value.length;if(size>160*1024)throw new BillingRequestError('payload_too_large',413);raw+=decoder.decode(part.value,{stream:true});}return JSON.parse(raw+decoder.decode()) as unknown;};
  try{return await Promise.race([read(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{reject(new BillingRequestError('billing_invalid_request',422));void reader!.cancel().catch(()=>{});},2000);})]);}
  finally{if(timer)clearTimeout(timer);void reader!.cancel().catch(()=>{});}
}
function publicResult(value:unknown):unknown {
  if(Array.isArray(value))return value.map(publicResult);
  if(!object(value))return value;
  for(const [key,child]of Object.entries(value)){if(secretFields.test(key))throw new BillingRequestError('billing_unavailable',503);publicResult(child);}
  return value;
}
function snapshot(value:BillingSnapshot):BillingSnapshot {
  return {revision:value.revision,settings:parseBillingSettings(value.settings),gates:value.gates,founders:value.founders,credentials:value.credentials.map(c=>({provider:c.provider,mode:c.mode,revision:c.revision,configured:c.configured,verified:c.verified,active:c.active,verification:c.verification,verifiedAt:c.verifiedAt}))};
}
/** Own-project Edge entrypoint. Authorization is independently repeated by Auth
 * and each DB RPC. Service-only verification never accepts client evidence. */
export function createBillingHandler(environment:Environment,deps:{backend:BillingBackend;fetch?:typeof fetch;tick?:()=>Promise<unknown>}) {
  const target=resolveHostedEmailTarget(environment),backend=deps.backend,fetcher=deps.fetch??fetch;
  const play=createPlayBillingService({backend,fetcher,accessToken:c=>createPlayCredentialAccessToken(c.apiKey,{fetcher})});
  const respond=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  return async(request:Request):Promise<Response>=>{
    if(!target)return respond({error:'billing_unavailable'},503);
    if(request.method!=='POST')return respond({error:'method_not_allowed'},405);
    try{
      if(!request.headers.get('content-type')?.startsWith('application/json'))return respond({error:'invalid_request'},415);
      const input=await readBillingBody(request);if(!object(input)||!text(input.action,40))invalid();
      const body=input as Record<string,unknown>,action=body.action as string;
      const only=(names:string[])=>{if(Object.keys(body).some(k=>k!=='action'&&!names.includes(k)))invalid();};
      if(action==='offer'){only([]);return respond(publicResult(await backend.publicRpc('get_billing_public_offer')));}
      if(action==='mollieWebhook'){
        only(['paymentId','credentialRevision']);if(!text(body.paymentId,104)||!/^tr_[a-zA-Z0-9]{4,100}$/u.test(body.paymentId as string)||!integer(body.credentialRevision))invalid();
        const trial=await verifyMollieTrialWebhook(body.paymentId as string,body.credentialRevision as number,{backend,fetch:fetcher});
        if(trial.matched)return respond({accepted:true});
        // A webhook is only an untrusted wake-up signal. Use a fresh event id:
        // the same payment can move from open to paid to refunded later.
        await backend.rpc('record_billing_provider_event',{p_provider:'mollie',p_event_id:`signal:${crypto.randomUUID()}`,p_payload:{paymentId:body.paymentId,credentialRevision:body.credentialRevision}});
        await deps.tick?.();return respond({accepted:true});
      }
      if(action==='playNotification'){only(['notification','authorization']);if(!text(body.authorization,16384)||!object(body.notification))invalid();await play.acceptNotification({authorization:body.authorization as string,body:body.notification,mode:target.FABELPAD_ENVIRONMENT==='staging'?'test':'live'});await deps.tick?.();return respond({accepted:true});}
      if(action==='withdraw'||action==='confirmWithdrawal'){
        if(action==='withdraw'){only(['email','reference','requestId']);if(!text(body.email,254)||!/^\S+@\S+\.\S+$/u.test(body.email as string)||!text(body.reference,150)||!uuid(body.requestId))invalid();await backend.rpc('request_billing_withdrawal',{p_email:body.email,p_reference:body.reference,p_request_id:body.requestId});return respond({received:true,message:'Je verzoek is ontvangen. Als de aankoopgegevens overeenkomen, ontvang je per e-mail de bevestigingsstap en een ontvangstbewijs.'});}
        only(['token']);if(!text(body.token,500))invalid();const result=await backend.rpc('confirm_billing_withdrawal',{p_token:body.token});await deps.tick?.();if(object(result)&&result.saved===false)throw new BillingRequestError('billing_revision_conflict',409);
      return respond(publicResult(result));
      }
      const authorization=request.headers.get('authorization')??'';
      if(!/^Bearer [\x21-\x7e]{20,16384}$/u.test(authorization))throw new BillingRequestError('sign_in_required',401);
      const token=authorization.slice(7),actor=await backend.authenticate(token);if(!actor)throw new BillingRequestError('sign_in_required',401);
      const rpc=<T>(name:string,parameters:Record<string,unknown>={})=>backend.rpc<T>(name,parameters,token);
      let result:unknown;
      switch(action){
        case 'settings':only([]);result=snapshot(await rpc<BillingSnapshot>('get_billing_settings'));break;
        case 'save':only(['baseRevision','settings']);if(!integer(body.baseRevision))invalid();result=await rpc('save_billing_settings',{p_expected_revision:body.baseRevision,p_settings:parseBillingSettings(body.settings)});break;
        case 'gate':only(['baseRevision','gate','enabled','confirmPhaseout']);if(!integer(body.baseRevision)||!['paymentRequired','foundersEnabled','mollieEnabled','playEnabled'].includes(String(body.gate))||typeof body.enabled!=='boolean')invalid();result=await rpc('set_billing_gate',{p_expected_revision:body.baseRevision,p_gate:body.gate,p_enabled:body.enabled,p_confirm_phaseout:body.confirmPhaseout===true});break;
        case 'impact':only([]);result=await rpc('billing_phaseout_impact');break;
        case 'deleteCredential':only(['baseRevision','credentialRevision']);if(!integer(body.baseRevision)||!integer(body.credentialRevision))invalid();result=await rpc('delete_billing_credential',{p_expected_revision:body.baseRevision,p_credential_revision:body.credentialRevision});break;
        case 'credential':only(['baseRevision','provider','mode','secret']);if(!integer(body.baseRevision)||!['mollie','play'].includes(String(body.provider))||!['test','live'].includes(String(body.mode))||!text(body.secret,20000))invalid();result=await rpc('save_billing_credential',{p_expected_revision:body.baseRevision,p_provider:body.provider,p_mode:body.mode,p_secret:body.secret});break;
        case 'test':{
          only(['provider','mode','credentialRevision']);if(!['mollie','play'].includes(String(body.provider))||!['test','live'].includes(String(body.mode))||body.credentialRevision!==undefined&&!integer(body.credentialRevision))invalid();await rpc('authorize_billing_admin',{p_fresh:true});
          const c=await backend.rpc<BillingCredential>('get_billing_provider_config',{p_provider:body.provider,p_mode:body.mode,...(body.credentialRevision===undefined?{}:{p_credential_revision:body.credentialRevision})});
          if(c.environment!==target.FABELPAD_ENVIRONMENT||c.config.appOrigin!==target.FABELPAD_APP_ORIGIN)throw new BillingRequestError('billing_unavailable',503);
          let checked:Record<string,unknown>;
          if(body.provider==='mollie'){const probe=await createMollieClient(c,{fetch:fetcher}).probe(c.config.mollie.firstMethods,c.config.prices.month.amountCents);checked={profileId:c.config.mollie.expectedProfileId,mode:c.mode,firstMethods:probe.firstMethods,recurringAvailable:probe.recurringReady,callbackVerified:false,webhookVerified:false,productsVerified:false,rtdnVerified:false,serverVerificationVerified:false,salesStatus:'unknown'};}
          else checked=await play.testConnection(c);
          await backend.rpc('record_billing_provider_test',{p_credential_revision:c.revision,p_result:checked});result={tested:true,...checked};break;
        }
        case 'playProof':{
          if(target.FABELPAD_ENVIRONMENT!=='production')invalid();
          await rpc('authorize_billing_admin',{p_fresh:true});
          if(Object.hasOwn(body,'credentialRevision')){only(['credentialRevision']);if(!integer(body.credentialRevision))invalid();result={...await rpc<Record<string,unknown>>('prepare_billing_play_license_proof',{p_credential_revision:body.credentialRevision}),proofOnly:true};break;}
          only(['proofId','purchaseToken']);if(!uuid(body.proofId)||!text(body.purchaseToken,4096))invalid();
          const ticket=await backend.rpc<Record<string,unknown>|null>('get_billing_play_license_proof',{p_proof_id:body.proofId});
          if(!object(ticket)||ticket.id!==body.proofId||ticket.parentId!==actor.id||ticket.environment!=='production'||ticket.mode!=='live'||!integer(ticket.credentialRevision)||ticket.credentialRevision<1||!integer(ticket.settingsRevision)||ticket.settingsRevision<1||!text(ticket.obfuscatedAccountId,64)||!text(ticket.expiresAt,50)||!Number.isFinite(Date.parse(ticket.expiresAt as string))||Date.parse(ticket.expiresAt as string)<=Date.now())throw new BillingRequestError('billing_forbidden',403);
          const config=parseBillingSettings(ticket.settings);
          const credential=await backend.rpc<BillingCredential>('get_billing_provider_config',{p_provider:'play',p_mode:'live',p_credential_revision:ticket.credentialRevision});
          const credentialConfig=parseBillingSettings(credential.config);
          // A successful product probe and gate changes advance the control
          // revision, while a credential retains its original immutable offer.
          // Pin the identity and compare the actual prepared products/prices;
          // the recording RPC independently checks the ticket's current CAS.
          const samePlay=Object.entries(config.play).every(([key,value])=>credentialConfig.play[key as keyof typeof config.play]===value);
          const samePrices=(['month','year']as const).every(period=>{const prepared=config.prices[period],original=credentialConfig.prices[period];return prepared.amountCents===original.amountCents&&prepared.currency===original.currency&&prepared.enabled===original.enabled;});
          if(credential.provider!=='play'||credential.revision!==ticket.credentialRevision||credential.environment!=='production'||credential.mode!=='live'||config.environment!=='production'||credentialConfig.environment!=='production'||config.appOrigin!==target.FABELPAD_APP_ORIGIN||credentialConfig.appOrigin!==target.FABELPAD_APP_ORIGIN||!samePlay||!samePrices)throw new BillingRequestError('billing_forbidden',403);
          const proof=await play.verifyLicenseProof({token:body.purchaseToken as string,credential:{...credential,config},expectedAccountId:ticket.obfuscatedAccountId as string});
          result=await backend.rpc('record_billing_play_license_proof',{p_proof_id:body.proofId,p_proof:proof});break;
        }
        case 'playTrial':only(['period','requestId']);if(target.FABELPAD_ENVIRONMENT!=='staging'||!['month','year'].includes(String(body.period))||!uuid(body.requestId))invalid();await rpc('authorize_billing_admin',{p_fresh:true});result=await rpc('reserve_billing_play_trial',{p_period:body.period,p_request_id:body.requestId});break;
        case 'trial':only(['credentialRevision','requestId']);if(!integer(body.credentialRevision)||!uuid(body.requestId))invalid();result=await startMollieTrial({credentialRevision:body.credentialRevision as number,requestId:body.requestId as string},{backend,accessToken:token,fetch:fetcher});break;
        case 'trialCallback':only(['trialId']);if(!uuid(body.trialId))invalid();await rpc('authorize_billing_admin',{p_fresh:true});result=await verifyMollieTrial(body.trialId as string,'callback',{backend,accessToken:token,fetch:fetcher});break;
        case 'account':only([]);result={entitlement:await rpc('get_billing_entitlement'),subscriptions:await rpc('list_billing_subscriptions'),offer:await backend.publicRpc('get_billing_public_offer')};break;
        case 'coupons':only([]);result={coupons:await rpc('list_billing_coupons')};break;
        case 'couponEnabled':only(['baseRevision','batchId','enabled']);if(!integer(body.baseRevision)||!uuid(body.batchId)||typeof body.enabled!=='boolean')invalid();result=await rpc('set_billing_coupon_enabled',{p_expected_revision:body.baseRevision,p_batch_id:body.batchId,p_enabled:body.enabled});break;
        case 'saveCoupons':only(['baseRevision','coupon']);if(!integer(body.baseRevision)||!object(body.coupon))invalid();result=await rpc('save_billing_coupon_batch',{p_expected_revision:body.baseRevision,p_coupon:body.coupon});break;
        case 'entitlement':only([]);result=await rpc('get_billing_entitlement');break;
        case 'chooseFree':only(['storyId']);if(!text(body.storyId,100))invalid();result=await rpc('choose_billing_free_story',{p_story_id:body.storyId});break;
        case 'quote':only(['period','couponCode']);if(!['month','year'].includes(String(body.period))||body.couponCode!==undefined&&!text(body.couponCode,100))invalid();result=await rpc('quote_billing_purchase',{p_period:body.period,p_coupon_code:body.couponCode||null});break;
        case 'checkout':case 'playReserve':{
          only(['period','requestId','couponCode','expectedRevision','expectedAmountCents','termsVersion','acceptTerms','acceptRecurring']);if(!['month','year'].includes(String(body.period))||!uuid(body.requestId)||!integer(body.expectedRevision)||!integer(body.expectedAmountCents)||!text(body.termsVersion,80)||body.acceptTerms!==true||typeof body.acceptRecurring!=='boolean'||body.couponCode!==undefined&&!text(body.couponCode,100))invalid();
          if(action==='playReserve'&&body.couponCode)invalid();
          const reserved=await rpc<Record<string,unknown>>('reserve_billing_purchase',{p_provider:action==='checkout'?'mollie':'play',p_period:body.period,p_request_id:body.requestId,p_expected_revision:body.expectedRevision,p_expected_amount_cents:body.expectedAmountCents,p_terms_version:body.termsVersion,p_accept_recurring:body.acceptRecurring,p_coupon_code:body.couponCode||null});
          if(reserved.gift!==true&&action==='checkout'){if(!uuid(reserved.id))throw new Error();await startMollieCheckout(reserved.id,{backend,fetch:fetcher});await deps.tick?.();}
          result=reserved;break;
        }
        case 'purchase':only(['reservationId']);if(!uuid(body.reservationId))invalid();result=await rpc('get_billing_purchase',{p_reservation_id:body.reservationId});break;
        case 'subscriptions':only([]);result={subscriptions:await rpc('list_billing_subscriptions')};break;
        case 'cancel':only(['subscriptionId','requestId']);if(!uuid(body.subscriptionId)||!uuid(body.requestId))invalid();result=await rpc('cancel_billing_subscription',{p_subscription_id:body.subscriptionId,p_request_id:body.requestId});await deps.tick?.();break;
        case 'operations':only([]);result=await rpc('list_billing_operations');break;
        case 'playVerify':only(['purchaseToken','reservationId']);if(!text(body.purchaseToken,4096)||body.reservationId!==undefined&&!uuid(body.reservationId))invalid();result=await play.verifyPurchase({token:body.purchaseToken as string,parentId:actor.id,reservationId:body.reservationId as string|undefined,mode:target.FABELPAD_ENVIRONMENT==='staging'?'test':'live'});break;
        default:invalid();
      }
      if(object(result)&&result.saved===false)throw new BillingRequestError('billing_revision_conflict',409);
      return respond(publicResult(result));
    }catch(error){return respond({error:error instanceof BillingRequestError?error.code:'billing_unavailable'},error instanceof BillingRequestError?error.status:503);}
  };
}
