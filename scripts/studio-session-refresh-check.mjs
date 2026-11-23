import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServerClient } from '@supabase/ssr';
import { AsyncLocalStorage } from 'node:async_hooks';
// Next normally installs this runtime global before loading its server modules.
const previousAsyncLocalStorage = globalThis.AsyncLocalStorage;
globalThis.AsyncLocalStorage = AsyncLocalStorage;
const { NextRequest } = await import('next/server.js');
const { default: nextTesting } = await import('next/experimental/testing/server.js');
// This pinned Next release still exports the pre-rename testing helper.
const doesProxyMatch = nextTesting.unstable_doesMiddlewareMatch;
import { compileSource } from './source-test-loader.mjs';

// Actual SSR/Auth SDK, Next request/response cookies and read-only RSC client;
// all HTTP is synthetic and pinned to this test's own example project.
const directory = await mkdtemp(join(tmpdir(), 'fabelpad-studio-refresh-'));
const beforeEnvironment = { ...process.env }, beforeFetch = globalThis.fetch, beforeConsoleError = console.error, beforeConsoleWarn = console.warn;
const cookieKey = Symbol.for('fabelpad.studio.refresh.cookies'), previousCookies = globalThis[cookieKey];
const api = 'https://refreshproject.example.test', app = 'https://fabelpad.example.test';
const key = 'sb_publishable_synthetic_studio_refresh_test';
const parent = { id: '00000000-0000-4000-8000-000000000181', email: 'admin@example.test', email_confirmed_at: '2026-11-23T12:00:00Z', aud: 'authenticated', role: 'authenticated', is_anonymous: false, user_metadata: {} };
const makeJwt = expiry => `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: parent.id, exp: expiry, aud: 'authenticated', role: 'authenticated' })).toString('base64url')}.synthetic-signature`;
const expiredAt = Math.floor(Date.now() / 1000) - 60, freshAt = Math.floor(Date.now() / 1000) + 3600;
const expiredJwt = makeJwt(expiredAt), freshJwt = makeJwt(freshAt);
const session = (expired, large = false) => ({ access_token: expired ? expiredJwt : freshJwt, token_type: 'bearer', expires_in: expired ? -60 : 3600, expires_at: expired ? expiredAt : freshAt, refresh_token: expired ? 'synthetic-old-refresh' : 'synthetic-rotated-refresh', user: large ? { ...parent, user_metadata: { full_name: 'x'.repeat(9000) } } : parent });
const json = (body, status = 200) => Response.json(body, { status, headers: { 'X-Supabase-Api-Version': '2024-01-01' } });
let expires = true, largeCookie = false, rejectedRefresh = false, userUnavailable = false, requests = [], refreshes = 0, checks = 0;
const jar = new Map();
function store(changes) { for (const { name, value, options } of changes) { if (!value || options?.maxAge === 0) jar.delete(name); else jar.set(name, value); } }
const cookieHeader = () => [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
const request = path => new NextRequest(`${app}${path}`, { headers: { cookie: cookieHeader() } });
try {
  for (const name of Object.keys(process.env)) if (/^(NEXT_PUBLIC_|FABELPAD_|APP_URL$)/u.test(name)) delete process.env[name];
  Object.assign(process.env, { FABELPAD_DATA_MODE: 'supabase', FABELPAD_APP_ORIGIN: app, NEXT_PUBLIC_SUPABASE_URL: api, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key });
  const proxyURL = await compileSource(new URL('../proxy.ts', import.meta.url), directory);
  const refreshURL = await compileSource(new URL('../lib/supabase/proxy.ts', import.meta.url), directory);
  const serverURL = await compileSource(new URL('../lib/supabase/server.ts', import.meta.url), directory);
  const fakeHeaders = pathToFileURL(join(directory, 'next-headers.mjs'));
  await writeFile(fakeHeaders, 'export async function cookies() { return globalThis[Symbol.for("fabelpad.studio.refresh.cookies")]; }\n');
  for (const source of [refreshURL, serverURL]) {
    let code = await readFile(new URL(source), 'utf8');
    code = code.replace("'@supabase/ssr'", JSON.stringify(import.meta.resolve('@supabase/ssr'))).replace("'next/server'", JSON.stringify(import.meta.resolve('next/server.js'))).replace("'next/headers'", JSON.stringify(fakeHeaders.href));
    await writeFile(new URL(source), code);
  }
  const { proxy, config } = await import(proxyURL);
  const { createSupabasePageClient } = await import(serverURL);
  const expectedFailure = args => args.some(value => value?.message === 'Synthetic refresh rejected');
  console.error = (...args) => { if (!expectedFailure(args)) beforeConsoleError(...args); };
  console.warn = (...args) => { if (!expectedFailure(args)) beforeConsoleWarn(...args); };
  globalThis.fetch = async (input, init) => {
    const req = new Request(input, init), url = new URL(req.url);
    assert.equal(url.origin, api, 'No live Auth/provider traffic');
    requests.push(url.pathname);
    if (url.pathname === '/auth/v1/verify') return json(session(expires, largeCookie));
    if (url.pathname === '/auth/v1/token') {
      refreshes++;
      assert.equal(url.searchParams.get('grant_type'), 'refresh_token');
      assert.equal((await req.json()).refresh_token, 'synthetic-old-refresh');
      return rejectedRefresh ? json({ code: 'refresh_token_not_found', message: 'Synthetic refresh rejected' }, 400) : json(session(false));
    }
    if (url.pathname === '/auth/v1/user') {
      if (userUnavailable) return json({ message: 'Synthetic Auth outage' }, 503);
      assert.equal(req.headers.get('authorization'), `Bearer ${freshJwt}`);
      return json(parent);
    }
    throw new Error(`Unexpected isolated request: ${url.pathname}`);
  };
  async function seed({ expired = true, large = false } = {}) {
    expires = expired; largeCookie = large; jar.clear(); requests = []; refreshes = 0; rejectedRefresh = false; userUnavailable = false;
    const client = createServerClient(api, key, { cookieOptions: { httpOnly: true, secure: true, sameSite: 'lax', path: '/' }, cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: store } });
    const result = await client.auth.verifyOtp({ email: parent.email, token: '123456', type: 'email' });
    assert.equal(result.error, null); requests = [];
  }
  const notCached = response => { assert.match(response.headers.get('cache-control'), /private/); assert.match(response.headers.get('cache-control'), /no-store/); assert.equal(response.headers.get('pragma'), 'no-cache'); assert.equal(response.headers.get('expires'), '0'); };

  for (const path of ['/studio', '/studio/overzicht', '/studio/email/templates', '/studio/betalingen', '/studio/privacy', '/studio/premium']) { assert.equal(doesProxyMatch({ config, nextConfig: {}, url: `${app}${path}` }), true); checks++; }
  for (const path of ['/api/auth/session', '/api/admin/email', '/api/billing/offer', '/gezin', '/profiel/account', '/studio-other', '/_next/static/chunk.js', '/art/station.webp']) { assert.equal(doesProxyMatch({ config, nextConfig: {}, url: `${app}${path}` }), false); checks++; }

  await seed({ large: true });
  const staleNames = [...jar.keys()]; assert.ok(staleNames.length >= 3, 'Exercise real chunked-cookie cleanup');
  const incoming = request('/studio/email');
  const refreshed = await proxy(incoming);
  assert.equal(refreshes, 1); notCached(refreshed);
  assert.equal(refreshed.headers.get('x-middleware-next'), '1');
  assert.equal(refreshed.headers.get('x-middleware-request-cookie'), incoming.headers.get('cookie'), 'RSC receives the refreshed cookie, not the original request');
  const changes = refreshed.cookies.getAll();
  assert.ok(changes.some(cookie => staleNames.includes(cookie.name) && cookie.maxAge === 0), 'Delete stale chunks in the browser');
  const rotated = changes.filter(cookie => cookie.value && cookie.maxAge !== 0);
  assert.equal(rotated.length, 1);
  assert.equal(rotated[0].httpOnly, true); assert.equal(rotated[0].secure, true); assert.equal(rotated[0].sameSite, 'lax'); assert.equal(rotated[0].path, '/');
  assert.ok(![...incoming.cookies.getAll()].some(cookie => staleNames.includes(cookie.name)), 'RSC cannot keep obsolete chunks');
  // The actual RSC adapter must consume the forwarded session without another
  // refresh or attempting a forbidden Server Component cookie write.
  globalThis[cookieKey] = { getAll: () => incoming.cookies.getAll(), set() { assert.fail('RSC cookie writes are forbidden'); } };
  const readonly = await createSupabasePageClient();
  const verified = await readonly.auth.getUser(); assert.equal(verified.data.user?.id, parent.id); assert.equal(verified.error, null); assert.equal(refreshes, 1);
  store(changes.map(cookie => ({ ...cookie, options: cookie })));
  requests = []; const next = await proxy(request('/studio/privacy'));
  assert.equal(refreshes, 1, 'Next browser navigation uses persisted rotation'); assert.deepEqual(requests, ['/auth/v1/user']); assert.equal(next.cookies.getAll().length, 0); notCached(next); checks++;

  await seed(); rejectedRefresh = true;
  const invalidRequest = request('/studio'); const invalid = await proxy(invalidRequest);
  assert.equal(refreshes, 1); assert.ok(invalid.cookies.getAll().some(cookie => cookie.maxAge === 0)); assert.equal(invalidRequest.cookies.getAll().length, 0); notCached(invalid); checks++;

  await seed({ expired: false }); userUnavailable = true;
  const oldHeader = cookieHeader(), outage = await proxy(request('/studio'));
  assert.equal(outage.cookies.getAll().length, 0); assert.equal(cookieHeader(), oldHeader); assert.equal(refreshes, 0); notCached(outage); checks++;

  jar.clear(); requests = []; const anonymous = await proxy(request('/studio'));
  assert.deepEqual(requests, []); assert.equal(anonymous.cookies.getAll().length, 0); notCached(anonymous); checks++;
  process.env.FABELPAD_DATA_MODE = 'local'; delete process.env.NEXT_PUBLIC_SUPABASE_URL; delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  requests = []; const local = await proxy(request('/studio')); assert.deepEqual(requests, []); notCached(local); checks++;
  process.env.FABELPAD_DATA_MODE = 'supabase';
  const malformed = await proxy(request('/studio')); assert.equal(malformed.cookies.getAll().length, 0); notCached(malformed); checks++;
  console.log(`Studio-sessieverversing: ${checks} checks groen; echte SDK-cookie-rotatie/chunks, RSC-doorgifte, browserpersistentie, fouttoestanden en beperkte Next-matcher.`);
} finally {
  globalThis.fetch = beforeFetch; console.error = beforeConsoleError; console.warn = beforeConsoleWarn;
  if (previousAsyncLocalStorage === undefined) delete globalThis.AsyncLocalStorage; else globalThis.AsyncLocalStorage = previousAsyncLocalStorage;
  if (previousCookies === undefined) delete globalThis[cookieKey]; else globalThis[cookieKey] = previousCookies;
  for (const name of Object.keys(process.env)) if (!(name in beforeEnvironment)) delete process.env[name];
  Object.assign(process.env, beforeEnvironment);
  await rm(directory, { recursive: true, force: true });
}
