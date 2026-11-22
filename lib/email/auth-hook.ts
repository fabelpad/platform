import { buildSupabaseAuthMessages, type AuthHookPayload, type EmailContext } from './templates.ts';
import { EmailDeliveryError, sendFabelpadEmail } from './resend.ts';

/** Standard Webhooks v1.0.0 HMAC-SHA256 profile. The exact raw UTF-8 request
 * body, webhook ID and original timestamp are verified using Web Crypto's
 * constant-time HMAC verification before parsing any recipient or token.
 * Reference: https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md
 */
const BODY_LIMIT = 20 * 1024;
const TIMESTAMP_TOLERANCE_SECONDS = 300;
const encoder = new TextEncoder();
type Environment = Record<string, string | undefined>;
type HookConfiguration = { context: EmailContext; apiKey: string; from: string; replyTo: string; secret: Uint8Array };
const mailbox = (value: unknown): value is string => typeof value === 'string' && value.length <= 254 && /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/u.test(value);
function decodeBase64(value: string) {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value)) throw new Error('Invalid signature configuration.');
  return Uint8Array.from(atob(value), character => character.charCodeAt(0));
}
function configuration(environment: Environment): HookConfiguration {
  const origin = environment.FABELPAD_APP_ORIGIN ?? '', stage = environment.FABELPAD_ENVIRONMENT;
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.username || url.password || url.origin !== origin || (stage !== 'staging' && stage !== 'production')) throw new Error('Invalid email configuration.');
  const from = environment.FABELPAD_EMAIL_FROM ?? '', fromMatch = /^Fabelpad(?: Staging)? <([^<>]+)>$/u.exec(from);
  const replyTo = environment.FABELPAD_EMAIL_REPLY_TO ?? '';
  if (!fromMatch || !mailbox(fromMatch[1]) || !mailbox(replyTo) || (stage === 'staging' && !from.startsWith('Fabelpad Staging <')) || (stage === 'production' && !from.startsWith('Fabelpad <'))) throw new Error('Invalid email configuration.');
  const apiKey = environment.RESEND_API_KEY ?? '';
  if (!/^re_[A-Za-z0-9_-]{8,}$/u.test(apiKey)) throw new Error('Invalid email configuration.');
  const suppliedSecret = environment.SEND_EMAIL_HOOK_SECRET ?? '';
  if (suppliedSecret.length > 200 || !/^(?:v1,)?whsec_/u.test(suppliedSecret)) throw new Error('Invalid signature configuration.');
  const secret = decodeBase64(suppliedSecret.replace(/^(?:v1,)?whsec_/u, ''));
  if (secret.length < 32 || secret.length > 64) throw new Error('Invalid signature configuration.');
  return { context: { siteUrl: origin, environment: stage }, apiKey, from, replyTo, secret };
}
const json = (status: number, retry = false) => Response.json(status === 200 ? {} : { error: { http_code: status, message: 'Email delivery could not be completed.' } }, {
  status, headers: { 'Cache-Control': 'no-store', ...(retry ? { 'Retry-After': 'true' } : {}), ...(status === 405 ? { Allow: 'POST' } : {}) },
});
async function readBody(request: Request) {
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/u.test(length) || Number(length) > BODY_LIMIT)) throw new Error('Invalid request size.');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Empty request.');
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const boundedRead = async () => {
    const decoder = new TextDecoder('utf-8', { fatal: true }); let body = '', size = 0;
    while (true) {
      const chunk = await reader.read(); if (chunk.done) return body + decoder.decode();
      size += chunk.value.byteLength;
      if (size > BODY_LIMIT) throw new Error('Invalid request size.');
      body += decoder.decode(chunk.value, { stream: true });
    }
  };
  try {
    return await Promise.race([boundedRead(), new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('Request read timeout.')), 750); })]);
  } finally {
    if (timeout) clearTimeout(timeout);
    void reader.cancel().catch(() => {});
  }
}
async function verify(request: Request, body: string, secret: Uint8Array, now: number) {
  const id = request.headers.get('webhook-id') ?? '', timestamp = request.headers.get('webhook-timestamp') ?? '';
  const signatures = request.headers.get('webhook-signature') ?? '';
  if (!/^[A-Za-z0-9_-]{1,200}$/u.test(id) || !/^\d{9,12}$/u.test(timestamp) || signatures.length > 2048 || !Number.isSafeInteger(now)) return null;
  const when = Number(timestamp);
  if (Math.abs(Math.floor(now / 1000) - when) > TIMESTAMP_TOLERANCE_SECONDS) return null;
  const key = await crypto.subtle.importKey('raw', new Uint8Array(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const content = encoder.encode(`${id}.${timestamp}.${body}`);
  const entries = signatures.split(' ').filter(Boolean);
  if (!entries.length || entries.length > 8) return null;
  for (const entry of entries) {
    const match = /^v1,([A-Za-z0-9+/]{43}=)$/u.exec(entry);
    if (!match) continue;
    try { if (await crypto.subtle.verify('HMAC', key, decodeBase64(match[1]), content)) return id; } catch { /* Invalid signatures never reach delivery. */ }
  }
  return null;
}
async function deliveryKey(id: string, slot: string, action: string, environment: string) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(`${environment}\n${id}\n${slot}\n${action}`));
  return `fabelpad-auth/${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')}`;
}
/** Public Edge endpoint, protected by mandatory signed webhooks rather than a
 * JWT (Auth calls it before a user session exists). This function never logs.
 * An HTTP 200 means Resend accepted all sends; it does not prove inbox delivery.
 */
export function createAuthEmailHandler(environment: Environment, options: { fetch?: typeof fetch; now?: () => number } = {}) {
  let config: HookConfiguration | null = null;
  try { config = configuration(environment); } catch { /* Fail closed without exposing which value is absent. */ }
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return json(405);
    if (!config) return json(503);
    if ((request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase() !== 'application/json' || request.headers.has('content-encoding')) return json(415);
    let body: string;
    try { body = await readBody(request); } catch { return json(400); }
    let id: string | null;
    try { id = await verify(request, body, config.secret, (options.now ?? Date.now)()); } catch { return json(401); }
    if (!id) return json(401);
    let payload: AuthHookPayload, messages: ReturnType<typeof buildSupabaseAuthMessages>;
    try { payload = JSON.parse(body); messages = buildSupabaseAuthMessages(payload, config.context); } catch { return json(400); }
    try {
      const settled = await Promise.allSettled(messages.map(async message => sendFabelpadEmail({
        apiKey: config!.apiKey, from: config!.from, replyTo: config!.replyTo, to: message.to, message: message.message,
        idempotencyKey: await deliveryKey(id!, message.recipientSlot, payload.email_data.email_action_type, config!.context.environment),
      }, options.fetch)));
      const failed = settled.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
      if (failed.length) return json(failed.some(result => result.reason instanceof EmailDeliveryError && result.reason.retryable) ? 503 : 502, failed.some(result => result.reason instanceof EmailDeliveryError && result.reason.retryable));
      return json(200);
    } catch { return json(503, true); }
  };
}
