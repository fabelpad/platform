import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compileSource } from './source-test-loader.mjs';

// Actual family API + installed Supabase SSR/PostgREST clients. Provider calls
// are intercepted: only synthetic Auth, status, family reads and RPC may run.
const root = new URL('../', import.meta.url);
const temporary = await mkdtemp(join(tmpdir(), 'fabelpad-birth-date-api-'));
const beforeEnvironment = { ...process.env }, beforeFetch = globalThis.fetch;
const cookieKey = Symbol.for('fabelpad.birth.api.cookies'), beforeCookies = globalThis[cookieKey];
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
let actor = A, jar = new Map(), requests = [], rejection;
const documents = new Map();
const active = { state: 'active', termsVersion: '2026-11-22', privacyVersion: '2026-11-22.1', acceptedTermsVersion: '2026-11-22', shownPrivacyVersion: '2026-11-22.1', lastActivityAt: '2026-11-22T12:00:00Z', deletionDeadline: null, consents: [] };
const expiry = Math.floor(Date.now() / 1000) + 3600;
const user = () => ({ id: actor, email: `${actor}@example.test`, email_confirmed_at: '2026-11-22T12:00:00Z', aud: 'authenticated', role: 'authenticated', is_anonymous: false, user_metadata: {} });
const token = () => `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: actor, exp: expiry, aud: 'authenticated', role: 'authenticated' })).toString('base64url')}.synthetic-signature`;
const json = (body, status = 200) => Response.json(body, { status, headers: { 'X-Supabase-Api-Version': '2024-01-01' } });
const fixture = (birthDate, childId = 'child-one') => ({ schemaVersion: 1, family: { version: 1, children: [{ id: childId, name: 'Robin', avatar: 1, ...(birthDate !== undefined ? { birthDate } : {}) }], activeId: childId }, data: { [childId]: { prefs: { muted: false, calm: true, readingLevel: 'under6' }, 'story-station': { picks: [1, 0, 1], updatedAt: 1790000000000 } } } });
let checks = 0;
try {
  for (const name of Object.keys(process.env)) if (/^(NEXT_PUBLIC_|FABELPAD_|APP_URL$)/u.test(name)) delete process.env[name];
  Object.assign(process.env, { FABELPAD_DATA_MODE: 'supabase', FABELPAD_APP_ORIGIN: 'https://fabelpad.example.test', NEXT_PUBLIC_SUPABASE_URL: 'https://project.example.test', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_birth_date_test' });
  globalThis[cookieKey] = { getAll: () => [...jar].map(([name, value]) => ({ name, value })), set: (name, value, options) => { if (!value || options?.maxAge === 0) jar.delete(name); else jar.set(name, value); } };
  const fakeHeaders = pathToFileURL(join(temporary, 'next-headers.mjs'));
  await writeFile(fakeHeaders, 'export async function cookies() { return globalThis[Symbol.for("fabelpad.birth.api.cookies")]; }\n');
  const apiURL = await compileSource(new URL('app/api/family/route.ts', root), temporary);
  const serverURL = await compileSource(new URL('lib/supabase/server.ts', root), temporary);
  await writeFile(new URL(serverURL), (await readFile(new URL(serverURL), 'utf8')).replace("'next/headers'", JSON.stringify(fakeHeaders.href)).replace("'@supabase/ssr'", JSON.stringify(import.meta.resolve('@supabase/ssr'))));
  const api = await import(apiURL);
  const { createSupabaseServerClient } = await import(serverURL);
  globalThis.fetch = async (input, init) => {
    const outgoing = new Request(input, init), url = new URL(outgoing.url);
    assert.equal(url.origin, 'https://project.example.test', 'The test cannot reach a real provider');
    const entry = { path: url.pathname, method: outgoing.method, body: outgoing.method === 'GET' ? null : await outgoing.json() }; requests.push(entry);
    if (url.pathname === '/auth/v1/verify') return json({ access_token: token(), token_type: 'bearer', expires_in: 3600, expires_at: expiry, refresh_token: 'synthetic-refresh', user: user() });
    if (url.pathname === '/auth/v1/user') return json(user());
    if (url.pathname === '/rest/v1/rpc/get_account_lifecycle') return json(active);
    if (url.pathname === '/rest/v1/family_documents') {
      assert.equal(outgoing.method, 'GET');
      assert.equal(url.searchParams.get('parent_id'), `eq.${actor}`, 'Every API read is restricted to the verified own family');
      assert.equal(url.searchParams.get('select'), 'snapshot,revision');
      return json(documents.has(actor) ? [documents.get(actor)] : []);
    }
    assert.equal(url.pathname, '/rest/v1/rpc/save_family_snapshot');
    if (rejection) return json(rejection, 400);
    const previous = documents.get(actor);
    const saved = entry.body.p_base_revision === (previous?.revision ?? 0);
    if (saved) documents.set(actor, { snapshot: structuredClone(entry.body.p_snapshot), revision: (previous?.revision ?? 0) + 1 });
    return json({ saved, revision: documents.get(actor)?.revision ?? 0, snapshot: documents.get(actor)?.snapshot ?? null });
  };
  const signIn = async id => { actor = id; jar = new Map(); const client = await createSupabaseServerClient(); await client.auth.verifyOtp({ email: user().email, token: '123456', type: 'email' }); requests = []; };
  const call = async (method, body, headers = {}, suffix = '') => {
    const incoming = new Request(`https://fabelpad.example.test/api/family${suffix}`, { method, headers: { 'X-Fabelpad-Parent': actor, ...(method === 'GET' ? {} : { origin: 'https://fabelpad.example.test', 'content-type': 'application/json' }), ...headers }, ...(method === 'GET' ? {} : { body: JSON.stringify(body) }) });
    const response = await api[method](incoming), value = await response.json(); checks++;
    assert.equal(response.headers.get('cache-control'), 'private, no-store'); assert.equal(response.headers.get('vary'), 'Cookie');
    assert.equal(JSON.stringify(value).includes('synthetic-refresh'), false);
    return { response, value };
  };
  const writes = () => requests.filter(entry => entry.path === '/rest/v1/rpc/save_family_snapshot').length;
  await signIn(A);
  let result = await call('PUT', { baseRevision: 0, snapshot: fixture(undefined) });
  assert.equal(result.response.status, 422); assert.equal(writes(), 0); assert.equal(documents.has(A), false);
  for (const date of ['', '2026-04-31', '2025-02-29', '9999-01-01', '2019-05-14T00:00:00Z', null, 20190514]) {
    result = await call('PUT', { baseRevision: 0, snapshot: fixture(date) }); assert.equal(result.response.status, 422); assert.equal(writes(), 0);
  }
  const valid = fixture('2024-02-29');
  result = await call('PUT', { baseRevision: 0, snapshot: valid }); assert.equal(result.response.status, 200); assert.deepEqual(result.value.snapshot, valid); assert.equal(writes(), 1);
  const manual = structuredClone(valid); manual.family.children[0].readingLevelOverride = '9plus';
  result = await call('PUT', { baseRevision: 1, snapshot: manual }); assert.equal(result.response.status, 200);
  result = await call('GET', undefined); assert.deepEqual(result.value.snapshot, manual, 'Date and explicit override are returned by the real own-family handler');
  result = await call('PUT', { baseRevision: 2, snapshot: fixture(undefined) }); assert.equal(result.response.status, 422); assert.equal(writes(), 2, 'A date cannot be cleared after being supplied');
  const edited = structuredClone(manual); edited.family.children[0].birthDate = '2019-05-14';
  result = await call('PUT', { baseRevision: 2, snapshot: edited }); assert.equal(result.response.status, 200); assert.equal(result.value.snapshot.family.children[0].readingLevelOverride, '9plus');
  delete edited.family.children[0].readingLevelOverride;
  result = await call('PUT', { baseRevision: 3, snapshot: edited }); assert.equal(result.response.status, 200); assert.equal(Object.hasOwn(result.value.snapshot.family.children[0], 'readingLevelOverride'), false);
  result = await call('PUT', { baseRevision: 3, snapshot: edited }); assert.equal(result.response.status, 409); assert.equal(result.value.revision, 4);
  await signIn(B);
  result = await call('GET', undefined, {}, `?parentId=${A}`); assert.equal(result.value.snapshot, null, 'A query cannot expose another family birth date');
  result = await call('PUT', { baseRevision: 4, snapshot: fixture(undefined) }); assert.equal(result.response.status, 422, 'A foreign ID or claimed old revision is not legacy status');
  documents.set(B, { snapshot: fixture(undefined), revision: 1 });
  result = await call('PUT', { baseRevision: 1, snapshot: fixture(undefined) }); assert.equal(result.response.status, 200, 'An actual stored legacy profile remains writable without inventing a date');
  const unknown = fixture('2019-05-14'); unknown.family.children[0].readingLevelOverride = 'auto';
  const before = writes(); result = await call('PUT', { baseRevision: 2, snapshot: unknown }); assert.equal(result.response.status, 422); assert.equal(writes(), before);
  result = await call('PUT', { baseRevision: 2, snapshot: fixture('2019-05-14') }, { origin: 'https://attacker.example.test' }); assert.equal(result.response.status, 403); assert.equal(writes(), before);
  result = await call('PUT', { baseRevision: 2, snapshot: fixture('2019-05-14') }, { 'X-Fabelpad-Parent': A }); assert.equal(result.response.status, 401); assert.equal(writes(), before);
  rejection = { code: '42501', message: 'profile_consent_required' };
  result = await call('PUT', { baseRevision: 2, snapshot: fixture('2019-05-14') }); assert.equal(result.response.status, 403); assert.equal(result.value.error, 'profile_consent_required');
  assert.equal(documents.get(B).snapshot.family.children[0].birthDate, undefined);
  console.log(`Birth date API checks passed: ${checks} real-handler/SSR cases, strict dates and override, new versus stored legacy IDs, scoped reads, JSON roundtrip, date edits, auto reset, CAS, auth/origin/consent boundaries and private responses.`);
  console.log('Provider network is intercepted; actual PostgreSQL/RLS behavior is exercised by profile-birth-date-db-check.mjs.');
} finally {
  globalThis.fetch = beforeFetch; if (beforeCookies === undefined) delete globalThis[cookieKey]; else globalThis[cookieKey] = beforeCookies;
  for (const name of Object.keys(process.env)) if (!(name in beforeEnvironment)) delete process.env[name]; Object.assign(process.env, beforeEnvironment);
  await rm(temporary, { recursive: true, force: true });
}
