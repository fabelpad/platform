'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import AdminShell from './AdminShell';
import { useAdminIdentity, type AdminOperation } from './useAdminIdentity';
import { AUTH_EMAIL_CATALOG, SERVICE_EMAIL_CATALOG, renderSupabaseDashboardTemplate, type AuthEmailAction, type RenderedEmail } from '../lib/email/templates';
import { EMAIL_TEMPLATE_IDS, parseEmailSettings, type EmailSettings, type EmailTemplateId } from '../lib/email/settings';

type EmailConfiguration = {
  environment: 'staging' | 'production'; appOrigin: string; configured: boolean;
  source: 'vault' | 'server' | 'none'; revision: number; keyConfigured: boolean;
  settings: EmailSettings; lastTestAt: string | null;
  auth: { emailEnabled: boolean; googleEnabled: boolean };
};
type DomainConfiguration = {
  status: 'verified' | 'pending' | 'restricted' | 'not-configured'; domain: string;
  records: { type: string; name: string; value: string; status: string }[];
  tracking: { open: boolean | null; click: boolean | null };
};
const TEMPLATE_NAMES: Record<EmailTemplateId, string> = {
  signup: 'Account bevestigen', magiclink: 'Inlogcode', invite: 'Uitnodiging', recovery: 'Toegang herstellen',
  email_change: 'Nieuw e-mailadres bevestigen', reauthentication: 'Handeling bevestigen',
  password_changed_notification: 'Wachtwoord gewijzigd', email_changed_notification: 'E-mailadres gewijzigd',
  phone_changed_notification: 'Telefoonnummer gewijzigd', identity_linked_notification: 'Inlogmethode gekoppeld',
  identity_unlinked_notification: 'Inlogmethode verwijderd', mfa_factor_enrolled_notification: 'Verificatiemethode toegevoegd',
  mfa_factor_unenrolled_notification: 'Verificatiemethode verwijderd',
  welcome: 'Welkom bij Fabelpad', 'account-deletion-requested': 'Verwijderverzoek ontvangen',
  'account-deleted': 'Account verwijderd', 'service-notice': 'Algemeen servicebericht',
};
const TEMPLATE_CATALOG = { ...AUTH_EMAIL_CATALOG, ...SERVICE_EMAIL_CATALOG };
const CONNECTION_FIELDS = ['fromName', 'fromEmail', 'replyTo', 'supportEmail', 'footerText'] as const;
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
function mergeOwnChanges(baseline: EmailConfiguration, candidate: EmailSettings, latest: EmailConfiguration, mode: 'connection' | 'templates', hasNewKey: boolean): EmailSettings {
  const merged = structuredClone(latest.settings);
  const conflict = () => { throw new EmailRequestError('Een andere beheerder heeft dezelfde instellingen gewijzigd. Jouw wijzigingen blijven in dit venster. Neem ze over of laad de opgeslagen instellingen opnieuw.', 409); };
  if (mode === 'connection') {
    if (hasNewKey && latest.revision !== baseline.revision) conflict();
    for (const key of CONNECTION_FIELDS) {
      if (same(candidate[key], baseline.settings[key])) continue;
      if (!same(latest.settings[key], baseline.settings[key]) && !same(latest.settings[key], candidate[key])) conflict();
      merged[key] = candidate[key];
    }
  } else {
    for (const key of EMAIL_TEMPLATE_IDS) {
      if (same(candidate.templates[key], baseline.settings.templates[key])) continue;
      if (!same(latest.settings.templates[key], baseline.settings.templates[key]) && !same(latest.settings.templates[key], candidate.templates[key])) conflict();
      if (candidate.templates[key]) merged.templates[key] = candidate.templates[key];
      else delete merged.templates[key];
    }
  }
  return merged;
}
class EmailRequestError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...options });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result || typeof result !== 'object') {
    throw new EmailRequestError(response.status === 409 && result?.error === 'settings_changed' ? 'Een andere beheerder heeft deze instellingen gewijzigd. Jouw wijzigingen blijven in dit venster. Neem ze over of laad de opgeslagen instellingen opnieuw.' : response.status === 401 || response.status === 403 ? 'Je beheersessie is verlopen of je hebt geen toegang. Log opnieuw in als beheerder.' : result?.message || 'De e-mailinstellingen zijn nu niet bereikbaar. Probeer het opnieuw.', response.status);
  }
  return result as T;
}
const dateLabel = (value: string) => new Intl.DateTimeFormat('nl-NL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

export default function EmailSettingsPage({ mode = 'connection' }: { mode?: 'connection' | 'templates' }) {
  const templatesPage = mode === 'templates';
  const loginHref = `/inloggen?next=${encodeURIComponent(templatesPage ? '/studio/email/templates' : '/studio/email')}`;
  const [configuration, setConfiguration] = useState<EmailConfiguration | null>(null);
  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [trackingDisabledConfirmed, setTrackingDisabledConfirmed] = useState(false);
  const [templateCategory, setTemplateCategory] = useState<'all' | 'auth' | 'service'>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplateId>('magiclink');
  const [busy, setBusy] = useState<'save' | 'test' | 'reload' | null>(null);
  const [notice, setNotice] = useState('');
  const [problem, setProblem] = useState('');
  const [domain, setDomain] = useState<DomainConfiguration | null>(null);
  const [domainBusy, setDomainBusy] = useState(false);
  const [domainError, setDomainError] = useState('');
  const [preview, setPreview] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewSubject, setPreviewSubject] = useState('');
  const [previewSnapshot, setPreviewSnapshot] = useState('');
  const previewController = useRef<AbortController | null>(null);
  const [previewVersion, setPreviewVersion] = useState(0);
  const identity = useAdminIdentity(() => { previewController.current?.abort(); setConfiguration(null); setSettings(null); setApiKey(''); setPreview(''); setPreviewSubject(''); setPreviewSnapshot(''); setDomain(null); setTrackingDisabledConfirmed(false); setBusy(null); setDomainBusy(false); setPreviewBusy(false); setProblem(''); setNotice(''); });
  const { session, checked: sessionChecked, denied } = identity;
  async function boundRequest<T>(operation: AdminOperation, url: string, options?: RequestInit): Promise<T> {
    if (!identity.isCurrent(operation)) throw new Error('Superseded administration request');
    const headers = new Headers(options?.headers); headers.set('X-Fabelpad-Parent', operation.parentId);
    const value = await request<T>(url, { ...options, headers });
    if (!identity.isCurrent(operation)) throw new Error('Superseded administration request');
    return value;
  }
  const dirty = !!settings && !!configuration && (JSON.stringify(settings) !== JSON.stringify(configuration.settings) || apiKey.length > 0);
  const canManage = !!session?.admin && !denied;

  function handleError(error: unknown) {
    if (error instanceof EmailRequestError && (error.status === 401 || error.status === 403)) {
      identity.invalidate('Je beheersessie is verlopen of je hebt geen toegang. Log opnieuw in als beheerder.');
    }
    setProblem(error instanceof Error ? error.message : 'Dit lukt nu niet. Probeer het opnieuw.');
  }
  async function loadDomain() {
    const operation = identity.capture(); if (!operation) return;
    setDomainBusy(true); setDomainError('');
    try { const value = await boundRequest<DomainConfiguration>(operation, '/api/admin/email/domain'); if (identity.isCurrent(operation)) setDomain(value); }
    catch (error) {
      if (!identity.isCurrent(operation)) return;
      if (error instanceof EmailRequestError && (error.status === 401 || error.status === 403)) handleError(error);
      else setDomainError('De domeinstatus kan nu niet worden opgehaald. Controleer deze in Resend of probeer het opnieuw.');
    } finally { if (identity.isCurrent(operation)) setDomainBusy(false); }
  }
  async function loadSettings() {
    const operation = identity.capture(); if (!operation) return;
    setBusy('reload'); setProblem(''); setNotice(''); setApiKey('');
    try { const data = await boundRequest<EmailConfiguration>(operation, '/api/admin/email'); if (!identity.isCurrent(operation)) return; setConfiguration(data); setSettings(structuredClone(data.settings)); setPreviewVersion(value => value + 1); }
    catch (error) { if (identity.isCurrent(operation)) handleError(error); }
    finally { if (identity.isCurrent(operation)) setBusy(null); }
  }
  useEffect(() => { if (canManage) { void loadSettings(); void loadDomain(); } }, [canManage]);
  async function loadPreview(candidateSettings: EmailSettings, action: EmailTemplateId) {
    const operation = identity.capture(); if (!operation) return;
    previewController.current?.abort();
    const controller = new AbortController(); previewController.current = controller;
    setPreviewBusy(true); setPreviewError('');
    try {
      const result = await boundRequest<{ html: string; subject: string }>(operation, '/api/admin/email/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ templateAction: action, settings: candidateSettings }) });
      if (!controller.signal.aborted && identity.isCurrent(operation)) {
        setPreview(`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; form-action 'none'; base-uri 'none'">${result.html}`);
        setPreviewSubject(result.subject); setPreviewSnapshot(JSON.stringify(candidateSettings));
      }
    } catch (error) {
      if (!controller.signal.aborted && identity.isCurrent(operation)) {
        if (error instanceof EmailRequestError && (error.status === 401 || error.status === 403)) handleError(error);
        else setPreviewError('Het voorbeeld is nu niet beschikbaar. Controleer je teksten en probeer het opnieuw.');
      }
    } finally { if (!controller.signal.aborted && identity.isCurrent(operation)) setPreviewBusy(false); }
  }
  useEffect(() => {
    if (canManage && configuration && templatesPage) { setPreview(''); void loadPreview(configuration.settings, selectedTemplate); }
    return () => previewController.current?.abort();
  }, [canManage, configuration?.revision, selectedTemplate, previewVersion, templatesPage]);
  useEffect(() => {
    const leave = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener('beforeunload', leave); return () => window.removeEventListener('beforeunload', leave);
  }, [dirty]);
  function updateSetting<K extends keyof Omit<EmailSettings, 'templates'>>(key: K, value: EmailSettings[K]) {
    setSettings(current => current && { ...current, [key]: value }); setNotice('');
  }
  function updateTemplate(key: 'subject' | 'title' | 'intro', value: string) {
    setSettings(current => {
      if (!current) return current;
      const definition = TEMPLATE_CATALOG[selectedTemplate];
      const copy = current.templates[selectedTemplate] || { subject: definition.subject, title: definition.title, intro: definition.intro };
      return { ...current, templates: { ...current.templates, [selectedTemplate]: { ...copy, [key]: value } } };
    }); setNotice('');
  }
  async function save(event: FormEvent) {
    event.preventDefault(); const operation = identity.capture(); if (!operation || !settings || !configuration || busy) return;
    setBusy('save'); setProblem(''); setNotice('');
    try {
      const latest = await boundRequest<EmailConfiguration>(operation, '/api/admin/email');
      const mergedSettings = mergeOwnChanges(configuration, settings, latest, mode, !!apiKey);
      const data = await boundRequest<EmailConfiguration & { test: { accepted: true } }>(operation, '/api/admin/email', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseRevision: latest.revision, requestId: crypto.randomUUID(), ...(apiKey ? { apiKey } : {}), settings: mergedSettings, trackingDisabledConfirmed }) });
      if (!identity.isCurrent(operation)) return;
      setConfiguration(data); setSettings(structuredClone(data.settings)); setPreviewVersion(value => value + 1);
      setNotice('Je instellingen zijn opgeslagen. Resend heeft de testmail geaccepteerd voor verzending naar jouw beheerdersadres. Controleer je inbox en spammap; dit bevestigt nog geen aflevering.');
      void loadDomain();
    } catch (error) { if (identity.isCurrent(operation)) handleError(error); }
    finally { if (identity.isCurrent(operation)) { setApiKey(''); setBusy(null); } }
  }
  async function sendTest() {
    const operation = identity.capture();
    if (!operation || !configuration || busy || dirty) return;
    setBusy('test'); setProblem(''); setNotice('');
    try {
      const result = await boundRequest<{ accepted: true; acceptedAt: string }>(operation, '/api/admin/email/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision: configuration.revision, requestId: crypto.randomUUID(), trackingDisabledConfirmed }) });
      if (!identity.isCurrent(operation)) return;
      setConfiguration(current => current && { ...current, lastTestAt: result.acceptedAt });
      setNotice('Resend heeft de testmail geaccepteerd voor verzending naar jouw beheerdersadres. Controleer je inbox en spammap; dit bevestigt nog geen aflevering.');
    } catch (error) { if (identity.isCurrent(operation)) handleError(error); }
    finally { if (identity.isCurrent(operation)) { setApiKey(''); setBusy(null); } }
  }
  const selectedCopy = settings && { ...TEMPLATE_CATALOG[selectedTemplate], ...settings.templates[selectedTemplate] };
  const authTemplate = Object.hasOwn(AUTH_EMAIL_CATALOG, selectedTemplate) ? selectedTemplate as AuthEmailAction : null;
  let smtpExport: RenderedEmail | null = null;
  if (templatesPage && authTemplate && settings && configuration) {
    try { smtpExport = renderSupabaseDashboardTemplate(authTemplate, configuration.environment, parseEmailSettings(settings)); }
    catch { /* The editor remains usable while required text is incomplete. */ }
  }
  async function copySmtpTemplate(part: 'subject' | 'html') {
    const operation = identity.capture(); if (!operation || !smtpExport) return;
    setProblem('');
    try { await navigator.clipboard.writeText(part === 'html' ? smtpExport.html : smtpExport.subject); if (!identity.isCurrent(operation)) return; setNotice(`${part === 'html' ? 'HTML' : 'Onderwerp'} gekopieerd voor deze omgeving. Plak dit zelf in de juiste Supabase-template.`); }
    catch { if (!identity.isCurrent(operation)) return; setProblem('Kopiëren is niet beschikbaar in deze browser. Download de HTML of selecteer het getoonde onderwerp.'); }
  }
  function downloadSmtpTemplate() {
    if (!identity.capture() || !smtpExport || !authTemplate || !configuration) return;
    try {
      const url = URL.createObjectURL(new Blob([smtpExport.html], { type: 'text/html;charset=utf-8' }));
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `fabelpad-${configuration.environment}-${AUTH_EMAIL_CATALOG[authTemplate].key}.html`;
      document.body.append(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice('De HTML is gedownload. Neem ook het getoonde onderwerp handmatig over in Supabase voor deze omgeving. Er zijn geen Supabase-instellingen gewijzigd.');
    } catch { setProblem('Downloaden lukt nu niet. Controleer je browser en probeer het opnieuw.'); }
  }
  return <AdminShell><div className="email-settings-page">

    <div className="email-heading"><div><span className="email-eyebrow">Fabelpad beheer</span><h1>{templatesPage ? 'E-mailtemplates.' : 'E-mailinstellingen.'}</h1><p>{templatesPage ? 'Bekijk en bewerk alle account- en serviceberichten op één plek.' : 'Koppel Resend en geef alle e-mails dezelfde vertrouwde Fabelpad-uitstraling.'}</p></div>{configuration && <span className={`email-environment email-environment-${configuration.environment}`}>{configuration.environment === 'staging' ? 'Staging · testomgeving' : 'Production · live omgeving'}</span>}</div>
    {!sessionChecked ? <p role="status">Beheerrechten controleren…</p> : denied ? <p className="notice"><a href={loginHref}>Opnieuw inloggen als beheerder →</a></p> : !session ? <p className="notice">Je beheersessie kon niet worden gecontroleerd. <a href={loginHref}>Naar inloggen</a></p> : !session.configured ? <p className="notice">De beheeromgeving is nog niet aangesloten.</p> : !session.parent ? <a className="account-primary email-login" href={loginHref}>Inloggen als beheerder</a> : !session.admin ? <p className="notice">Dit account heeft geen toegang tot de e-mailinstellingen.</p> : <>
      {!configuration && busy && <p role="status">E-mailinstellingen ophalen…</p>}
      {!configuration && !busy && <button className="account-secondary" onClick={() => { void loadSettings(); }}>Opnieuw proberen</button>}
      {configuration && settings && <>
        <section className="email-status-card" aria-labelledby="email-connection-heading"><div><span className={`email-status-dot${configuration.configured ? ' connected' : ''}`} aria-hidden="true"/><h2 id="email-connection-heading">{configuration.configured ? 'Resend is gekoppeld' : 'Koppel je Resend-account'}</h2></div><p>{configuration.configured ? 'Je opgeslagen instellingen worden gebruikt voor Fabelpad-e-mails in deze omgeving.' : 'Vul de verzendinstellingen en je Resend API-key in. We testen de verzending voordat we de koppeling opslaan.'}</p><dl><div><dt>Deze omgeving</dt><dd>{configuration.appOrigin}</dd></div><div><dt>Testontvanger</dt><dd>{session.parent.email}</dd></div><div><dt>Inloggen met e-mailcode</dt><dd>{configuration.auth.emailEnabled ? 'Ingeschakeld' : 'Nog niet ingeschakeld'}</dd></div>{configuration.lastTestAt && <div><dt>Laatste geaccepteerde testmail</dt><dd>{dateLabel(configuration.lastTestAt)}</dd></div>}</dl>{!configuration.auth.emailEnabled && <p className="email-note">De verzendkoppeling en het inloggen met e-mail zijn aparte instellingen. Na het koppelen moet de e-mailroute voor deze omgeving ook zijn geactiveerd.</p>}</section>
        <form onSubmit={event => { void save(event); }} autoComplete="off">
          <fieldset disabled={!!busy} className="email-fieldset">{!templatesPage && <section className="email-card" aria-labelledby="email-sender-heading"><h2 id="email-sender-heading">Afzender en contact</h2><p>Gebruik een afzender op een domein dat in Resend is geverifieerd.</p><div className="email-field-grid"><label>Naam afzender<input required maxLength={80} value={settings.fromName} onChange={event => updateSetting('fromName', event.target.value)} /></label><label>E-mailadres afzender<input type="email" required maxLength={254} value={settings.fromEmail} onChange={event => updateSetting('fromEmail', event.target.value)} /></label><label>Antwoordadres<input type="email" required maxLength={254} value={settings.replyTo} onChange={event => updateSetting('replyTo', event.target.value)} /></label><label>Supportadres in e-mails<input type="email" required maxLength={254} value={settings.supportEmail} onChange={event => updateSetting('supportEmail', event.target.value)} /></label></div><label>Tekst onderaan applicatiemails en template-exports<textarea required rows={3} maxLength={500} value={settings.footerText} onChange={event => updateSetting('footerText', event.target.value)} /></label><label>Resend API-key{configuration.keyConfigured && <span className="email-key-state">Er is al een API-key opgeslagen. Laat dit veld leeg om die te behouden.</span>}<input name="resend-connection-key" type="password" autoComplete="new-password" autoCapitalize="none" spellCheck={false} required={!configuration.keyConfigured} maxLength={512} value={apiKey} onChange={event => { setApiKey(event.target.value); setNotice(''); }} aria-describedby="email-key-help" /></label><p id="email-key-help" className="email-note">Maak de API-key aan in <a href="https://resend.com/api-keys" target="_blank" rel="noreferrer">Resend → API Keys</a>. Kies bij voorkeur alleen verzendrechten voor je Fabelpad-domein. Je opgeslagen key wordt hier nooit teruggetoond.</p><p><a href="/studio/email/templates">Alle e-mailtemplates bekijken en aanpassen →</a></p></section>}
          {templatesPage && <><div className="admin-template-toolbar"><label>Templatecategorie<select value={templateCategory} onChange={event => { const category = event.target.value as 'all' | 'auth' | 'service'; setTemplateCategory(category); const allowed = category === 'all' || (category === 'auth' ? Object.hasOwn(AUTH_EMAIL_CATALOG, selectedTemplate) : Object.hasOwn(SERVICE_EMAIL_CATALOG, selectedTemplate)); if (!allowed) setSelectedTemplate(EMAIL_TEMPLATE_IDS.find(action => category === 'auth' ? Object.hasOwn(AUTH_EMAIL_CATALOG, action) : Object.hasOwn(SERVICE_EMAIL_CATALOG, action))!); }}><option value="all">Alle 17 templates</option><option value="auth">Accountmails (13)</option><option value="service">Serviceberichten (4)</option></select></label><p>13 accountmails · 4 serviceberichten<br />Iedere template heeft een eigen onderwerp en tekst.</p></div><div className="email-template-layout"><nav className="email-template-list" aria-label="Alle e-mailtemplates">{templateCategory !== 'service' && <h2>Accountmails</h2>}{EMAIL_TEMPLATE_IDS.filter(action => templateCategory !== 'service' && Object.hasOwn(AUTH_EMAIL_CATALOG, action)).map(action => <button key={action} type="button" aria-pressed={selectedTemplate === action} onClick={() => setSelectedTemplate(action)}><span>{TEMPLATE_NAMES[action]}</span><small>{settings.templates[action] ? 'Aangepaste tekst' : 'Standaardtekst'}</small></button>)}{templateCategory !== 'auth' && <h2>Serviceberichten</h2>}{EMAIL_TEMPLATE_IDS.filter(action => templateCategory !== 'auth' && Object.hasOwn(SERVICE_EMAIL_CATALOG, action)).map(action => <button key={action} type="button" aria-pressed={selectedTemplate === action} onClick={() => setSelectedTemplate(action)}><span>{TEMPLATE_NAMES[action]}</span><small>{settings.templates[action] ? 'Aangepaste tekst' : 'Standaardtekst'}</small></button>)}</nav><div className="email-template-detail"><section className="email-card email-template-editor" aria-labelledby="email-copy-heading"><h2 id="email-copy-heading">{TEMPLATE_NAMES[selectedTemplate]}</h2><p>Pas onderwerp, kop en introductie aan. Codes, bevestigingsknoppen en beveiligingsinformatie blijven in de vaste opmaak. Een template schakelt de bijbehorende functie niet in.</p>{selectedCopy && <><label>Onderwerp<input required maxLength={160} value={selectedCopy.subject} onChange={event => updateTemplate('subject', event.target.value)} /></label><label>Kop in de e-mail<input required maxLength={200} value={selectedCopy.title} onChange={event => updateTemplate('title', event.target.value)} /></label><label>Introductie<textarea required rows={4} maxLength={1000} value={selectedCopy.intro} onChange={event => updateTemplate('intro', event.target.value)} /></label><button type="button" className="account-secondary email-reset" disabled={!settings.templates[selectedTemplate]} onClick={() => { setSettings(current => { if (!current) return current; const templates = { ...current.templates }; delete templates[selectedTemplate]; return { ...current, templates }; }); setNotice(''); }}>Standaardtekst voor deze e-mail herstellen</button></>}</section>{authTemplate ? <section className="email-card" aria-labelledby="smtp-export-heading"><h2 id="smtp-export-heading">Overnemen in Supabase</h2><p>Inlogcodes en accountmails worden via Supabase custom SMTP verstuurd. Bewaren in Fabelpad wijzigt deze Supabase-templates niet automatisch. Gebruik onderstaande export voor de teksten die nu in de editor staan, ook als je die nog niet hebt opgeslagen.</p><ol><li>Open het Supabase-project van <strong>{configuration.environment === 'staging' ? 'staging' : 'production'}</strong>.</li><li>Ga naar <strong>Authentication → Email Templates → {AUTH_EMAIL_CATALOG[authTemplate].dashboard}</strong>.</li><li>Neem het onderwerp hieronder over. Download de HTML, open het bestand als tekst en plak de volledige inhoud in het HTML-veld van die template. Bewaar die wijziging in Supabase.</li><li>Controleer met de bijbehorende accountactie of de e-mail klopt. Herhaal dit afzonderlijk voor de andere omgeving.</li></ol>{smtpExport ? <label>Onderwerp voor Supabase<input readOnly value={smtpExport.subject} onFocus={event => event.target.select()} /></label> : <p className="email-note">Maak de vereiste teksten compleet en gebruik gewone tekst zonder dubbele accolades. Fabelpad voegt de benodigde Supabase-variabelen zelf toe.</p>}<div className="admin-copy-actions"><button type="button" className="account-secondary" disabled={!smtpExport || !!busy} onClick={() => void copySmtpTemplate('subject')}>Onderwerp kopiëren</button><button type="button" className="account-secondary" disabled={!smtpExport || !!busy} onClick={() => void copySmtpTemplate('html')}>HTML kopiëren voor Supabase</button><button type="button" className="account-secondary" disabled={!smtpExport || !!busy} onClick={downloadSmtpTemplate}>HTML downloaden voor Supabase</button></div><p className="email-note">De export bevat vaste Supabase-velden zoals <code>{'{{ .Token }}'}</code>, geen echte inlogcode of sleutel. Laat custom SMTP ingeschakeld; voor deze werkwijze activeer je geen Send Email Hook. Afzender en SMTP-toegang stel je afzonderlijk in Supabase in.</p></section> : <section className="email-card"><h2>Servicebericht vanuit Fabelpad</h2><p>Deze template wordt door de applicatie gebruikt via de Resend-API. Na opslaan gebruiken nieuwe serviceberichten de bewaarde teksten; al klaargezette berichten behouden hun vastgelegde inhoud. Voor dit bericht is geen Supabase SMTP-template nodig.</p></section>}<section className="email-card" aria-labelledby="email-preview-heading"><div className="email-section-heading"><h2 id="email-preview-heading">E-mailvoorbeeld</h2><button type="button" className="account-secondary" disabled={previewBusy || !!busy} onClick={() => { void loadPreview(settings, selectedTemplate); }}>{previewBusy ? 'Voorbeeld laden…' : 'Voorbeeld bijwerken'}</button></div><p>{TEMPLATE_NAMES[selectedTemplate]} · Dit voorbeeld bevat uitsluitend fictieve gegevens en een onbruikbare voorbeeldcode. Er wordt geen e-mail verstuurd.</p>{preview && previewSnapshot !== JSON.stringify(settings) && <p className="email-note">Je teksten zijn gewijzigd. Kies ‘Voorbeeld bijwerken’ om ze te bekijken voordat je opslaat.</p>}{previewSubject && <p><strong>Onderwerp:</strong> {previewSubject}</p>}{previewError ? <p role="status">{previewError}</p> : preview ? <iframe title={`E-mailvoorbeeld: ${TEMPLATE_NAMES[selectedTemplate]}`} sandbox="" referrerPolicy="no-referrer" srcDoc={preview} className="email-preview" /> : <p role="status">Voorbeeld laden…</p>}</section></div></div></>}
          <div className="email-save-panel"><label className="email-tracking-confirmation"><input type="checkbox" required checked={trackingDisabledConfirmed} onChange={event => setTrackingDisabledConfirmed(event.target.checked)} /><span>Open- en kliktracking staan uit in Resend</span></label><p className="email-note">Controleer dit bij je domein in Resend voordat je een test verstuurt. Zo blijven eenmalige codes en links ongewijzigd.</p>{templatesPage && !configuration.keyConfigured && <p><a href="/studio/email">Koppel eerst Resend om templates te kunnen opslaan en testen.</a> Je kunt de teksten wel alvast aanpassen en bekijken.</p>}<p>{dirty ? 'Je hebt wijzigingen die nog niet zijn opgeslagen.' : 'Je bekijkt de opgeslagen instellingen.'}</p><p>Een testmail gaat alleen naar jouw ingelogde beheerdersadres. Opslaan lukt pas als Resend de test accepteert.</p><div className="account-actions"><button type="submit" className="account-primary" disabled={!trackingDisabledConfirmed || (templatesPage && !configuration.keyConfigured)}>{busy === 'save' ? 'Koppeling testen en opslaan…' : 'Opslaan en testmail versturen'}</button><button type="button" className="account-secondary" disabled={!configuration.keyConfigured || dirty || !trackingDisabledConfirmed} onClick={() => { void sendTest(); }}>{busy === 'test' ? 'Testmail versturen…' : 'Testmail opnieuw versturen'}</button><button type="button" className="account-secondary" onClick={() => { if (!dirty || window.confirm('Je onopgeslagen wijzigingen verlaten en de opgeslagen instellingen opnieuw laden?')) void loadSettings(); }}>Opgeslagen instellingen opnieuw laden</button></div></div>
          </fieldset>
        </form>
        {!templatesPage && <section className="email-card" aria-labelledby="email-domain-heading"><div className="email-section-heading"><h2 id="email-domain-heading">Verzenddomein</h2><button type="button" className="account-secondary" disabled={domainBusy || !!busy} onClick={() => { void loadDomain(); }}>{domainBusy ? 'Controleren…' : 'Domeinstatus vernieuwen'}</button></div>{domainError ? <p role="status">{domainError}</p> : !domain ? <p role="status">Domeinstatus ophalen…</p> : <><p>{domain.status === 'verified' ? `Het verzenddomein ${domain.domain} is geverifieerd.` : domain.status === 'pending' ? `Het verzenddomein ${domain.domain} wacht nog op verificatie.` : domain.status === 'restricted' ? 'Je API-key kan e-mail versturen, maar heeft geen rechten om domeingegevens op te vragen. De verzendkoppeling kan gewoon worden gebruikt. Controleer domeinverificatie en tracking in Resend.' : 'Koppel Resend om het verzenddomein te controleren.'}</p>{domain.records.length > 0 && <div className="email-records-scroll" role="region" aria-label="DNS-records voor het verzenddomein" tabIndex={0}><table><thead><tr><th scope="col">Type</th><th scope="col">Naam</th><th scope="col">Waarde</th><th scope="col">Status</th></tr></thead><tbody>{domain.records.map((record, index) => <tr key={`${record.type}-${record.name}-${index}`}><td>{record.type}</td><td><code>{record.name}</code></td><td><code>{record.value}</code></td><td>{record.status}</td></tr>)}</tbody></table></div>}{domain.status !== 'not-configured' && <p className="email-note">Opentracking: {domain.tracking.open === null ? 'niet opvraagbaar' : domain.tracking.open ? 'aan' : 'uit'} · Kliktracking: {domain.tracking.click === null ? 'niet opvraagbaar' : domain.tracking.click ? 'aan' : 'uit'}. Laat beide uit voor accountmails met eenmalige codes of links.</p>}</>}<p><a href="https://resend.com/domains" target="_blank" rel="noreferrer">Open domeininstellingen in Resend →</a></p></section>}
      </>}
    </>}
    {(problem || identity.error) && <p className="account-feedback email-feedback email-error" role="alert">{problem || identity.error}</p>}{notice && <p className="account-feedback email-feedback" role="status">{notice}</p>}
  </div></AdminShell>;
}
