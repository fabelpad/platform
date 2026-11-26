import { blogSite, verifyBlogIdentity, BLOG_ENVIRONMENTS } from '../blog/config.ts';
import type { BlogRpcClient, BlogRuntimeDependencies } from '../blog/runtime.ts';
import { BLOG_MEDIA_MAX_BYTES } from '../blog/media.ts';
import { BlogRuntimeError, blogObject } from './errors.ts';

async function bytes(response: Response, maximum: number): Promise<Uint8Array> {
  const reader = response.body?.getReader(); if (!reader) return new Uint8Array();
  let size = 0; const chunks: Uint8Array[] = [];
  try { while (true) { const next = await reader.read(); if (next.done) break; size += next.value.byteLength; if (size > maximum) { await reader.cancel(); throw new BlogRuntimeError('BLOG_UNAVAILABLE', 503); } chunks.push(next.value); } }
  finally { reader.releaseLock(); }
  const result = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; } return result;
}
/** Edge-only credentials. No opaque connector bearer is used as a Supabase JWT. */
export function createBlogSupabaseDependencies(environment: Record<string, string | undefined>, fetcher: typeof fetch = fetch): BlogRuntimeDependencies {
  const origin = environment.SUPABASE_URL ?? '';
  const known = (Object.entries(BLOG_ENVIRONMENTS) as ['staging' | 'production', typeof BLOG_ENVIRONMENTS.staging | typeof BLOG_ENVIRONMENTS.production][]).find(([,target]) => origin === `https://${target.projectRef}.supabase.co`);
  if (!known) throw new BlogRuntimeError('CONFIGURATION_REQUIRED', 503);
  const name = known[0];
  if (environment.FABELPAD_ENVIRONMENT !== undefined && environment.FABELPAD_ENVIRONMENT !== name) throw new BlogRuntimeError('CONFIGURATION_REQUIRED', 503);
  const site = blogSite(name), target = BLOG_ENVIRONMENTS[name];
  const key = environment.SUPABASE_ANON_KEY ?? environment.SUPABASE_PUBLISHABLE_KEY ?? '', service = environment.SUPABASE_SERVICE_ROLE_KEY ?? environment.SB_SECRET_KEY ?? '';
  verifyBlogIdentity(site, new URL(origin).hostname.split('.')[0]);
  if (origin !== `https://${target.projectRef}.supabase.co` || environment.FABELPAD_APP_ORIGIN !== undefined && environment.FABELPAD_APP_ORIGIN !== site.origin || !key || !service || /[\r\n]/u.test(key + service)) throw new BlogRuntimeError('CONFIGURATION_REQUIRED', 503);
  const serviceHeaders = { apikey: service, ...(!service.startsWith('sb_secret_') ? { Authorization: `Bearer ${service}` } : {}) };
  const client = (userJwt?: string): BlogRpcClient => ({
    async rpc(name, parameters) {
      if (!(userJwt ? name === 'blog_admin' : ['blog_public','blog_connector','blog_service'].includes(name))) return { data: null, error: { message: 'PERMISSION_DENIED', code: '42501' } };
      try {
        const response = await fetcher(`${origin}/rest/v1/rpc/${name}`, { method: 'POST', headers: { ...(userJwt ? { apikey: key, Authorization: `Bearer ${userJwt}` } : serviceHeaders), 'Content-Type': 'application/json' }, body: JSON.stringify(parameters), cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20_000) });
        let value: unknown; try { value = JSON.parse(new TextDecoder().decode(await bytes(response, 8_000_000))); } catch { return { data: null, error: { message: 'BLOG_UNAVAILABLE' } }; }
        if (!response.ok) return { data: null, error: { message: blogObject(value) && value.message === 'fresh_auth_required' ? 'fresh_auth_required' : response.status === 401 ? 'INVALID_CREDENTIAL' : blogObject(value) && typeof value.message === 'string' ? value.message : 'BLOG_UNAVAILABLE', code: blogObject(value) && typeof value.code === 'string' ? value.code : undefined } };
        return { data: value, error: null };
      } catch { return { data: null, error: { message: 'BLOG_UNAVAILABLE' } }; }
    },
  });
  const assetUrl = (path: string, authenticated = false) => {
    if (!/^blog\/[a-f0-9-]{36}\/[a-f0-9]{64}\.(?:png|jpg|webp)$/u.test(path)) throw new BlogRuntimeError('INVALID_MEDIA');
    return `${origin}/storage/v1/object/${authenticated ? 'authenticated/' : ''}fabelpad-blog/${path}`;
  };
  return {
    site, serviceClient: client(), userClient: jwt => client(jwt), fetch: fetcher,
    storage: {
      async put(path, content, mimeType) {
        if (content.byteLength > BLOG_MEDIA_MAX_BYTES || !['image/png','image/jpeg'].includes(mimeType)) throw new BlogRuntimeError('INVALID_MEDIA');
        const response = await fetcher(assetUrl(path), { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(20_000), headers: { ...serviceHeaders, 'Content-Type': mimeType, 'x-upsert': 'false' }, body: new Uint8Array(content) });
        await response.body?.cancel(); if (!response.ok) throw new BlogRuntimeError('MEDIA_UNAVAILABLE', 503);
      },
      async get(path) {
        const response = await fetcher(assetUrl(path, true), { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(20_000), headers: serviceHeaders });
        if (!response.ok) { await response.body?.cancel(); throw new BlogRuntimeError('MEDIA_UNAVAILABLE', response.status === 404 ? 404 : 503); }
        return bytes(response, BLOG_MEDIA_MAX_BYTES);
      },
    },
  };
}
