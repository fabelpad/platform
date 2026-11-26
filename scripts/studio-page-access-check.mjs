import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compileSource } from './source-test-loader.mjs';

// Real SSR/Auth SDK and page-access policy, with isolated cookies and HTTP only.
const directory = await mkdtemp(join(tmpdir(), 'fabelpad-studio-page-'));
const beforeEnvironment = { ...process.env }, beforeFetch = globalThis.fetch;
const cookieKey = Symbol.for('fabelpad.studio.page.cookies'), beforeCookies = globalThis[cookieKey];
const parent = { id: '00000000-0000-4000-8000-000000000171', email: 'admin@example.test', email_confirmed_at: '2026-11-23T12:00:00Z', aud: 'authenticated', role: 'authenticated', is_anonymous: false, user_metadata: { role: 'admin' } };
const json = (body, status = 200) => Response.json(body, { status, headers: { 'X-Supabase-Api-Version': '2024-01-01' } });
const expiry = Math.floor(Date.now() / 1000) + 3600;
const jwt = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: parent.id, exp: expiry, aud: 'authenticated', role: 'authenticated' })).toString('base64url')}.synthetic-signature`;
let jar = new Map(), requests = [], lifecycle, admin = false, authFailure = false, roleFailure = false, checks = 0;
try {
  for (const name of Object.keys(process.env)) if (/^(NEXT_PUBLIC_|FABELPAD_|APP_URL$)/u.test(name)) delete process.env[name];
  Object.assign(process.env, { FABELPAD_DATA_MODE: 'supabase', FABELPAD_APP_ORIGIN: 'https://fabelpad.example.test', NEXT_PUBLIC_SUPABASE_URL: 'https://project.example.test', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_studio_test' });
  globalThis[cookieKey] = { getAll: () => [...jar].map(([name, value]) => ({ name, value })), set(name, value, options) { if (!value || options?.maxAge === 0) jar.delete(name); else jar.set(name, value); } };
  const fakeHeaders = pathToFileURL(join(directory, 'next-headers.mjs'));
  await writeFile(fakeHeaders, 'export async function cookies() { return globalThis[Symbol.for("fabelpad.studio.page.cookies")]; }\n');
  const accessURL = await compileSource(new URL('../lib/server/studioAccess.ts', import.meta.url), directory);
  const serverURL = await compileSource(new URL('../lib/supabase/server.ts', import.meta.url), directory);
  await writeFile(new URL(serverURL), (await readFile(new URL(serverURL), 'utf8')).replace("'next/headers'", JSON.stringify(fakeHeaders.href)).replace("'@supabase/ssr'", JSON.stringify(import.meta.resolve('@supabase/ssr'))));
  const { createSupabaseServerClient } = await import(serverURL);
  const { getStudioPageAccess } = await import(accessURL);
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init), url = new URL(request.url);
    assert.equal(url.origin, 'https://project.example.test', 'No actual account/provider requests');
    requests.push(url.pathname);
    if (url.pathname === '/auth/v1/verify') return json({ access_token: jwt, token_type: 'bearer', expires_in: 3600, expires_at: expiry, refresh_token: 'synthetic-studio-refresh', user: parent });
    if (url.pathname === '/auth/v1/user') return authFailure ? json({ message: 'synthetic-private-auth-failure' }, 503) : json(parent);
    if (url.pathname === '/rest/v1/rpc/get_account_lifecycle') { assert.equal(request.method, 'POST'); return json(lifecycle); }
    if (url.pathname === '/rest/v1/content_admins') {
      assert.equal(url.searchParams.get('user_id'), `eq.${parent.id}`);
      assert.equal(url.searchParams.get('select'), 'user_id');
      return roleFailure ? json({ message: 'synthetic-private-role-failure' }, 503) : json(admin ? { user_id: parent.id } : null);
    }
    throw new Error(`Unexpected isolated request: ${url.pathname}`);
  };
  const reset = async (authenticated = true) => {
    jar.clear(); requests = []; admin = false; authFailure = false; roleFailure = false;
    lifecycle = { state: 'active', termsVersion: 'current', privacyVersion: 'current', acceptedTermsVersion: 'current', shownPrivacyVersion: 'current', consents: [] };
    if (authenticated) { const client = await createSupabaseServerClient(); await client.auth.verifyOtp({ email: parent.email, token: '123456', type: 'email' }); requests = []; }
  };
  const expect = async value => { assert.deepEqual(await getStudioPageAccess(), value); checks++; };
  await reset(false); await expect({ allowed: false, reason: 'login' }); assert.deepEqual(requests, []);
  await reset(); await expect({ allowed: false, reason: 'role' }); assert.ok(requests.includes('/auth/v1/user'), 'Auth verifies every page request');
  admin = true; await expect({ allowed: true });
  admin = false; await expect({ allowed: false, reason: 'role' }); // Revocation must affect the next page, without a server cache.
  for (const state of ['onboarding', 'deletion_pending', 'deleting']) {
    await reset(); admin = true; lifecycle.state = state;
    await expect({ allowed: false, reason: 'account' }); assert.ok(!requests.includes('/rest/v1/content_admins'));
  }
  await reset(); admin = true; lifecycle.acceptedTermsVersion = 'older'; await expect({ allowed: false, reason: 'account' });
  await reset(); authFailure = true; await expect({ allowed: false, reason: 'unavailable' }); assert.ok(!requests.includes('/rest/v1/rpc/get_account_lifecycle'));
  await reset(); roleFailure = true; await expect({ allowed: false, reason: 'unavailable' });
  process.env.FABELPAD_DATA_MODE = 'local'; delete process.env.NEXT_PUBLIC_SUPABASE_URL; delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY; delete process.env.FABELPAD_APP_ORIGIN; await expect({ allowed: true });
  process.env.FABELPAD_DATA_MODE = 'supabase'; delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  await expect({ allowed: false, reason: 'unavailable' });
  for (const route of ['', 'overzicht', 'email', 'email/templates', 'privacy', 'premium', 'betalingen', 'voorlezen', 'blog', 'integraties/socialhero']) {
    const page = await readFile(new URL(`../app/studio/${route ? `${route}/` : ''}page.tsx`, import.meta.url), 'utf8');
    assert.ok(page.includes(`<StudioPageAccess returnTo="/studio${route ? `/${route}` : ''}">`), `Direct route ${route} needs the server guard`);
  }
  const editPage = await readFile(new URL('../app/studio/blog/[postId]/page.tsx', import.meta.url), 'utf8');
  assert.ok(editPage.includes('<StudioPageAccess returnTo={`/studio/blog/${postId}`}>'));
  const previewPage = await readFile(new URL('../app/studio/blog/[postId]/preview/page.tsx', import.meta.url), 'utf8');
  assert.ok(previewPage.indexOf('await getStudioPageAccess()') < previewPage.indexOf("client.rpc('blog_admin'"), 'Draft bytes must be fetched only after the verified admin gate');
  const wrapper = await readFile(new URL('../src/StudioPageAccess.tsx', import.meta.url), 'utf8');
  assert.ok(wrapper.indexOf('await connection();') < wrapper.indexOf('await getStudioPageAccess();'), 'Account decisions must run after the request-time boundary');
  console.log(`Studio-paginatoegang: ${checks} serverautorisatiechecks en alle 10 vaste directe routes groen.`);
} finally {
  globalThis.fetch = beforeFetch;
  if (beforeCookies === undefined) delete globalThis[cookieKey]; else globalThis[cookieKey] = beforeCookies;
  for (const name of Object.keys(process.env)) if (!(name in beforeEnvironment)) delete process.env[name];
  Object.assign(process.env, beforeEnvironment);
  await rm(directory, { recursive: true, force: true });
}
