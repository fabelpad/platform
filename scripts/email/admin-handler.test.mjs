import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileSource } from '../source-test-loader.mjs';
const temporary = await mkdtemp(join(tmpdir(), 'fabelpad-email-admin-tests-'));
after(() => rm(temporary, { recursive: true, force: true }));
const { createEmailAdminHandler } = await import(await compileSource(new URL('../../lib/email/admin-handler.ts', import.meta.url), temporary));
const { createSupabaseEmailBackend } = await import(await compileSource(new URL('../../lib/email/supabase-backend.ts', import.meta.url), temporary));
const { DEFAULT_EMAIL_SETTINGS } = await import(await compileSource(new URL('../../lib/email/settings.ts', import.meta.url), temporary));
const environment = { FABELPAD_APP_ORIGIN: 'https://fabelpad.example.test', FABELPAD_ENVIRONMENT: 'production' };
const actor = { id: 'd4cb24f9-1b4d-4f00-9f73-d45e453baad5', email: 'beheerder@example.test' };
const token = 'synthetic.user.accessToken';
const key = 're_synthetic_secret_only';
const id = '25515b07-8e6b-41cd-a572-ab07b5cce4b6';
const defaults = () => structuredClone(DEFAULT_EMAIL_SETTINGS);
const request = body => new Request('https://project.supabase.co/functions/v1/email-admin', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(body) });
const saveBody = (changes = {}) => ({ action: 'save', baseRevision: 0, requestId: id, settings: defaults(), apiKey: key, trackingDisabledConfirmed: true, ...changes });
function fixture(options = {}) {
  const events = [], sends = [], domains = [];
  let state = { revision: options.initial ? 1 : 0, settings: defaults(), keyConfigured: Boolean(options.initial), lastTestAt: null, lastTestProviderId: null };
  let activeKey = options.initial ? key : null;
  const backend = {
    async authenticate(accessToken) { events.push(['auth', accessToken]); return options.actor === undefined ? actor : options.actor; },
    async rpc(name, args, accessToken) {
      events.push([name, structuredClone(args), accessToken]);
      if (options.rpc) { const result = await options.rpc(name, args); if (result !== undefined) return result; }
      if (name === 'get_email_settings') return { ...structuredClone(state), accidentalSecret: 'must-never-return' };
      if (name === 'get_email_delivery_config') return activeKey ? { ...structuredClone(state), apiKey: activeKey } : null;
      if (name === 'reserve_email_test') return { allowed: !options.limited, retryAfter: 30 };
      if (name === 'save_email_settings') {
        assert.equal(sends.length, 1, 'the test must be accepted before saving');
        if (options.casConflict) return { saved: false, ...state };
        state = { revision: state.revision + 1, settings: args.p_settings, keyConfigured: true, lastTestAt: '2026-11-22T12:00:00Z', lastTestProviderId: args.p_test_provider_id };
        activeKey = args.p_api_key ?? activeKey;
        return { saved: true, ...state, accidentalSecret: activeKey };
      }
      if (name === 'record_email_test') {
        state.lastTestAt = '2026-11-22T12:00:00Z'; state.lastTestProviderId = args.p_test_provider_id; return { saved: true, ...state };
      }
      throw new Error('Unexpected RPC');
    },
  };
  const fetcher = async (url, init) => {
    if (url.includes('/domains')) {
      domains.push(url);
      if (options.provider) return options.provider(url, init);
      return Response.json({ error: 'restricted-private-provider-diagnostic' }, { status: 403 });
    }
    assert.equal(url, 'https://api.resend.com/emails');
    events.push(['send']); sends.push({ headers: init.headers, body: JSON.parse(init.body) });
    if (options.sendStatus) return Response.json({ message: 'private-upstream-key-and-message' }, { status: options.sendStatus });
    return Response.json({ id: 'synthetic-provider-id' });
  };
  return { handler: createEmailAdminHandler({ ...environment, ...options.environment }, { backend, fetch: fetcher }), events, sends, domains, state: () => state };
}

test('only a verified current admin can access settings; no unauthenticated DB calls or sends', async () => {
  const noAuth = fixture();
  const missing = request({ action: 'get' }); missing.headers.delete('authorization');
  assert.equal((await noAuth.handler(missing)).status, 401); assert.equal(noAuth.events.length, 0);
  const denied = fixture({ actor: null });
  assert.equal((await denied.handler(request({ action: 'get' }))).status, 403);
  assert.deepEqual(denied.events.map(event => event[0]), ['auth']); assert.equal(denied.sends.length, 0);
});
test('settings return only masked metadata and environment; accidental backend fields are removed', async () => {
  const app = fixture({ initial: true });
  const response = await app.handler(request({ action: 'get' }));
  assert.equal(response.status, 200); const body = await response.json();
  assert.equal(body.keyConfigured, true); assert.equal(body.source, 'vault'); assert.equal(body.environment, 'production');
  assert.doesNotMatch(JSON.stringify(body), /re_synthetic|must-never-return|apiKey|accidentalSecret/u);
  assert.equal(app.events.find(event => event[0] === 'get_email_settings')[2], token);
  assert.equal(app.events.some(event => event[0] === 'get_email_delivery_config'), false);
});
test('first save sends the real styled test only to the authenticated admin before atomic storage', async () => {
  const app = fixture(); const response = await app.handler(request(saveBody()));
  assert.equal(response.status, 200); const body = await response.json();
  assert.equal(body.revision, 1); assert.equal(body.testStatus, 'accepted'); assert.equal(body.testRecipient, actor.email);
  assert.doesNotMatch(JSON.stringify(body), /re_synthetic|accidentalSecret/u);
  assert.deepEqual(app.sends[0].body.to, [actor.email]); assert.match(app.sends[0].body.html, /background:#fcf9f0/u);
  assert.match(app.sends[0].headers['Idempotency-Key'], /^fabelpad-mail-test\/[a-f0-9]{64}$/u);
  assert.doesNotMatch(app.sends[0].headers['Idempotency-Key'], /beheerder|25515b07/u);
  const names = app.events.map(event => event[0]); assert.ok(names.indexOf('send') < names.indexOf('save_email_settings'));
});
test('failed replacement tests preserve the previous configuration and hide provider diagnostics', async () => {
  const app = fixture({ initial: true, sendStatus: 403 });
  const response = await app.handler(request(saveBody({ baseRevision: 1, apiKey: 're_replacement_secret' })));
  assert.equal(response.status, 422); assert.deepEqual(await response.json(), { error: 'test_not_accepted' });
  assert.equal(app.state().revision, 1); assert.equal(app.events.some(event => event[0] === 'save_email_settings'), false);
});
test('stale revision, arbitrary recipient, invalid key and raw HTML are rejected before sending', async () => {
  for (const [body, status] of [[saveBody({ baseRevision: 9 }), 409], [saveBody({ to: 'other@example.test' }), 400], [saveBody({ apiKey: 'invalid' }), 400], [saveBody({ settings: { ...defaults(), footerText: '<script>bad</script>' } }), 400]]) {
    const app = fixture(); assert.equal((await app.handler(request(body))).status, status); assert.equal(app.sends.length, 0);
  }
});
test('test limits and CAS conflicts cannot overwrite an existing configuration', async () => {
  const limited = fixture({ limited: true }); const rate = await limited.handler(request(saveBody()));
  assert.equal(rate.status, 429); assert.equal(rate.headers.get('Retry-After'), '30'); assert.equal(limited.sends.length, 0);
  const conflict = fixture({ initial: true, casConflict: true });
  assert.equal((await conflict.handler(request(saveBody({ baseRevision: 1 })))).status, 409); assert.equal(conflict.state().revision, 1);
});
test('sending-only keys need explicit no-tracking confirmation; known tracking cannot be bypassed', async () => {
  const restricted = fixture();
  assert.equal((await restricted.handler(request(saveBody({ trackingDisabledConfirmed: false })))).status, 409);
  assert.equal(restricted.sends.length, 0);
  const tracking = fixture({ provider: async url => url.endsWith('/domains') ? Response.json({ data: [{ name: 'fabelpad.nl', id: 'synthetic-domain-id' }] }) : Response.json({ name: 'fabelpad.nl', status: 'verified', open_tracking: true, click_tracking: false, records: [] }) });
  const blocked = await tracking.handler(request(saveBody()));
  assert.deepEqual(await blocked.json(), { error: 'tracking_enabled' }); assert.equal(tracking.sends.length, 0);
  const invalid = fixture({ provider: async () => Response.json({ message: 'private error' }, { status: 401 }) });
  const response = await invalid.handler(request(saveBody())); assert.equal(response.status, 502); assert.deepEqual(await response.json(), { error: 'domain_check_failed' }); assert.equal(invalid.sends.length, 0);
});
test('domain inspection returns only configured sender records, no other account domains or key', async () => {
  const app = fixture({ initial: true, provider: async url => url.endsWith('/domains') ? Response.json({ data: [{ name: 'unrelated.example', id: 'private-other-domain-id' }, { name: 'fabelpad.nl', id: 'synthetic-domain-id' }] }) : Response.json({ name: 'fabelpad.nl', status: 'verified', open_tracking: false, click_tracking: false, records: [{ record: 'DKIM', name: 'resend._domainkey', type: 'TXT', value: 'synthetic-public-dns', status: 'verified', ttl: 'Auto' }], secret: 'private-other-data' }) });
  const response = await app.handler(request({ action: 'domain' })); const body = await response.json();
  assert.equal(body.domain, 'fabelpad.nl'); assert.equal(body.status, 'verified'); assert.equal(body.records.length, 1);
  assert.doesNotMatch(JSON.stringify(body), /unrelated|private|re_synthetic/u); assert.equal(app.sends.length, 0);
});
test('preview uses unsaved plain-text copy, preserves OTP instructions and never sends or reads a secret', async () => {
  const app = fixture();
  const settings = { ...defaults(), supportEmail: 'hulp@example.test', footerText: 'Een eigen voettekst & uitleg', templates: { magiclink: { subject: 'Een aangepaste code', title: 'Welkom & lees verder', intro: 'Je code staat hieronder.' } } };
  const response = await app.handler(request({ action: 'preview', templateAction: 'magiclink', settings }));
  assert.equal(response.status, 200); const body = await response.json();
  assert.equal(body.subject, 'Een aangepaste code'); assert.match(body.html, /123456/u); assert.match(body.html, /Welkom &amp; lees verder/u);
  assert.match(body.html, /hulp@example.test/u); assert.match(body.html, /Een eigen voettekst &amp; uitleg/u);
  assert.equal(app.sends.length, 0); assert.equal(app.events.length, 1);
});
test('staging custom senders are marked as staging in sender, subject and body', async () => {
  const app = fixture({ environment: { FABELPAD_ENVIRONMENT: 'staging' } });
  assert.equal((await app.handler(request(saveBody({ settings: { ...defaults(), fromName: 'Fabelpad Ouders' } })))).status, 200);
  assert.equal(app.sends[0].body.from, 'Fabelpad Ouders Staging <noreply@fabelpad.nl>');
  assert.match(app.sends[0].body.subject, /^\[TEST\] /u); assert.match(app.sends[0].body.html, /TESTOMGEVING/u);
});
test('explicit test uses saved configuration and records accepted status without a settings revision change', async () => {
  const app = fixture({ initial: true });
  const response = await app.handler(request({ action: 'test', baseRevision: 1, requestId: id, trackingDisabledConfirmed: true }));
  assert.equal(response.status, 200); const body = await response.json(); assert.equal(body.revision, 1); assert.equal(body.testStatus, 'accepted');
  assert.equal(app.events.some(event => event[0] === 'record_email_test'), true); assert.equal(app.events.some(event => event[0] === 'save_email_settings'), false);
});
test('runtime secret read failure never falls back to legacy environment credentials', async () => {
  const app = fixture({ environment: { RESEND_API_KEY: key, FABELPAD_EMAIL_FROM: 'Fabelpad <noreply@fabelpad.nl>', FABELPAD_EMAIL_REPLY_TO: 'support@fabelpad.nl' }, rpc: async name => { if (name === 'get_email_delivery_config') throw new Error('private-secret-diagnostic'); } });
  const response = await app.handler(request(saveBody())); assert.equal(response.status, 503); assert.equal(app.sends.length, 0); assert.doesNotMatch(await response.text(), /private|re_synthetic/u);
});

const backendEnvironment = { SUPABASE_URL: 'https://' + 'a'.repeat(20) + '.supabase.co', SUPABASE_ANON_KEY: 'synthetic-public-key', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-secret' };
test('HTTP backend checks live Auth confirmation/nonanonymous status and database role without trusting metadata', async () => {
  for (const changed of [{ is_anonymous: true }, { email_confirmed_at: null }, { id: '../forged' }]) {
    const urls = [];
    const backend = createSupabaseEmailBackend(backendEnvironment, async url => { urls.push(url); return Response.json({ ...actor, email_confirmed_at: '2026-11-22T10:00:00Z', is_anonymous: false, user_metadata: { admin: true }, ...changed }); });
    assert.equal(await backend.authenticate(token), null); assert.equal(urls.length, 1);
  }
  const seen = [];
  const backend = createSupabaseEmailBackend(backendEnvironment, async (url, init) => { seen.push({ url, init }); return Response.json(url.endsWith('/auth/v1/user') ? { ...actor, email_confirmed_at: '2026-11-22T10:00:00Z', is_anonymous: false } : [{ user_id: actor.id }]); });
  assert.deepEqual(await backend.authenticate(token), actor); assert.equal(seen.length, 2);
  for (const item of seen) { assert.equal(item.init.headers.Authorization, 'Bearer ' + token); assert.equal(item.init.headers.apikey, 'synthetic-public-key'); }
});
test('HTTP service RPC uses the Edge secret only and never passes provider diagnostics through errors', async () => {
  const seen = [];
  const backend = createSupabaseEmailBackend(backendEnvironment, async (url, init) => { seen.push({ url, init }); return Response.json({ diagnostic: 'private-secret' }, { status: 500 }); });
  await assert.rejects(backend.rpc('get_email_delivery_config', {}), error => !error.message.includes('private'));
  assert.equal(seen[0].init.headers.Authorization, 'Bearer synthetic-service-secret');
  assert.equal(seen[0].init.headers.apikey, 'synthetic-service-secret');
});

test('all 17 templates have a synthetic preview without reading delivery secrets or sending', async () => {
  const { EMAIL_TEMPLATE_IDS } = await import(await compileSource(new URL('../../lib/email/settings.ts', import.meta.url), temporary));
  assert.equal(EMAIL_TEMPLATE_IDS.length, 17);
  const app = fixture();
  for (const templateAction of EMAIL_TEMPLATE_IDS) {
    const response = await app.handler(request({ action: 'preview', templateAction, settings: defaults() }));
    assert.equal(response.status, 200, templateAction);
    const body = await response.json(); assert.ok(body.subject); assert.match(body.html, /background:#fcf9f0/u); assert.ok(body.text);
  }
  assert.equal(app.sends.length, 0); assert.equal(app.events.some(event => event[0] !== 'auth'), false);
});
test('full 17-template Unicode settings fit the bounded request and retain codepoint limits', async () => {
  const { EMAIL_TEMPLATE_IDS } = await import(await compileSource(new URL('../../lib/email/settings.ts', import.meta.url), temporary));
  const settings = { ...defaults(), templates: Object.fromEntries(EMAIL_TEMPLATE_IDS.map(template => [template, { subject: '🌲'.repeat(160), title: '🌲'.repeat(200), intro: '🌲'.repeat(1000) }])) };
  const body = saveBody({ settings }); assert.ok(new TextEncoder().encode(JSON.stringify(body)).length > 48 * 1024);
  const app = fixture(); assert.equal((await app.handler(request(body))).status, 200); assert.equal(app.state().revision, 1);
});
test('unknown tracking state and an unverified sender domain fail closed before sending', async () => {
  for (const detail of [{ name: 'fabelpad.nl', status: 'verified', records: [] }, { name: 'fabelpad.nl', status: 'pending', open_tracking: false, click_tracking: false, records: [] }]) {
    const app = fixture({ provider: async url => url.endsWith('/domains') ? Response.json({ data: [{ name: 'fabelpad.nl', id: 'synthetic-domain-id' }] }) : Response.json(detail) });
    const response = await app.handler(request(saveBody())); assert.ok([409, 503].includes(response.status)); assert.equal(app.sends.length, 0);
  }
});
test('malformed JSON and bodies above 160KiB are rejected without a provider request', async () => {
  const app = fixture();
  const malformed = request({}); const raw = new Request(malformed.url, { method: 'POST', headers: malformed.headers, body: '{bad' });
  assert.equal((await app.handler(raw)).status, 400);
  assert.equal((await app.handler(request({ excess: 'x'.repeat(161 * 1024) }))).status, 413); assert.equal(app.domains.length, 0); assert.equal(app.sends.length, 0);
});

test('hosted identity requires the exact environment, project and app origin combination', async () => {
  const { validateHostedEmailTarget } = await import(await compileSource(new URL('../../lib/email/hosted-target.ts', import.meta.url), temporary));
  const staging = { FABELPAD_ENVIRONMENT: 'staging', FABELPAD_APP_ORIGIN: 'https://staging.fabelpad.nl', SUPABASE_URL: 'https://tlwfpivafcokcjyjwgmq.supabase.co' };
  const production = { FABELPAD_ENVIRONMENT: 'production', FABELPAD_APP_ORIGIN: 'https://fabelpad.nl', SUPABASE_URL: 'https://aptprpkosqctwrzeetgs.supabase.co' };
  assert.equal(validateHostedEmailTarget(staging), true); assert.equal(validateHostedEmailTarget(production), true);
  for (const incorrect of [
    { ...staging, FABELPAD_APP_ORIGIN: production.FABELPAD_APP_ORIGIN },
    { ...staging, SUPABASE_URL: production.SUPABASE_URL },
    { ...staging, FABELPAD_ENVIRONMENT: production.FABELPAD_ENVIRONMENT },
    { ...production, FABELPAD_APP_ORIGIN: staging.FABELPAD_APP_ORIGIN },
    { ...production, SUPABASE_URL: staging.SUPABASE_URL },
    { ...production, FABELPAD_ENVIRONMENT: staging.FABELPAD_ENVIRONMENT },
    { ...staging, FABELPAD_APP_ORIGIN: 'https://attacker.example.test' },
    { ...production, SUPABASE_URL: 'https://attacker.example.test' },
  ]) assert.equal(validateHostedEmailTarget(incorrect), false);
});
test('both actual Edge entrypoints reject a cross-environment target before reading secrets or making network calls', async () => {
  const previousDeno = globalThis.Deno, previousFetch = globalThis.fetch;
  try {
    for (const name of ['email-admin', 'auth-email']) {
      const reads = []; let served, calls = 0;
      const mismatched = { FABELPAD_ENVIRONMENT: 'staging', FABELPAD_APP_ORIGIN: 'https://fabelpad.nl', SUPABASE_URL: 'https://tlwfpivafcokcjyjwgmq.supabase.co' };
      globalThis.Deno = { env: { get(key) { reads.push(key); assert.ok(Object.hasOwn(mismatched, key), 'No private setting may be read before identity is verified'); return mismatched[key]; } }, serve(handler) { served = handler; } };
      globalThis.fetch = async () => { calls++; throw new Error('No network permitted'); };
      await import(await compileSource(new URL(`../../supabase/functions/${name}/index.ts?cross-environment-check`, import.meta.url), temporary));
      assert.deepEqual(reads.sort(), Object.keys(mismatched).sort());
      assert.equal((await served(request({ action: 'get' }))).status, 503); assert.equal(calls, 0);
    }
  } finally { if (previousDeno === undefined) delete globalThis.Deno; else globalThis.Deno = previousDeno; globalThis.fetch = previousFetch; }
});
