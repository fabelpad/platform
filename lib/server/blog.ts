import { getSupabaseConfig } from '../supabase/config';
import { createSupabaseRequestClient, getVerifiedParent, isContentAdmin } from '../supabase/server';
import { getParentAccountStatus } from './parent';
import { checkMutationOrigin, RequestError } from './http';
import { isBlogUuid } from '../blog/document';
import { blogIdentifier } from '../socialhero/errors';

type Context = 'admin' | 'socialhero' | 'media';
function allowed(context: Context, path: string[], method: string): string | null {
  if (context === 'media') return path.length === 1 && isBlogUuid(path[0]) && method === 'GET' ? `/public/media/${path[0]}` : null;
  if (context === 'socialhero') {
    if (path.length === 1 && path[0] === 'capabilities' && method === 'GET') return '/socialhero/capabilities';
    if (path.length === 1 && path[0] === 'media' && method === 'POST') return '/socialhero/media';
    if (path.length === 1 && path[0] === 'connection' && method === 'DELETE') return '/socialhero/connection';
    if (path[0] === 'posts' && blogIdentifier(path[1])) {
      if (path.length === 2 && ['GET', 'PUT'].includes(method)) return `/socialhero/posts/${path[1]}`;
      if (path.length === 3 && path[2] === 'publish' && method === 'POST') return `/socialhero/posts/${path[1]}/publish`;
    }
    return null;
  }
  if (!path.length && ['GET', 'POST'].includes(method)) return '/admin/posts';
  if (path.length === 1 && ['authors', 'categories'].includes(path[0]) && method === 'POST') return `/admin/${path[0]}`;
  if (path[0] === 'posts' && isBlogUuid(path[1])) {
    if (path.length === 2 && ['GET', 'PUT'].includes(method)) return `/admin/posts/${path[1]}`;
    if (path.length === 3 && ['publish', 'restore'].includes(path[2]) && method === 'POST') return `/admin/posts/${path[1]}/${path[2]}`;
  }
  if (path[0] === 'media' && (path.length === 1 && method === 'POST' || path.length === 2 && isBlogUuid(path[1]) && method === 'GET')) return `/admin/media${path[1] ? `/${path[1]}` : ''}`;
  if (path[0] === 'connection') {
    if (path.length === 1 && ['GET', 'PATCH', 'DELETE'].includes(method)) return '/admin/connection';
    if (path.length === 2 && ['pair', 'check'].includes(path[1]) && method === 'POST') return `/admin/connection/${path[1]}`;
  }
  return null;
}
function failure(code: string, status: number, message: string, requestId: string) {
  return Response.json({ code, message, requestId }, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'X-Request-Id': requestId, Vary: 'Cookie, Authorization' } });
}
async function boundedBody(request: Request, limit: number): Promise<Uint8Array | undefined> {
  if (!request.body) return undefined;
  if (Number(request.headers.get('content-length')) > limit) throw new Error('PAYLOAD_TOO_LARGE');
  const reader = request.body.getReader(), chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) { const chunk = await reader.read(); if (chunk.done) break; length += chunk.value.length; if (length > limit) { await reader.cancel(); throw new Error('PAYLOAD_TOO_LARGE'); } chunks.push(chunk.value); }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; } return bytes;
}

/** Thin transport adapter. The Edge runtime repeats auth and delegates ALL writes
 * to the same transaction service for local editors and SocialHero. */
export async function blogApi(request: Request, context: Context, path: string[]): Promise<Response> {
  const requestId = crypto.randomUUID(), target = allowed(context, path, request.method);
  if (!target) return failure('NOT_FOUND', 404, 'Deze blogroute is niet beschikbaar.', requestId);
  try {
    const config = getSupabaseConfig();
    if (!config) return failure('CONFIGURATION_REQUIRED', 503, 'De blogomgeving is nog niet ingericht.', requestId);
    let authorization = request.headers.get('authorization');
    if (context === 'admin') {
      if (request.method !== 'GET') checkMutationOrigin(request);
      const client = await createSupabaseRequestClient(request), parent = await getVerifiedParent(client);
      if (!parent) return failure('INVALID_CREDENTIAL', 401, 'Log in om de blog te beheren.', requestId);
      const privateImage = path[0] === 'media' && path.length === 2 && request.method === 'GET';
      if (!privateImage && request.headers.get('x-fabelpad-parent') !== parent.id) return failure('ACCOUNT_CHANGED', 401, 'Het beheeraccount is gewijzigd. Open de pagina opnieuw.', requestId);
      const account = await getParentAccountStatus(client);
      if (account.state !== 'active' || account.acceptedTermsVersion !== account.termsVersion || !await isContentAdmin(client, parent.id)) return failure('PERMISSION_DENIED', 403, 'Je hebt geen toegang tot het blogbeheer.', requestId);
      if (!authorization) {
        const { data: { session } } = await client.auth.getSession();
        authorization = session?.access_token ? `Bearer ${session.access_token}` : null;
      }
    }
    if (context !== 'media' && (!authorization || !/^Bearer [A-Za-z0-9_.~-]{32,16384}$/u.test(authorization))) return failure('INVALID_CREDENTIAL', 401, 'De verbinding is niet geldig.', requestId);
    const contentType = request.headers.get('content-type');
    const headers = new Headers({ apikey: config.publishableKey, 'X-Request-Id': requestId });
    if (authorization && context !== 'media') headers.set('Authorization', authorization);
    if (contentType) headers.set('Content-Type', contentType);
    const idempotencyKey = request.headers.get('idempotency-key'); if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
    const actor = request.headers.get('x-fabelpad-parent'); if (context === 'admin' && actor) headers.set('X-Fabelpad-Parent', actor);
    const body = await boundedBody(request, target.endsWith('/media') ? 8 * 1024 * 1024 + 64 * 1024 : 320 * 1024);
    const targetUrl = new URL(`${config.url}/functions/v1/blog-runtime${target}`);
    if (context === 'admin' && !path.length && request.method === 'GET') {
      const incoming = new URL(request.url);
      for (const key of ['query', 'state']) { const value = incoming.searchParams.get(key); if (value !== null) targetUrl.searchParams.set(key, value.slice(0, 200)); }
    }
    const upstream = await fetch(targetUrl, { method: request.method, headers, ...(body ? { body: body.slice().buffer } : {}), redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(40_000) });
    const outgoing = new Headers({ 'Cache-Control': context === 'media' && upstream.ok ? 'public, max-age=300, must-revalidate' : 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'X-Request-Id': requestId, Vary: 'Cookie, Authorization' });
    for (const name of ['Content-Type', 'Retry-After', 'Content-Length', 'ETag']) { const value = upstream.headers.get(name); if (value) outgoing.set(name, value); }
    if (context !== 'media') outgoing.set('X-Robots-Tag', 'noindex, nofollow');
    return new Response(upstream.body, { status: upstream.status, headers: outgoing });
  } catch (error) {
    if (error instanceof RequestError) return failure(error.code === 'invalid_origin' ? 'PERMISSION_DENIED' : error.code.toUpperCase(), error.status, error.message, requestId);
    if (error instanceof Error && error.message === 'PAYLOAD_TOO_LARGE') return failure('PAYLOAD_TOO_LARGE', 413, 'Dit bestand of artikel is te groot.', requestId);
    return failure('SERVICE_UNAVAILABLE', 503, 'De blogverbinding is tijdelijk niet bereikbaar. Probeer het opnieuw.', requestId);
  }
}
