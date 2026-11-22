'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { PageShell, type AccountSession } from './AccountPage';
import { AUTH_EMAIL_CATALOG, SERVICE_EMAIL_CATALOG } from '../lib/email/templates';
import { EMAIL_TEMPLATE_IDS, type EmailSettings, type EmailTemplateId } from '../lib/email/settings';

type EmailConfiguration = {
  environment: 'staging' | 'production'; appOrigin: string; configured: boolean;
  source: 'vault' | 'server' | 'none'; revision: number; keyConfigured: boolean;
  settings: EmailSettings; lastTestAt: string | null;
  auth: { emailEnabled: boolean; googleEnabled: false };
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
  const [session, setSession] = useState<AccountSession | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [denied, setDenied] = useState(false);
  const [configuration, setConfiguration] = useState<EmailConfiguration | null>(null);
  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [trackingDisabledConfirmed, setTrackingDisabledConfirmed] = useState(false);
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
  const dirty = !!settings && !!configuration && (JSON.stringify(settings) !== JSON.stringify(configuration.settings) || apiKey.length > 0);
  const canManage = !!session?.admin && !denied;

  function handleError(error: unknown) {
    if (error instanceof EmailRequestError && (error.status === 401 || error.status === 403)) {
      setDenied(true); setConfiguration(null); setSettings(null); setApiKey(''); setPreview(''); setDomain(null);
    }
    setProblem(error instanceof Error ? error.message : 'Dit lukt nu niet. Probeer het opnieuw.');
  }
  async function loadDomain() {
    setDomainBusy(true); setDomainError('');
    try { setDomain(await request<DomainConfiguration>('/api/admin/email/domain')); }
    catch (error) {
      if (error instanceof EmailRequestError && (error.status === 401 || error.status === 403)) handleError(error);
      else setDomainError('De domeinstatus kan nu niet worden opgehaald. Controleer deze in Resend of probeer het opnieuw.');
    } finally { setDomainBusy(false); }
  }
  async function loadSettings() {
    setBusy('reload'); setProblem(''); setNotice(''); setApiKey('');
    try { const data = await request<EmailConfiguration>('/api/admin/email'); setConfiguration(data); setSettings(structuredClone(data.settings)); setPreviewVersion(value => value + 1); }
    catch (error) { handleError(error); }
    finally { setBusy(null); }
  }
  useEffect(() => {
    const controller = new AbortController();
    request<AccountSession>('/api/auth/session', { signal: controller.signal }).then(data => { setSession(data); setSessionChecked(true); }).catch(error => {
      if (!controller.signal.aborted) { setProblem(error instanceof Error ? error.message : 'Je accountverbinding is niet bereikbaar.'); setSessionChecked(true); }
    });
    return () => controller.abort();
  }, []);
  useEffect(() => { if (canManage) { void loadSettings(); void loadDomain(); } }, [canManage]);
  async function loadPreview(candidateSettings: EmailSettings, action: EmailTemplateId) {
    previewController.current?.abort();
    const controller = new AbortController(); previewController.current = controller;
    setPreviewBusy(true); setPreviewError('');
    try {
      const result = await request<{ html: string; subject: string }>('/api/admin/email/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ templateAction: action, settings: candidateSettings }) });
      if (!controller.signal.aborted) {
        setPreview(`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; form-action 'none'; base-uri 'none'">${result.html}`);
        setPreviewSubject(result.subject); setPreviewSnapshot(JSON.stringify(candidateSettings));
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        if (error instanceof EmailRequestError && (error.status === 401 || error.status === 403)) handleError(error);
        else setPreviewError('Het voorbeeld is nu niet beschikbaar. Controleer je teksten en probeer het opnieuw.');
      }
    } finally { if (!controller.signal.aborted) setPreviewBusy(false); }
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
    event.preventDefault(); if (!settings || !configuration || busy) return;
    setBusy('save'); setProblem(''); setNotice('');
    try {
      const latest = await request<EmailConfiguration>('/api/admin/email');
      const mergedSettings = mergeOwnChanges(configuration, settings, latest, mode, !!apiKey);
      const data = await request<EmailConfiguration & { test: { accepted: true } }>('/api/admin/email', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseRevision: latest.revision, requestId: crypto.randomUUID(), ...(apiKey ? { apiKey } : {}), settings: mergedSettings, trackingDisabledConfirmed }) });
      setConfiguration(data); setSettings(structuredClone(data.settings)); setPreviewVersion(value => value + 1);
      setNotice('Je instellingen zijn opgeslagen. Resend heeft de testmail geaccepteerd voor verzending naar jouw beheerdersadres. Controleer je inbox en spammap; dit bevestigt nog geen aflevering.');
      void loadDomain();
    } catch (error) { handleError(error); }
    finally { setApiKey(''); setBusy(null); }
  }
  async function sendTest() {
    if (!configuration || busy || dirty) return;
    setBusy('test'); setProblem(''); setNotice('');
    try {
      const result = await request<{ accepted: true; acceptedAt: string }>('/api/admin/email/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision: configuration.revision, requestId: crypto.randomUUID(), trackingDisabledConfirmed }) });
      setConfiguration(current => current && { ...current, lastTestAt: result.acceptedAt });
      setNotice('Resend heeft de testmail geaccepteerd voor verzending naar jouw beheerdersadres. Controleer je inbox en spammap; dit bevestigt nog geen aflevering.');
    } catch (error) { handleError(error); }
    finally { setApiKey(''); setBusy(null); }
  }
  const selectedCopy = settings && { ...TEMPLATE_CATALOG[selectedTemplate], ...settings.templates[selectedTemplate] };
  return <PageShell adminNavigation={canManage}><div className="email-settings-page">
    <nav className="studio-navigation" aria-label="Beheeronderdelen"><a href="/studio">Verhalen</a><a href="/studio/email" aria-current={!templatesPage ? 'page' : undefined}>E-mailinstellingen</a><a href="/studio/email/templates" aria-current={templatesPage ? 'page' : undefined}>E-mailtemplates</a></nav>
    <div className="email-heading"><div><span className="email-eyebrow">Fabelpad beheer</span><h1>{templatesPage ? 'Alle e-mails, één Fabelpad.' : 'E-mail met een eigen verhaal.'}</h1><p>{templatesPage ? 'Bekijk en bewerk alle account- en serviceberichten op één plek.' : 'Koppel Resend en geef alle e-mails dezelfde vertrouwde Fabelpad-uitstraling.'}</p></div>{configuration && <span className={`email-environment email-environment-${configuration.environment}`}>{configuration.environment === 'staging' ? 'Staging · testomgeving' : 'Production · live omgeving'}</span>}</div>
    {!sessionChecked ? <p role="status">Beheerrechten controleren…</p> : denied ? <p className="notice"><a href={loginHref}>Opnieuw inloggen als beheerder →</a></p> : !session ? <p className="notice">Je beheersessie kon niet worden gecontroleerd. <a href={loginHref}>Naar inloggen</a></p> : !session.configured ? <p className="notice">De beheeromgeving is nog niet aangesloten.</p> : !session.parent ? <a className="account-primary email-login" href={loginHref}>Inloggen als beheerder</a> : !session.admin ? <p className="notice">Dit account heeft geen toegang tot de e-mailinstellingen.</p> : <>
      {!configuration && busy && <p role="status">E-mailinstellingen ophalen…</p>}
      {!configuration && !busy && <button className="account-secondary" onClick={() => { void loadSettings(); }}>Opnieuw proberen</button>}
      {configuration && settings && <>
        <section className="email-status-card" aria-labelledby="email-connection-heading"><div><span className={`email-status-dot${configuration.configured ? ' connected' : ''}`} aria-hidden="true"/><h2 id="email-connection-heading">{configuration.configured ? 'Resend is gekoppeld' : 'Koppel je Resend-account'}</h2></div><p>{configuration.configured ? 'Je opgeslagen instellingen worden gebruikt voor Fabelpad-e-mails in deze omgeving.' : 'Vul de verzendinstellingen en je Resend API-key in. We testen de verzending voordat we de koppeling opslaan.'}</p><dl><div><dt>Deze omgeving</dt><dd>{configuration.appOrigin}</dd></div><div><dt>Testontvanger</dt><dd>{session.parent.email}</dd></div><div><dt>Inloggen met e-mailcode</dt><dd>{configuration.auth.emailEnabled ? 'Ingeschakeld' : 'Nog niet ingeschakeld'}</dd></div>{configuration.lastTestAt && <div><dt>Laatste geaccepteerde testmail</dt><dd>{dateLabel(configuration.lastTestAt)}</dd></div>}</dl>{!configuration.auth.emailEnabled && <p className="email-note">De verzendkoppeling en het inloggen met e-mail zijn aparte instellingen. Na het koppelen moet de e-mailroute voor deze omgeving ook zijn geactiveerd.</p>}</section>
        <form onSubmit={event => { void save(event); }} autoComplete="off">
          <fieldset disabled={!!busy} className="email-fieldset">{!templatesPage && <section className="email-card" aria-labelledby="email-sender-heading"><h2 id="email-sender-heading">Afzender en contact</h2><p>Gebruik een afzender op een domein dat in Resend is geverifieerd.</p><div className="email-field-grid"><label>Naam afzender<input required maxLength={80} value={settings.fromName} onChange={event => updateSetting('fromName', event.target.value)} /></label><label>E-mailadres afzender<input type="email" required maxLength={254} value={settings.fromEmail} onChange={event => updateSetting('fromEmail', event.target.value)} /></label><label>Antwoordadres<input type="email" required maxLength={254} value={settings.replyTo} onChange={event => updateSetting('replyTo', event.target.value)} /></label><label>Supportadres in e-mails<input type="email" required maxLength={254} value={settings.supportEmail} onChange={event => updateSetting('supportEmail', event.target.value)} /></label></div><label>Tekst onderaan iedere e-mail<textarea required rows={3} maxLength={500} value={settings.footerText} onChange={event => updateSetting('footerText', event.target.value)} /></label><label>Resend API-key{configuration.keyConfigured && <span className="email-key-state">Er is al een API-key opgeslagen. Laat dit veld leeg om die te behouden.</span>}<input name="resend-connection-key" type="password" autoComplete="new-password" autoCapitalize="none" spellCheck={false} required={!configuration.keyConfigured} maxLength={512} value={apiKey} onChange={event => { setApiKey(event.target.value); setNotice(''); }} aria-describedby="email-key-help" /></label><p id="email-key-help" className="email-note">Maak de API-key aan in <a href="https://resend.com/api-keys" target="_blank" rel="noreferrer">Resend → API Keys</a>. Kies bij voorkeur alleen verzendrechten voor je Fabelpad-domein. Je opgeslagen key wordt hier nooit teruggetoond.</p><p><a href="/studio/email/templates">Alle e-mailtemplates bekijken en aanpassen →</a></p></section>}
          {templatesPage && <div className="email-template-layout"><nav className="email-template-list" aria-label="Alle e-mailtemplates"><h2>Accountmails</h2>{EMAIL_TEMPLATE_IDS.filter(action => Object.hasOwn(AUTH_EMAIL_CATALOG, action)).map(action => <button key={action} type="button" aria-pressed={selectedTemplate === action} onClick={() => setSelectedTemplate(action)}><span>{TEMPLATE_NAMES[action]}</span><small>{settings.templates[action] ? 'Aangepaste tekst' : 'Standaardtekst'}</small></button>)}<h2>Serviceberichten</h2>{EMAIL_TEMPLATE_IDS.filter(action => Object.hasOwn(SERVICE_EMAIL_CATALOG, action)).map(action => <button key={action} type="button" aria-pressed={selectedTemplate === action} onClick={() => setSelectedTemplate(action)}><span>{TEMPLATE_NAMES[action]}</span><small>{settings.templates[action] ? 'Aangepaste tekst' : 'Standaardtekst'}</small></button>)}</nav><div className="email-template-detail"><section className="email-card email-template-editor" aria-labelledby="email-copy-heading"><h2 id="email-copy-heading">{TEMPLATE_NAMES[selectedTemplate]}</h2><p>Pas onderwerp, kop en introductie aan. Codes, bevestigingsknoppen en beveiligingsinformatie blijven in de vaste opmaak. Een template schakelt de bijbehorende functie niet in.</p>{selectedCopy && <><label>Onderwerp<input required maxLength={160} value={selectedCopy.subject} onChange={event => updateTemplate('subject', event.target.value)} /></label><label>Kop in de e-mail<input required maxLength={200} value={selectedCopy.title} onChange={event => updateTemplate('title', event.target.value)} /></label><label>Introductie<textarea required rows={4} maxLength={1000} value={selectedCopy.intro} onChange={event => updateTemplate('intro', event.target.value)} /></label><button type="button" className="account-secondary email-reset" disabled={!settings.templates[selectedTemplate]} onClick={() => { setSettings(current => { if (!current) return current; const templates = { ...current.templates }; delete templates[selectedTemplate]; return { ...current, templates }; }); setNotice(''); }}>Standaardtekst voor deze e-mail herstellen</button></>}</section><section className="email-card" aria-labelledby="email-preview-heading"><div className="email-section-heading"><h2 id="email-preview-heading">E-mailvoorbeeld</h2><button type="button" className="account-secondary" disabled={previewBusy || !!busy} onClick={() => { void loadPreview(settings, selectedTemplate); }}>{previewBusy ? 'Voorbeeld laden…' : 'Voorbeeld bijwerken'}</button></div><p>{TEMPLATE_NAMES[selectedTemplate]} · Dit voorbeeld bevat uitsluitend fictieve gegevens en een onbruikbare voorbeeldcode. Er wordt geen e-mail verstuurd.</p>{preview && previewSnapshot !== JSON.stringify(settings) && <p className="email-note">Je teksten zijn gewijzigd. Kies ‘Voorbeeld bijwerken’ om ze te bekijken voordat je opslaat.</p>}{previewSubject && <p><strong>Onderwerp:</strong> {previewSubject}</p>}{previewError ? <p role="status">{previewError}</p> : preview ? <iframe title={`E-mailvoorbeeld: ${TEMPLATE_NAMES[selectedTemplate]}`} sandbox="" referrerPolicy="no-referrer" srcDoc={preview} className="email-preview" /> : <p role="status">Voorbeeld laden…</p>}</section></div></div>}
          <div className="email-save-panel"><label className="email-tracking-confirmation"><input type="checkbox" required checked={trackingDisabledConfirmed} onChange={event => setTrackingDisabledConfirmed(event.target.checked)} /><span>Open- en kliktracking staan uit in Resend</span></label><p className="email-note">Controleer dit bij je domein in Resend voordat je een test verstuurt. Zo blijven eenmalige codes en links ongewijzigd.</p>{templatesPage && !configuration.keyConfigured && <p><a href="/studio/email">Koppel eerst Resend om templates te kunnen opslaan en testen.</a> Je kunt de teksten wel alvast aanpassen en bekijken.</p>}<p>{dirty ? 'Je hebt wijzigingen die nog niet zijn opgeslagen.' : 'Je bekijkt de opgeslagen instellingen.'}</p><p>Een testmail gaat alleen naar jouw ingelogde beheerdersadres. Opslaan lukt pas als Resend de test accepteert.</p><div className="account-actions"><button type="submit" className="account-primary" disabled={!trackingDisabledConfirmed || (templatesPage && !configuration.keyConfigured)}>{busy === 'save' ? 'Koppeling testen en opslaan…' : 'Opslaan en testmail versturen'}</button><button type="button" className="account-secondary" disabled={!configuration.keyConfigured || dirty || !trackingDisabledConfirmed} onClick={() => { void sendTest(); }}>{busy === 'test' ? 'Testmail versturen…' : 'Testmail opnieuw versturen'}</button><button type="button" className="account-secondary" onClick={() => { if (!dirty || window.confirm('Je onopgeslagen wijzigingen verlaten en de opgeslagen instellingen opnieuw laden?')) void loadSettings(); }}>Opgeslagen instellingen opnieuw laden</button></div></div>
          </fieldset>
        </form>
        {!templatesPage && <section className="email-card" aria-labelledby="email-domain-heading"><div className="email-section-heading"><h2 id="email-domain-heading">Verzenddomein</h2><button type="button" className="account-secondary" disabled={domainBusy || !!busy} onClick={() => { void loadDomain(); }}>{domainBusy ? 'Controleren…' : 'Domeinstatus vernieuwen'}</button></div>{domainError ? <p role="status">{domainError}</p> : !domain ? <p role="status">Domeinstatus ophalen…</p> : <><p>{domain.status === 'verified' ? `Het verzenddomein ${domain.domain} is geverifieerd.` : domain.status === 'pending' ? `Het verzenddomein ${domain.domain} wacht nog op verificatie.` : domain.status === 'restricted' ? 'Je API-key kan e-mail versturen, maar heeft geen rechten om domeingegevens op te vragen. De verzendkoppeling kan gewoon worden gebruikt. Controleer domeinverificatie en tracking in Resend.' : 'Koppel Resend om het verzenddomein te controleren.'}</p>{domain.records.length > 0 && <div className="email-records-scroll" role="region" aria-label="DNS-records voor het verzenddomein" tabIndex={0}><table><thead><tr><th scope="col">Type</th><th scope="col">Naam</th><th scope="col">Waarde</th><th scope="col">Status</th></tr></thead><tbody>{domain.records.map((record, index) => <tr key={`${record.type}-${record.name}-${index}`}><td>{record.type}</td><td><code>{record.name}</code></td><td><code>{record.value}</code></td><td>{record.status}</td></tr>)}</tbody></table></div>}{domain.status !== 'not-configured' && <p className="email-note">Opentracking: {domain.tracking.open === null ? 'niet opvraagbaar' : domain.tracking.open ? 'aan' : 'uit'} · Kliktracking: {domain.tracking.click === null ? 'niet opvraagbaar' : domain.tracking.click ? 'aan' : 'uit'}. Laat beide uit voor accountmails met eenmalige codes of links.</p>}</>}<p><a href="https://resend.com/domains" target="_blank" rel="noreferrer">Open domeininstellingen in Resend →</a></p></section>}
      </>}
    </>}
    {problem && <p className="account-feedback email-feedback email-error" role="alert">{problem}</p>}{notice && <p className="account-feedback email-feedback" role="status">{notice}</p>}
  </div></PageShell>;
}
