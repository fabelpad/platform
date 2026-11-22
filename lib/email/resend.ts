import type { RenderedEmail } from './templates.ts';

export class EmailDeliveryError extends Error {
  readonly retryable: boolean;
  readonly status: number | null;
  constructor(status: number | null = null) {
    super('Email delivery is not confirmed.');
    this.name = 'EmailDeliveryError'; this.status = status;
    this.retryable = status === null || status === 429 || status >= 500;
  }
}
export type ResendDelivery = {
  apiKey: string; from: string; to: string; message: RenderedEmail;
  idempotencyKey: string; replyTo?: string;
};
const mailbox = (value: string) => typeof value === 'string' && value.length <= 254 && /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/u.test(value) && !/[\r\n]/u.test(value);
/** Server/Edge only. The caller supplies a stable, non-personal outbox/hook ID.
 * A retry uses the exact same message and key; provider idempotency expires at
 * 24 hours, so a durable outbox must not blindly retry beyond that window.
 * No recipient, token, body, secret or upstream diagnostics are logged/thrown.
 */
export async function sendFabelpadEmail(delivery: ResendDelivery, fetcher: typeof fetch = fetch): Promise<{ providerId: string }> {
  // Deno 1 also exposes window; only a real DOM marks a browser runtime.
  if (typeof document !== 'undefined') throw new EmailDeliveryError(403);
  const from = /^[^<>\r\n\u0000-\u001f\u007f]{1,88} <([^<>]+)>$/u.exec(delivery.from);
  if (!/^re_[A-Za-z0-9_-]{8,}$/u.test(delivery.apiKey) || !from || !mailbox(from[1]) || !mailbox(delivery.to) || (delivery.replyTo !== undefined && !mailbox(delivery.replyTo))) throw new EmailDeliveryError(422);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{7,199}$/u.test(delivery.idempotencyKey)) throw new EmailDeliveryError(422);
  if (/[\r\n]/u.test(delivery.message.subject) || !delivery.message.subject || Array.from(delivery.message.subject).length > 200 || delivery.message.html.length > 200_000 || delivery.message.text.length > 50_000) throw new EmailDeliveryError(422);
  const controller = new AbortController();
  let activeReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const perform = async () => {
    let response: Response;
    try {
      response = await fetcher('https://api.resend.com/emails', {
        method: 'POST', redirect: 'error', signal: controller.signal,
        headers: { Authorization: `Bearer ${delivery.apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': delivery.idempotencyKey, 'User-Agent': 'Fabelpad/1.0 (transactional-mail)' },
        body: JSON.stringify({ from: delivery.from, to: [delivery.to], subject: delivery.message.subject, html: delivery.message.html, text: delivery.message.text, ...(delivery.replyTo ? { reply_to: delivery.replyTo } : {}) }),
      });
    } catch { throw new EmailDeliveryError(); }
    if (!response.ok) { try { await response.body?.cancel(); } catch { /* Never retain upstream diagnostics. */ } throw new EmailDeliveryError(response.status); }
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > 4096) { await response.body?.cancel(); throw new EmailDeliveryError(); }
    let payload: unknown;
    try {
      const reader = response.body?.getReader(); if (!reader) throw new Error(); activeReader = reader;
      const decoder = new TextDecoder(); let body = '', size = 0;
      try {
        while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 4096) { await reader.cancel(); throw new Error(); } body += decoder.decode(part.value, { stream: true }); }
        payload = JSON.parse(body + decoder.decode());
      } finally { reader.releaseLock(); activeReader = null; }
    } catch { throw new EmailDeliveryError(); }
    if (typeof payload !== 'object' || payload === null || !('id' in payload) || typeof payload.id !== 'string' || !/^[a-zA-Z0-9-]{8,100}$/u.test(payload.id)) throw new EmailDeliveryError();
    return { providerId: payload.id };
  };
  try {
    return await Promise.race([perform(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); void activeReader?.cancel().catch(() => {}); reject(new EmailDeliveryError()); }, 3_000);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}
