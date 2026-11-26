import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compileSource } from './source-test-loader.mjs';

// Actual parent route handlers + installed SSR/Auth SDK; no real users, mail or network.
const root = new URL('../', import.meta.url);
const temporary = await mkdtemp(join(tmpdir(), 'fabelpad-parent-api-'));
const { TERMS_VERSION, PRIVACY_VERSION } = await import(await compileSource(new URL('../lib/legal/documents.ts', import.meta.url), temporary));
const beforeEnvironment = { ...process.env }, beforeFetch = globalThis.fetch;
const cookieKey = Symbol.for('fabelpad.parent.api.cookies'), beforeCookies = globalThis[cookieKey];
const parent = { id: '00000000-0000-4000-8000-000000000151', email: 'parent@example.test', email_confirmed_at: '2026-11-22T12:00:00Z', aud: 'authenticated', role: 'authenticated', is_anonymous: false, user_metadata: { role: 'admin' } };
const active = { state: 'active', termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION, acceptedTermsVersion: TERMS_VERSION, shownPrivacyVersion: PRIVACY_VERSION, lastActivityAt: '2026-11-22T12:00:00Z', deletionDeadline: null, consents: [] };
const deadlineMinute = '2026-12-22T12:00:00Z';
const confirmedDeletion = { confirm: true, expectedDeadlineMinute: deadlineMinute };
const json = (body, status = 200) => Response.json(body, { status, headers: { 'X-Supabase-Api-Version': '2024-01-01' } });
const expiry = Math.floor(Date.now() / 1000) + 3600;
const jwt = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: parent.id, exp: expiry, aud: 'authenticated', role: 'authenticated', amr: [{ method: 'otp', timestamp: Math.floor(Date.now() / 1000) }] })).toString('base64url')}.synthetic-signature`;
let jar = new Map(), requests = [], rpc, authFailure, logoutFailure = false, checks = 0;
const request = (body, headers = {}, method = 'POST') => new Request('https://fabelpad.example.test/api/parent/test', { method, headers: { ...(method === 'GET' ? {} : { 'content-type': 'application/json', origin: 'https://fabelpad.example.test', 'X-Fabelpad-Parent': parent.id }), ...headers }, ...(method === 'GET' ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }) });
try {
  for (const name of Object.keys(process.env)) if (/^(NEXT_PUBLIC_|FABELPAD_|APP_URL$)/u.test(name)) delete process.env[name];
  Object.assign(process.env, { FABELPAD_DATA_MODE: 'supabase', FABELPAD_APP_ORIGIN: 'https://fabelpad.example.test', NEXT_PUBLIC_SUPABASE_URL: 'https://project.example.test', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_parent_test' });
  globalThis[cookieKey] = { getAll: () => [...jar].map(([name, value]) => ({ name, value })), set: (name, value, options) => { if (!value || options?.maxAge === 0) jar.delete(name); else jar.set(name, value); } };
  const fakeHeaders = pathToFileURL(join(temporary, 'next-headers.mjs'));
  await writeFile(fakeHeaders, 'export async function cookies() { return globalThis[Symbol.for("fabelpad.parent.api.cookies")]; }\n');
  const parentURL = await compileSource(new URL('lib/server/parent.ts', root), temporary);
  const deletionURL = await compileSource(new URL('app/api/parent/deletion/route.ts', root), temporary);
  const preferencesURL = await compileSource(new URL('app/api/parent/email-preferences/route.ts', root), temporary);
  const serverURL = await compileSource(new URL('lib/supabase/server.ts', root), temporary);
  await writeFile(new URL(serverURL), (await readFile(new URL(serverURL), 'utf8')).replace("'next/headers'", JSON.stringify(fakeHeaders.href)).replace("'@supabase/ssr'", JSON.stringify(import.meta.resolve('@supabase/ssr'))).replace("'@supabase/supabase-js'", JSON.stringify(import.meta.resolve('@supabase/supabase-js'))));
  const { parentRequest } = await import(parentURL);
  const deletionRoute = await import(deletionURL);
  const preferencesRoute = await import(preferencesURL);
  const { createSupabaseServerClient } = await import(serverURL);
  globalThis.fetch = async (input, init) => {
    const outgoing = new Request(input, init), url = new URL(outgoing.url);
    assert.equal(url.origin, 'https://project.example.test', 'Parent tests cannot call a real provider');
    assert.equal(outgoing.headers.get('apikey'), process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
    const text = outgoing.method === 'GET' ? '' : await outgoing.text();
    const entry = { path: url.pathname, method: outgoing.method, body: text ? JSON.parse(text) : null }; requests.push(entry);
    if (url.pathname === '/auth/v1/verify') return json({ access_token: jwt, token_type: 'bearer', expires_in: 3600, expires_at: expiry, refresh_token: 'synthetic-parent-refresh', user: parent });
    if (url.pathname === '/auth/v1/user') return authFailure ? json({ code: authFailure, msg: 'synthetic-private-auth-diagnostic' }, authFailure === 'over_request_rate_limit' ? 429 : 401) : json(parent);
    if (url.pathname === '/auth/v1/logout') return logoutFailure ? json({ message: 'synthetic-private-logout-diagnostic' }, 500) : new Response(null, { status: 204 });
    assert.ok(url.pathname.startsWith('/rest/v1/rpc/'), 'Only known isolated RPC requests are permitted');
    assert.ok(rpc, 'Each RPC needs an explicit synthetic response'); return rpc(entry);
  };
  const reset = async ({ authenticated = true } = {}) => {
    jar = new Map(); requests = []; rpc = undefined; authFailure = undefined; logoutFailure = false;
    if (authenticated) { const client = await createSupabaseServerClient(); await client.auth.verifyOtp({ email: parent.email, token: '123456', type: 'email' }); requests = []; }
  };
  const outcome = async (operation, body, headers, method) => {
    const incoming = request(body, headers, method);
    const response = operation === 'deletion' ? await deletionRoute[method === 'GET' ? 'GET' : 'POST'](incoming) : operation === 'email-preferences' ? await preferencesRoute[method === 'GET' ? 'GET' : 'POST'](incoming) : await parentRequest(incoming, operation);
    const value = await response.json();
    assert.equal(response.headers.get('cache-control'), 'private, no-store'); assert.equal(response.headers.get('vary'), 'Cookie, Authorization');
    assert.equal(JSON.stringify(value).includes('synthetic-private'), false); assert.equal(JSON.stringify(value).includes('access_token'), false); assert.equal(JSON.stringify(value).includes('synthetic-parent-refresh'), false);
    checks++; return { response, value };
  };
  await reset({ authenticated: false }); let result = await outcome('status', undefined, {}, 'GET'); assert.equal(result.response.status, 401); assert.equal(requests.length, 0);
  await reset({ authenticated: false }); result = await outcome('deletion', undefined, {}, 'GET'); assert.equal(result.response.status, 401); assert.equal(requests.length, 0);
  await reset(); rpc = entry => { assert.equal(entry.path, '/rest/v1/rpc/preview_account_deletion'); assert.deepEqual(entry.body, {}); return json({ deletionDeadlineMinute: deadlineMinute, expiresAt: '2026-11-22T12:01:00Z', accidentalSecret: 'synthetic-private-discard-this-field' }); };
  const originalCookies = [...jar];
  result = await outcome('deletion', undefined, {}, 'GET');
  assert.equal(result.response.status, 200); assert.deepEqual(result.value, { deletionDeadlineMinute: deadlineMinute, expiresAt: '2026-11-22T12:01:00Z' }); assert.deepEqual([...jar], originalCookies);
  assert.deepEqual(requests.filter(entry => entry.path.includes('/rpc/')).map(entry => entry.path), ['/rest/v1/rpc/preview_account_deletion'], 'A preview never records activity or requests deletion');
  await reset(); rpc = () => json({ deletionDeadlineMinute: deadlineMinute, expiresAt: null }); result = await outcome('deletion', undefined, {}, 'GET'); assert.equal(result.response.status, 200); assert.equal(result.value.expiresAt, null);
  for (const invalid of ['not-a-date', '2026-12-22T12:00:01Z', '2026-12-22T13:00:00+01:00']) {
    await reset(); rpc = () => json({ deletionDeadlineMinute: invalid }); result = await outcome('deletion', undefined, {}, 'GET'); assert.equal(result.response.status, 503);
  }
  for (const headers of [{ 'X-Fabelpad-Parent': '' }, { 'X-Fabelpad-Parent': 'another-parent' }]) {
    await reset(); result = await outcome('deletion', { confirm: true }, headers); assert.equal(result.response.status, 401); assert.equal(requests.filter(item => item.path.includes('/rpc/')).length, 0);
  }
  await reset(); result = await outcome('deletion', { confirm: true }, { origin: 'https://attacker.example.test' }); assert.equal(result.response.status, 403); assert.equal(requests.length, 0);
  for (const [operation, body] of [
    ['onboarding', { parentDeclaration: true, acceptTerms: false, termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION }],
    ['onboarding', { parentDeclaration: true, acceptTerms: true, termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION, parentId: 'other-parent' }],
    ['consent', { profileId: 'child-one', consent: true, guardianDeclaration: false }],
    ['consent', { profileId: '../foreign', consent: true, guardianDeclaration: true }],
    ['deletion', { confirm: true, parentId: 'other-parent' }], ['restore', { confirmRestore: false }],
    ['deletion', { confirm: true }], ['deletion', { confirm: true, expectedDeadlineMinute: '2026-12-22T12:00:01Z' }],
    ['deletion', { confirm: true, expectedDeadlineMinute: 42 }],
    ['activity', { eventId: 'bad', kind: 'reading', profileId: 'child-one' }],
  ]) { await reset(); result = await outcome(operation, body); assert.equal(result.response.status, 422); assert.equal(requests.filter(item => item.path.includes('/rpc/')).length, 0); }
  for (const [body, headers, expected] of [['{invalid', {}, 400], ['{}', { 'content-type': 'text/plain' }, 415], [{ overflow: 'x'.repeat(9000) }, {}, 413]]) {
    await reset(); result = await outcome('deletion', body, headers); assert.equal(result.response.status, expected); assert.equal(requests.filter(item => item.path.includes('/rpc/')).length, 0);
  }
  await reset(); rpc = entry => { assert.equal(entry.path, '/rest/v1/rpc/get_account_lifecycle'); return json(active); };
  result = await outcome('status', undefined, {}, 'GET'); assert.equal(result.response.status, 200); assert.deepEqual(result.value, active);
  await reset(); rpc = entry => { assert.equal(entry.path, '/rest/v1/rpc/complete_parent_onboarding'); assert.equal('p_marketing_consent' in entry.body, false); assert.equal(entry.body.p_parent_declaration, true); assert.equal(entry.body.p_accept_terms, true); return json({ message: 'document_version_changed', code: '22023', details: 'synthetic-private-sql' }, 400); };
  result = await outcome('onboarding', { parentDeclaration: true, acceptTerms: true, termsVersion: 'obsolete', privacyVersion: PRIVACY_VERSION }); assert.equal(result.response.status, 409); assert.equal(result.value.error, 'document_version_changed');
  for (const [operation, body, error, expectedStatus, expectedCode] of [
    ['deletion', confirmedDeletion, { code: '28000', message: 'synthetic-private-session-diagnostic' }, 428, 'fresh_auth_required'],
    ['deletion', confirmedDeletion, { code: 'P0001', message: 'deletion_preview_expired' }, 409, 'deletion_preview_expired'],
    ['consent', { profileId: 'child-one', consent: true, guardianDeclaration: true }, { code: '42501', message: 'profile_consent_revoked' }, 403, 'profile_consent_revoked'],
    ['restore', { confirmRestore: true }, { code: '42501', message: 'account_blocked' }, 403, 'account_blocked'],
    ['activity', { eventId: '00000000-0000-4000-8000-000000000152', kind: 'reading', profileId: 'child-one', occurredAt: '2025-01-01T00:00:00.000Z' }, { code: '22023', message: 'synthetic-private-invalid-timestamp' }, 422, 'invalid_request'],
    ['deletion', confirmedDeletion, { code: 'XX000', message: 'synthetic-private-sql-host-and-secret' }, 503, 'backend_unavailable'],
  ]) { await reset(); rpc = () => json(error, 400); result = await outcome(operation, body); assert.equal(result.response.status, expectedStatus); assert.equal(result.value.error, expectedCode); }
  await reset(); rpc = entry => { assert.equal(entry.path, '/rest/v1/rpc/consent_child_profile'); assert.deepEqual(entry.body, { p_child_id: 'child-one', p_consent: false, p_guardian_declaration: false }); return json(active); };
  result = await outcome('consent', { profileId: 'child-one' }, {}, 'DELETE'); assert.equal(result.response.status, 200);
  await reset(); logoutFailure = true;
  const pending = { ...active, state: 'deletion_pending', deletionDeadline: '2026-12-22T12:00:00Z', consents: [] };
  rpc = entry => { assert.equal(entry.path, '/rest/v1/rpc/request_account_deletion'); assert.deepEqual(entry.body, { p_expected_deadline_minute: deadlineMinute }); return json(pending); };
  result = await outcome('deletion', confirmedDeletion); assert.equal(result.response.status, 200); assert.equal(result.value.deletionDeadline, pending.deletionDeadline); assert.equal(result.value.state, 'deletion_pending');
  for (const [failure, status, code] of [['user_not_found', 410, 'account_deleted'], ['bad_jwt', 401, 'not_authenticated'], ['over_request_rate_limit', 503, 'backend_unavailable']]) {
    await reset(); authFailure = failure; result = await outcome('status', undefined, {}, 'GET'); assert.equal(result.response.status, status); assert.equal(result.value.error, code); assert.equal(requests.filter(item => item.path.includes('/rpc/')).length, 0);
    assert.equal(result.value.cleanupParentId, failure === 'user_not_found' ? parent.id : undefined, 'Only confirmed deletion may carry a device-cleanup hint');
  }
  await reset({authenticated:false});rpc=entry=>{assert.equal(entry.path,'/rest/v1/rpc/get_account_lifecycle');return json(active);};
  result=await outcome('status',undefined,{Authorization:`Bearer ${jwt}`},'GET');assert.equal(result.response.status,200);assert.ok(requests.some(r=>r.path==='/auth/v1/user'),'Native bearer always contacts Auth');assert.equal(jar.size,0,'Native authorization never sets cookie sessions');
  await reset({authenticated:false});authFailure='bad_jwt';result=await outcome('status',undefined,{Authorization:`Bearer ${jwt}`},'GET');assert.equal(result.response.status,401);assert.equal(requests.filter(r=>r.path.includes('/rpc/')).length,0);
  await reset({ authenticated: false }); result = await outcome('email-preferences', undefined, {}, 'GET'); assert.equal(result.response.status, 401); assert.equal(requests.length, 0);
  for (const method of ['GET', 'POST']) for (const actor of ['', 'other-parent']) {
    await reset(); result = await outcome('email-preferences', { marketingConsent: true }, { 'X-Fabelpad-Parent': actor }, method);
    assert.equal(result.response.status, 401); assert.equal(requests.filter(entry => entry.path.includes('/rpc/')).length, 0);
  }
  await reset(); result = await outcome('email-preferences', { marketingConsent: true }, { origin: 'https://attacker.example.test' }); assert.equal(result.response.status, 403); assert.equal(requests.length, 0);
  const preferenceRpc = entry => {
    if (entry.path.endsWith('/get_account_lifecycle')) return json(active);
    if (entry.path.endsWith('/get_parent_email_preferences')) { assert.deepEqual(entry.body, {}); return json({ marketingConsent: false, updatedAt: null, secret: 'synthetic-private-discard-this-field' }); }
    assert.equal(entry.path, '/rest/v1/rpc/set_parent_email_preferences'); assert.equal(typeof entry.body.p_marketing_consent, 'boolean');
    assert.deepEqual(Object.keys(entry.body), ['p_marketing_consent']); return json({ marketingConsent: entry.body.p_marketing_consent, updatedAt: '2026-11-24T16:00:00Z', secret: 'synthetic-private-discard-this-field' });
  };
  await reset(); rpc = preferenceRpc; result = await outcome('email-preferences', undefined, { 'X-Fabelpad-Parent': parent.id }, 'GET'); assert.equal(result.response.status, 200); assert.deepEqual(result.value, { marketingConsent: false, updatedAt: null });
  for (const marketingConsent of [false, true]) { await reset(); rpc = preferenceRpc; result = await outcome('email-preferences', { marketingConsent }); assert.equal(result.response.status, 200); assert.deepEqual(result.value, { marketingConsent, updatedAt: '2026-11-24T16:00:00Z' }); }
  for (const body of [{}, { marketingConsent: 'true' }, { marketingConsent: null }, { marketingConsent: 1 }, { marketingConsent: true, parentId: 'another-parent' }]) {
    await reset(); rpc = preferenceRpc; result = await outcome('email-preferences', body); assert.equal(result.response.status, 422); assert.equal(requests.some(entry => entry.path.endsWith('/set_parent_email_preferences')), false);
  }
  for (const state of ['onboarding', 'deletion_pending', 'deleting']) {
    await reset(); rpc = entry => { assert.equal(entry.path, '/rest/v1/rpc/get_account_lifecycle'); return json({ ...active, state }); };
    result = await outcome('email-preferences', undefined, { 'X-Fabelpad-Parent': parent.id }, 'GET'); assert.equal(result.response.status, 403);
    assert.equal(requests.some(entry => entry.path.endsWith('/get_parent_email_preferences')), false);
  }
  for (const invalid of [{ marketingConsent: true }, { marketingConsent: 'true', updatedAt: null }, { marketingConsent: true, updatedAt: 'bad-time' }]) {
    await reset(); rpc = entry => entry.path.endsWith('/get_account_lifecycle') ? json(active) : json(invalid);
    result = await outcome('email-preferences', undefined, { 'X-Fabelpad-Parent': parent.id }, 'GET'); assert.equal(result.response.status, 503);
  }
  for (const marketingConsent of [undefined, false, true, 'true']) {
    await reset(); rpc = entry => { assert.equal(entry.path, `/rest/v1/rpc/complete_parent_onboarding${marketingConsent === undefined ? '' : '_with_marketing'}`); assert.equal('p_marketing_consent' in entry.body, marketingConsent !== undefined); assert.equal(entry.body.p_marketing_consent, marketingConsent); return json(active); };
    result = await outcome('onboarding', { parentDeclaration: true, acceptTerms: true, termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION, ...(marketingConsent === undefined ? {} : { marketingConsent }) });
    assert.equal(result.response.status, marketingConsent === 'true' ? 422 : 200);
    if (marketingConsent === 'true') assert.equal(requests.some(entry => entry.path.includes('/rpc/')), false);
  }
  await reset({ authenticated: false }); rpc = preferenceRpc; result = await outcome('email-preferences', undefined, { Authorization: `Bearer ${jwt}`, 'X-Fabelpad-Parent': parent.id }, 'GET'); assert.equal(result.response.status, 200); assert.equal(jar.size, 0);
  console.log(`Parent API checks passed: ${checks} isolated SDK scenarios, owner binding, declarations, version conflicts, consent, fresh authentication, deletion transactions and safe error/purge signals.`);
} finally {
  globalThis.fetch = beforeFetch;
  if (beforeCookies === undefined) delete globalThis[cookieKey]; else globalThis[cookieKey] = beforeCookies;
  for (const name of Object.keys(process.env)) if (!(name in beforeEnvironment)) delete process.env[name]; Object.assign(process.env, beforeEnvironment);
  await rm(temporary, { recursive: true, force: true });
}
