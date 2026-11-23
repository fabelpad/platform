import { resolveHostedEmailTarget } from '../email/hosted-target.ts';

export interface BillingBackend {
  authenticate(token: string): Promise<{ id: string; email: string } | null>;
  rpc<T>(name: string, parameters?: Record<string, unknown>, accessToken?: string): Promise<T>;
  publicRpc<T>(name: string, parameters?: Record<string, unknown>): Promise<T>;
}
export class BillingRequestError extends Error {
  constructor(readonly code: string, readonly status = 422) { super(code); }
}
const AUTH_RPCS = new Set(['authorize_billing_admin','get_billing_settings','save_billing_settings','set_billing_gate','billing_phaseout_impact','save_billing_credential','delete_billing_credential','prepare_billing_mollie_trial','reserve_billing_play_trial','prepare_billing_play_license_proof','get_billing_entitlement','choose_billing_free_story','quote_billing_purchase','reserve_billing_purchase','get_billing_purchase','cancel_billing_subscription','save_billing_coupon_batch','set_billing_coupon_enabled','list_billing_coupons','list_billing_subscriptions','list_billing_operations']);
const SERVICE_RPCS = new Set(['get_billing_provider_config','record_billing_provider_test','claim_billing_jobs','complete_billing_job','fail_billing_job','record_billing_provider_event','apply_billing_provider_evidence','recheck_billing_purchase','prepare_billing_jobs','request_billing_refund','get_billing_mollie_binding','get_billing_mollie_job_context','record_billing_mollie_customer','recheck_billing_renewal','get_billing_play_binding','get_billing_play_reservation','get_billing_play_license_proof','record_billing_play_license_proof','get_billing_mollie_trial','record_billing_mollie_trial','claim_billing_withdrawal','get_email_delivery_config','get_billing_email_context','freeze_billing_email','request_billing_withdrawal','confirm_billing_withdrawal']);
const SAFE_ERRORS = new Set(['fresh_auth_required','billing_quote_changed','billing_payment_disabled','billing_channel_disabled','billing_provider_unverified','billing_subscription_exists','billing_purchase_pending','billing_coupon_invalid','billing_coupon_expired','billing_coupon_exhausted','billing_coupon_used','billing_revision_conflict','billing_phaseout_confirmation_required','billing_campaign_full','billing_configuration_incomplete','billing_credential_in_use','billing_account_inactive','billing_consent_required','billing_invalid_request','billing_rate_limited','account_blocked','account_inactive','admin_required']);
export async function billingJson(response: Response, limit = 512 * 1024): Promise<unknown> {
  const reader = response.body?.getReader(); if (!reader) throw new BillingRequestError('billing_unavailable',503);
  const parts: Uint8Array[] = []; let size = 0;
  try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > limit) throw new BillingRequestError('billing_unavailable',503); parts.push(part.value); }
    const bytes = new Uint8Array(size); let offset = 0; for (const part of parts) { bytes.set(part,offset); offset += part.length; }
    return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  } finally { await reader.cancel().catch(()=>{}); }
}
/** Only the Edge runtime receives a service key. Browser/Next credentials never
 * select a project or a privileged RPC; all session checks are repeated in SQL. */
export function createBillingBackend(environment: Record<string,string|undefined>, fetcher: typeof fetch = fetch): BillingBackend {
  if (!resolveHostedEmailTarget(environment)) throw new BillingRequestError('billing_unavailable',503);
  const origin=environment.SUPABASE_URL!, service=environment.SUPABASE_SERVICE_ROLE_KEY??'', anon=environment.SUPABASE_ANON_KEY??'';
  if (!service || !anon || /[\r\n]/u.test(service+anon)) throw new BillingRequestError('billing_unavailable',503);
  async function request(path:string, token:string, key:string, body?:unknown):Promise<unknown> {
    const response=await fetcher(origin+path,{method:body===undefined?'GET':'POST',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15_000),headers:{apikey:key,Authorization:`Bearer ${token}`,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const value=await billingJson(response);
    if (!response.ok) {
      const error=value && typeof value==='object'?value as Record<string,unknown>:{};
      const code=typeof error.message==='string' && SAFE_ERRORS.has(error.message)?error.message:response.status===401?'sign_in_required':response.status===403||error.code==='42501'?'billing_forbidden':error.code==='28000'?'fresh_auth_required':error.code==='40001'?'billing_revision_conflict':'billing_unavailable';
      throw new BillingRequestError(code,code==='fresh_auth_required'?428:code==='billing_revision_conflict'||code==='billing_quote_changed'?409:response.status===401?401:response.status===403||error.code==='42501'?403:SAFE_ERRORS.has(code)?422:503);
    }
    return value;
  }
  return {
    async authenticate(token) {
      const value=await request('/auth/v1/user',token,anon); if (!value || typeof value!=='object') return null;
      const user=value as Record<string,unknown>;
      return typeof user.id==='string' && /^[a-f0-9-]{36}$/iu.test(user.id) && typeof user.email==='string' && typeof user.email_confirmed_at==='string' && Number.isFinite(Date.parse(user.email_confirmed_at)) && user.is_anonymous===false?{id:user.id,email:user.email}:null;
    },
    async rpc<T>(name:string,parameters:Record<string,unknown>={},accessToken?:string):Promise<T> {
      if (!(accessToken?AUTH_RPCS:SERVICE_RPCS).has(name)) throw new BillingRequestError('billing_forbidden',403);
      return await request(`/rest/v1/rpc/${name}`,accessToken??service,accessToken?anon:service,parameters) as T;
    },
    async publicRpc<T>(name:string,parameters:Record<string,unknown>={}):Promise<T> {
      if (name!=='get_billing_public_offer') throw new BillingRequestError('billing_forbidden',403);
      return await request(`/rest/v1/rpc/${name}`,anon,anon,parameters) as T;
    },
  };
}
