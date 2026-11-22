import type { LifecycleBackend } from './worker.ts';
type Environment = Record<string, string | undefined>;
const RPC = new Set(['verify_lifecycle_worker_request', 'claim_lifecycle_jobs', 'get_lifecycle_job_context', 'complete_lifecycle_job', 'fail_lifecycle_job', 'freeze_lifecycle_email', 'get_email_delivery_config']);
/** Edge-only service adapter. All dynamic identifiers come from leased jobs,
 * never an HTTP-supplied parent, storage path or RPC name. No SDK logs/secrets. */
export function createLifecycleSupabaseBackend(environment: Environment, fetcher: typeof fetch = fetch): LifecycleBackend {
  const origin = environment.SUPABASE_URL ?? '', service = environment.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/u.test(origin) || !service || /[\r\n]/u.test(service)) throw new Error('Maintenance backend unavailable.');
  async function request(path: string, method: string, body?: unknown, missing = false): Promise<unknown> {
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    const perform = async () => {
      const response = await fetcher(origin + path, { method, redirect: 'error', signal: controller.signal,
        headers: { apikey: service, Authorization: `Bearer ${service}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      if (missing && response.status === 404) { await response.body?.cancel(); return null; }
      if (!response.ok) { await response.body?.cancel(); throw new Error('Maintenance backend unavailable.'); }
      if (response.status === 204) return true;
      reader = response.body?.getReader(); if (!reader) return true;
      let size = 0, raw = ''; const decoder = new TextDecoder();
      try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 1024 * 1024) throw new Error('Maintenance backend unavailable.'); raw += decoder.decode(part.value, { stream: true }); } return raw ? JSON.parse(raw + decoder.decode()) as unknown : true; }
      finally { await reader.cancel().catch(() => {}); reader = undefined; }
    };
    try { return await Promise.race([perform(), new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); void reader?.cancel().catch(() => {}); reject(new Error('Maintenance backend unavailable.')); }, 4_000); })]); }
    finally { if (timer) clearTimeout(timer); }
  }
  return {
    async rpc<T>(name: string, parameters: Record<string, unknown> = {}): Promise<T> {
      if (!RPC.has(name)) throw new Error('Maintenance backend unavailable.');
      return await request(`/rest/v1/rpc/${name}`, 'POST', parameters) as T;
    },
    async removeStorage(bucket, names) {
      await request(`/storage/v1/object/${encodeURIComponent(bucket)}`, 'DELETE', { prefixes: names });
    },
    async deleteAuth(userId) { await request(`/auth/v1/admin/users/${encodeURIComponent(userId)}`, 'DELETE', undefined, true); },
    async authExists(userId) {
      const result = await request(`/auth/v1/admin/users/${encodeURIComponent(userId)}`, 'GET', undefined, true);
      if (result === null) return false;
      if (!result || typeof result !== 'object' || !('id' in result) || result.id !== userId) throw new Error('Maintenance backend unavailable.');
      return true;
    },
  };
}
