import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compileSource } from './source-test-loader.mjs';

// Execute actual Next route exports with the installed Supabase SSR/Auth SDK.
// Every outbound call is bound to this synthetic provider; no live cases or mail.
const root = new URL('../', import.meta.url);
const temporary = await mkdtemp(join(tmpdir(), 'fabelpad-privacy-admin-api-'));
const beforeEnvironment = { ...process.env }, beforeFetch = globalThis.fetch;
const cookieKey = Symbol.for('fabelpad.privacy.admin.api.cookies'), beforeCookies = globalThis[cookieKey];
const actor = { id: '00000000-0000-4000-8000-000000000181', email: 'operator@example.test', email_confirmed_at: '2026-11-22T12:00:00Z', aud: 'authenticated', role: 'authenticated', is_anonymous: false, user_metadata: { admin: true, role: 'admin' } };
const subject = '00000000-0000-4000-8000-000000000182', caseId = '00000000-0000-4000-8000-000000000183';
const active = { state: 'active', termsVersion: '2026-11-22', privacyVersion: '2026-11-22', acceptedTermsVersion: '2026-11-22', shownPrivacyVersion: '2026-11-22', lastActivityAt: '2026-11-22T12:00:00Z', deletionDeadline: null, consents: [] };
const json = (body, status = 200) => Response.json(body, { status, headers: { 'X-Supabase-Api-Version': '2024-01-01' } });
const expiry = Math.floor(Date.now() / 1000) + 3600;
const jwt = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: actor.id, exp: expiry, aud: 'authenticated', role: 'authenticated' })).toString('base64url')}.synthetic-signature`;
let jar = new Map(), requests = [], rpc, lifecycle = active, admin = true, roleFailure = false, checks = 0;
const request = ({ method = 'GET', body, headers = {}, query = '' } = {}) => new Request(`https://fabelpad.example.test/api/admin/privacy${query}`, { method, headers: { ...(method === 'GET' ? {} : { 'content-type': 'application/json', origin: 'https://fabelpad.example.test', 'X-Fabelpad-Parent': actor.id }), ...headers }, ...(method === 'GET' ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }) });
const caseRequests = () => requests.filter(item => /\/rpc\/(?:list|register|manage)_privacy_request(?:s)?$/u.test(item.path));
try {
  for (const name of Object.keys(process.env)) if (/^(NEXT_PUBLIC_|FABELPAD_|APP_URL$)/u.test(name)) delete process.env[name];
  Object.assign(process.env, { FABELPAD_DATA_MODE: 'supabase', FABELPAD_APP_ORIGIN: 'https://fabelpad.example.test', NEXT_PUBLIC_SUPABASE_URL: 'https://project.example.test', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_privacy_test' });
  globalThis[cookieKey] = { getAll: () => [...jar].map(([name, value]) => ({ name, value })), set: (name, value, options) => { if (!value || options?.maxAge === 0) jar.delete(name); else jar.set(name, value); } };
  const fakeHeaders = pathToFileURL(join(temporary, 'next-headers.mjs'));
  await writeFile(fakeHeaders, 'export async function cookies() { return globalThis[Symbol.for("fabelpad.privacy.admin.api.cookies")]; }\n');
  const collectionURL = await compileSource(new URL('app/api/admin/privacy/route.ts', root), temporary);
  const itemURL = await compileSource(new URL('app/api/admin/privacy/[id]/route.ts', root), temporary);
  const serverURL = await compileSource(new URL('lib/supabase/server.ts', root), temporary);
  await writeFile(new URL(serverURL), (await readFile(new URL(serverURL), 'utf8')).replace("'next/headers'", JSON.stringify(fakeHeaders.href)).replace("'@supabase/ssr'", JSON.stringify(import.meta.resolve('@supabase/ssr'))));
  const collection = await import(collectionURL), item = await import(itemURL);
  const { createSupabaseServerClient } = await import(serverURL);
  const { PRIVACY_EXTENSION_REASONS } = await import(await compileSource(new URL('lib/privacyAdmin.ts', root), temporary));
  globalThis.fetch = async (input, init) => {
    const outgoing = new Request(input, init), url = new URL(outgoing.url);
    assert.equal(url.origin, 'https://project.example.test', 'Privacy tests must never reach a real provider');
    assert.equal(outgoing.headers.get('apikey'), process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
    const text = outgoing.method === 'GET' ? '' : await outgoing.text();
    const entry = { path: url.pathname, url, method: outgoing.method, body: text ? JSON.parse(text) : null }; requests.push(entry);
    if (url.pathname === '/auth/v1/verify') return json({ access_token: jwt, token_type: 'bearer', expires_in: 3600, expires_at: expiry, refresh_token: 'synthetic-privacy-refresh', user: actor });
    if (url.pathname === '/auth/v1/user') return json(actor);
    if (url.pathname === '/rest/v1/rpc/get_account_lifecycle') return json(lifecycle);
    if (url.pathname === '/rest/v1/content_admins') {
      assert.equal(url.searchParams.get('user_id'), `eq.${actor.id}`, 'Only the verified actor controls operator authorization');
      return roleFailure ? json({ message: 'synthetic-private-role-store-diagnostic' }, 500) : json(admin ? { user_id: actor.id } : null);
    }
    assert.ok(rpc, 'Each privacy RPC needs an explicit isolated response'); return rpc(entry);
  };
  const reset = async ({ authenticated = true, isAdmin = true, state = 'active' } = {}) => {
    jar = new Map(); requests = []; rpc = undefined; admin = isAdmin; roleFailure = false; lifecycle = { ...active, state };
    if (authenticated) { const client = await createSupabaseServerClient(); await client.auth.verifyOtp({ email: actor.email, token: '123456', type: 'email' }); requests = []; }
  };
  const outcome = async (options = {}, id = undefined) => {
    const incoming = request(options);
    const response = options.method === 'PUT' ? await item.PUT(incoming, { params: Promise.resolve({ id: id ?? caseId }) }) : options.method === 'POST' ? await collection.POST(incoming) : await collection.GET(incoming);
    const value = await response.json(), encoded = JSON.stringify(value);
    assert.equal(response.headers.get('cache-control'), 'private, no-store'); assert.equal(response.headers.get('vary'), 'Cookie'); assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    for (const secret of ['synthetic-private', 'access_token', 'synthetic-privacy-refresh']) assert.equal(encoded.includes(secret), false);
    checks++; return { response, value };
  };

  await reset({ authenticated: false }); let result = await outcome(); assert.equal(result.response.status, 401); assert.equal(requests.length, 0);
  // Forged user_metadata admin/role fields never replace the database membership check.
  await reset({ isAdmin: false }); result = await outcome(); assert.equal(result.response.status, 403); assert.equal(result.value.error, 'admin_required'); assert.equal(caseRequests().length, 0); assert.ok(requests.some(entry => entry.path === '/rest/v1/content_admins'));
  await reset({ state: 'deletion_pending' }); result = await outcome(); assert.equal(result.response.status, 403); assert.equal(result.value.error, 'account_inactive'); assert.equal(caseRequests().length, 0);
  await reset(); roleFailure = true; result = await outcome(); assert.equal(result.response.status, 503); assert.equal(caseRequests().length, 0);

  const registration = { reference: 'AVG-2026-000001', kind: 'erasure', scope: 'child', parentId: subject, profileId: 'child-one', receivedAt: '2026-11-22T12:00:00Z' };
  for (const header of ['', subject]) {
    await reset(); result = await outcome({ method: 'POST', body: registration, headers: { 'X-Fabelpad-Parent': header } }); assert.equal(result.response.status, 401); assert.equal(result.value.error, 'account_changed'); assert.equal(caseRequests().length, 0);
  }
  for (const headers of [{ origin: 'https://attacker.example.test' }, { 'sec-fetch-site': 'cross-site' }]) {
    await reset(); result = await outcome({ method: 'POST', body: registration, headers }); assert.equal(result.response.status, 403); assert.equal(requests.length, 0);
  }
  for (const body of [
    { ...registration, email: 'never-store@example.test' }, { ...registration, actorId: subject },
    { ...registration, reference: 'parent@example.test' }, { ...registration, kind: 'unknown' },
    { ...registration, parentId: '../foreign' }, { ...registration, profileId: '../child' },
    { ...registration, scope: 'parent' }, { ...registration, receivedAt: 'invalid' },
  ]) { await reset(); result = await outcome({ method: 'POST', body }); assert.equal(result.response.status, 422); assert.equal(caseRequests().length, 0); }
  for (const [body, headers, expected] of [['{invalid', {}, 400], ['{}', { 'content-type': 'text/plain' }, 415], [{ text: 'x'.repeat(9000) }, {}, 413]]) {
    await reset(); result = await outcome({ method: 'POST', body, headers }); assert.equal(result.response.status, expected); assert.equal(caseRequests().length, 0);
  }
  for (const offset of ['-1', '001', '100001', '1e2', 'Infinity']) {
    await reset(); result = await outcome({ query: `?offset=${offset}` }); assert.equal(result.response.status, 422); assert.equal(caseRequests().length, 0);
  }
  for (const offset of [0, 100, 100000]) {
    await reset(); rpc = entry => { assert.equal(entry.path, '/rest/v1/rpc/list_privacy_requests'); assert.deepEqual(entry.body, { p_limit: 100, p_offset: offset }); return json({ cases: [], total: 0, truncated: false, nextOffset: null }); };
    result = await outcome({ query: offset ? `?offset=${offset}` : '' }); assert.equal(result.response.status, 200); assert.deepEqual(result.value.cases, []);
  }
  await reset(); rpc = entry => { assert.equal(entry.path, '/rest/v1/rpc/register_privacy_request'); assert.deepEqual(entry.body, { p_reference: registration.reference, p_kind: 'erasure', p_scope: 'child', p_parent_id: subject, p_child_id: 'child-one', p_received_at: registration.receivedAt }); return json({ id: caseId }); };
  result = await outcome({ method: 'POST', body: registration }); assert.equal(result.response.status, 200); assert.equal(result.value.id, caseId);
  await reset(); rpc = entry => { assert.deepEqual(entry.body, { p_reference: 'AVG-2026-000002', p_kind: 'access', p_scope: 'parent', p_parent_id: null, p_child_id: null, p_received_at: null }); return json({ id: caseId }); };
  result = await outcome({ method: 'POST', body: { reference: 'AVG-2026-000002', kind: 'access', scope: 'parent' } }); assert.equal(result.response.status, 200);

  const reason = PRIVACY_EXTENSION_REASONS.complex_request;
  for (const body of [
    { action: 'extend', extensionReason: reason }, { action: 'extend', extensionReason: reason, notificationConfirmed: false },
    { action: 'extend', extensionReason: 'Private diagnosis or free-form email text', notificationConfirmed: true },
    { action: 'extend', extensionReason: 'complex_request', notificationConfirmed: true },
    { action: 'extend', extensionReason: reason, notificationConfirmed: true, notes: 'never-store' },
    { action: 'verify', verificationMethod: 'assume_from_login' }, { action: 'complete', freeText: 'never-store' },
    { action: 'bind_subject', parentId: '../foreign' }, { action: 'unknown' },
  ]) { await reset(); result = await outcome({ method: 'PUT', body }); assert.equal(result.response.status, 422); assert.equal(caseRequests().length, 0); }
  await reset(); result = await outcome({ method: 'PUT', body: { action: 'complete' } }, 'not-a-uuid'); assert.equal(result.response.status, 422); assert.equal(caseRequests().length, 0);
  for (const [body, expected] of [
    [{ action: 'extend', extensionReason: reason, notificationConfirmed: true }, { p_request_id: caseId, p_action: 'extend', p_extension_reason: reason }],
    [{ action: 'verify', verificationMethod: 'proportionate_support' }, { p_request_id: caseId, p_action: 'verify', p_verification_method: 'proportionate_support' }],
    [{ action: 'bind_subject', parentId: subject, profileId: 'child-one' }, { p_request_id: caseId, p_action: 'bind_subject', p_parent_id: subject, p_child_id: 'child-one' }],
    [{ action: 'bind_subject', parentId: subject }, { p_request_id: caseId, p_action: 'bind_subject', p_parent_id: subject, p_child_id: null }],
    ...['execute_erasure', 'complete', 'decline'].map(action => [{ action }, { p_request_id: caseId, p_action: action }]),
  ]) {
    await reset(); rpc = entry => { assert.equal(entry.path, '/rest/v1/rpc/manage_privacy_request'); assert.deepEqual(entry.body, expected); return json({ id: caseId, state: 'verified' }); };
    result = await outcome({ method: 'PUT', body }); assert.equal(result.response.status, 200);
  }
  for (const [error, status, code] of [[{ code: 'XX000', message: 'synthetic-private-sql-connection-and-secret', details: 'synthetic-private-query' }, 503, 'backend_unavailable'], [{ code: '42501', message: 'account_blocked' }, 403, 'account_blocked']]) {
    await reset(); rpc = () => json(error, 400); result = await outcome({ method: 'PUT', body: { action: 'complete' } }); assert.equal(result.response.status, status); assert.equal(result.value.error, code);
  }
  console.log(`Privacy admin API checks passed: ${checks} actual-route SDK scenarios, verified operator rights, account binding, strict metadata, extension notice/reasons, pagination/RPC parameters and diagnostic redaction.`);
} finally {
  globalThis.fetch = beforeFetch;
  if (beforeCookies === undefined) delete globalThis[cookieKey]; else globalThis[cookieKey] = beforeCookies;
  for (const name of Object.keys(process.env)) if (!(name in beforeEnvironment)) delete process.env[name]; Object.assign(process.env, beforeEnvironment);
  await rm(temporary, { recursive: true, force: true });
}
