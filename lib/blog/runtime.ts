import type { BlogSite, BlogDocument, SocialHeroCapabilities, SocialHeroConnectionView } from './types.ts';
import { BlogValidationError, validateBlogDocument } from './document.ts';
import { markdownToBlogDocument } from './markdown.ts';
import { decodeBlogMedia, BLOG_MEDIA_MAX_BYTES } from './media.ts';
import { BlogRuntimeError, blogHash, blogIdentifier, blogObject, blogOnly, blogUuid } from '../socialhero/errors.ts';
import { SocialHeroPairingClient, type SocialHeroTransport } from '../socialhero/client.ts';

export type BlogRpcClient = { rpc(name: string, parameters: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }> };
export type BlogRuntimeLogEntry = { requestId: string; method: string; path: string; status: number; code: string | null };
export type BlogRuntimeDependencies = {
  site: BlogSite; userClient: (jwt: string) => BlogRpcClient; serviceClient: BlogRpcClient;
  storage: { put(path: string, bytes: Uint8Array, mimeType: string): Promise<void>; get(path: string): Promise<Uint8Array> };
  fetch?: typeof fetch; pairingTransport?: SocialHeroTransport; now?: () => Date;
  background?: (task: Promise<unknown>) => void;
  log?: (entry: BlogRuntimeLogEntry) => void;
};
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
const codes: Record<string, number> = { INVALID_REQUEST: 422, INVALID_CONTENT: 422, INVALID_MEDIA: 422, INVALID_CREDENTIAL: 401, INVALID_PAIRING_CODE: 400, PAIRING_EXPIRED: 410, DESTINATION_MISMATCH: 409, PAIRING_IN_PROGRESS: 409, PERMISSION_DENIED: 403, POST_NOT_FOUND: 404, SLUG_CONFLICT: 409, REVISION_CONFLICT: 409, IDEMPOTENCY_CONFLICT: 409, RATE_LIMITED: 429, CONFIGURATION_REQUIRED: 503, PUBLICATION_STALE: 409, PUBLICATION_BUSY: 409, LEASE_EXPIRED: 409, fresh_auth_required: 401, account_blocked: 403 };
const messages: Record<string, string> = {
  INVALID_PAIRING_CODE: 'Deze koppelcode klopt niet. Kopieer een nieuwe code uit SocialHero en probeer opnieuw.',
  PAIRING_EXPIRED: 'Deze koppelcode is verlopen. Maak in SocialHero een nieuwe code en koppel opnieuw.',
  DESTINATION_MISMATCH: 'De koppeling past niet bij deze website of omgeving. Gebruik de code voor deze website en controleer of je staging of productie hebt gekozen.',
  PAIRING_IN_PROGRESS: 'De koppeling wordt nog bevestigd. Wacht even en kies daarna Koppeling controleren.',
  PAIRING_UNAVAILABLE: 'SocialHero is nu niet bereikbaar. Probeer straks Koppeling controleren om dezelfde poging te hervatten.',
  REVISION_CONFLICT: 'Dit artikel is intussen gewijzigd. Open de nieuwste versie en verwerk je wijzigingen voordat je opnieuw opslaat.',
  SLUG_CONFLICT: 'Deze artikel-URL is al in gebruik. Kies een andere URL en sla opnieuw op.',
  IDEMPOTENCY_CONFLICT: 'Deze actie is eerder met andere inhoud verstuurd. Haal de actuele status op en verstuur de nieuwe wijziging als een nieuwe actie.',
  PERMISSION_DENIED: 'Je hebt geen toestemming voor deze actie. Controleer je beheerdersrechten en de toegestane acties van de koppeling.',
  RATE_LIMITED: 'Er zijn te veel verzoeken gedaan. Wacht even en probeer het daarna opnieuw.',
  fresh_auth_required: 'Meld je opnieuw aan om deze wijziging te bevestigen.',
  INVALID_CREDENTIAL: 'Deze aanmelding of koppeling is niet meer geldig. Meld je opnieuw aan of controleer de koppeling.',
  INVALID_MEDIA: 'Upload een geldige PNG- of JPEG-afbeelding van maximaal 8 MiB, 8 miljoen pixels en 6000 pixels per zijde.',
  BLOG_UNAVAILABLE: 'De blogservice is nu niet bereikbaar. Probeer het later opnieuw; controleer de actuele status voordat je een wijziging herhaalt.',
  CONFIGURATION_REQUIRED: 'De blogkoppeling is nog niet beschikbaar voor deze website. Laat de websiteconfiguratie controleren.',
};
const json = (value: unknown, status = 200) => Response.json(value, { status, headers });
function safeResult(value: unknown): unknown {
  if (Array.isArray(value)) { value.forEach(safeResult); return value; }
  if (blogObject(value)) for (const [key, item] of Object.entries(value)) {
    if (/^(?:accessToken|refreshToken|tokenHash|objectPath|leaseId|secretId|credential|authorization|code)$/iu.test(key)) throw new BlogRuntimeError('BLOG_UNAVAILABLE', 503);
    safeResult(item);
  }
  return value;
}
async function rpc<T>(client: BlogRpcClient, dispatcher: string, action: string, input: Record<string, unknown> = {}, tokenHash?: string): Promise<T> {
  const result = await client.rpc(dispatcher, { p_action: action, p_input: input, ...(tokenHash ? { p_token_hash: tokenHash } : {}) });
  if (result.error) {
    const code = Object.hasOwn(codes, result.error.message) ? result.error.message : result.error.code === '28000' ? 'fresh_auth_required' : result.error.code === '42501' ? 'PERMISSION_DENIED' : 'BLOG_UNAVAILABLE';
    throw new BlogRuntimeError(code, codes[code] ?? 503, code === 'RATE_LIMITED' ? 60 : code === 'PAIRING_IN_PROGRESS' ? 3 : undefined);
  }
  return result.data as T;
}
async function boundedBytes(stream: ReadableStream<Uint8Array> | null, maximum: number): Promise<Uint8Array> {
  if (!stream) return new Uint8Array();
  const reader = stream.getReader(), chunks: Uint8Array[] = []; let size = 0;
  try { while (true) { const item = await reader.read(); if (item.done) break; size += item.value.byteLength; if (size > maximum) { await reader.cancel(); throw new BlogRuntimeError('PAYLOAD_TOO_LARGE', 413); } chunks.push(item.value); } }
  finally { reader.releaseLock(); }
  const result = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; } return result;
}
async function body(request: Request): Promise<Record<string, unknown>> {
  if (!/^application\/json(?:;|$)/iu.test(request.headers.get('content-type') ?? '')) throw new BlogRuntimeError('INVALID_REQUEST');
  let parsed: unknown;
  try { parsed = JSON.parse(new TextDecoder().decode(await boundedBytes(request.body, 2_000_000))); }
  catch (error) { if (error instanceof BlogRuntimeError) throw error; throw new BlogRuntimeError('INVALID_REQUEST'); }
  if (!blogObject(parsed)) throw new BlogRuntimeError('INVALID_REQUEST'); return parsed;
}
function bearer(request: Request, machine: boolean): string {
  const value = request.headers.get('authorization') ?? '';
  const expression = machine ? /^Bearer ([A-Za-z0-9_-]{43,1024})$/u : /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/u;
  const match = value.match(expression); if (!match || value.length > 8192) throw new BlogRuntimeError('INVALID_CREDENTIAL', 401); return match[1];
}
function id(value: unknown): string { if (!blogUuid(value)) throw new BlogRuntimeError('INVALID_REQUEST'); return value; }
function revision(value: unknown, nullable = false): number | null { if (nullable && value === null) return null; if (!Number.isSafeInteger(value) || (value as number) < 1) throw new BlogRuntimeError('INVALID_REQUEST'); return value as number; }
function operationKey(request: Request): string { const key = request.headers.get('idempotency-key'); if (!key || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/u.test(key)) throw new BlogRuntimeError('INVALID_REQUEST'); return key; }
function canonicalJson(value: unknown): string { return JSON.stringify(value, (_key, item) => blogObject(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item); }
function mediaResponse(value: Record<string, unknown>) { return { assetId: value.assetId, mimeType: value.mimeType, width: value.width, height: value.height }; }
function logPath(parts: string[]): string {
  const sections = ['admin','socialhero','public','worker','posts','authors','categories','media','connection','capabilities'];
  return '/' + parts.slice(0,5).map((part,index) => index < 2 && sections.includes(part) || index === 2 && parts[1] === 'connection' && ['pair','check'].includes(part) || index === 3 && ['publish','restore'].includes(part) ? part : ':id').join('/');
}
type AssetContext = { assetId: string; objectPath: string; mimeType: string; byteLength: number; sha256: string; width: number; height: number; leaseId?: string; complete?: boolean };
type PublicationClaim = { publicationId: string; leaseId: string; postId: string; revision: number; publicUrl: string; proof: string; alreadyPromoted: boolean };
type PairContext = { attemptId: string; code: string | null; accessToken: string | null; connectionId: string | null; site: BlogSite; expiresAt: string };

/** Public proof must be active article markup, never comments or stored code examples. */
export function verifyBlogPublicationHtml(html: string, claim: Pick<PublicationClaim, 'postId' | 'revision' | 'proof'>): boolean {
  const active = html.replace(/<!--[\s\S]*?(?:-->|$)/gu, '').replace(/<(script|style|template|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/giu, '');
  const articles = [...active.matchAll(/<article\b[^>]*>/giu)].map(match => Object.fromEntries([...match[0].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/gu)].map(item => [item[1].toLowerCase(), item[2] ?? item[3]])));
  return articles.filter(article => article['data-blog-revision'] === `${claim.postId}:${claim.revision}` && article['data-blog-proof'] === claim.proof).length === 1;
}

/** HTTP orchestration only. All durable authorization/CAS/idempotency is transactional SQL. */
export function createBlogRuntimeHandler(dependencies: BlogRuntimeDependencies): (request: Request) => Promise<Response> {
  const blogPath = dependencies.site.blogPath;
  if (!/^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*)(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/u.test(blogPath)) throw new BlogRuntimeError('CONFIGURATION_REQUIRED', 503);
  const service = <T>(action: string, input: Record<string, unknown> = {}) => rpc<T>(dependencies.serviceClient, 'blog_service', action, input);
  const publicRpc = <T>(action: string, input: Record<string, unknown> = {}) => rpc<T>(dependencies.serviceClient, 'blog_public', action, input);
  const now = dependencies.now ?? (() => new Date());
  const pairing = new SocialHeroPairingClient(dependencies.site.environment === 'production' ? 'production' : 'staging', dependencies.pairingTransport, now);
  async function identity() {
    const actual = await publicRpc<BlogSite>('site');
    if (actual.siteId !== dependencies.site.siteId || actual.origin !== dependencies.site.origin || actual.environment !== dependencies.site.environment) throw new BlogRuntimeError('CONFIGURATION_REQUIRED', 503);
  }
  async function assetBytes(context: AssetContext) {
    if (!context || !blogUuid(context.assetId) || typeof context.objectPath !== 'string' || !/^blog\/[a-f0-9-]{36}\/[a-f0-9]{64}\.(?:png|jpg|webp)$/u.test(context.objectPath)) throw new BlogRuntimeError('INVALID_MEDIA');
    const bytes = await dependencies.storage.get(context.objectPath);
    if (bytes.byteLength !== context.byteLength || await blogHash(bytes) !== context.sha256) throw new BlogRuntimeError('INVALID_MEDIA'); return bytes;
  }
  async function upload(request: Request, reserve: (metadata: Record<string, unknown>) => Promise<AssetContext>): Promise<Response> {
    const bytes = await boundedBytes(request.body, BLOG_MEDIA_MAX_BYTES + 32_768); let form: FormData;
    try { form = await new Request('https://multipart.invalid', { method: 'POST', headers: { 'Content-Type': request.headers.get('content-type') ?? '' }, body: new Uint8Array(bytes) }).formData(); } catch { throw new BlogRuntimeError('INVALID_MEDIA'); }
    const entries = [...form.entries()]; if (entries.length !== 1 || entries[0][0] !== 'file' || typeof entries[0][1] === 'string') throw new BlogRuntimeError('INVALID_MEDIA');
    const file = entries[0][1], decoded = await decodeBlogMedia(new Uint8Array(await file.arrayBuffer()), file.type);
    const metadata = { sha256: decoded.sha256, byteLength: decoded.byteLength, mimeType: decoded.mimeType, width: decoded.width, height: decoded.height };
    const reservation = await reserve(metadata);
    if (!blogUuid(reservation.assetId) || typeof reservation.objectPath !== 'string' || !/^blog\/[a-f0-9-]{36}\/[a-f0-9]{64}\.(?:png|jpg)$/u.test(reservation.objectPath) || reservation.sha256 !== decoded.sha256 || reservation.byteLength !== decoded.byteLength || reservation.mimeType !== decoded.mimeType || reservation.width !== decoded.width || reservation.height !== decoded.height) throw new BlogRuntimeError('INVALID_MEDIA');
    if (!reservation.complete) {
      try { await assetBytes(reservation); }
      catch { try { await dependencies.storage.put(reservation.objectPath, decoded.bytes, decoded.mimeType); } catch { /* A previous identical upload may have committed before its response was lost. */ } }
      await assetBytes(reservation);
      return json(mediaResponse(await service<Record<string, unknown>>('media_complete', { assetId: reservation.assetId, leaseId: reservation.leaseId })));
    }
    await assetBytes(reservation); return json(mediaResponse(reservation as unknown as Record<string, unknown>));
  }
  async function publication(publicationId?: string): Promise<boolean> {
    const envelope = await service<{ claim: PublicationClaim | null }>('publication_claim', publicationId ? { publicationId } : {}); let claim = envelope.claim;
    if (!claim) return false;
    try {
      claim = await service<PublicationClaim>('publication_promote', { publicationId: claim.publicationId, leaseId: claim.leaseId });
      const url = new URL(claim.publicUrl);
      if (url.origin !== dependencies.site.origin || url.search || url.hash || url.username || url.password || !url.pathname.startsWith(`${blogPath}/`) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(url.pathname.slice(blogPath.length+1)) || !blogUuid(claim.postId) || !blogUuid(claim.publicationId) || !blogUuid(claim.leaseId) || !Number.isSafeInteger(claim.revision) || !/^[A-Za-z0-9_-]{16,200}$/u.test(claim.proof)) throw new BlogRuntimeError('PUBLICATION_STALE', 409);
      const response = await (dependencies.fetch ?? fetch)(url, { headers: { Accept: 'text/html', 'Cache-Control': 'no-cache' }, cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(8000) });
      if (response.status !== 200 || !/^text\/html(?:;|$)/iu.test(response.headers.get('content-type') ?? '')) throw new BlogRuntimeError('PUBLICATION_NOT_VISIBLE', 503);
      const html = new TextDecoder().decode(await boundedBytes(response.body, 2_000_000));
      if (!verifyBlogPublicationHtml(html, claim)) throw new BlogRuntimeError('PUBLICATION_NOT_VISIBLE', 503);
      await service('publication_confirm', { publicationId: claim.publicationId, leaseId: claim.leaseId, proof: claim.proof }); return true;
    } catch (error) {
      await service('publication_fail', { publicationId: claim.publicationId, leaseId: claim.leaseId, code: error instanceof BlogRuntimeError ? error.code : 'PUBLICATION_NOT_VISIBLE' }); return false;
    }
  }
  async function finishPair(attemptId: string, admin: <T>(action: string, input?: Record<string, unknown>) => Promise<T>): Promise<SocialHeroConnectionView> {
    try {
      let context = await service<PairContext>('pair_context', { attemptId });
      if (context.site.siteId !== dependencies.site.siteId || context.site.origin !== dependencies.site.origin || context.site.environment !== dependencies.site.environment) throw new BlogRuntimeError('DESTINATION_MISMATCH', 409);
      if (!context.accessToken) {
        if (!context.code) throw new BlogRuntimeError('PAIRING_EXPIRED', 410);
        const claimed = await pairing.claim({ code: context.code, attemptId, siteId: context.site.siteId, origin: context.site.origin, environment: context.site.environment });
        await admin('pair_pending', { attemptId, ...claimed });
        context = await service<PairContext>('pair_context', { attemptId });
      }
      if (!context.accessToken || !context.connectionId) throw new BlogRuntimeError('PAIRING_EXPIRED', 410);
      await pairing.verify(context.connectionId, context.accessToken);
      return await service<SocialHeroConnectionView>('pair_activate', { attemptId, connectionId: context.connectionId });
    } catch (error) {
      const code = error instanceof BlogRuntimeError ? error.code : 'PAIRING_UNAVAILABLE';
      await service('pair_fail', { attemptId, code, definitive: ['INVALID_PAIRING_CODE','PAIRING_EXPIRED','DESTINATION_MISMATCH','INVALID_CREDENTIAL','PERMISSION_DENIED'].includes(code) });
      throw error;
    }
  }
  return async request => {
    const requestId = crypto.randomUUID(); let route = '/unknown', logCode: string | null = null;
    const execute = async () => {
    try {
      const url = new URL(request.url), path = url.pathname.replace(/^.*\/blog-runtime(?=\/|$)/u, ''), parts = path.split('/').filter(Boolean).map(segment => decodeURIComponent(segment));
      route = logPath(parts);
      if (parts.some(part => !part || part.includes('/') || part.includes('\\') || part === '..')) throw new BlogRuntimeError('INVALID_REQUEST');
      await identity();
      if (parts[0] === 'worker' && parts.length === 1 && request.method === 'POST') {
        const bytes = await boundedBytes(request.body, 4096), timestamp = Number(request.headers.get('x-fabelpad-timestamp')), nonce = request.headers.get('x-fabelpad-nonce'), signature = request.headers.get('x-fabelpad-signature');
        if (!Number.isSafeInteger(timestamp) || !blogUuid(nonce) || !signature || !/^[a-f0-9]{64}$/u.test(signature)) throw new BlogRuntimeError('INVALID_CREDENTIAL', 401);
        const checked = await service<{ valid: boolean }>('worker_verify', { timestamp, nonce, signature, bodySha256: await blogHash(bytes) });
        if (!checked.valid) throw new BlogRuntimeError('INVALID_CREDENTIAL', 401);
        const work = (async () => { await service('cleanup'); let completed = 0; for (let index = 0; index < 3; index++) { if (!await publication()) break; completed++; } return completed; })();
        if (dependencies.background) { dependencies.background(work); return json({ accepted: true }, 202); }
        return json({ completed: await work });
      }
      if (parts[0] === 'public' && parts[1] === 'media' && parts.length === 3 && request.method === 'GET') {
        const context = await publicRpc<AssetContext>('media', { assetId: id(parts[2]) });
        if (!context) throw new BlogRuntimeError('NOT_FOUND', 404);
        const bytes = await assetBytes(context); return new Response(new Uint8Array(bytes), { headers: { ...headers, 'Content-Type': context.mimeType, 'Content-Length': String(bytes.byteLength) } });
      }
      if (parts[0] === 'admin') {
        const client = dependencies.userClient(bearer(request, false));
        const admin = <T>(action: string, input: Record<string, unknown> = {}) => rpc<T>(client, 'blog_admin', action, input);
        if (parts[1] === 'posts') {
          if (request.method === 'GET' && parts.length === 2) return json(safeResult(await admin('list', { ...(url.searchParams.has('query') ? { query: url.searchParams.get('query') } : {}), ...(url.searchParams.has('state') ? { state: url.searchParams.get('state') } : {}) })));
          if (request.method === 'GET' && parts.length === 3) return json(safeResult(await admin('get', { postId: id(parts[2]) })));
          if (parts.length === 2 && request.method === 'POST' || parts.length === 3 && request.method === 'PUT') {
            const input = await body(request); blogOnly(input, ['baseRevision','document']);
            return json(safeResult(await admin('save', { postId: parts[2] ? id(parts[2]) : null, baseRevision: revision(input.baseRevision, true), document: validateBlogDocument(input.document) })));
          }
          if (parts.length === 4 && request.method === 'POST' && parts[3] === 'restore') { const input = await body(request); blogOnly(input, ['baseRevision','revision']); return json(safeResult(await admin('restore', { postId: id(parts[2]), baseRevision: revision(input.baseRevision), revision: revision(input.revision) }))); }
          if (parts.length === 4 && request.method === 'POST' && parts[3] === 'publish') {
            const input = await body(request); blogOnly(input, ['revision']);
            const started = await admin<{ publicationId: string }>('publish', { postId: id(parts[2]), revision: revision(input.revision) });
            const confirmed = await publication(id(started.publicationId)); return json(safeResult(await admin('get', { postId: parts[2] })), confirmed ? 200 : 202);
          }
        }
        if (['authors','categories'].includes(parts[1]) && parts.length === 2 && request.method === 'POST') { const input = await body(request); blogOnly(input, ['id','name','bio','active']); const result = await admin<{record: unknown}>('taxonomy', { ...input, id: input.id == null ? null : id(input.id), kind: parts[1] === 'authors' ? 'author' : 'category' }); return json(safeResult(result.record)); }
        if (parts[1] === 'media') {
          if (parts.length === 2 && request.method === 'POST') { await admin('connection_status'); const key = request.headers.get('idempotency-key'); return await upload(request, metadata => admin<AssetContext>('media_reserve', { ...metadata, requestId: key ? id(key) : requestId })); }
          if (parts.length === 3 && request.method === 'GET') { const context = await admin<AssetContext>('media_get', { assetId: id(parts[2]) }); const bytes = await assetBytes(context); return new Response(new Uint8Array(bytes), { headers: { ...headers, 'Content-Type': context.mimeType, 'Content-Length': String(bytes.byteLength) } }); }
        }
        if (parts[1] === 'connection') {
          if (parts.length === 2 && request.method === 'GET') return json(safeResult(await admin('connection_status')));
          if (parts.length === 2 && request.method === 'PATCH') { const input = await body(request); blogOnly(input, ['connectionId','allowDraft','allowPublish']); if (typeof input.allowDraft !== 'boolean' || typeof input.allowPublish !== 'boolean') throw new BlogRuntimeError('INVALID_REQUEST'); return json(safeResult(await admin('connection_policy', { ...(input.connectionId ? { connectionId: id(input.connectionId) } : {}), allowDraft: input.allowDraft, allowPublish: input.allowPublish }))); }
          if (parts.length === 2 && request.method === 'DELETE') { const input = await body(request); blogOnly(input, ['connectionId']); return json(safeResult(await admin('connection_revoke', input.connectionId ? { connectionId: id(input.connectionId) } : {}))); }
          if (parts.length === 3 && parts[2] === 'pair' && request.method === 'POST') {
            const input = await body(request); blogOnly(input, ['code','allowDraft','allowPublish']); if (typeof input.code !== 'string' || !/^[A-Za-z0-9_-]{43}$/u.test(input.code) || typeof input.allowDraft !== 'boolean' || typeof input.allowPublish !== 'boolean') throw new BlogRuntimeError('INVALID_PAIRING_CODE', 400);
            const started = await admin<{ attemptId: string }>('pair_begin', { ...input, attemptId: crypto.randomUUID() }); return json(safeResult(await finishPair(id(started.attemptId), admin)));
          }
          if (parts.length === 3 && parts[2] === 'check' && request.method === 'POST') { const input = await body(request); blogOnly(input, []); const context = await admin<{ attemptId: string | null }>('pair_resume'); return json(safeResult(context.attemptId ? await finishPair(id(context.attemptId), admin) : await admin('connection_check'))); }
        }
      }
      if (parts[0] === 'socialhero') {
        const tokenHash = await blogHash(bearer(request, true));
        const machine = <T>(action: string, input: Record<string, unknown> = {}) => rpc<T>(dependencies.serviceClient, 'blog_connector', action, input, tokenHash);
        if (parts[1] === 'capabilities' && parts.length === 2 && request.method === 'GET') return json(safeResult(await machine('capabilities')));
        if (parts[1] === 'connection' && parts.length === 2 && request.method === 'DELETE') { await machine('revoke'); return new Response(null, { status: 204, headers }); }
        if (parts[1] === 'media' && parts.length === 2 && request.method === 'POST') {
          const caps = await machine<SocialHeroCapabilities>('capabilities'); if (caps.credentialState !== 'active') throw new BlogRuntimeError('PAIRING_IN_PROGRESS', 409, 3); if (!caps.scopes.includes('draft')) throw new BlogRuntimeError('PERMISSION_DENIED', 403);
          const key = operationKey(request); return await upload(request, async metadata => machine<AssetContext>('media_reserve', { ...metadata, idempotencyKey: key, fingerprint: await blogHash(JSON.stringify(metadata)) }));
        }
        if (parts[1] === 'posts' && blogIdentifier(parts[2])) {
          const externalId = parts[2];
          if (parts.length === 3 && request.method === 'GET') return json(safeResult(await machine('get', { externalId })));
          if (parts.length === 3 && request.method === 'PUT') {
            const key = operationKey(request), input = await body(request), caps = await machine<SocialHeroCapabilities>('capabilities');
            if (caps.credentialState !== 'active') throw new BlogRuntimeError('PAIRING_IN_PROGRESS', 409, 3); if (!caps.scopes.includes('draft')) throw new BlogRuntimeError('PERMISSION_DENIED', 403);
            let previous: { slug: string } | null = null;
            try { previous = await machine('get', { externalId }); } catch (error) { if (!(error instanceof BlogRuntimeError) || error.code !== 'POST_NOT_FOUND') throw error; }
            const document: BlogDocument = markdownToBlogDocument(input, { authorId: caps.authors.find(author => author.name === dependencies.site.siteName)?.id ?? caps.authors[0]?.id ?? '', slug: previous?.slug, origin: dependencies.site.origin });
            return json(safeResult(await machine('put', { externalId, idempotencyKey: key, fingerprint: await blogHash(canonicalJson(input)), baseRevision: revision(input.baseRevision, true), document })));
          }
          if (parts.length === 4 && parts[3] === 'publish' && request.method === 'POST') {
            const key = operationKey(request), input = await body(request); blogOnly(input, ['revision']);
            const started = await machine<{ publicationId: string }>('publish', { externalId, revision: revision(input.revision), idempotencyKey: key, fingerprint: await blogHash(canonicalJson(input)) });
            const confirmed = await publication(id(started.publicationId)); return json(safeResult(await machine('get', { externalId })), confirmed ? 200 : 202);
          }
        }
      }
      throw new BlogRuntimeError('NOT_FOUND', 404);
    } catch (error) {
      const controlled = error instanceof BlogRuntimeError || error instanceof BlogValidationError;
      const code = controlled ? error.code : 'BLOG_UNAVAILABLE', status = controlled ? error.status : 503;
      logCode = code;
      const response = json({ code, message: messages[code] ?? 'De blogactie kon niet worden uitgevoerd. Controleer je invoer of probeer opnieuw.', requestId, ...(error instanceof BlogValidationError ? { fieldErrors: error.fieldErrors } : {}) }, status);
      if (error instanceof BlogRuntimeError && error.retryAfter) response.headers.set('Retry-After', String(error.retryAfter)); return response;
    }
    };
    const response = await execute();
    try { dependencies.log?.({ requestId, method: ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'].includes(request.method) ? request.method : 'OTHER', path: route, status: response.status, code: logCode }); } catch { /* Observability cannot change the transactional result. */ }
    return response;
  };
}
