import { NarrationBackendError, narrationObject, narrationResponseBytes, narrationUuid, type NarrationBackend } from './backend-types.ts';
import { narrationHostedTarget } from './hosted-target.ts';
const PUBLIC = ['get_narration_voices', 'get_narration_manifest', 'authorize_narration_asset', 'get_narration_name_pack', 'get_narration_sample'];
const USER = ['get_narration_admin_status', 'save_narration_settings', 'reserve_narration_test', 'get_narration_catalogue_sources', 'save_narration_catalogue_plan', 'enqueue_narration_catalogue', 'retry_narration_job', 'review_narration_item', 'publish_narration_job', 'authorize_narration_preview'];
const SERVICE = ['get_narration_test_context', 'complete_narration_test', 'claim_narration_job', 'fail_narration_job', 'install_narration_plan', 'claim_narration_item', 'renew_narration_lease', 'complete_narration_item', 'fail_narration_item', 'get_narration_asset_context', 'verify_narration_worker_request', 'register_narration_served_sources'];
const SAFE_ERRORS: Record<string, number> = { narration_revision_conflict: 409, narration_source_changed: 409, narration_configuration_changed: 409, narration_job_busy: 409, narration_key_required: 409, narration_plan_expired: 409, narration_rate_limited: 429, fresh_auth_required: 428, narration_admin_required: 403, narration_content_locked: 403, narration_incomplete: 409, narration_source_not_published: 409, narration_name_pack_required: 409 };
export function createNarrationSupabaseBackend(environment: Record<string, string | undefined>, fetcher: typeof fetch = fetch): NarrationBackend {
  const origin = environment.SUPABASE_URL ?? '', service = environment.SUPABASE_SERVICE_ROLE_KEY ?? '', key = environment.SUPABASE_ANON_KEY ?? '';
  if (!narrationHostedTarget(environment) || !service || !key || /[\r\n]/u.test(service + key)) throw new NarrationBackendError('narration_unavailable');
  async function call(path: string, token: string | undefined, body?: unknown): Promise<unknown> {
    const response = await fetcher(`${origin}${path}`, { method: body === undefined ? 'GET' : 'POST', redirect: 'error', signal: AbortSignal.timeout(20_000), headers: { apikey: token === service ? service : key, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const bytes = await narrationResponseBytes(response, 64 * 1024 * 1024); let value: unknown;
    try { value = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new NarrationBackendError('narration_unavailable'); }
    if (!response.ok) {
      const message = narrationObject(value) && typeof value.message === 'string' ? value.message : '';
      const databaseCode = narrationObject(value) && typeof value.code === 'string' && /^(?:PGRST[A-Z0-9]{3,8}|[0-9A-Z]{5})$/u.test(value.code) ? value.code : undefined;
      throw new NarrationBackendError(Object.hasOwn(SAFE_ERRORS, message) ? message : response.status === 401 ? 'sign_in_required' : response.status === 403 ? 'narration_forbidden' : 'narration_unavailable', SAFE_ERRORS[message] ?? (response.status === 401 || response.status === 403 ? response.status : 503), databaseCode);
    }
    return value;
  }
  const objectPath = (path: string) => { if (!/^assets\/[a-f0-9]{64}\/[a-f0-9-]{36}\.wav$/u.test(path)) throw new NarrationBackendError('narration_invalid_asset'); return path; };
  return {
    async authenticate(token) {
      try { const user = await call('/auth/v1/user', token); return narrationObject(user) && narrationUuid(user.id) && user.is_anonymous === false && typeof user.email_confirmed_at === 'string' ? { id: user.id } : null; }
      catch (error) { if (error instanceof NarrationBackendError && [401, 403].includes(error.status)) return null; throw error; }
    },
    async rpc<T>(name: string, parameters: Record<string, unknown> = {}, token?: string): Promise<T> {
      if (!(token ? USER.includes(name) : SERVICE.includes(name))) throw new NarrationBackendError('narration_forbidden', 403);
      const value = await call(`/rest/v1/rpc/${name}`, token ?? service, parameters);
      if (name === 'claim_narration_job' || name === 'claim_narration_item') {
        if (!narrationObject(value) || Object.keys(value).length !== 1 || !Object.hasOwn(value, 'claim') || value.claim !== null && !narrationObject(value.claim)) throw new NarrationBackendError('narration_unavailable');
        return value.claim as T;
      }
      return value as T;
    },
    async publicRpc<T>(name: string, parameters: Record<string, unknown> = {}, token?: string): Promise<T> {
      if (!PUBLIC.includes(name)) throw new NarrationBackendError('narration_forbidden', 403);
      return await call(`/rest/v1/rpc/${name}`, token, parameters) as T;
    },
    async uploadAudio(path, bytes) {
      objectPath(path); if (bytes.byteLength < 45 || bytes.byteLength > 16 * 1024 * 1024) throw new NarrationBackendError('narration_invalid_asset');
      const response = await fetcher(`${origin}/storage/v1/object/fabelpad-narration/${path}`, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(20_000), headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'audio/wav', 'x-upsert': 'false' }, body: new Uint8Array(bytes) });
      await response.body?.cancel(); if (!response.ok) throw new NarrationBackendError('storage_unavailable');
    },
    async readAudio(path) {
      objectPath(path); const response = await fetcher(`${origin}/storage/v1/object/authenticated/fabelpad-narration/${path}`, { redirect: 'error', signal: AbortSignal.timeout(20_000), headers: { apikey: service, Authorization: `Bearer ${service}` } });
      if (!response.ok) { await response.body?.cancel(); throw new NarrationBackendError('narration_asset_unavailable', 404); } return narrationResponseBytes(response, 16 * 1024 * 1024);
    },
  };
}
