import type { AuthEmailAction } from './templates.ts';

export type EmailTemplateId = AuthEmailAction | 'welcome' | 'account-deletion-requested' | 'account-deleted' | 'service-notice';

/** Safe, plain-text editor values. Layout, OTPs and security instructions stay in code. */
export type EmailTemplateCopy = { subject: string; title: string; intro: string };
export type EmailSettings = {
  fromName: string;
  fromEmail: string;
  replyTo: string;
  supportEmail: string;
  footerText: string;
  templates: Partial<Record<EmailTemplateId, EmailTemplateCopy>>;
};
export type EmailSettingsSnapshot = {
  revision: number;
  settings: EmailSettings;
  keyConfigured: boolean;
  lastTestAt: string | null;
  lastTestProviderId: string | null;
};
export type EmailDeliveryConfig = EmailSettingsSnapshot & { apiKey: string };

// Kept independent from the renderer to avoid a Node/Deno circular dependency.
export const EMAIL_TEMPLATE_ACTIONS = [
  'signup', 'invite', 'magiclink', 'recovery', 'email_change', 'reauthentication',
  'password_changed_notification', 'email_changed_notification', 'phone_changed_notification',
  'identity_linked_notification', 'identity_unlinked_notification',
  'mfa_factor_enrolled_notification', 'mfa_factor_unenrolled_notification',
] as const satisfies readonly AuthEmailAction[];
export const EMAIL_TEMPLATE_IDS = [
  ...EMAIL_TEMPLATE_ACTIONS, 'welcome', 'account-deletion-requested', 'account-deleted', 'service-notice',
] as const satisfies readonly EmailTemplateId[];

export const DEFAULT_EMAIL_SETTINGS: Readonly<EmailSettings> = Object.freeze({
  fromName: 'Fabelpad',
  fromEmail: 'noreply@fabelpad.nl',
  replyTo: 'support@fabelpad.nl',
  supportEmail: 'support@fabelpad.nl',
  footerText: 'Dit is een servicebericht van Fabelpad over je ouderaccount.',
  templates: Object.freeze({}),
});

const ownObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const invalid = (): never => { throw new Error('Ongeldige e-mailinstellingen.'); };
const copy = (value: unknown, maximum: number, multiline = false) => {
  if (typeof value !== 'string') return invalid();
  const normalized = value.replace(/\r\n/gu, '\n').trim();
  const forbidden = multiline ? /[\u0000-\u0009\u000b-\u001f\u007f<>]/u : /[\u0000-\u001f\u007f<>]/u;
  if (!normalized || Array.from(normalized).length > maximum || forbidden.test(normalized)) return invalid();
  return normalized;
};
const mailbox = (value: unknown) => {
  const normalized = copy(value, 254);
  if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,63}$/u.test(normalized)) return invalid();
  return normalized;
};
const exactKeys = (value: Record<string, unknown>, expected: readonly string[]) => Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key));

/** Reject secret-bearing/unknown properties rather than silently persisting them. */
export function parseEmailSettings(value: unknown): EmailSettings {
  if (!ownObject(value) || !exactKeys(value, ['fromName', 'fromEmail', 'replyTo', 'supportEmail', 'footerText', 'templates']) || !ownObject(value.templates)) return invalid();
  const templates: EmailSettings['templates'] = {};
  for (const [action, override] of Object.entries(value.templates)) {
    if (!(EMAIL_TEMPLATE_IDS as readonly string[]).includes(action) || !ownObject(override) || !exactKeys(override, ['subject', 'title', 'intro'])) return invalid();
    templates[action as EmailTemplateId] = { subject: copy(override.subject, 160), title: copy(override.title, 200), intro: copy(override.intro, 1000, true) };
  }
  return {
    fromName: copy(value.fromName, 80), fromEmail: mailbox(value.fromEmail),
    replyTo: mailbox(value.replyTo), supportEmail: mailbox(value.supportEmail),
    footerText: copy(value.footerText, 500, true), templates,
  };
}

/** Use only server-side; the original or parsed key must never be returned to clients. */
export function parseResendApiKey(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Ongeldige Resend API-key.');
  const normalized = value.trim();
  if (!/^re_[A-Za-z0-9_-]{8,250}$/u.test(normalized)) throw new Error('Ongeldige Resend API-key.');
  return normalized;
}
