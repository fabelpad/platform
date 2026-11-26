import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { compileSource } from './source-test-loader.mjs';

// Exercise the installed Supabase SSR/Auth SDK against an isolated fake provider.
// Cookies use a request-local Next adapter; no network or real accounts are used.
const root = new URL('../', import.meta.url);
const temp = await mkdtemp(join(tmpdir(), 'fabelpad-auth-contract-'));
const { TERMS_VERSION, PRIVACY_VERSION } = await import(await compileSource(new URL('../lib/legal/documents.ts', import.meta.url), temp));
const originalEnvironment = { ...process.env }, originalFetch = globalThis.fetch;
const contextKey = Symbol.for('fabelpad.auth.contract.cookies');
const originalContext = globalThis[contextKey];
let requests = [], writes = [], jar = new Map(), handler;
let lifecycleState = 'active';
let registrationProofs = new Map();
let completionUnavailable = false;
const hash = value => createHash('sha256').update(value).digest('hex');
const lifecycle = () => ({ state: lifecycleState, termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION, acceptedTermsVersion: lifecycleState === 'onboarding' ? null : TERMS_VERSION, shownPrivacyVersion: PRIVACY_VERSION, lastActivityAt: null, deletionDeadline: lifecycleState === 'deletion_pending' ? '2026-12-22T00:00:00Z' : null, consents: [] });
let checks = 0;
const parent = { id: '00000000-0000-4000-8000-000000000101', email: 'parent@example.test', aud: 'authenticated', role: 'authenticated', email_confirmed_at: '2026-01-01T00:00:00Z', is_anonymous: false, user_metadata: { full_name: 'Testouder', admin: true, role: 'admin' } };
const json = (body, status = 200) => Response.json(body, { status });
const jwt = expiry => `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: parent.id, exp: expiry, role: 'authenticated', aud: 'authenticated' })).toString('base64url')}.synthetic-signature`;
const session = (expiry = Math.floor(Date.now() / 1000) + 3600) => ({ access_token: jwt(expiry), token_type: 'bearer', expires_in: Math.max(0, expiry - Math.floor(Date.now() / 1000)), expires_at: expiry, refresh_token: 'synthetic-test-refresh-token', user: parent });
const request = (body, headers = {}) => new Request('https://fabelpad.example.test/api/auth/test', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://fabelpad.example.test', ...headers }, body: JSON.stringify(body) });
const reset = () => { jar = new Map(); writes = []; requests = []; handler = undefined; registrationProofs = new Map(); completionUnavailable = false; };
try {
  for (const name of Object.keys(process.env)) if (/^(NEXT_PUBLIC_|FABELPAD_|APP_URL$)/u.test(name)) delete process.env[name];
  Object.assign(process.env, {
    FABELPAD_DATA_MODE: 'supabase', FABELPAD_APP_ORIGIN: 'https://fabelpad.example.test',
    NEXT_PUBLIC_SUPABASE_URL: 'https://project.example.test', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_test_only',
    FABELPAD_AUTH_EMAIL_ENABLED: 'true', FABELPAD_AUTH_GOOGLE_ENABLED: 'false',
  });
  globalThis[contextKey] = {
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    set(name, value, options) {
      writes.push({ name, value, options });
      if (!value || options?.maxAge === 0) jar.delete(name); else jar.set(name, value);
    },
  };
  const fakeHeaders = pathToFileURL(join(temp, 'next-headers.mjs'));
  await writeFile(fakeHeaders, 'export async function cookies() { return globalThis[Symbol.for("fabelpad.auth.contract.cookies")]; }\n');
  const authURL = await compileSource(new URL('lib/server/auth.ts', root), temp);
  const serverURL = await compileSource(new URL('lib/supabase/server.ts', root), temp);
  const callbackURL = await compileSource(new URL('app/auth/callback/route.ts', root), temp);
  const registrationURL = await compileSource(new URL('lib/server/registration.ts', root), temp);
  const completionRouteURL = await compileSource(new URL('app/api/auth/registration/complete/route.ts', root), temp);
  await writeFile(new URL(registrationURL), (await readFile(new URL(registrationURL), 'utf8')).replace("'next/headers'", JSON.stringify(fakeHeaders.href)));
  const serverCode = (await readFile(new URL(serverURL), 'utf8'))
    .replace("'next/headers'", JSON.stringify(fakeHeaders.href))
    .replace("'@supabase/ssr'", JSON.stringify(import.meta.resolve('@supabase/ssr'))).replace("'@supabase/supabase-js'", JSON.stringify(import.meta.resolve('@supabase/supabase-js')));
  await writeFile(new URL(serverURL), serverCode);
  const { authMutation, authSession } = await import(authURL);
  const { createSupabaseServerClient, getVerifiedParent } = await import(serverURL);
  const { GET: callback } = await import(callbackURL);
  const { POST: completeRegistration } = await import(completionRouteURL);
  globalThis.fetch = async (input, init) => {
    const outgoing = new Request(input, init);
    const url = new URL(outgoing.url);
    assert.equal(url.origin, 'https://project.example.test', 'Auth tests cannot reach a real provider');
    assert.equal(outgoing.headers.get('apikey'), process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
    const text = outgoing.method === 'GET' ? '' : await outgoing.text();
    const item = { method: outgoing.method, url, body: text ? JSON.parse(text) : null, authorization: outgoing.headers.get('authorization') };
    requests.push(item);
    if (['/rest/v1/rpc/begin_parent_registration', '/rest/v1/rpc/begin_parent_registration_with_marketing'].includes(url.pathname)) {
      assert.match(item.body.p_nonce_hash, /^[a-f0-9]{64}$/);
      if (url.pathname.endsWith('_with_marketing')) assert.equal(typeof item.body.p_marketing_consent, 'boolean');
      else assert.equal('p_marketing_consent' in item.body, false, 'Legacy clients never claim that a marketing checkbox was shown');
      assert.equal(item.body.p_parent_declaration, true); assert.equal(item.body.p_accept_terms, true);
      assert.equal(item.body.p_terms_version, TERMS_VERSION); assert.equal(item.body.p_privacy_version, PRIVACY_VERSION);
      if (item.body.p_channel === 'google') assert.equal(item.body.p_email_hash, null);
      else assert.match(item.body.p_email_hash, /^[a-f0-9]{64}$/);
      registrationProofs.set(item.body.p_nonce_hash, { ...item.body });
      return json({ expiresAt: new Date(Date.now() + 1800000).toISOString() });
    }
    if (url.pathname === '/rest/v1/rpc/complete_parent_registration') {
      if (completionUnavailable) return json({ code: 'XX000', message: 'synthetic-private-registration-diagnostic' }, 500);
      const stored = registrationProofs.get(item.body.p_nonce_hash);
      const completed = !!stored && !stored.expired && stored.p_channel === item.body.p_channel && (stored.p_channel === 'google' || stored.p_email_hash === hash(parent.email));
      if (completed) lifecycleState = 'active';
      return json({ completed });
    }
    if (url.pathname === '/rest/v1/rpc/get_account_lifecycle') return json(lifecycle());
    if (url.pathname === '/rest/v1/rpc/record_family_activity') { assert.equal(item.body.p_kind, 'parent_login'); return json({ recorded: true }); }
    assert.ok(handler, 'Every provider request must have an explicit test response');
    return handler(item);
  };

  // Request codes with a fixed project redirect and generic, provider-free text.
  reset(); handler = item => { assert.equal(item.url.pathname, '/auth/v1/otp'); return json({}); };
  let response = await authMutation(request({ email: ' Parent@Example.Test ', next: 'https://attacker.example.test' }), 'otp');
  assert.equal(response.status, 200);
  assert.equal(requests[0].body.email, parent.email);
  assert.equal(requests[0].body.create_user, false, 'Login must not create an undeclared parent account');
  assert.equal(requests[0].url.searchParams.get('redirect_to'), 'https://fabelpad.example.test/inloggen');
  assert.match((await response.json()).message, /Fabelpad/u);
  assert.equal(response.headers.get('cache-control'), 'private, no-store'); checks++;

  // Registration checks both explicit declarations and current immutable versions
  // before Auth is allowed to create even an unconfirmed OTP identity.
  for (const body of [
    { email: parent.email, intent: 'register' },
    { email: parent.email, intent: 'register', parentDeclaration: true, acceptTerms: true, termsVersion: TERMS_VERSION, privacyVersion: '2026-11-22.1' },
    { email: parent.email, intent: 'register', parentDeclaration: true, acceptTerms: false, termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION },
    { email: parent.email, intent: 'register', parentDeclaration: true, acceptTerms: true, termsVersion: 'obsolete', privacyVersion: PRIVACY_VERSION },
  ]) { reset(); response = await authMutation(request(body), 'otp'); assert.ok([409, 422].includes(response.status)); assert.equal(requests.length, 0); checks++; }
  reset(); handler = item => { assert.equal(item.url.pathname, '/auth/v1/otp'); assert.equal(item.body.create_user, true); return json({}); };
  response = await authMutation(request({ email: parent.email, intent: 'register', parentDeclaration: true, acceptTerms: true, termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION }), 'otp');
  assert.equal(response.status, 200); checks++;

  const declarations = { intent: 'register', parentDeclaration: true, acceptTerms: true, termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION };
  for (const marketingConsent of ['true', 1, null, {}, []]) {
    for (const action of ['otp', 'google']) {
      reset(); response = await authMutation(request({ email: parent.email, ...declarations, marketingConsent }), action);
      assert.equal(response.status, 422); assert.equal((await response.json()).error, 'invalid_marketing_consent'); assert.equal(requests.length, 0); checks++;
    }
  }
  for (const marketingConsent of [undefined, false, true]) {
    reset(); handler = item => { assert.equal(item.url.pathname, '/auth/v1/otp'); return json({}); };
    response = await authMutation(request({ email: parent.email, ...declarations, ...(marketingConsent === undefined ? {} : { marketingConsent }) }), 'otp');
    assert.equal(response.status, 200);
    const proofRequest = requests.find(item => item.url.pathname.includes('/begin_parent_registration'));
    assert.equal(proofRequest.url.pathname, `/rest/v1/rpc/begin_parent_registration${marketingConsent === undefined ? '' : '_with_marketing'}`);
    assert.equal('p_marketing_consent' in proofRequest.body, marketingConsent !== undefined);
    assert.equal(proofRequest.body.p_marketing_consent, marketingConsent);
    assert.equal(requests.some(item => item.url.pathname.includes('set_parent_email_preferences')), false, 'Pre-auth registration only creates a proof, never a preference'); checks++;
  }
  process.env.FABELPAD_AUTH_GOOGLE_ENABLED = 'true';
  for (const marketingConsent of [undefined, false, true]) {
    reset();
    response = await authMutation(request({ ...declarations, ...(marketingConsent === undefined ? {} : { marketingConsent }) }), 'google');
    assert.equal(response.status, 200);
    const proofRequest = requests.find(item => item.url.pathname.includes('/begin_parent_registration'));
    assert.equal(proofRequest.url.pathname, `/rest/v1/rpc/begin_parent_registration${marketingConsent === undefined ? '' : '_with_marketing'}`);
    assert.equal('p_marketing_consent' in proofRequest.body, marketingConsent !== undefined);
    assert.equal(proofRequest.body.p_marketing_consent, marketingConsent); checks++;
  }
  process.env.FABELPAD_AUTH_GOOGLE_ENABLED = 'false';
  const proofCookie = () => [...jar].find(([name]) => name === '__Host-fabelpad-registration')?.[1];
  const ordinaryAuth = item => {
    if (item.url.pathname === '/auth/v1/otp') return json({});
    if (item.url.pathname === '/auth/v1/verify') return json(session());
    if (item.url.pathname === '/auth/v1/user') return json(parent);
    if (item.url.pathname === '/auth/v1/token') { assert.equal(item.url.searchParams.get('grant_type'), 'pkce'); assert.ok(item.body.code_verifier); return json(session()); }
    throw new Error('Unexpected isolated registration provider request');
  };
  // Resending an OTP uses the original declaration, including its opt-in.
  reset(); lifecycleState = 'onboarding'; handler = ordinaryAuth;
  response = await authMutation(request({ email: parent.email, ...declarations, marketingConsent: true }), 'otp');
  assert.equal(response.status, 200); const consentProof = proofCookie();
  const originalConsent = [...registrationProofs.values()][0];
  assert.equal(originalConsent.p_marketing_consent, true);
  response = await authMutation(request({ email: parent.email, intent: 'resume_registration', marketingConsent: false }), 'otp');
  assert.equal(response.status, 200); assert.equal(proofCookie(), consentProof);
  assert.equal(registrationProofs.size, 1); assert.equal([...registrationProofs.values()][0].p_marketing_consent, true); checks++;
  // The only cookie is an opaque capability; real declarations and exact
  // versions are stored server-side before Auth creates an identity.
  reset(); lifecycleState = 'onboarding'; handler = ordinaryAuth;
  response = await authMutation(request({ email: parent.email, ...declarations }), 'otp');
  assert.equal(response.status, 200);
  const originalProof = proofCookie(); assert.match(originalProof, /^otp\.[A-Za-z0-9_-]{43}$/);
  const nonce = originalProof.split('.')[1], saved = requests.find(item => item.url.pathname.endsWith('/begin_parent_registration'));
  assert.equal(saved.body.p_nonce_hash, hash(nonce)); assert.equal(saved.body.p_email_hash, hash(parent.email));
  assert.equal(JSON.stringify(saved.body).includes(nonce), false); assert.equal(JSON.stringify(await response.json()).includes(nonce), false);
  const protectedCookie = writes.find(item => item.name === '__Host-fabelpad-registration');
  assert.equal(protectedCookie.options.httpOnly, true); assert.equal(protectedCookie.options.secure, true); assert.equal(protectedCookie.options.sameSite, 'lax'); assert.equal(protectedCookie.options.path, '/'); assert.equal(protectedCookie.options.domain, undefined); assert.ok(protectedCookie.options.maxAge > 0 && protectedCookie.options.maxAge <= 1800); checks++;
  response = await authMutation(request({ email: parent.email, token: '123456', next: '/gezin' }), 'verify');
  assert.equal(response.status, 200); let registrationResult = await response.json();
  assert.equal(registrationResult.next, '/gezin'); assert.equal(registrationResult.lifecycle.state, 'active'); assert.equal(proofCookie(), undefined);
  assert.equal(requests.filter(item => item.url.pathname.endsWith('/complete_parent_registration')).length, 1); checks++;

  // Failed resends, invalid codes and a canceled OAuth redirect do not discard
  // a previous valid declaration or force a second set of checkboxes.
  reset(); lifecycleState = 'onboarding'; handler = ordinaryAuth;
  await authMutation(request({ email: parent.email, ...declarations }), 'otp'); const oldProof = proofCookie();
  handler = item => item.url.pathname === '/auth/v1/otp' ? json({ message: 'synthetic-provider-throttle' }, 429) : ordinaryAuth(item);
  response = await authMutation(request({ email: parent.email, ...declarations }), 'otp'); assert.equal(response.status, 429); assert.equal(proofCookie(), oldProof); checks++;
  handler = item => item.url.pathname === '/auth/v1/verify' ? json({ code: 'otp_expired', message: 'synthetic-private-invalid-code' }, 401) : ordinaryAuth(item);
  response = await authMutation(request({ email: parent.email, token: '000000' }), 'verify'); assert.equal(response.status, 401); assert.equal(proofCookie(), oldProof); assert.equal(requests.some(item => item.url.pathname.endsWith('/complete_parent_registration')), false); checks++;
  handler = ordinaryAuth; response = await authMutation(request({ email: parent.email, token: '123456' }), 'verify'); assert.equal((await response.json()).next, '/gezin'); checks++;
  reset(); lifecycleState = 'onboarding'; handler = ordinaryAuth;
  await authMutation(request({ email: parent.email, ...declarations }), 'otp');
  response = await authMutation(request({ email: parent.email, intent: 'login' }), 'otp'); assert.equal(response.status, 200); assert.equal(proofCookie(), undefined, 'An explicitly successful login start clears an earlier registration intent'); checks++;

  // Stale, foreign-email or missing proof cannot manufacture acceptance.
  for (const kind of ['expired', 'different-email', 'missing']) {
    reset(); lifecycleState = 'onboarding'; handler = ordinaryAuth;
    if (kind !== 'missing') {
      await authMutation(request({ email: kind === 'different-email' ? 'different@example.test' : parent.email, ...declarations }), 'otp');
      if (kind === 'expired') for (const stored of registrationProofs.values()) stored.expired = true;
    }
    response = await authMutation(request({ email: parent.email, token: '123456' }), 'verify');
    registrationResult = await response.json(); assert.equal(response.status, 200); assert.match(registrationResult.next, /^\/onboarding\?/); assert.equal(registrationResult.lifecycle.state, 'onboarding'); assert.equal(proofCookie(), undefined); checks++;
  }

  // Once Auth succeeded, a temporary DB failure can resume from the saved
  // capability without asking for declarations again or replaying an OTP.
  reset(); lifecycleState = 'onboarding'; handler = ordinaryAuth;
  await authMutation(request({ email: parent.email, ...declarations }), 'otp'); const retryProof = proofCookie(); completionUnavailable = true;
  response = await authMutation(request({ email: parent.email, token: '123456' }), 'verify'); registrationResult = await response.json();
  assert.equal(response.status, 200); assert.equal(registrationResult.registrationRetryRequired, true); assert.match(registrationResult.next, /^\/onboarding\?/); assert.equal(proofCookie(), retryProof); checks++;
  response = await completeRegistration(request({}, { 'X-Fabelpad-Parent': parent.id })); assert.equal(response.status, 503); assert.equal(proofCookie(), retryProof); assert.equal(JSON.stringify(await response.json()).includes('synthetic-private-registration-diagnostic'), false); checks++;
  for (const actor of ['', 'different-parent']) { response = await completeRegistration(request({}, { 'X-Fabelpad-Parent': actor })); assert.equal(response.status, 401); checks++; }
  completionUnavailable = false;
  response = await completeRegistration(request({}, { 'X-Fabelpad-Parent': parent.id })); registrationResult = await response.json(); assert.equal(response.status, 200); assert.equal(registrationResult.completed, true); assert.equal(registrationResult.lifecycle.state, 'active'); assert.equal(proofCookie(), undefined); checks++;
  const completionCount = requests.filter(item => item.url.pathname.endsWith('/complete_parent_registration')).length;
  response = await completeRegistration(request({}, { 'X-Fabelpad-Parent': parent.id })); assert.equal((await response.json()).completed, true); assert.equal(requests.filter(item => item.url.pathname.endsWith('/complete_parent_registration')).length, completionCount, 'A completed account must not be accepted again'); checks++;

  // Generic completion cannot consume a Google proof using an existing OTP
  // session. Only a fresh successful PKCE callback applies that declaration.
  reset(); lifecycleState = 'onboarding'; handler = ordinaryAuth; process.env.FABELPAD_AUTH_GOOGLE_ENABLED = 'true';
  const preexistingOtp = await createSupabaseServerClient(); await preexistingOtp.auth.verifyOtp({ email: parent.email, token: '123456', type: 'email' });
  response = await authMutation(request({ ...declarations, marketingConsent: true, next: '/studio' }), 'google'); assert.equal(response.status, 200); const googleProof = proofCookie(); assert.match(googleProof, /^google\./); assert.equal([...registrationProofs.values()][0].p_marketing_consent, true);
  response = await completeRegistration(request({}, { 'X-Fabelpad-Parent': parent.id })); assert.equal(response.status, 428); assert.equal((await response.json()).error, 'google_registration_required'); assert.equal(proofCookie(), googleProof); assert.equal(requests.some(item => item.url.pathname.endsWith('/complete_parent_registration')), false); checks++;
  response = await callback(new Request('https://fabelpad.example.test/auth/callback?error=access_denied')); assert.equal(response.status, 303); assert.equal(proofCookie(), googleProof); checks++;
  const beginCount = requests.filter(item => item.url.pathname.endsWith('/begin_parent_registration_with_marketing')).length;
  response = await authMutation(request({ intent: 'resume_registration', marketingConsent: false, next: '/studio' }), 'google'); assert.equal(response.status, 200); assert.equal(proofCookie(), googleProof); assert.equal(requests.filter(item => item.url.pathname.endsWith('/begin_parent_registration_with_marketing')).length, beginCount); assert.equal([...registrationProofs.values()][0].p_marketing_consent, true); checks++;
  response = await callback(new Request('https://fabelpad.example.test/auth/callback?code=synthetic-google-code&next=/studio')); assert.equal(new URL(response.headers.get('location')).pathname, '/studio'); assert.equal(lifecycleState, 'active'); assert.equal(proofCookie(), undefined); checks++;
  process.env.FABELPAD_AUTH_GOOGLE_ENABLED = 'false'; lifecycleState = 'active';

  // Invalid inputs and cross-site requests never reach the mail provider.
  for (const [body, headers, action, status] of [
    [{ email: 'invalid' }, {}, 'otp', 422],
    [{ email: parent.email }, { origin: 'https://attacker.example.test' }, 'otp', 403],
    [{ email: parent.email }, { 'sec-fetch-site': 'cross-site' }, 'otp', 403],
    [{ email: parent.email, token: '123' }, {}, 'verify', 422],
    [{ type: 'signup', tokenHash: 'synthetic-token-hash-for-test' }, {}, 'confirm', 422],
    [{ type: 'invite', tokenHash: 'invalid hash' }, {}, 'confirm', 422],
  ]) {
    reset(); response = await authMutation(request(body, headers), action);
    assert.equal(response.status, status); assert.equal(requests.length, 0); checks++;
  }
  process.env.FABELPAD_AUTH_EMAIL_ENABLED = 'false';
  reset(); response = await authMutation(request({ email: parent.email }), 'otp');
  assert.equal(response.status, 503); assert.equal(requests.length, 0); checks++;
  process.env.FABELPAD_AUTH_EMAIL_ENABLED = 'true';
  reset(); response = await authMutation(request({}), 'google');
  assert.equal(response.status, 503); assert.equal(requests.length, 0); checks++;

  // Provider failures keep internal diagnostics and credentials out of responses.
  for (const status of [429, 500]) {
    reset(); handler = () => json({ message: 'synthetic-private-provider-detail', code: 'over_email_send_rate_limit' }, status);
    response = await authMutation(request({ email: parent.email }), 'otp');
    assert.equal(response.status, status === 429 ? 429 : 503);
    assert.equal(JSON.stringify(await response.json()).includes('synthetic-private-provider-detail'), false); checks++;
  }
  reset(); handler = () => json({ message: 'synthetic-private-provider-detail', code: 'otp_expired' }, 403);
  response = await authMutation(request({ email: parent.email, token: '123456' }), 'verify');
  assert.equal(response.status, 401); assert.equal(jar.size, 0); checks++;

  // Real SDK session serialization, verified identity and safe return location.
  reset(); handler = item => {
    if (item.url.pathname === '/auth/v1/verify') { assert.equal(item.body.type, 'email'); return json(session()); }
    if (item.url.pathname === '/auth/v1/user') return json(parent);
    throw new Error('Unexpected synthetic auth request');
  };
  response = await authMutation(request({ email: parent.email, token: '123456', next: '/studio' }), 'verify');
  assert.equal(response.status, 200);
  let result = await response.json();
  assert.equal(result.parent.id, parent.id); assert.equal(result.next, '/studio');
  assert.ok(requests.some(item => item.url.pathname === '/auth/v1/user'), 'Authorization must verify user with Auth');
  assert.ok(writes.some(item => item.value));
  for (const item of writes.filter(item => item.value)) {
    assert.equal(item.options.httpOnly, true); assert.equal(item.options.secure, true);
    assert.equal(item.options.sameSite, 'lax'); assert.equal(item.options.path, '/');
  }
  assert.equal(JSON.stringify(result).includes('access_token'), false);
  assert.equal(JSON.stringify(result).includes('refresh_token'), false); checks++;

  // Metadata never confers admin: a table lookup decides every request.
  requests = []; handler = item => {
    if (item.url.pathname === '/auth/v1/user') return json(parent);
    if (item.url.pathname === '/rest/v1/content_admins') return json(null);
    throw new Error('Unexpected synthetic session request');
  };
  response = await authSession(); result = await response.json();
  assert.equal(response.status, 200); assert.equal(result.admin, false);
  const roleRequest = requests.find(item => item.url.pathname === '/rest/v1/content_admins');
  assert.equal(roleRequest.url.searchParams.get('user_id'), `eq.${parent.id}`); checks++;
  handler = item => item.url.pathname === '/auth/v1/user' ? json(parent) : json({ user_id: parent.id });
  assert.equal((await (await authSession()).json()).admin, true); checks++;
  handler = item => item.url.pathname === '/auth/v1/user' ? json(parent) : json({ message: 'synthetic-role-store-failure' }, 500);
  response = await authSession(); assert.equal(response.status, 503);
  assert.equal(JSON.stringify(await response.json()).includes('synthetic-role-store-failure'), false); checks++;

  // A server-side refresh persists rotated cookies before reading private data.
  reset(); handler = item => {
    if (item.url.pathname === '/auth/v1/verify') return json(session(Math.floor(Date.now() / 1000) + 5));
    if (item.url.pathname === '/auth/v1/token') { assert.equal(item.url.searchParams.get('grant_type'), 'refresh_token'); return json(session()); }
    if (item.url.pathname === '/auth/v1/user') return json(parent);
    throw new Error('Unexpected synthetic refresh request');
  };
  const nearExpiryClient = await createSupabaseServerClient();
  await nearExpiryClient.auth.verifyOtp({ email: parent.email, token: '123456', type: 'email' });
  requests = []; writes = [];
  assert.equal((await getVerifiedParent())?.id, parent.id);
  assert.ok(requests.some(item => item.url.pathname === '/auth/v1/token'));
  assert.ok(writes.some(item => item.value)); checks++;

  // Signing out revokes this device and clears its session cookies only.
  requests = []; writes = []; handler = item => {
    assert.equal(item.url.pathname, '/auth/v1/logout'); assert.equal(item.url.searchParams.get('scope'), 'local'); return new Response(null, { status: 204 });
  };
  response = await authMutation(request({}), 'signout');
  assert.equal(response.status, 200); assert.equal(jar.size, 0);
  assert.ok(writes.some(item => item.options.maxAge === 0)); checks++;
  reset(); response = await authMutation(request({}), 'signout');
  assert.equal(response.status, 200); assert.equal(requests.length, 0); checks++;

  // Links are type-restricted and require the same verified identity as OTP.
  for (const type of ['email', 'invite', 'recovery', 'email_change']) {
    reset(); handler = item => {
      if (item.url.pathname === '/auth/v1/verify') { assert.equal(item.body.type, type); assert.equal(item.body.token_hash, 'synthetic-token-hash-for-test'); return json(session()); }
      if (item.url.pathname === '/auth/v1/user') return json(parent);
      throw new Error('Unexpected synthetic confirmation request');
    };
    response = await authMutation(request({ type, tokenHash: 'synthetic-token-hash-for-test', next: '//attacker.example.test' }), 'confirm');
    assert.equal(response.status, 200); result = await response.json();
    assert.equal(result.next, '/gezin'); assert.equal(result.parent.id, parent.id); checks++;
  }
  reset(); handler = () => json({ user: null, session: null });
  response = await authMutation(request({ type: 'email_change', tokenHash: 'synthetic-token-hash-for-test' }), 'confirm');
  assert.equal(response.status, 200); result = await response.json();
  assert.equal(result.next, '/inloggen'); assert.match(result.message, /andere e-mailadres/u); assert.equal(jar.size, 0); checks++;

  // Google uses the real SDK's PKCE cookie and fixed project callback. Every
  // successful channel then uses the same server-side onboarding/deletion gate.
  process.env.FABELPAD_AUTH_GOOGLE_ENABLED = 'true';
  for (const state of ['onboarding', 'active', 'deletion_pending']) {
    reset(); lifecycleState = state;
    handler = item => {
      if (item.url.pathname === '/auth/v1/token') { assert.equal(item.url.searchParams.get('grant_type'), 'pkce'); assert.equal(item.body.auth_code, 'synthetic-google-code'); assert.ok(item.body.code_verifier); return json(session()); }
      if (item.url.pathname === '/auth/v1/user') return json(parent);
      throw new Error('Unexpected OAuth request');
    };
    response = await authMutation(request({ next: '/studio', intent: 'login' }), 'google');
    assert.equal(response.status, 200);
    const destination = new URL((await response.json()).url);
    assert.equal(destination.origin, 'https://project.example.test'); assert.equal(destination.pathname, '/auth/v1/authorize'); assert.equal(destination.searchParams.get('provider'), 'google');
    assert.equal(new URL(destination.searchParams.get('redirect_to')).origin, 'https://fabelpad.example.test');
    response = await callback(new Request('https://untrusted-host.example.test/auth/callback?code=synthetic-google-code&next=/studio'));
    assert.equal(response.status, 303);
    const target = new URL(response.headers.get('location'));
    assert.equal(target.origin, 'https://fabelpad.example.test');
    assert.equal(target.pathname, state === 'onboarding' ? '/onboarding' : state === 'active' ? '/studio' : '/profiel/account');
    assert.equal(requests.some(item => item.url.pathname === '/rest/v1/rpc/record_family_activity'), state === 'active'); checks++;
  }
  lifecycleState = 'active';
  process.env.FABELPAD_AUTH_GOOGLE_ENABLED = 'false';

  // Unavailable/invalid configuration is a safe 503, not an unhandled callback.
  reset(); process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_secret_synthetic-rejected-secret';
  response = await callback(new Request('https://untrusted-host.example.test/auth/callback?code=synthetic-code'));
  assert.equal(response.status, 503); assert.equal(JSON.stringify(await response.json()).includes('synthetic-rejected-secret'), false);
  assert.equal(requests.length, 0); checks++;
  console.log(`Auth contract checks passed: ${checks} isolated scenarios using the installed SSR/Auth SDK, OTP, typed human-confirmed links, safe redirects, cookies and refresh, signout, verified identities and database-backed admin rights. Live email delivery remains a separate provider test.`);
} finally {
  globalThis.fetch = originalFetch;
  if (originalContext === undefined) delete globalThis[contextKey]; else globalThis[contextKey] = originalContext;
  for (const name of Object.keys(process.env)) if (!(name in originalEnvironment)) delete process.env[name];
  Object.assign(process.env, originalEnvironment);
  await rm(temp, { recursive: true, force: true });
}
