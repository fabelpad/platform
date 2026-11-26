#!/usr/bin/env node
// Owner-operated, staging-only acceptance fixture. Never imports service keys.
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PNG } from 'pngjs';

export const STAGING = Object.freeze({ origin: 'https://staging.fabelpad.nl', project: 'tlwfpivafcokcjyjwgmq', canonical: 'https://fabelpad.nl' });
const sha = value => createHash('sha256').update(value).digest('hex');
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(value);
const ensure = (condition, code) => { if (!condition) throw new Error(code); };
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
const delay = milliseconds => new Promise(done => setTimeout(done, milliseconds));

export function createProbeState(publishableKey) {
  validatePublishableKey(publishableKey);
  const runId = randomUUID(), credential = () => ({ attemptId: randomUUID(), connectionId: randomUUID(), token: randomBytes(32).toString('base64url') });
  return { schemaVersion: 1, ...STAGING, runId, actorId: randomUUID(), sessionId: randomUUID(), destinationId: randomUUID(),
    email: `synthetic-blog-${runId}@example.invalid`, externalId: `synthetic-${runId}`, slug: `synthetische-stagingcontrole-${runId}`,
    publishableKey, credential: credential(), replacement: credential(), phase: 'initial', checks: [], createdAt: new Date().toISOString() };
}
function validatePublishableKey(key) {
  ensure(typeof key === 'string' && key.length >= 20 && key.length <= 4096 && !/\s/u.test(key), 'PUBLISHABLE_KEY_REQUIRED');
  if (key.startsWith('sb_publishable_')) return;
  try { ensure(key.split('.').length === 3 && JSON.parse(Buffer.from(key.split('.')[1], 'base64url')).role === 'anon', 'PUBLISHABLE_KEY_REQUIRED'); }
  catch { throw new Error('PUBLISHABLE_KEY_REQUIRED'); }
}
export function validateProbeState(state) {
  ensure(state?.schemaVersion === 1 && state.origin === STAGING.origin && state.project === STAGING.project && state.canonical === STAGING.canonical, 'STAGING_IDENTITY_REQUIRED');
  for (const id of ['runId', 'actorId', 'sessionId', 'destinationId']) ensure(uuid(state[id]), 'INVALID_LOCAL_STATE');
  for (const credential of [state.credential, state.replacement]) ensure(uuid(credential?.attemptId) && uuid(credential?.connectionId) && /^[A-Za-z0-9_-]{43}$/u.test(credential?.token ?? ''), 'INVALID_LOCAL_STATE');
  ensure(state.email === `synthetic-blog-${state.runId}@example.invalid` && state.externalId === `synthetic-${state.runId}` && state.slug === `synthetische-stagingcontrole-${state.runId}`, 'INVALID_LOCAL_STATE');
  validatePublishableKey(state.publishableKey); return state;
}
const sqlGuard = state => `
 perform private.blog_lock();
 if not exists(select 1 from private.blog_installation where singleton and site_id='fabelpad' and environment='staging' and project_ref='${STAGING.project}' and origin='${STAGING.origin}' and canonical_origin='${STAGING.canonical}' and socialhero_origin='https://socialhero-staging.dgwebservices.nl') then raise exception 'Staging blog fixture identity mismatch';end if;
 if exists(select 1 from auth.users where id=${quote(state.actorId)}::uuid and (email is distinct from ${quote(state.email)} or raw_user_meta_data->>'syntheticBlogRunId' is distinct from ${quote(state.runId)})) then raise exception 'Synthetic identity collision';end if;`;

/** Raw opaque tokens never occur in these owner-only SQL artifacts. */
export function fixtureSetupSql(input) {
  const s = validateProbeState(input), c = s.credential;
  return `-- SYNTHETIC STAGING ACCEPTANCE ONLY. No real account/guardian declaration.
-- A synthetic active credential bypasses remote pairing to isolate this receiver.
-- No email or campaign is sent. No service-role key or raw bearer is present.
begin;
do $fixture$ declare generation bigint;begin
${sqlGuard(s)}
 if exists(select 1 from private.blog_installation where singleton and (active_connection_id is not null or current_attempt_id is not null)) then raise exception 'Fixture requires an empty disconnected installation; existing connection preserved';end if;
 if exists(select 1 from private.socialhero_connections where state in ('active','pending')) or exists(select 1 from private.socialhero_pairing_attempts where state in ('claiming','pending') and expires_at>clock_timestamp()) then raise exception 'Existing connection or provisioning preserved';end if;
 insert into auth.users(id,email,email_confirmed_at,is_anonymous,raw_user_meta_data) values(${quote(s.actorId)},${quote(s.email)},clock_timestamp(),false,jsonb_build_object('syntheticBlogRunId',${quote(s.runId)}));
 insert into auth.sessions(id,user_id,not_after) values(${quote(s.sessionId)},${quote(s.actorId)},clock_timestamp()+interval '2 hours');
 insert into public.content_admins(user_id) values(${quote(s.actorId)});
 insert into private.account_lifecycle(parent_id,state,terms_version,privacy_version,accepted_at,parent_declaration,signup_channel,last_activity_at)
 values(${quote(s.actorId)},'active',(select max(version) from private.legal_document_versions where kind='terms'),(select max(version) from private.legal_document_versions where kind='privacy'),clock_timestamp(),true,'other',clock_timestamp())
 on conflict(parent_id) do update set state='active',terms_version=excluded.terms_version,privacy_version=excluded.privacy_version,accepted_at=excluded.accepted_at,parent_declaration=true,signup_channel='other',last_activity_at=excluded.last_activity_at where account_lifecycle.parent_id=${quote(s.actorId)}::uuid;
 update private.blog_installation set binding_generation=binding_generation+1 where singleton returning binding_generation into generation;
 insert into private.socialhero_destinations(site_id,destination_id,allow_draft,allow_publish,policy_actor_id) values('fabelpad',${quote(s.destinationId)},true,true,${quote(s.actorId)});
 insert into private.socialhero_policy_audit(site_id,destination_id,environment,allow_draft,allow_publish,actor_id,source) values('fabelpad',${quote(s.destinationId)},'staging',true,true,${quote(s.actorId)},'pair');
 insert into private.socialhero_pairing_attempts(id,site_id,actor_id,session_id,generation,allow_draft,allow_publish,state,code_hash,connection_id,expires_at)
 values(${quote(c.attemptId)},'fabelpad',${quote(s.actorId)},${quote(s.sessionId)},generation,true,true,'active',${quote(sha(`synthetic:${s.runId}`))},${quote(c.connectionId)},clock_timestamp()+interval '2 hours');
 insert into private.socialhero_connections(id,site_id,destination_id,token_hash,state,attempt_id,expires_at,connected_at,last_checked_at)
 values(${quote(c.connectionId)},'fabelpad',${quote(s.destinationId)},${quote(sha(c.token))},'active',${quote(c.attemptId)},clock_timestamp()+interval '2 hours',clock_timestamp(),clock_timestamp());
 update private.blog_installation set active_connection_id=${quote(c.connectionId)},current_attempt_id=${quote(c.attemptId)} where singleton;
end$fixture$;
commit;
`;
}
export function policyOffSql(input) {
  const s = validateProbeState(input);
  return `-- SYNTHETIC STAGING ONLY: withdraw publish through the ordinary admin service.
begin;
do $fixture$ begin
${sqlGuard(s)}
 if not exists(select 1 from private.blog_installation where singleton and active_connection_id=${quote(s.credential.connectionId)}::uuid) then raise exception 'Synthetic fixture is not selected';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',${quote(s.actorId)},'session_id',${quote(s.sessionId)},'amr',jsonb_build_array(jsonb_build_object('method','otp','timestamp',floor(extract(epoch from clock_timestamp())))))::text,true);
 perform public.blog_admin('connection_policy',jsonb_build_object('connectionId',${quote(s.credential.connectionId)},'allowDraft',true,'allowPublish',false));
end$fixture$;
commit;
`;
}
export function reconnectSql(input) {
  const s = validateProbeState(input), c = s.replacement;
  return `-- OPTIONAL SYNTHETIC STAGING RECONNECT: hashes only; preserves the explicit opt-out.
begin;
do $fixture$ declare generation bigint;begin
${sqlGuard(s)}
 if not exists(select 1 from private.blog_installation where singleton and active_connection_id=${quote(s.credential.connectionId)}::uuid) or not exists(select 1 from private.socialhero_destinations where site_id='fabelpad' and destination_id=${quote(s.destinationId)}::uuid and allow_draft and not allow_publish) then raise exception 'Apply synthetic publish withdrawal before reconnect';end if;
 update private.blog_installation set binding_generation=binding_generation+1 where singleton returning binding_generation into generation;
 insert into private.socialhero_pairing_attempts(id,site_id,actor_id,session_id,generation,allow_draft,allow_publish,state,code_hash,connection_id,expires_at)
 values(${quote(c.attemptId)},'fabelpad',${quote(s.actorId)},${quote(s.sessionId)},generation,true,true,'active',${quote(sha(`synthetic-reconnect:${s.runId}`))},${quote(c.connectionId)},clock_timestamp()+interval '2 hours');
 insert into private.socialhero_connections(id,site_id,destination_id,token_hash,state,attempt_id,supersedes_id,expires_at,connected_at,last_checked_at)
 values(${quote(c.connectionId)},'fabelpad',${quote(s.destinationId)},${quote(sha(c.token))},'active',${quote(c.attemptId)},${quote(s.credential.connectionId)},clock_timestamp()+interval '2 hours',clock_timestamp(),clock_timestamp());
 update private.socialhero_connections set state='revoked',revoked_at=clock_timestamp() where id=${quote(s.credential.connectionId)}::uuid and state='active';
 update private.blog_installation set active_connection_id=${quote(c.connectionId)},current_attempt_id=${quote(c.attemptId)} where singleton;
 -- Deliberately no destination policy UPDATE or opt-in audit on reconnect.
end$fixture$;
commit;
`;
}
export function cleanupSql(input) {
  const s = validateProbeState(input);
  return `-- Owner fallback after HTTP revoke; retain synthetic articles/media for evidence.
begin;
do $fixture$ begin
${sqlGuard(s)}
 update private.socialhero_connections set state='revoked',revoked_at=coalesce(revoked_at,clock_timestamp()) where id in(${quote(s.credential.connectionId)}::uuid,${quote(s.replacement.connectionId)}::uuid) and destination_id=${quote(s.destinationId)}::uuid;
 update private.blog_installation set active_connection_id=null where singleton and active_connection_id in(${quote(s.credential.connectionId)}::uuid,${quote(s.replacement.connectionId)}::uuid);
 update private.blog_installation set current_attempt_id=null where singleton and current_attempt_id in(${quote(s.credential.attemptId)}::uuid,${quote(s.replacement.attemptId)}::uuid);
 delete from auth.users where id=${quote(s.actorId)}::uuid and email=${quote(s.email)} and raw_user_meta_data->>'syntheticBlogRunId'=${quote(s.runId)};
end$fixture$;
commit;
`;
}

async function secureWrite(path, value) { await mkdir(dirname(path), { recursive: true, mode: 0o700 }); await writeFile(path, value, { mode: 0o600 }); await chmod(path, 0o600); }
async function readState(path) { const info = await stat(path); ensure((info.mode & 0o077) === 0 && info.isFile(), 'LOCAL_STATE_REQUIRES_MODE_600'); return validateProbeState(JSON.parse(await readFile(path, 'utf8'))); }
async function boundedResponse(response, max = 2_000_000) {
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader(), chunks = []; let length = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      length += part.value.byteLength;
      if (length > max) { await reader.cancel(); throw new Error('RESPONSE_TOO_LARGE'); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks, length);
}
function attrs(tag) { return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/gu)].map(match => [match[1].toLowerCase(), match[2] ?? match[3]])); }
export function verifyPublicHtml(html, article, proof) {
  const active = html.replace(/<!--[\s\S]*?(?:-->|$)/gu, '').replace(/<(script|style|template|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/giu, '');
  ensure([...active.matchAll(/<article\b[^>]*>/giu)].map(match => attrs(match[0])).filter(value => value['data-blog-revision'] === `${article.postId}:${article.revision}` && value['data-blog-proof'] === proof).length === 1, 'PUBLIC_REVISION_PROOF_MISSING');
  const h1 = [...active.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/giu)]; ensure(h1.length === 1 && h1[0][1] === article.document.title, 'PUBLIC_H1_MISMATCH');
  ensure(html.includes(`<title>${article.document.seo.title || article.document.title}`), 'SEO_TITLE_MISSING');
  const links = [...html.matchAll(/<link\b[^>]*>/giu)].map(match => attrs(match[0]));
  ensure(links.some(value => value.rel === 'canonical' && value.href === `${STAGING.canonical}/blog/${article.document.slug}`), 'CANONICAL_MISMATCH');
  const meta = [...html.matchAll(/<meta\b[^>]*>/giu)].map(match => attrs(match[0]));
  ensure(meta.some(value => value.name === 'robots' && /noindex/u.test(value.content ?? '')), 'STAGING_NOINDEX_REQUIRED');
  ensure(meta.some(value => value.name === 'description' && value.content === article.document.seo.description), 'SEO_DESCRIPTION_MISMATCH');
  const schema = [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/giu)].map(match => { try { return JSON.parse(match[1]); } catch { return null; } });
  ensure(schema.some(value => ['Article', 'BlogPosting'].includes(value?.['@type']) && value.headline === article.document.title && value.url === `${STAGING.canonical}/blog/${article.document.slug}`), 'STRUCTURED_DATA_MISSING');
}

export async function runProbe(state, persist, report = value => process.stdout.write(JSON.stringify(value) + '\n')) {
  validateProbeState(state);
  const record = async (check, details = {}) => { const result = { check, passed: true, ...details }; state.checks.push(result); report(result); await persist(state); };
  const request = async (path, { method = 'GET', body, key, token = state.credential.token, authorized = true } = {}) => {
    ensure(path.startsWith('/api/socialhero/v1/') || path.startsWith('/api/blog/media/') || path.startsWith('/blog/'), 'UNSAFE_PROBE_PATH');
    const headers = { Accept: path.startsWith('/blog/') ? 'text/html' : 'application/json', 'Cache-Control': 'no-cache' };
    if (authorized) { ensure(path.startsWith('/api/socialhero/v1/'), 'BEARER_SCOPE_VIOLATION'); headers.Authorization = `Bearer ${token}`; }
    if (key) headers['Idempotency-Key'] = key;
    if (body !== undefined && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
    const response = await fetch(STAGING.origin + path, { method, headers, ...(body === undefined ? {} : { body: body instanceof FormData ? body : JSON.stringify(body) }), redirect: 'manual', signal: AbortSignal.timeout(40_000) });
    const bytes = await boundedResponse(response), text = bytes.toString('utf8'); let data; try { data = JSON.parse(text); } catch { data = null; }
    return { response, status: response.status, data, text, bytes };
  };
  const rpc = async (action, input = {}) => {
    const response = await fetch(`https://${STAGING.project}.supabase.co/rest/v1/rpc/blog_public`, { method: 'POST', headers: { apikey: state.publishableKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_action: action, p_input: input }), redirect: 'manual', signal: AbortSignal.timeout(15_000) });
    ensure(response.status === 200, 'PUBLIC_READ_RPC_FAILED'); return JSON.parse((await boundedResponse(response)).toString('utf8'));
  };
  const path = `/api/socialhero/v1/posts/${state.externalId}`;
  const revoke = async () => {
    for (const token of [state.credential.token, state.replacement.token]) {
      const result = await request('/api/socialhero/v1/connection', { method: 'DELETE', token }); ensure([204, 401].includes(result.status), 'CREDENTIAL_REVOKE_FAILED');
      ensure((await request('/api/socialhero/v1/capabilities', { token })).status === 401, 'REVOKED_CREDENTIAL_STILL_ACTIVE');
    }
    state.phase = 'revoked'; await record('credential_revoked_and_rejected');
  };
  if (state.phase === 'revoked') return { complete: true, alreadyRevoked: true };
  try {
    const site = await rpc('site'); ensure(site.siteId === 'fabelpad' && site.environment === 'staging' && site.origin === STAGING.origin && site.canonicalOrigin === STAGING.canonical, 'STAGING_IDENTITY_REQUIRED');
    if (state.phase === 'initial') {
      const caps = await request('/api/socialhero/v1/capabilities'); ensure(caps.status === 200 && caps.data.connectionId === state.credential.connectionId && caps.data.destinationId === state.destinationId && caps.data.scopes.includes('draft') && caps.data.scopes.includes('publish'), 'CAPABILITIES_FAILED'); await record('capabilities_identity_scope');
      const png = PNG.sync.write({ width: 2, height: 2, data: Buffer.alloc(16, 255) }), upload = new FormData(); upload.set('file', new File([png], 'synthetic-staging.png', { type: 'image/png' }));
      const media = await request('/api/socialhero/v1/media', { method: 'POST', body: upload, key: `${state.runId}:media` }); ensure(media.status === 200 && uuid(media.data?.assetId) && media.data.mimeType === 'image/png' && media.data.width === 2, 'MEDIA_UPLOAD_FAILED'); state.assetId = media.data.assetId;
      ensure((await request(`/api/blog/media/${state.assetId}`, { authorized: false })).status === 404, 'DRAFT_MEDIA_BECAME_PUBLIC'); await record('decoded_private_media');
      const input = { baseRevision: null, type: 'blog', locale: 'nl-NL', title: 'Synthetische stagingcontrole blog', slug: state.slug, excerpt: 'Synthetische acceptatiecontrole. Geen echte publicatie voor lezers.', authorId: caps.data.authors[0].id, categoryId: null, tags: ['synthetische-controle'], seo: { title: 'Synthetische blogcontrole', description: 'Synthetische controle van het blogsysteem op staging.' }, hero: { assetId: state.assetId, alt: 'Synthetische witte testafbeelding' }, ogImageAssetId: state.assetId, content: { format: 'markdown', body: '## Synthetische controle\n\nDeze **synthetische** tekst controleert de echte stagingroutes.\n\n- Eerste controle\n- Tweede controle' } };
      const saved = await request(path, { method: 'PUT', body: input, key: `${state.runId}:draft` }); ensure(saved.status === 200 && saved.data.revision === 1 && saved.data.state === 'draft', 'DRAFT_PUT_FAILED'); state.postId = saved.data.postId;
      ensure(canonical((await request(path)).data) === canonical(saved.data), 'DRAFT_GET_MISMATCH'); ensure((await request(`/blog/${state.slug}`, { authorized: false })).status === 404, 'DRAFT_PAGE_BECAME_PUBLIC');
      ensure(canonical((await request(path, { method: 'PUT', body: input, key: `${state.runId}:draft` })).data) === canonical(saved.data), 'REPLAY_CHANGED_RESULT');
      const conflict = await request(path, { method: 'PUT', body: { ...input, title: 'Conflicterende replay' }, key: `${state.runId}:draft` }); ensure(conflict.status === 409 && conflict.data.code === 'IDEMPOTENCY_CONFLICT', 'CHANGED_REPLAY_NOT_REJECTED'); await record('draft_get_replay_conflict');
      async function publish(revision, slug, key) {
        const started = await request(path + '/publish', { method: 'POST', body: { revision }, key }); ensure([200, 202].includes(started.status), 'PUBLISH_REQUEST_FAILED');
        if (started.status === 202) ensure(started.data.state === 'publishing', 'ACCEPTED_STATUS_FALSE_PUBLISHED');
        let article;
        for (let attempt = 0; attempt < 45; attempt++) {
          const status = await request(path), page = await rpc('post', { slug });
          if (status.status === 200 && status.data.state === 'published' && status.data.publishedRevision === revision && page.article?.revision === revision) {
            const html = await request(`/blog/${slug}`, { authorized: false }); ensure(html.status === 200, 'PUBLISHED_HTML_UNAVAILABLE');
            const proof = page.verification?.proof;
            ensure(page.verification?.revision === revision && typeof proof === 'string' && /^[a-f0-9]{64}$/u.test(proof), 'PUBLIC_PROOF_UNAVAILABLE'); verifyPublicHtml(html.text, page.article, proof); article = page.article; break;
          }
          await delay(3000);
        }
        ensure(article, 'PUBLICATION_POLL_TIMED_OUT'); await record('publication_html_seo_proof', { httpStatus: started.status, revision }); return article;
      }
      const live = await publish(1, state.slug, `${state.runId}:publish-1`); state.liveHash = sha(canonical(live));
      const publicMedia = await request(`/api/blog/media/${state.assetId}`, { authorized: false }); ensure(publicMedia.status === 200 && publicMedia.response.headers.get('content-type')?.startsWith('image/png') && sha(publicMedia.bytes) === sha(png), 'PUBLIC_MEDIA_BYTES_MISMATCH'); await record('public_media_checksum');
      const draftInput = { ...input, baseRevision: 1, title: 'Synthetisch nieuw concept', content: { format: 'markdown', body: '## Nieuw concept\n\nDit concept mag de publieke versie niet aanpassen.' } };
      const draft = await request(path, { method: 'PUT', body: draftInput, key: `${state.runId}:draft-2` }); ensure(draft.status === 200 && draft.data.revision === 2, 'LATER_DRAFT_FAILED');
      ensure(sha(canonical((await rpc('post', { slug: state.slug })).article)) === state.liveHash, 'DRAFT_CHANGED_LIVE_BYTES_OR_DATE'); await record('later_draft_preserves_live_bytes_dates_url');
      const nextSlug = state.slug + '-nieuw', renamed = await request(path, { method: 'PUT', body: { ...draftInput, baseRevision: 2, slug: nextSlug }, key: `${state.runId}:rename` }); ensure(renamed.status === 200 && renamed.data.revision === 3, 'EXPLICIT_SLUG_CHANGE_FAILED');
      await publish(3, nextSlug, `${state.runId}:publish-3`);
      const redirect = await request(`/blog/${state.slug}`, { authorized: false }); ensure(redirect.status === 308 && new URL(redirect.response.headers.get('location'), STAGING.origin).href === `${STAGING.origin}/blog/${nextSlug}`, 'HISTORIC_SLUG_REDIRECT_FAILED');
      state.latestRevision = 3; state.latestSlug = nextSlug; state.savedInput = { ...draftInput, slug: nextSlug }; state.phase = 'await-policy-withdrawal'; await record('explicit_slug_direct_308');
      return { complete: false, next: 'Apply policy-off.sql as owner; optionally fixture-reconnect.sql; then run again. Revoke is available immediately on abort.' };
    }
    ensure(state.phase === 'await-policy-withdrawal', 'INVALID_PROBE_PHASE');
    const old = await request('/api/socialhero/v1/capabilities'), replaced = old.status === 401;
    const token = replaced ? state.replacement.token : state.credential.token, caps = replaced ? await request('/api/socialhero/v1/capabilities', { token }) : old;
    ensure(caps.status === 200 && caps.data.destinationId === state.destinationId && caps.data.scopes.includes('draft') && !caps.data.scopes.includes('publish'), 'APPLY_POLICY_OFF_SQL_FIRST');
    const denied = await request(path + '/publish', { method: 'POST', token, body: { revision: state.latestRevision }, key: `${state.runId}:denied` }); ensure(denied.status === 403 && denied.data.code === 'PERMISSION_DENIED', 'PUBLISH_WITHDRAWAL_NOT_ENFORCED');
    const allowed = await request(path, { method: 'PUT', token, body: { ...state.savedInput, baseRevision: state.latestRevision, title: 'Synthetisch concept na intrekken publiceren' }, key: `${state.runId}:draft-allowed` }); ensure(allowed.status === 200 && allowed.data.revision === 4, 'DRAFT_DISABLED_WITH_PUBLISH');
    await record(replaced ? 'reconnect_preserves_optout_old_token_rejected_draft_allowed' : 'publish_withdrawal_403_draft_allowed'); await revoke(); return { complete: true };
  } catch (error) {
    try { await revoke(); } catch { report({ check: 'cleanup_required', passed: false, fallback: 'fixture-cleanup.sql' }); }
    throw error;
  }
}

async function main() {
  const [command, ...args] = process.argv.slice(2), options = Object.fromEntries(args.reduce((pairs, value, index) => index % 2 === 0 ? [...pairs, [value, args[index + 1]]] : pairs, []));
  const statePath = resolve(options['--state'] || '.next/blog-staging-probe/state.json');
  if (command === 'init') {
    try { await stat(statePath); throw new Error('LOCAL_STATE_ALREADY_EXISTS'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const key = options['--publishable-key-file'] ? (await readFile(resolve(options['--publishable-key-file']), 'utf8')).trim() : process.env.FABELPAD_STAGING_PUBLISHABLE_KEY;
    const state = createProbeState(key); await secureWrite(statePath, JSON.stringify(state, null, 2) + '\n');
    const artifacts = { 'fixture-setup.sql': fixtureSetupSql(state), 'policy-off.sql': policyOffSql(state), 'fixture-reconnect.sql': reconnectSql(state), 'fixture-cleanup.sql': cleanupSql(state) };
    for (const [name, source] of Object.entries(artifacts)) await secureWrite(resolve(dirname(statePath), name), source);
    process.stdout.write(artifacts['fixture-setup.sql']); return;
  }
  const state = await readState(statePath), persist = value => secureWrite(statePath, JSON.stringify(value, null, 2) + '\n');
  if (command === 'run') { const result = await runProbe(state, persist); await secureWrite(resolve(dirname(statePath), 'safe-results.json'), JSON.stringify({ project: STAGING.project, origin: STAGING.origin, runId: state.runId, phase: state.phase, checks: state.checks, result }, null, 2) + '\n'); process.stdout.write(JSON.stringify(result) + '\n'); return; }
  if (command === 'revoke') {
    for (const credential of [state.credential, state.replacement]) {
      const response = await fetch(`${STAGING.origin}/api/socialhero/v1/connection`, { method: 'DELETE', headers: { Authorization: `Bearer ${credential.token}` }, redirect: 'manual', signal: AbortSignal.timeout(20_000) }); ensure([204, 401].includes(response.status), 'CREDENTIAL_REVOKE_FAILED');
    }
    state.phase = 'revoked'; await persist(state); process.stdout.write('{"revoked":true,"ownerCleanup":"fixture-cleanup.sql"}\n'); return;
  }
  throw new Error('USE_INIT_RUN_OR_REVOKE');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => {
  // Never print fetch/SQL errors, response bodies, local state or request headers.
  const code = /^[A-Z][A-Z0-9_]{1,100}$/u.test(error?.message ?? '') ? error.message : 'STAGING_PROBE_FAILED';
  process.stderr.write(JSON.stringify({ passed: false, code }) + '\n'); process.exitCode = 1;
});
