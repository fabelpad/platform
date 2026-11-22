import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileSource } from '../source-test-loader.mjs';

const temporary = await mkdtemp(join(tmpdir(), 'fabelpad-email-tests-'));
after(() => rm(temporary, { recursive: true, force: true }));
const root = new URL('../../', import.meta.url);
const { AUTH_EMAIL_CATALOG, renderSupabaseDashboardTemplate, renderAuthEmail, renderServiceEmail, buildSupabaseAuthMessages } = await import(await compileSource(new URL('lib/email/templates.ts', root), temporary));
const { sendFabelpadEmail, EmailDeliveryError } = await import(await compileSource(new URL('lib/email/resend.ts', root), temporary));
const context = { siteUrl: 'https://fabelpad.example.test', environment: 'production' };
const hook = (action, changes = {}) => ({
  user: { email: 'ouder@example.test', new_email: 'nieuw@example.test', phone: '+31000000000' },
  email_data: { email_action_type: action, site_url: context.siteUrl, token: '123456', token_hash: 'a'.repeat(64), token_new: '', token_hash_new: '', ...changes },
});

test('signup and login show usable OTP without action links consuming it', () => {
  for (const action of ['signup', 'magiclink']) {
    const message = renderAuthEmail(action, { token: '123456' }, context);
    assert.match(message.html, /123456/u);
    assert.match(message.text, /123456/u);
    assert.equal(message.subject.includes('123456'), false);
    assert.equal(message.html.includes('token_hash='), false);
    assert.equal(message.html.includes('auth/v1/verify'), false);
  }
});
test('all 13 Dashboard templates use the common branded layout with no external image or tracking request', () => {
  assert.equal(Object.keys(AUTH_EMAIL_CATALOG).length, 13);
  for (const action of Object.keys(AUTH_EMAIL_CATALOG)) {
    const message = renderSupabaseDashboardTemplate(action);
    assert.match(message.html, /background:#fcf9f0/u);
    assert.match(message.html, /Fabelpad/u);
    assert.match(message.html, /support@fabelpad.nl/u);
    assert.doesNotMatch(message.html, /<(?:script|img|iframe|link)\b/iu);
    assert.equal(message.html.includes('{{ .Data'), false);
    assert.equal(message.subject.includes('{{ .Token'), false);
  }
});
test('invite, recovery and email-change Dashboard links require deliberate confirmation', () => {
  for (const action of ['invite', 'recovery', 'email_change']) assert.equal(renderSupabaseDashboardTemplate(action).html.includes(`/auth/confirm?token_hash={{ .TokenHash }}&amp;type=${action}&amp;next=/gezin`), true);
});
test('staging is visibly distinguished and production is not marked test', () => {
  assert.match(renderAuthEmail('magiclink', { token: '123456' }, { ...context, environment: 'staging' }).subject, /^\[TEST\] /u);
  assert.match(renderSupabaseDashboardTemplate('magiclink', 'staging').html, /TESTOMGEVING/u);
  assert.doesNotMatch(renderSupabaseDashboardTemplate('magiclink').html, /TESTOMGEVING/u);
});
test('HTML and subjects cannot be injected through content or unsupported schemes', () => {
  const message = renderServiceEmail({ kind: 'service-notice', subject: '<wereld>', title: '<script>bad</script>', paragraphs: ['<img src=x onerror=bad> & tekst'], action: { label: '<klik>', path: '/gezin?q=%22' } }, context);
  assert.doesNotMatch(message.html, /<script>|<img src=x/u);
  assert.match(message.html, /&lt;script&gt;bad&lt;\/script&gt;/u);
  assert.throws(() => renderServiceEmail({ kind: 'service-notice', subject: 'Hi\r\nBcc: injected', title: 'Titel', paragraphs: ['Tekst'] }, context));
  for (const path of ['//evil.example.test', '/\\evil.example.test', '/\nmalicious']) assert.throws(() => renderServiceEmail({ kind: 'service-notice', subject: 'Onderwerp', title: 'Titel', paragraphs: ['Tekst'], action: { label: 'Open', path } }, context));
  assert.throws(() => renderAuthEmail('invite', { confirmationUrl: 'javascript:alert(1)' }, context));
  assert.throws(() => renderAuthEmail('magiclink', { token: '{{ .Token }}' }, context));
});
test('hook supports OTP alias, refuses unknown actions and binds project site URL', () => {
  for (const action of ['signup', 'magiclink', 'email']) assert.equal(buildSupabaseAuthMessages(hook(action), context)[0].to, 'ouder@example.test');
  assert.throws(() => buildSupabaseAuthMessages(hook('unsupported'), context));
  assert.throws(() => buildSupabaseAuthMessages(hook('magiclink', { site_url: 'https://another.example.test' }), context));
  assert.throws(() => buildSupabaseAuthMessages(hook('magiclink', { token: '' }), context));
});
test('secure email change sends each token and hash only to its corresponding mailbox', () => {
  const messages = buildSupabaseAuthMessages(hook('email_change', { token_new: '654321', token_hash_new: 'b'.repeat(64) }), context);
  assert.equal(messages.length, 2);
  assert.equal(messages[0].to, 'ouder@example.test'); assert.equal(messages[1].to, 'nieuw@example.test');
  assert.match(messages[0].message.html, /123456/u); assert.doesNotMatch(messages[0].message.html, /654321/u);
  assert.match(messages[0].message.html, new RegExp('token_hash=' + 'b'.repeat(64), 'u'));
  assert.match(messages[1].message.html, /654321/u); assert.doesNotMatch(messages[1].message.html, /123456/u);
  assert.match(messages[1].message.html, new RegExp('token_hash=' + 'a'.repeat(64), 'u'));
});
test('single email change sends to new address and partial dual payload fails closed', () => {
  for (const fields of [{ token: '123456' }, { token: '', token_new: '654321' }]) assert.equal(buildSupabaseAuthMessages(hook('email_change', fields), context)[0].to, 'nieuw@example.test');
  assert.throws(() => buildSupabaseAuthMessages(hook('email_change', { token_hash_new: 'b'.repeat(64) }), context));
});
test('email changed notification reaches old mailbox, and API links ignore untrusted redirects', () => {
  const notification = buildSupabaseAuthMessages(hook('email_changed_notification', { old_email: 'vorig@example.test' }), context);
  assert.equal(notification[0].to, 'vorig@example.test');
  const invite = buildSupabaseAuthMessages(hook('invite', { redirect_to: 'https://evil.example.test/' }), context)[0].message;
  assert.match(invite.html, /https:\/\/fabelpad.example.test\/auth\/confirm\?/u);
  assert.doesNotMatch(invite.html, /evil.example.test/u);
});
test('all application service messages share layout and include plain text', () => {
  for (const message of [{ kind: 'welcome' }, { kind: 'account-deletion-requested' }, { kind: 'account-deleted' }, { kind: 'service-notice', subject: 'Servicebericht', title: 'Titel', paragraphs: ['Eerste alinea', 'Tweede alinea'] }]) {
    const rendered = renderServiceEmail(message, context);
    assert.match(rendered.html, /background:#fcf9f0/u); assert.match(rendered.text, /support@fabelpad.nl/u);
  }
});
const delivery = () => ({ apiKey: 're_synthetic_test_only', from: 'Fabelpad <noreply@example.test>', to: 'ouder@example.test', message: renderAuthEmail('magiclink', { token: '123456' }, context), idempotencyKey: 'fabelpad/production/synthetic-event/primary', replyTo: 'support@fabelpad.nl' });
test('Resend API sends HTML and text with stable idempotency and no redirects', async () => {
  let calls = 0;
  const result = await sendFabelpadEmail(delivery(), async (url, options) => {
    calls++; assert.equal(url, 'https://api.resend.com/emails'); assert.equal(options.redirect, 'error');
    assert.equal(options.headers['Idempotency-Key'], delivery().idempotencyKey);
    const body = JSON.parse(options.body); assert.deepEqual(body.to, ['ouder@example.test']); assert.match(body.text, /123456/u); assert.equal(body.reply_to, 'support@fabelpad.nl');
    return Response.json({ id: 'synthetic-provider-id' });
  });
  assert.deepEqual(result, { providerId: 'synthetic-provider-id' }); assert.equal(calls, 1);
});
test('invalid headers, recipient, sender and idempotency key cannot send', async () => {
  for (const fields of [{ to: 'a@example.test\r\nBcc:b@example.test' }, { from: 'Injected\r\nBcc: bad <noreply@example.test>' }, { apiKey: 'not-key' }, { idempotencyKey: 'short' }]) {
    let called = false;
    await assert.rejects(sendFabelpadEmail({ ...delivery(), ...fields }, async () => { called = true; return Response.json({ id: 'should-not-send' }); }), EmailDeliveryError);
    assert.equal(called, false);
  }
});
test('provider failures hide credentials, OTP, body and diagnostics and classify retryability', async () => {
  for (const status of [400, 401, 403, 409, 422, 429, 500, 503]) {
    await assert.rejects(sendFabelpadEmail(delivery(), async () => Response.json({ error: 'private-provider-diagnostic 123456 re_private' }, { status })), error => {
      assert.equal(error.status, status); assert.equal(error.retryable, status === 429 || status >= 500);
      assert.equal(error.message, 'Email delivery is not confirmed.'); return true;
    });
  }
  await assert.rejects(sendFabelpadEmail(delivery(), async () => { throw new Error('private-network-diagnostic'); }), error => error.retryable && !error.message.includes('private-'));
});
test('oversized or malformed provider responses are bounded and never treated as confirmed', async () => {
  for (const response of [new Response('x'.repeat(5000)), new Response('{bad'), Response.json({ id: 'short' }), Response.json({ id: 'synthetic-provider-id' }, { headers: { 'content-length': '5000' } })]) await assert.rejects(sendFabelpadEmail(delivery(), async () => response), EmailDeliveryError);
});
test('Deno window global can send while a browser DOM is rejected', async () => {
  const hadWindow = Object.hasOwn(globalThis, 'window'), previousWindow = globalThis.window;
  const hadDocument = Object.hasOwn(globalThis, 'document'), previousDocument = globalThis.document;
  try {
    globalThis.window = {};
    assert.deepEqual(await sendFabelpadEmail(delivery(), async () => Response.json({ id: 'synthetic-provider-id' })), { providerId: 'synthetic-provider-id' });
    globalThis.document = {};
    await assert.rejects(sendFabelpadEmail(delivery(), async () => { throw new Error('must not send'); }), error => error instanceof EmailDeliveryError && error.status === 403);
  } finally {
    if (hadWindow) globalThis.window = previousWindow; else delete globalThis.window;
    if (hadDocument) globalThis.document = previousDocument; else delete globalThis.document;
  }
});
test('a stalled provider response body is cancelled within the total three-second budget', async () => {
  let cancelled = false, signal;
  const started = Date.now();
  await assert.rejects(sendFabelpadEmail(delivery(), async (_, options) => {
    signal = options.signal;
    return new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{')); }, cancel() { cancelled = true; } }));
  }), error => error instanceof EmailDeliveryError && error.retryable);
  assert.equal(cancelled, true); assert.equal(signal.aborted, true); assert.ok(Date.now() - started < 4500);
});

test('all four service templates accept edited subject/title/intro through the canonical safe layout', () => {
  const ids = ['welcome', 'account-deletion-requested', 'account-deleted', 'service-notice'];
  for (const id of ids) {
    const settings = { supportEmail: 'hulp@example.test', footerText: 'Gedeelde voettekst', templates: { [id]: { subject: 'Eigen onderwerp', title: 'Eigen titel & uitleg', intro: 'Eigen inleiding' } } };
    const message = renderServiceEmail(id === 'service-notice' ? { kind: id, subject: 'Default', title: 'Default', paragraphs: ['Default'] } : { kind: id }, { ...context, settings });
    assert.equal(message.subject, 'Eigen onderwerp'); assert.match(message.html, /Eigen titel &amp; uitleg/u); assert.match(message.text, /Eigen inleiding/u); assert.match(message.html, /Gedeelde voettekst/u); assert.match(message.html, /hulp@example.test/u);
  }
});
