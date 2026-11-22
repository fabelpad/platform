import type { EmailAdminBackend } from './admin-handler.ts';

type Environment = Record<string, string | undefined>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
/** Edge-only adapter. The service credential is supplied by the Edge runtime,
 * never by the browser/Next server. No upstream error body is retained/logged.
 */
export function createSupabaseEmailBackend(environment: Environment, fetcher: typeof fetch = fetch): EmailAdminBackend {
  const origin = environment.SUPABASE_URL ?? '', service = environment.SUPABASE_SERVICE_ROLE_KEY ?? '', publicKey = environment.SUPABASE_ANON_KEY ?? '';
  if (!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/u.test(origin) || !service || !publicKey || /[\r\n]/u.test(service + publicKey)) throw new Error('Email backend unavailable.');
  async function request(path: string, token: string, key: string, body?: unknown, signal?: AbortSignal) {
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
    const abort = () => controller.abort(); signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) controller.abort();
    const run = async () => {
      const response = await fetcher(`${origin}${path}`, { method: body === undefined ? 'GET' : 'POST', redirect: 'error', signal: controller.signal,
        headers: { apikey: key, Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      if (!response.ok) { await response.body?.cancel(); if (response.status === 401 || response.status === 403) return { denied: true, value: null }; throw new Error('Email backend unavailable.'); }
      const reader = response.body?.getReader(); if (!reader) throw new Error('Email backend unavailable.');
      let raw = '', size = 0; const decoder = new TextDecoder();
      try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 256 * 1024) throw new Error('Email backend unavailable.'); raw += decoder.decode(part.value, { stream: true }); } return { denied: false, value: JSON.parse(raw + decoder.decode()) as unknown }; }
      finally { await reader.cancel().catch(() => {}); }
    };
    try { return await Promise.race([run(), new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('Email backend unavailable.')); }, 1500); })]); }
    finally { if (timer) clearTimeout(timer); signal?.removeEventListener('abort', abort); }
  }
  return {
    async authenticate(token) {
      const auth = await request('/auth/v1/user', token, publicKey);
      if (auth.denied || !auth.value || typeof auth.value !== 'object') return null;
      const user = auth.value as Record<string, unknown>;
      if (typeof user.id !== 'string' || !UUID.test(user.id) || typeof user.email !== 'string' || typeof user.email_confirmed_at !== 'string' || !Number.isFinite(Date.parse(user.email_confirmed_at)) || user.is_anonymous !== false) return null;
      const role = await request(`/rest/v1/content_admins?user_id=eq.${encodeURIComponent(user.id)}&select=user_id`, token, publicKey);
      if (role.denied || !Array.isArray(role.value) || role.value.length !== 1 || role.value[0]?.user_id !== user.id) return null;
      return { id: user.id, email: user.email };
    },
    async rpc<T>(name: string, parameters: Record<string, unknown>, accessToken?: string, signal?: AbortSignal): Promise<T> {
      if (!['get_email_settings', 'get_email_delivery_config', 'save_email_settings', 'reserve_email_test', 'record_email_test'].includes(name)) throw new Error('Email backend unavailable.');
      const result = await request(`/rest/v1/rpc/${name}`, accessToken ?? service, accessToken ? publicKey : service, parameters, signal);
      if (result.denied) throw new Error('Email backend unavailable.');
      return result.value as T;
    },
  };
}
