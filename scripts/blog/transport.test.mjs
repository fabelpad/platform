import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { compileSource } from '../source-test-loader.mjs';
const temporary = await mkdtemp(path.join(tmpdir(), 'fabelpad-blog-transport-'));
const environment = { ...process.env }, originalFetch = globalThis.fetch;
for (const key of Object.keys(process.env)) if (/^(NEXT_PUBLIC_|FABELPAD_|APP_URL$)/u.test(key)) delete process.env[key];
Object.assign(process.env, { FABELPAD_DATA_MODE: 'supabase', FABELPAD_APP_ORIGIN: 'https://staging.fabelpad.nl', NEXT_PUBLIC_SUPABASE_URL: 'https://tlwfpivafcokcjyjwgmq.supabase.co', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_blog_transport_test' });
const context = Symbol.for('fabelpad.blog.transport.test');
const server = await compileSource(new URL('../../lib/supabase/server.ts', import.meta.url), temporary);
await writeFile(new URL(server), `const state=()=>globalThis[Symbol.for('fabelpad.blog.transport.test')];export async function createSupabaseRequestClient(){return state().client;}export async function getVerifiedParent(){return state().parent;}export async function isContentAdmin(_client,id){return state().admins.has(id);}`);
const parent = await compileSource(new URL('../../lib/server/parent.ts', import.meta.url), temporary);
await writeFile(new URL(parent), `export async function getParentAccountStatus(){return globalThis[Symbol.for('fabelpad.blog.transport.test')].account;}`);
const { blogApi } = await import(await compileSource(new URL('../../lib/server/blog.ts', import.meta.url), temporary));
after(async () => { globalThis.fetch = originalFetch; delete globalThis[context]; for (const key of Object.keys(process.env)) if (!(key in environment)) delete process.env[key]; Object.assign(process.env, environment); await rm(temporary, { recursive: true, force: true }); });
const actor = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222';
const token = 'eyJhbGciOiJIUzI1NiJ9.e30.synthetic-signature';
let state, outgoing, upstream;
function reset() {
  state = { parent: { id: actor }, admins: new Set([actor]), account: { state: 'active', termsVersion: 'terms', acceptedTermsVersion: 'terms' }, client: { auth: { getSession: async () => ({ data: { session: { access_token: token } } }) } } };
  globalThis[context] = state; outgoing = [];
  upstream = () => Response.json({ state: 'publishing', revision: 4 }, { status: 202, headers: { 'Set-Cookie': 'do-not-forward=secret', 'Location': 'https://evil.invalid/', 'Retry-After': '2' } });
  globalThis.fetch = async (input, options) => { const request = new Request(input, options); outgoing.push({ request, options }); assert.equal(new URL(request.url).origin, 'https://tlwfpivafcokcjyjwgmq.supabase.co'); return upstream(); };
}
function request(method, headers = {}, body) { return new Request('https://staging.fabelpad.nl/api/admin/blog', { method, headers: { 'X-Fabelpad-Parent': actor, ...(method === 'GET' ? {} : { Origin: 'https://staging.fabelpad.nl', 'Content-Type': 'application/json' }), ...headers }, ...(body === undefined ? {} : { body }) }); }
async function failure(response, status, code) { assert.equal(response.status, status); const value = await response.json(); assert.equal(value.code, code); assert.match(value.requestId, /^[a-f0-9-]{36}$/); assert.equal(response.headers.get('cache-control'), 'private, no-store'); assert.ok(!JSON.stringify(value).includes(token)); }

test('admin transport requires the verified actor, active lifecycle and trusted admin grant before contacting Edge', async () => {
  reset(); state.parent = null; await failure(await blogApi(request('GET'), 'admin', []), 401, 'INVALID_CREDENTIAL');
  reset(); await failure(await blogApi(request('GET', { 'X-Fabelpad-Parent': other }), 'admin', []), 401, 'ACCOUNT_CHANGED');
  reset(); state.account.state = 'suspended'; await failure(await blogApi(request('GET'), 'admin', []), 403, 'PERMISSION_DENIED');
  reset(); state.account.acceptedTermsVersion = 'old'; await failure(await blogApi(request('GET'), 'admin', []), 403, 'PERMISSION_DENIED');
  reset(); state.admins.clear(); await failure(await blogApi(request('GET'), 'admin', []), 403, 'PERMISSION_DENIED');
  assert.equal(outgoing.length, 0);
  reset(); await failure(await blogApi(request('POST', { Origin: 'https://evil.invalid' }, '{}'), 'admin', []), 403, 'PERMISSION_DENIED'); assert.equal(outgoing.length, 0);
});

test('only fixed method/path pairs are forwarded; bearer, actor and idempotency stay in headers', async () => {
  reset(); const result = await blogApi(request('POST', { 'Idempotency-Key': 'revision-4' }, '{"revision":4}'), 'admin', ['posts', actor, 'publish']); assert.equal(result.status, 202);
  const { request: forwarded, options } = outgoing[0]; assert.equal(new URL(forwarded.url).pathname, `/functions/v1/blog-runtime/admin/posts/${actor}/publish`); assert.equal(forwarded.headers.get('authorization'), `Bearer ${token}`); assert.equal(forwarded.headers.get('idempotency-key'), 'revision-4'); assert.equal(forwarded.headers.get('x-fabelpad-parent'), actor); assert.equal(await forwarded.text(), '{"revision":4}'); assert.equal(options.redirect, 'error'); assert.equal(options.cache, 'no-store');
  assert.equal(result.headers.get('set-cookie'), null); assert.equal(result.headers.get('location'), null); assert.equal(result.headers.get('retry-after'), '2'); assert.equal(result.headers.get('x-robots-tag'), 'noindex, nofollow'); assert.equal(result.headers.get('cache-control'), 'private, no-store');
  for (const [method, path] of [['POST',['capabilities']], ['GET',['posts', 'x', 'publish']], ['DELETE',['posts', 'x']], ['GET',['..','capabilities']], ['PUT',['connection']]]) await failure(await blogApi(request(method, { Authorization: 'Bearer ' + 't'.repeat(43) }), 'socialhero', path), 404, 'NOT_FOUND');
  assert.equal(outgoing.length, 1);
});

test('machine requests cannot use cookie auth or a query-selected destination; public media cannot fetch a private path', async () => {
  reset(); await failure(await blogApi(request('GET'), 'socialhero', ['capabilities']), 401, 'INVALID_CREDENTIAL'); assert.equal(outgoing.length, 0);
  const machine = new Request('https://staging.fabelpad.nl/api/socialhero/v1/capabilities?destinationId=foreign&token=bad', { headers: { Authorization: 'Bearer ' + 't'.repeat(43) } });
  await blogApi(machine, 'socialhero', ['capabilities']); assert.equal(new URL(outgoing[0].request.url).search, ''); assert.equal(outgoing[0].request.headers.get('x-fabelpad-parent'), null);
  reset(); upstream = () => new Response('synthetic-image', { headers: { 'Content-Type': 'image/png' } }); const image = await blogApi(request('GET', { Authorization: 'Bearer ' + token }), 'media', [actor]); assert.equal(image.status, 200); assert.equal(image.headers.get('content-type'), 'image/png'); assert.equal(outgoing[0].request.headers.get('authorization'), null); assert.equal(image.headers.get('cache-control'), 'public, max-age=300, must-revalidate');
  await failure(await blogApi(request('GET'), 'media', ['private',actor]), 404, 'NOT_FOUND');
});

test('bounded upload and JSON bodies fail safely; network errors disclose no provider or credential data', async () => {
  reset(); await failure(await blogApi(request('POST', {}, 'x'.repeat(320 * 1024 + 1)), 'admin', []), 413, 'PAYLOAD_TOO_LARGE'); assert.equal(outgoing.length, 0);
  reset(); await failure(await blogApi(request('POST', { 'Content-Length': String(9 * 1024 * 1024) }, 'x'), 'admin', ['media']), 413, 'PAYLOAD_TOO_LARGE'); assert.equal(outgoing.length, 0);
  reset(); globalThis.fetch = async () => { throw new Error('internal: service role ' + token); }; await failure(await blogApi(request('GET'), 'admin', []), 503, 'SERVICE_UNAVAILABLE');
});
