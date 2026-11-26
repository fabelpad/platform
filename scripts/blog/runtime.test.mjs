import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';
import { PNG } from 'pngjs';
import { compileSource } from '../source-test-loader.mjs';
const temporary = await mkdtemp(path.join(tmpdir(), 'fabelpad-blog-runtime-'));
await symlink(new URL('../../node_modules', import.meta.url).pathname, path.join(temporary, 'node_modules'));
const { createBlogRuntimeHandler, verifyBlogPublicationHtml } = await import(await compileSource(new URL('../../lib/blog/runtime.ts', import.meta.url), temporary));
const { createBlogSupabaseDependencies } = await import(await compileSource(new URL('../../lib/socialhero/supabase.ts', import.meta.url), temporary));
const site = { siteId: 'fabelpad', siteName: 'Fabelpad', origin: 'https://staging.fabelpad.nl', canonicalOrigin: 'https://fabelpad.nl', environment: 'staging', blogPath: '/blog', contentTypes: ['blog','article'], locales: ['nl-NL'] };
const ids = { attempt: '11111111-1111-4111-8111-111111111111', connection: '22222222-2222-4222-8222-222222222222', destination: '33333333-3333-4333-8333-333333333333', asset: '44444444-4444-4444-8444-444444444444', post: '55555555-5555-4555-8555-555555555555', publication: '66666666-6666-4666-8666-666666666666', lease: '77777777-7777-4777-8777-777777777777' };
const token = 't'.repeat(43), userJwt = 'eyJhbGciOiJIUzI1NiJ9.e30.synthetic', code = 'c'.repeat(43);
const jsonRequest = (route, value, method = 'POST', machine = false) => new Request(`https://edge.invalid/blog-runtime/${route}`, { method, headers: { Authorization: `Bearer ${machine ? token : userJwt}`, 'Content-Type': 'application/json', 'Idempotency-Key': 'operation-1' }, body: method === 'GET' ? undefined : JSON.stringify(value) });
const connection = (status = 'active') => ({ status, connectionId: ids.connection, destinationId: ids.destination, site, allowDraft: true, allowPublish: true, scopes: ['read','draft','publish'], connectedAt: null, expiresAt: null, lastCheckedAt: null });
const caps = state => ({ contractVersion: 1, connectionId: ids.connection, destinationId: ids.destination, credentialState: state, ...site, scopes: ['read','draft','publish'], authors: [{ id: ids.asset, name: 'Fabelpad' }], categories: [], media: { mimeTypes: ['image/png','image/jpeg'], maxBytes: 8388608 } });
function fixture(action, extras = {}) {
  const calls = [];
  const invoke = user => ({ async rpc(dispatcher, parameters) { calls.push({ user, dispatcher, ...parameters }); try { const result = parameters.p_action === 'site' ? site : await action(parameters.p_action, parameters.p_input, { user, dispatcher, hash: parameters.p_token_hash }); return { data: result, error: null }; } catch (error) { return { data: null, error: { message: error.message, code: error.code } }; } } });
  const dependencies = { site, serviceClient: invoke(null), userClient: jwt => invoke(jwt), storage: { get: async () => { throw new Error(); }, put: async () => { throw new Error(); } }, now: () => new Date('2026-11-26T12:00:00Z'), ...extras };
  return { calls, dependencies, handler: createBlogRuntimeHandler(dependencies) };
}
test('real local HTTP verify callback can only read committed pending capabilities, then activation strips every secret', async () => {
  let pending = false, active = false, context, handler;
  const server = createServer(async (incoming, outgoing) => {
    const chunks = []; for await (const chunk of incoming) chunks.push(chunk);
    const input = JSON.parse(Buffer.concat(chunks).toString());
    outgoing.setHeader('Content-Type', 'application/json');
    if (incoming.url.endsWith('/claim')) { assert.equal(input.contractVersion, 1); outgoing.end(JSON.stringify({ connectionId: ids.connection, destinationId: ids.destination, accessToken: token, expiresAt: '2026-11-26T12:10:00Z' })); }
    else {
      assert.equal(pending, true, 'Pending transaction commits before remote callback');
      assert.equal(incoming.headers.authorization, `Bearer ${token}`);
      const callback = await handler(jsonRequest('socialhero/capabilities', null, 'GET', true)); assert.equal(callback.status, 200); assert.equal((await callback.json()).credentialState, 'pending');
      outgoing.end(JSON.stringify({ connectionId: ids.connection, status: 'verified' }));
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const local = `http://127.0.0.1:${server.address().port}`;
  const f = fixture(async (action, input) => {
    if (action === 'pair_begin') { assert.equal(input.allowDraft, true); assert.equal(input.allowPublish, true); context = { attemptId: input.attemptId, code, accessToken: null, connectionId: null, site, expiresAt: '2026-11-26T12:10:00Z' }; return context; }
    if (action === 'pair_context') return context;
    if (action === 'pair_pending') { pending = true; context = { ...context, code: null, accessToken: input.accessToken, connectionId: input.connectionId }; return connection('pending'); }
    if (action === 'capabilities') return caps(active ? 'active' : 'pending');
    if (action === 'pair_activate') { active = true; context.accessToken = null; return connection(); }
    throw new Error(action);
  }, { pairingTransport: async request => { const response = await fetch(new URL(request.url.pathname, local), { method: 'POST', headers: request.headers, body: request.body }); return { status: response.status, body: new Uint8Array(await response.arrayBuffer()) }; } });
  handler = f.handler;
  try {
    const response = await handler(jsonRequest('admin/connection/pair', { code, allowDraft: true, allowPublish: true }));
    assert.equal(response.status, 200); const text = await response.text(); assert.equal(JSON.parse(text).status, 'active'); assert.ok(!text.includes(token) && !text.includes(code));
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.ok(f.calls.filter(call => call.dispatcher === 'blog_admin').every(call => call.user === userJwt));
    assert.ok(f.calls.filter(call => call.dispatcher === 'blog_connector').every(call => call.user === null && /^[a-f0-9]{64}$/.test(call.p_token_hash)));
  } finally { await new Promise(resolve => server.close(resolve)); }
});
test('lost verification response retains pending attempt; explicit check resumes without another claim', async () => {
  let context, verifyCalls = 0, claimCalls = 0, failed;
  const f = fixture(async (action, input) => {
    if (action === 'pair_begin') { context = { attemptId: input.attemptId, code, accessToken: null, connectionId: null, site }; return context; }
    if (action === 'pair_context') return context;
    if (action === 'pair_pending') { context = { ...context, ...input }; return connection('pending'); }
    if (action === 'pair_fail') { failed = input; return connection('pending'); }
    if (action === 'pair_resume') return { attemptId: context.attemptId, site };
    if (action === 'pair_activate') return connection();
    throw new Error(action);
  }, { pairingTransport: async request => {
    if (request.url.pathname.endsWith('/claim')) { claimCalls++; return { status: 200, body: new TextEncoder().encode(JSON.stringify({ connectionId: ids.connection, destinationId: ids.destination, accessToken: token, expiresAt: '2026-11-26T12:10:00Z' })) }; }
    if (++verifyCalls === 1) throw new Error('synthetic lost response');
    return { status: 200, body: new TextEncoder().encode(JSON.stringify({ connectionId: ids.connection, status: 'verified' })) };
  } });
  const unavailable = await f.handler(jsonRequest('admin/connection/pair', { code, allowDraft: true, allowPublish: false })); assert.equal(unavailable.status, 503); assert.match((await unavailable.json()).message, /SocialHero.*niet bereikbaar.*hervatten/u);
  assert.equal(failed.definitive, false); assert.equal(claimCalls, 1);
  assert.equal((await f.handler(jsonRequest('admin/connection/check', {}))).status, 200); assert.equal(claimCalls, 1); assert.equal(verifyCalls, 2);
});
test('media retries reconcile an immutable upload committed before network failure, finalize only after hash readback', async () => {
  let stored, finalized = false;
  const f = fixture(async (action, input) => {
    if (action === 'capabilities') return caps('active');
    if (action === 'media_reserve') return { ...input, assetId: ids.asset, leaseId: ids.lease, complete: false, objectPath: `blog/${ids.asset}/${input.sha256}.png` };
    if (action === 'media_complete') { assert.ok(stored); finalized = true; return { assetId: ids.asset, mimeType: 'image/png', width: 2, height: 2 }; }
    throw new Error(action);
  }, { storage: { put: async (_path, bytes) => { stored = bytes; throw new Error('response lost after durable object write'); }, get: async () => { if (!stored) throw new Error('missing'); return stored; } } });
  const form = new FormData(); form.set('file', new File([PNG.sync.write({ width: 2, height: 2, data: Buffer.alloc(16, 255) })], 'synthetic.png', { type: 'image/png' }));
  const response = await f.handler(new Request('https://edge.invalid/blog-runtime/socialhero/media', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Idempotency-Key': 'same-media-operation' }, body: form }));
  assert.equal(response.status, 200); assert.equal(finalized, true); assert.deepEqual(await response.json(), { assetId: ids.asset, mimeType: 'image/png', width: 2, height: 2 });
  assert.ok(!JSON.stringify(f.calls.at(-1)).includes(token));
});
test('a generic 200 cannot confirm publication; delayed proof is retried through the authenticated worker', async () => {
  const claim = { publicationId: ids.publication, leaseId: ids.lease, postId: ids.post, revision: 2, publicUrl: `${site.origin}/blog/voorbeeld`, proof: 'p'.repeat(43), alreadyPromoted: false };
  let correct = false, confirmed = false, failed = 0, claims = 0;
  const status = () => ({ postId: ids.post, externalId: 'story-1', slug: 'voorbeeld', state: confirmed ? 'published' : 'publishing', revision: 2, draftRevision: 2, publishedRevision: confirmed ? 2 : null, previewUrl: null, publicUrl: null, publishedAt: null });
  const f = fixture(async action => {
    if (action === 'publish') return { status: status(), publicationId: ids.publication };
    if (action === 'publication_claim') return { claim: ++claims <= 2 ? claim : null };
    if (action === 'publication_promote') return claim;
    if (action === 'publication_confirm') { confirmed = true; return { published: true }; }
    if (action === 'publication_fail') { failed++; return { retry: true }; }
    if (action === 'get') return status();
    if (action === 'worker_verify') return { valid: true };
    if (action === 'cleanup') return {};
    throw new Error(action);
  }, { fetch: async (_url, init) => { assert.equal(init.redirect, 'manual'); assert.equal(init.cache, 'no-store'); return new Response(correct ? `<article data-blog-revision="${ids.post}:2" data-blog-proof="${claim.proof}">live</article>` : '<html><h1>General landing page</h1></html>', { headers: { 'Content-Type': 'text/html' } }); } });
  assert.equal((await f.handler(jsonRequest('socialhero/posts/story-1/publish', { revision: 2 }, 'POST', true))).status, 202);
  assert.equal(confirmed, false); assert.equal(failed, 1);
  correct = true;
  const worker = new Request('https://edge.invalid/blog-runtime/worker', { method: 'POST', headers: { 'x-fabelpad-timestamp': '1795694400', 'x-fabelpad-nonce': ids.attempt, 'x-fabelpad-signature': 'a'.repeat(64) }, body: '{}' });
  assert.equal((await f.handler(worker)).status, 200); assert.equal(confirmed, true);
  const invalid = await f.handler(new Request('https://edge.invalid/blog-runtime/worker', { method: 'POST', body: '{}' })); assert.equal(invalid.status, 401);
});
test('publication proof ignores inactive examples, duplicates and older revisions', () => {
  const claim = { postId: ids.post, revision: 2, proof: 'p'.repeat(43) }, article = `<article data-blog-revision="${ids.post}:2" data-blog-proof="${claim.proof}"></article>`;
  assert.equal(verifyBlogPublicationHtml(article, claim), true);
  for (const html of [`<!-- ${article} -->`, `<template>${article}</template>`, `<script>${article}</script>`, article + article, article.replace(':2', ':1'), article.replace(claim.proof, 'q'.repeat(43))]) assert.equal(verifyBlogPublicationHtml(html, claim), false);
});
test('Edge REST client isolates user and machine authority and never returns raw SQL errors', async () => {
  const requests = [], environment = { SUPABASE_URL: 'https://tlwfpivafcokcjyjwgmq.supabase.co', SUPABASE_ANON_KEY: 'synthetic-public', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service', FABELPAD_APP_ORIGIN: site.origin, FABELPAD_ENVIRONMENT: 'staging' };
  const backend = createBlogSupabaseDependencies(environment, async (url, init) => { requests.push({ url, init }); return Response.json({ ok: true }); });
  await backend.userClient(userJwt).rpc('blog_admin', { p_action: 'list' });
  await backend.serviceClient.rpc('blog_connector', { p_token_hash: 'a'.repeat(64), p_action: 'capabilities' });
  await backend.userClient(userJwt).rpc('blog_service', {}); await backend.serviceClient.rpc('blog_admin', {});
  assert.equal(requests.length, 2); assert.equal(requests[0].init.headers.Authorization, `Bearer ${userJwt}`); assert.equal(requests[0].init.headers.apikey, 'synthetic-public'); assert.equal(requests[1].init.headers.Authorization, 'Bearer synthetic-service');
  const f = fixture(async () => { throw new Error('SQL private_table secret token=' + token); });
  const result = await f.handler(jsonRequest('admin/posts', null, 'GET')); assert.equal(result.status, 503); assert.ok(!(await result.text()).includes(token));
});
test('factory uses the configured author and blog path; opaque bearers may exceed 43 characters and logs omit identifiers and secrets', async () => {
  const logs = [], customSite = { ...site, siteName: 'Boekenhuis', blogPath: '/artikelen' };
  const claim = { publicationId: ids.publication, leaseId: ids.lease, postId: ids.post, revision: 1, publicUrl: `${site.origin}/artikelen/voorbeeld`, proof: 'p'.repeat(43), alreadyPromoted: false };
  let written = false, confirmed = false;
  const f = fixture(async (action, input) => {
    if (action === 'capabilities') return { ...caps('active'), authors: [{ id: ids.asset, name: 'Ander' }, { id: ids.destination, name: 'Boekenhuis' }] };
    if (action === 'get') { if (!written) throw new Error('POST_NOT_FOUND'); return { postId: ids.post, slug: 'voorbeeld', revision: 1, state: confirmed ? 'published' : 'draft' }; }
    if (action === 'put') { assert.equal(input.document.authorId, ids.destination); written = true; return { postId: ids.post, slug: 'voorbeeld', revision: 1 }; }
    if (action === 'publish') return { publicationId: ids.publication };
    if (action === 'publication_claim') return { claim };
    if (action === 'publication_promote') return claim;
    if (action === 'publication_confirm') { confirmed = true; return { published: true }; }
    throw new Error(action);
  }, { site: customSite, log: entry => logs.push(entry), fetch: async url => { assert.equal(new URL(url).pathname, '/artikelen/voorbeeld'); return new Response(`<article data-blog-revision="${ids.post}:1" data-blog-proof="${claim.proof}"></article>`, { headers: { 'Content-Type': 'text/html' } }); } });
  const put = new Request('https://edge.invalid/blog-runtime/socialhero/posts/private-external-id?token=never-log', { method: 'PUT', headers: { Authorization: `Bearer ${'l'.repeat(1024)}`, 'Content-Type': 'application/json', 'Idempotency-Key': 'custom-1' }, body: JSON.stringify({ baseRevision: null, title: 'Voorbeeld', content: { format: 'markdown', body: 'Veilige tekst.' } }) });
  assert.equal((await f.handler(put)).status, 200);
  assert.equal((await f.handler(jsonRequest('socialhero/posts/private-external-id/publish', { revision: 1 }, 'POST', true))).status, 200);
  assert.equal(confirmed, true); assert.equal(logs.length, 2); assert.equal(logs[0].path, '/socialhero/posts/:id'); assert.equal(logs[1].path, '/socialhero/posts/:id/publish');
  assert.ok(!JSON.stringify(logs).includes('private-external-id') && !JSON.stringify(logs).includes('never-log') && !JSON.stringify(logs).includes('l'.repeat(43)));
  assert.throws(() => createBlogRuntimeHandler({ ...f.dependencies, site: { ...customSite, blogPath: '//evil.invalid' } }), error => error.code === 'CONFIGURATION_REQUIRED');
});
test('late asynchronous admin-upload failures use the same safe error envelope and structured request log', async () => {
  const logs = [];
  const f = fixture(async action => { if (action === 'connection_status') return connection(); throw new Error('PERMISSION_DENIED'); }, { log: entry => logs.push(entry) });
  const form = new FormData(); form.set('file', new File([PNG.sync.write({ width: 2, height: 2, data: Buffer.alloc(16, 255) })], 'synthetic.png', { type: 'image/png' }));
  const response = await f.handler(new Request('https://edge.invalid/blog-runtime/admin/media', { method: 'POST', headers: { Authorization: `Bearer ${userJwt}` }, body: form }));
  assert.equal(response.status, 403); const result = await response.json(); assert.equal(result.code, 'PERMISSION_DENIED');
  assert.deepEqual(logs, [{ requestId: result.requestId, method: 'POST', path: '/admin/media', status: 403, code: 'PERMISSION_DENIED' }]);
});
test.after(async () => { await rm(temporary, { recursive: true, force: true }); });
