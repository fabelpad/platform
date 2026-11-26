import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { PNG } from 'pngjs';
import { compileSource } from '../source-test-loader.mjs';
import { blogDatabaseFixture } from './database-fixture.mjs';

const temporary = await mkdtemp(path.join(tmpdir(), 'fabelpad-blog-runtime-database-'));
await symlink(new URL('../../node_modules', import.meta.url).pathname, path.join(temporary, 'node_modules'));
const { createBlogRuntimeHandler } = await import(await compileSource(new URL('../../lib/blog/runtime.ts', import.meta.url), temporary));
const jwt = 'eyJhbGciOiJIUzI1NiJ9.e30.synthetic';
const token = 't'.repeat(43), code = 'c'.repeat(43);
test('real HTTP controller and real SQL agree on handshake recovery, immutable media, CAS, scope and publication proof', async t => {
  const f = await blogDatabaseFixture(), objects = new Map();
  let handler, queue = Promise.resolve(), verifyCalls = 0, claimCalls = 0, proveHtml = false, failAfterUpload = true;
  let withdrawOnUpload = false, connection, uploaded, remote;
  const connectionId = randomUUID(), destinationId = randomUUID();
  // Session setup and one RPC share a critical section: simultaneous callbacks
  // must not inherit another request's role/JWT in the in-process SQL fixture.
  const database = (role, operation) => {
    const next = queue.then(async () => { await f[role](); return operation(); });
    queue = next.catch(() => {}); return next;
  };
  const sql = (role, name, action, input = {}) => database(role, () => f.rpc(name, action, input));
  const client = user => ({ async rpc(name, parameters) {
    try {
      assert.ok(user ? name === 'blog_admin' : ['blog_public','blog_service','blog_connector'].includes(name));
      if (user) assert.equal(user, jwt);
      const data = await database(user ? 'admin' : 'service', async () => name === 'blog_connector'
        ? (await f.db.query('select public.blog_connector($1,$2,$3) result', [parameters.p_token_hash, parameters.p_action, parameters.p_input])).rows[0].result
        : f.rpc(name, parameters.p_action, parameters.p_input));
      return { data, error: null };
    } catch (error) { return { data: null, error: { message: error.message, code: error.code } }; }
  } });
  const site = await sql('anonymous', 'blog_public', 'site');
  const request = (route, value, method = 'POST', machine = false, key = 'operation-1') => new Request(`https://edge.invalid/blog-runtime/${route}`, {
    method, headers: { Authorization: `Bearer ${machine ? token : jwt}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: ['GET','HEAD'].includes(method) ? undefined : JSON.stringify(value),
  });
  const call = async (...args) => { const response = await handler(request(...args)); const body = await response.json(); return { response, body }; };
  const upload = (key = 'media-1') => {
    const form = new FormData(); form.set('file', new File([PNG.sync.write({ width: 2, height: 2, data: Buffer.alloc(16, 255) })], 'synthetic.png', { type: 'image/png' }));
    return handler(new Request('https://edge.invalid/blog-runtime/socialhero/media', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Idempotency-Key': key }, body: form }));
  };
  handler = createBlogRuntimeHandler({ site, userClient: client, serviceClient: client(null),
    pairingTransport: async request => {
      if (request.url.pathname.endsWith('/claim')) {
        claimCalls++;
        return { status: 200, body: new TextEncoder().encode(JSON.stringify({ connectionId, destinationId, accessToken: token, expiresAt: new Date(Date.now()+9*60*1000).toISOString() })) };
      }
      const pending = await call('socialhero/capabilities', null, 'GET', true);
      assert.equal(pending.response.status, 200); assert.equal(pending.body.credentialState, 'pending');
      if (++verifyCalls === 1) throw new Error('synthetic response lost after remote verification');
      return { status: 200, body: new TextEncoder().encode(JSON.stringify({ connectionId, status: 'verified' })) };
    },
    storage: {
      get: async objectPath => { if (!objects.has(objectPath)) throw new Error('missing'); return new Uint8Array(objects.get(objectPath)); },
      put: async (objectPath, bytes) => {
        assert.equal(objects.has(objectPath), false, 'Immutable path is uploaded only once'); objects.set(objectPath, new Uint8Array(bytes));
        if (withdrawOnUpload) await sql('admin', 'blog_admin', 'connection_policy', { connectionId, allowDraft: false, allowPublish: false });
        if (failAfterUpload) { failAfterUpload = false; throw new Error('synthetic response lost after immutable object write'); }
      },
    },
    fetch: async (url, init) => {
      assert.equal(new URL(url).origin, site.origin); assert.equal(init.redirect, 'manual');
      const page = await sql('anonymous', 'blog_public', 'post', { slug: new URL(url).pathname.split('/').at(-1) });
      const markup = proveHtml && page.article && page.verification
        ? `<article data-blog-revision="${page.article.postId}:${page.article.revision}" data-blog-proof="${page.verification.proof}">Live article</article>`
        : '<html><h1>Generic website response</h1></html>';
      return new Response(markup, { headers: { 'Content-Type': 'text/html' } });
    },
  });
  try {
    await t.test('pending commit precedes callback; a lost response resumes from Vault and activates exactly once', async () => {
      const failed = await call('admin/connection/pair', { code, allowDraft: true, allowPublish: true });
      assert.equal(failed.response.status, 503); assert.equal(claimCalls, 1);
      const checked = await call('admin/connection/check', {}); assert.equal(checked.response.status, 200, JSON.stringify(checked.body));
      connection = checked.body; assert.equal(connection.status, 'active'); assert.equal(connection.allowPublish, true);
      assert.equal(claimCalls, 1); assert.equal(verifyCalls, 2);
      assert.ok(!JSON.stringify(connection).includes(token) && !JSON.stringify(connection).includes(code));
      const caps = await call('socialhero/capabilities', null, 'GET', true); assert.equal(caps.body.credentialState, 'active');
      const activeCheck = await call('admin/connection/check', {}); assert.equal(activeCheck.response.status, 200); assert.ok(activeCheck.body.lastCheckedAt); assert.equal(verifyCalls, 2, 'An active local check does not invent a remote health request');
      await database('owner', async () => assert.equal((await f.db.query("select count(*)::int n from vault.secrets where name like 'fabelpad_blog_pair_%'")).rows[0].n, 0));
    });
    await t.test('real decoded bytes survive an uncertain upload once, stay private, and complete replay returns the same asset', async () => {
      const first = await upload(); assert.equal(first.status, 200); uploaded = await first.json();
      const replay = await upload(); assert.equal(replay.status, 200); assert.deepEqual(await replay.json(), uploaded); assert.equal(objects.size, 1);
      const privateBytes = await handler(request(`admin/media/${uploaded.assetId}`, null, 'GET')); assert.equal(privateBytes.status, 200); assert.equal(privateBytes.headers.get('content-type'), 'image/png');
      const publicBytes = await handler(request(`public/media/${uploaded.assetId}`, null, 'GET')); assert.equal(publicBytes.status, 404);
    });
    await t.test('Markdown uses the same JSON revision service; immutable replay, local CAS and slug retention cross the HTTP boundary', async () => {
      const input = { baseRevision: null, type: 'blog', locale: 'nl-NL', title: 'Samen lezen', content: { format: 'markdown', body: '## Een begin\n\nEen **veilige** tekst.' }, hero: { assetId: uploaded.assetId, alt: 'Samen lezen' } };
      let result = await call('socialhero/posts/remote-1', input, 'PUT', true, 'draft-1'); assert.equal(result.response.status, 200); remote = result.body;
      assert.equal(remote.slug, 'samen-lezen'); assert.equal(remote.revision, 1);
      const replay = await call('socialhero/posts/remote-1', input, 'PUT', true, 'draft-1'); assert.deepEqual(replay.body, remote);
      const local = await call(`admin/posts/${remote.postId}`, null, 'GET'); assert.equal(local.body.document.content.type, 'doc');
      result = await call(`admin/posts/${remote.postId}`, { baseRevision: 1, document: { ...local.body.document, title: 'Lokale bewerking' } }, 'PUT'); assert.equal(result.response.status, 200); assert.equal(result.body.revision, 2);
      const conflict = await call('socialhero/posts/remote-1', { ...input, baseRevision: 1, title: 'Verouderd' }, 'PUT', true, 'draft-2'); assert.equal(conflict.response.status, 409); assert.equal(conflict.body.code, 'REVISION_CONFLICT');
      result = await call('socialhero/posts/remote-1', { ...input, baseRevision: 2, title: 'Nieuwe titel' }, 'PUT', true, 'draft-3'); assert.equal(result.response.status, 200); remote = result.body; assert.equal(remote.slug, 'samen-lezen'); assert.equal(remote.revision, 3);
    });
    await t.test('publication scope is current; a generic HTTP 200 remains publishing until a signed durable worker sees the exact public proof', async () => {
      let result = await call('admin/connection', { connectionId, allowDraft: true, allowPublish: false }, 'PATCH'); assert.equal(result.response.status, 200);
      result = await call('socialhero/posts/remote-1/publish', { revision: remote.revision }, 'POST', true, 'publish-denied'); assert.equal(result.response.status, 403); assert.equal(result.body.code, 'PERMISSION_DENIED');
      await call('admin/connection', { connectionId, allowDraft: true, allowPublish: true }, 'PATCH');
      result = await call('socialhero/posts/remote-1/publish', { revision: remote.revision }, 'POST', true, 'publish-1'); assert.equal(result.response.status, 202); assert.equal(result.body.state, 'publishing');
      const editor = await call(`admin/posts/${remote.postId}`, null, 'GET'); assert.equal(editor.body.publication.lastError, 'PUBLICATION_NOT_VISIBLE');
      const liveBytes = await handler(request(`public/media/${uploaded.assetId}`, null, 'GET')); assert.equal(liveBytes.status, 200);
      await database('owner', async () => {
        await f.db.query('update private.blog_publications set next_attempt_at=clock_timestamp() where post_id=$1', [remote.postId]);
        await f.db.exec('create table if not exists storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[])');
        await f.db.exec('select private.configure_blog_worker_schedule()'); await f.db.exec('select private.invoke_blog_worker()');
      });
      const scheduled = await database('owner', async () => (await f.db.query("select * from net.http_request_queue where url like '%blog-runtime/worker' order by id desc limit 1")).rows[0]);
      proveHtml = true;
      const worker = await handler(new Request('https://edge.invalid/blog-runtime/worker', { method: 'POST', headers: scheduled.headers, body: '{}' }));
      assert.equal(worker.status, 200); assert.equal((await worker.json()).completed, 1);
      result = await call('socialhero/posts/remote-1', null, 'GET', true); assert.equal(result.body.state, 'published'); assert.equal(result.body.publishedRevision, remote.revision);
      const replay = await handler(new Request('https://edge.invalid/blog-runtime/worker', { method: 'POST', headers: scheduled.headers, body: '{}' })); assert.equal(replay.status, 401);
    });
    await t.test('policy withdrawal during an actual storage upload is rechecked before the real finalizer marks bytes ready', async () => {
      withdrawOnUpload = true;
      const response = await upload('media-withdrawn'); assert.equal(response.status, 403); assert.equal((await response.json()).code, 'PERMISSION_DENIED');
      await database('owner', async () => assert.equal((await f.db.query("select count(*)::int n from private.blog_media where state='ready'")).rows[0].n, 1));
    });
  } finally { await queue; await f.db.close(); }
});
test.after(async () => { await rm(temporary, { recursive: true, force: true }); });
