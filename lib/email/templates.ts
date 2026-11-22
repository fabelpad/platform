/** One Fabelpad design for Supabase Auth and application service messages.
 * Pure rendering: usable in Node and a Supabase Edge Function, with no secrets,
 * network, tracking pixels, external fonts or user-editable HTML.
 */
export const EMAIL_TEMPLATE_VERSION = 'fabelpad-2026-11-22';
export type EmailEnvironment = 'staging' | 'production';
export type RenderedEmail = { subject: string; html: string; text: string };
export type EmailContext = { siteUrl: string; environment: EmailEnvironment };
export type AuthEmailValues = {
  token?: string; confirmationUrl?: string; email?: string; newEmail?: string;
  oldEmail?: string; phone?: string; oldPhone?: string; provider?: string; factorType?: string;
};

export const AUTH_EMAIL_CATALOG = {
  signup: { dashboard: 'Confirm sign up', key: 'confirmation', subject: 'Bevestig je Fabelpad-account', title: 'Welkom bij Fabelpad', intro: 'Met deze code bevestig je je e-mailadres en open je je ouderaccount.', mode: 'otp' },
  invite: { dashboard: 'Invite user', key: 'invite', subject: 'Je bent uitgenodigd voor Fabelpad', title: 'Er ligt een uitnodiging voor je klaar', intro: 'Je bent uitgenodigd om een ouderaccount bij Fabelpad te gebruiken. Accepteer de uitnodiging alleen als je deze verwacht.', mode: 'link' },
  magiclink: { dashboard: 'Magic link or OTP', key: 'magic_link', subject: 'Je inlogcode voor Fabelpad', title: 'Jouw volgende avontuur wacht', intro: 'Gebruik deze eenmalige code om in te loggen op je ouderaccount.', mode: 'otp' },
  recovery: { dashboard: 'Reset password', key: 'recovery', subject: 'Herstel de toegang tot Fabelpad', title: 'We helpen je weer op weg', intro: 'Er is gevraagd om de toegang tot je Fabelpad-account te herstellen. Ga alleen verder als je dit zelf hebt aangevraagd.', mode: 'link' },
  email_change: { dashboard: 'Change email address', key: 'email_change', subject: 'Bevestig je e-mailadres voor Fabelpad', title: 'Een nieuw e-mailadres', intro: 'Er is gevraagd om het e-mailadres van je Fabelpad-account te wijzigen.', mode: 'change' },
  reauthentication: { dashboard: 'Reauthentication', key: 'reauthentication', subject: 'Bevestig dat jij het bent bij Fabelpad', title: 'Even controleren dat jij het bent', intro: 'Gebruik deze eenmalige code om de handeling te bevestigen die je zojuist in je ouderaccount bent gestart.', mode: 'otp' },
  password_changed_notification: { dashboard: 'Password changed', key: 'password_changed_notification', subject: 'Je Fabelpad-wachtwoord is gewijzigd', title: 'Je wachtwoord is gewijzigd', intro: 'Het wachtwoord van je Fabelpad-account is gewijzigd.', mode: 'notification' },
  email_changed_notification: { dashboard: 'Email address changed', key: 'email_changed_notification', subject: 'Je Fabelpad-e-mailadres is gewijzigd', title: 'Je e-mailadres is gewijzigd', intro: 'Het e-mailadres van je Fabelpad-account is gewijzigd.', mode: 'notification' },
  phone_changed_notification: { dashboard: 'Phone number changed', key: 'phone_changed_notification', subject: 'Je Fabelpad-telefoonnummer is gewijzigd', title: 'Je telefoonnummer is gewijzigd', intro: 'Het telefoonnummer van je Fabelpad-account is gewijzigd.', mode: 'notification' },
  identity_linked_notification: { dashboard: 'Sign-in method linked', key: 'identity_linked_notification', subject: 'Een inlogmethode is gekoppeld aan Fabelpad', title: 'Een inlogmethode is gekoppeld', intro: 'Er is een inlogmethode gekoppeld aan je Fabelpad-account.', mode: 'notification' },
  identity_unlinked_notification: { dashboard: 'Sign-in method removed', key: 'identity_unlinked_notification', subject: 'Een inlogmethode is verwijderd uit Fabelpad', title: 'Een inlogmethode is verwijderd', intro: 'Er is een inlogmethode verwijderd uit je Fabelpad-account.', mode: 'notification' },
  mfa_factor_enrolled_notification: { dashboard: 'Verification method added', key: 'mfa_factor_enrolled_notification', subject: 'Een verificatiemethode is toegevoegd aan Fabelpad', title: 'Een verificatiemethode is toegevoegd', intro: 'Er is een extra verificatiemethode toegevoegd aan je Fabelpad-account.', mode: 'notification' },
  mfa_factor_unenrolled_notification: { dashboard: 'Verification method removed', key: 'mfa_factor_unenrolled_notification', subject: 'Een verificatiemethode is verwijderd uit Fabelpad', title: 'Een verificatiemethode is verwijderd', intro: 'Er is een extra verificatiemethode verwijderd uit je Fabelpad-account.', mode: 'notification' },
} as const;
export type AuthEmailAction = keyof typeof AUTH_EMAIL_CATALOG;

const SUPPORT = 'support@fabelpad.nl';
const templateVariable = /^(?:\{\{ \.SiteURL \}\}(?:\/auth\/confirm\?token_hash=\{\{ \.TokenHash \}\}&type=(?:invite|recovery|email_change)&next=\/gezin)?|\{\{ \.ConfirmationURL \}\})$/u;
const escapeHtml = (value: string) => value.replace(/[&<>"']/gu, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
const text = (value: unknown, maximum = 500) => {
  if (typeof value !== 'string' || value.length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) throw new Error('Invalid email content.');
  return value;
};
function safeUrl(value: string, allowTemplate = false) {
  if (allowTemplate && templateVariable.test(value)) return value;
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('Invalid email URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password || value.length > 8192) throw new Error('Invalid email URL.');
  return url.href;
}
function siteUrl(context: EmailContext, allowTemplate: boolean) {
  if (!['staging', 'production'].includes(context.environment)) throw new Error('Invalid email environment.');
  if (allowTemplate && context.siteUrl === '{{ .SiteURL }}') return context.siteUrl;
  const value = safeUrl(context.siteUrl), url = new URL(value);
  if (url.pathname !== '/' || url.search || url.hash) throw new Error('Email site URL must be an origin.');
  return url.origin;
}
type Section = { type: 'paragraph'; value: string } | { type: 'code'; value: string } | { type: 'button'; value: string; url: string };
function renderLayout(subject: string, title: string, introduction: string, sections: Section[], context: EmailContext, allowTemplate = false): RenderedEmail {
  const origin = siteUrl(context, allowTemplate);
  const prefix = context.environment === 'staging' ? '[TEST] ' : '';
  const finalSubject = prefix + text(subject, 180);
  if (/[\r\n]/u.test(finalSubject)) throw new Error('Invalid email subject.');
  const paragraphs = sections.map(section => {
    if (section.type === 'code') return `<tr><td style="padding:8px 0 22px;"><div aria-label="Eenmalige code" style="background:#fcf9f0;border:2px dashed #d8b75f;border-radius:16px;color:#1d503f;font-family:Consolas,monospace;font-size:32px;font-weight:bold;letter-spacing:6px;line-height:1.5;padding:18px 10px;text-align:center;word-break:break-all;">${escapeHtml(text(section.value, 100))}</div></td></tr>`;
    if (section.type === 'button') return `<tr><td style="padding:4px 0 24px;"><a href="${escapeHtml(safeUrl(section.url, allowTemplate))}" style="background:#f9cb52;border-bottom:4px solid #c59832;border-radius:12px;color:#1c4135;display:inline-block;font-size:16px;font-weight:bold;line-height:1.4;padding:14px 22px;text-decoration:none;">${escapeHtml(text(section.value, 100))}</a></td></tr>`;
    return `<tr><td style="color:#53685c;font-size:16px;line-height:1.7;padding:0 0 18px;">${escapeHtml(text(section.value, 4000))}</td></tr>`;
  }).join('\n');
  const badge = context.environment === 'staging' ? '<p style="color:#1d503f;font-size:12px;font-weight:bold;margin:0 0 16px;">TESTOMGEVING — FABELPAD STAGING</p>' : '';
  const footerText = `Dit is een servicebericht van Fabelpad over je ouderaccount. Hulp nodig? Mail ${SUPPORT}.`;
  const html = `<!doctype html>
<html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(finalSubject)}</title></head>
<body style="margin:0;padding:0;background:#fcf9f0;color:#1c4135;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(introduction)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fcf9f0;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;"><tr><td style="padding:0 12px 22px;">
<a href="${escapeHtml(origin)}" style="color:#1d503f;font-family:Georgia,serif;font-size:34px;font-weight:bold;text-decoration:none;">Fabelpad<span aria-hidden="true" style="color:#c59832;"> ✦</span></a><p style="color:#6e7d72;font-size:13px;line-height:1.5;margin:5px 0 0;">Kleine lezers. Grote avonturen.</p></td></tr>
<tr><td style="background:#ffffff;border:1px solid #e3e6d6;border-bottom:6px solid #e9e5d6;border-radius:24px;padding:32px 26px;">${badge}<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td><p style="color:#7b804f;font-size:11px;font-weight:bold;letter-spacing:2px;margin:0 0 12px;">VOOR OUDERS EN VERZORGERS</p><h1 style="color:#1d503f;font-family:Georgia,serif;font-size:29px;line-height:1.2;margin:0 0 20px;">${escapeHtml(text(title, 200))}</h1></td></tr>
<tr><td style="color:#53685c;font-size:16px;line-height:1.7;padding:0 0 22px;">${escapeHtml(text(introduction, 1000))}</td></tr>
${paragraphs}
<tr><td style="border-top:1px solid #e3e6d6;color:#6e7d72;font-size:13px;line-height:1.7;padding-top:20px;">${escapeHtml(footerText)}<br><a href="mailto:${SUPPORT}" style="color:#1d503f;font-weight:bold;">${SUPPORT}</a></td></tr>
</table></td></tr><tr><td align="center" style="color:#6e7d72;font-size:12px;line-height:1.8;padding:22px 10px 0;"><a href="${escapeHtml(origin)}/privacy" style="color:#53685c;">Privacy en gegevens verwijderen</a><br>Deel je inlogcode nooit. Fabelpad vraagt je code niet per e-mail.</td></tr></table>
</td></tr></table></body></html>`;
  const plainSections = sections.map(section => section.type === 'button' ? `${section.value}: ${section.url}` : section.value);
  return { subject: finalSubject, html, text: [prefix ? 'TESTOMGEVING — FABELPAD STAGING' : '', title, introduction, ...plainSections, footerText, `${origin}/privacy`, 'Deel je inlogcode nooit. Fabelpad vraagt je code niet per e-mail.'].filter(Boolean).join('\n\n') };
}

function authEmail(action: AuthEmailAction, values: AuthEmailValues, context: EmailContext, allowTemplate: boolean): RenderedEmail {
  if (!Object.hasOwn(AUTH_EMAIL_CATALOG, action)) throw new Error('Unsupported email action.');
  const definition = AUTH_EMAIL_CATALOG[action];
  const sections: Section[] = [];
  if (definition.mode === 'otp' || definition.mode === 'change') {
    const code = values.token;
    if (typeof code !== 'string' || (!/^\d{6,10}$/u.test(code) && !(allowTemplate && code === '{{ .Token }}'))) throw new Error('A valid one-time code is required.');
    if (definition.mode === 'change') sections.push({ type: 'paragraph', value: `Nieuw e-mailadres: ${text(values.newEmail ?? '', 254)}` });
    sections.push({ type: 'code', value: code });
    sections.push({ type: 'paragraph', value: action === 'email_change' ? 'Vul deze code in bij de e-mailwijziging die je zelf hebt gestart. Als bevestiging van beide adressen nodig is, gebruik je voor elk adres de bijbehorende code.' : action === 'reauthentication' ? 'Vul de code in bij de handeling die je in Fabelpad bent gestart.' : 'Ga terug naar het inlogscherm van Fabelpad en vul de code daar in. Je hoeft geen wachtwoord te onthouden.' });
    sections.push({ type: 'paragraph', value: 'De code is eenmalig geldig en vervalt na korte tijd. Werkt de code niet meer? Vraag in Fabelpad een nieuwe code aan.' });
    if (definition.mode === 'change' && values.confirmationUrl) sections.push({ type: 'button', value: 'E-mailwijziging bevestigen', url: values.confirmationUrl });
  } else if (definition.mode === 'link') {
    if (!values.confirmationUrl) throw new Error('A confirmation URL is required.');
    sections.push({ type: 'button', value: action === 'invite' ? 'Uitnodiging accepteren' : 'Toegang herstellen', url: values.confirmationUrl });
    sections.push({ type: 'paragraph', value: 'Deze persoonlijke link is eenmalig geldig. Stuur dit bericht niet door.' });
  } else {
    if (action === 'email_changed_notification') sections.push({ type: 'paragraph', value: `Vorig e-mailadres: ${text(values.oldEmail ?? '', 254)}. Nieuw e-mailadres: ${text(values.email ?? '', 254)}.` });
    if (action === 'phone_changed_notification') sections.push({ type: 'paragraph', value: `Vorig telefoonnummer: ${text(values.oldPhone ?? '', 80)}. Nieuw telefoonnummer: ${text(values.phone ?? '', 80)}.` });
    if (action.startsWith('identity_')) sections.push({ type: 'paragraph', value: `Inlogmethode: ${text(values.provider ?? '', 80)}.` });
    if (action.startsWith('mfa_')) sections.push({ type: 'paragraph', value: `Verificatiemethode: ${text(values.factorType ?? '', 80)}.` });
  }
  sections.push({ type: 'paragraph', value: definition.mode === 'notification' ? `Heb je deze wijziging niet zelf gedaan? Neem direct contact op via ${SUPPORT} en gebruik alleen de vertrouwde Fabelpad-website om je account te controleren.` : `Niet zelf aangevraagd? Gebruik de code of link niet en deel deze met niemand. Bij twijfel kun je contact opnemen via ${SUPPORT}.` });
  return renderLayout(definition.subject, definition.title, definition.intro, sections, context, allowTemplate);
}
export function renderAuthEmail(action: AuthEmailAction, values: AuthEmailValues, context: EmailContext): RenderedEmail {
  return authEmail(action, values, context, false);
}
/** Paste-ready Go templates. These placeholders are only allowed by this build-time export. */
export function renderSupabaseDashboardTemplate(action: AuthEmailAction, environment: EmailEnvironment = 'production'): RenderedEmail {
  const confirmationUrl = ['invite', 'recovery', 'email_change'].includes(action) ? `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=${action}&next=/gezin` : '{{ .ConfirmationURL }}';
  return authEmail(action, { token: '{{ .Token }}', confirmationUrl, email: '{{ .Email }}', newEmail: '{{ .NewEmail }}', oldEmail: '{{ .OldEmail }}', phone: '{{ .Phone }}', oldPhone: '{{ .OldPhone }}', provider: '{{ .Provider }}', factorType: '{{ .FactorType }}' }, { siteUrl: '{{ .SiteURL }}', environment }, true);
}

export type ServiceEmail =
  | { kind: 'welcome' }
  | { kind: 'account-deletion-requested' }
  | { kind: 'account-deleted' }
  | { kind: 'service-notice'; subject: string; title: string; paragraphs: string[]; action?: { label: string; path: string } };
/** All application transactional mail goes through this same layout, never raw HTML. */
export function renderServiceEmail(message: ServiceEmail, context: EmailContext): RenderedEmail {
  const origin = siteUrl(context, false);
  if (message.kind === 'welcome') return renderLayout('Welkom bij Fabelpad', 'Er wacht een wereld vol verhalen', 'Je ouderaccount bij Fabelpad is klaar voor gebruik.', [{ type: 'button', value: 'Open Fabelpad', url: `${origin}/gezin` }, { type: 'paragraph', value: 'Je kunt op het inlogscherm steeds een nieuwe eenmalige e-mailcode aanvragen.' }], context);
  if (message.kind === 'account-deletion-requested') return renderLayout('Je verwijderverzoek bij Fabelpad', 'We hebben je verzoek ontvangen', 'Je verzoek om je Fabelpad-account en de bijbehorende gegevens te verwijderen is ontvangen.', [{ type: 'paragraph', value: 'Dit bericht bevestigt de ontvangst van je verzoek. Je account en gegevens zijn hiermee nog niet verwijderd. Je ontvangt bericht wanneer het verzoek is afgehandeld.' }], context);
  if (message.kind === 'account-deleted') return renderLayout('Je Fabelpad-account is verwijderd', 'Je account is verwijderd', 'De verwijdering van je Fabelpad-account is afgerond.', [{ type: 'paragraph', value: 'Lees in het privacybeleid welke beperkte bewaartermijnen eventueel gelden. Heb je vragen over je gegevens? Neem dan contact met ons op.' }], context);
  if (message.kind !== 'service-notice' || !Array.isArray(message.paragraphs) || message.paragraphs.length < 1 || message.paragraphs.length > 12) throw new Error('Invalid service email.');
  const sections: Section[] = message.paragraphs.slice(1).map(value => ({ type: 'paragraph', value: text(value, 4000) }));
  if (message.action) {
    if (!message.action.path.startsWith('/') || message.action.path.startsWith('//') || /[\\\r\n]/u.test(message.action.path)) throw new Error('Invalid service email action.');
    const url = new URL(message.action.path, origin);
    if (url.origin !== origin) throw new Error('Invalid service email action.');
    sections.push({ type: 'button', value: message.action.label, url: url.href });
  }
  return renderLayout(message.subject, message.title, text(message.paragraphs[0], 1000), sections, context);
}

export type AuthHookPayload = {
  user: { email?: string; new_email?: string; phone?: string };
  email_data: { email_action_type: string; site_url: string; token?: string; token_hash?: string; token_new?: string; token_hash_new?: string; old_email?: string; old_phone?: string; provider?: string; factor_type?: string };
};
export type AuthEmailMessage = { to: string; message: RenderedEmail; recipientSlot: 'primary' | 'current' | 'new' };
const emailAddress = (value: unknown) => {
  if (typeof value !== 'string' || value.length > 254 || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/u.test(value)) throw new Error('Invalid email recipient.');
  return value;
};
function confirmationLink(site: string, action: 'invite' | 'recovery' | 'email_change', hash: unknown) {
  if (typeof hash !== 'string' || !/^[A-Za-z0-9_-]{16,256}$/u.test(hash)) throw new Error('Invalid confirmation token.');
  const url = new URL('/auth/confirm', site);
  url.searchParams.set('token_hash', hash); url.searchParams.set('type', action); url.searchParams.set('next', '/gezin');
  return url.href;
}
/** Call only after verifying the hook signature and project binding. A redirect
 * from the payload is deliberately ignored; links always target this site.
 * No user_metadata is inserted into messages or used to choose recipients.
 */
export function buildSupabaseAuthMessages(payload: AuthHookPayload, context: EmailContext): AuthEmailMessage[] {
  if (!payload || typeof payload !== 'object' || !payload.user || !payload.email_data) throw new Error('Invalid auth email payload.');
  const site = siteUrl(context, false), data = payload.email_data;
  if (data.site_url !== site && data.site_url !== `${site}/`) throw new Error('Auth email project binding does not match.');
  const actionName = data.email_action_type === 'email' ? 'magiclink' : data.email_action_type;
  if (!Object.hasOwn(AUTH_EMAIL_CATALOG, actionName)) throw new Error('Unsupported email action.');
  const action = actionName as AuthEmailAction;
  const values: AuthEmailValues = { token: data.token, email: payload.user.email, newEmail: payload.user.new_email, oldEmail: data.old_email, phone: payload.user.phone, oldPhone: data.old_phone, provider: data.provider, factorType: data.factor_type };
  if (action === 'email_change') {
    const toNew = emailAddress(payload.user.new_email);
    const twoCodes = Boolean(data.token && data.token_new && data.token_hash && data.token_hash_new);
    if (twoCodes) {
      return [
        { to: emailAddress(payload.user.email), recipientSlot: 'current', message: renderAuthEmail(action, { ...values, token: data.token, confirmationUrl: confirmationLink(site, action, data.token_hash_new) }, context) },
        { to: toNew, recipientSlot: 'new', message: renderAuthEmail(action, { ...values, token: data.token_new, confirmationUrl: confirmationLink(site, action, data.token_hash) }, context) },
      ];
    }
    if (data.token_hash_new) throw new Error('Incomplete email change confirmation.');
    return [{ to: toNew, recipientSlot: 'new', message: renderAuthEmail(action, { ...values, token: data.token_new || data.token, confirmationUrl: confirmationLink(site, action, data.token_hash) }, context) }];
  }
  if (action === 'invite' || action === 'recovery') values.confirmationUrl = confirmationLink(site, action, data.token_hash);
  // Supabase's own mailer notifies the OLD mailbox after an email change.
  const to = emailAddress(action === 'email_changed_notification' ? data.old_email : payload.user.email);
  return [{ to, recipientSlot: 'primary', message: renderAuthEmail(action, values, context) }];
}
