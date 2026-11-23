'use client';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { accountRequest, PageShell, readAccountSession, type AccountSession } from './AccountPage';
import { localAccountDate, parentNeedsOnboarding, type ParentAccountStatus } from '../lib/parentAccount';
import { safeNext } from '../lib/authNavigation';
import { clearParentDeviceData, exportSnapshot } from './profileStorage';
import CloudBoundary, { SyncBadge, useCloudFamily } from './CloudBoundary';
import ParentShell, { ParentDialog } from './ParentShell';
import { BookOpen, Download, LogOut, RefreshCw, ShieldCheck, UserRound } from 'lucide-react';

async function getStatus(): Promise<ParentAccountStatus> {
  const response = await fetch('/api/parent/status', { cache: 'no-store' });
  const value = await response.json();
  if (!response.ok) throw new Error(value.message || 'Je accountstatus is nu niet bereikbaar.');
  return value;
}

export function ParentOnboardingPage() {
  const [session, setSession] = useState<AccountSession | null>(null);
  const [status, setStatus] = useState<ParentAccountStatus | null>(null);
  const [adult, setAdult] = useState(false);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [retryCompletion, setRetryCompletion] = useState(false);
  const [reauthCompletion, setReauthCompletion] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setRetryCompletion(false); setReauthCompletion(false); setNotice('');
    void fetch('/api/auth/session', { cache: 'no-store' }).then(readAccountSession).then(async s => {
      if (!active) return; setSession(s);
      if (!s.parent) return;
      let next = await getStatus();
      if (parentNeedsOnboarding(next)) {
        // Resume only a server-stored registration declaration. Missing proof
        // leaves a one-time explicit fallback; it never invents old consent.
        const response = await fetch('/api/auth/registration/complete', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Fabelpad-Parent': s.parent.id }, body: '{}' });
        const result = await response.json();
        if (!response.ok) { if (active) { setRetryCompletion(true); setReauthCompletion(response.status === 428 || response.status === 401); } throw new Error(result.message || 'Je registratie kan nu niet worden afgerond. Je eerdere keuzes worden niet opnieuw gevraagd zolang we die nog kunnen controleren.'); }
        if (result.lifecycle) next = result.lifecycle;
      }
      if (!active) return;
      if (next.state === 'active' && !parentNeedsOnboarding(next)) {
        const requested = safeNext(new URLSearchParams(location.search).get('next'));
        location.replace(requested === '/onboarding' ? '/gezin' : requested);
        return;
      }
      setStatus(next);
    }).catch(e => { if (active) { setNotice(e.message); setRetryCompletion(true); } });
    return () => { active = false; };
  }, [attempt]);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy || !adult || !terms || !status) return;
    setBusy(true); setNotice('');
    try {
      await accountRequest('/api/parent/onboarding', { parentDeclaration: true, acceptTerms: true, termsVersion: status.termsVersion, privacyVersion: status.privacyVersion }, session!.parent!.id);
      const requested = safeNext(new URLSearchParams(location.search).get('next'));
      location.assign(requested === '/onboarding' ? '/gezin' : requested);
    } catch (error) {
      setNotice((error as Error).message);
      try { const next = await getStatus(); if (next.termsVersion !== status.termsVersion || next.privacyVersion !== status.privacyVersion) { setStatus(next); setTerms(false); setAdult(false); setNotice('De documenten zijn bijgewerkt. Lees de huidige versie en bevestig je keuzes opnieuw.'); } } catch { /* Keep the original failed request visible. */ }
    } finally { setBusy(false); }
  }
  return <PageShell><section className="account-form"><h1>Welkom, ouder.</h1>
    <p>Een ouderaccount is voor volwassenen. Lezen zonder online kinderprofiel blijft mogelijk.</p>
    {!session && !notice && <p role="status">Je account openen…</p>}
    {session?.parent && !status && !notice && <p role="status">Je registratie afronden…</p>}
    {retryCompletion && <p>{reauthCompletion ? <a className="account-primary" href="/inloggen?next=/onboarding&reauth=1">Bevestig opnieuw met e-mailcode of Google</a> : <button type="button" className="account-primary" onClick={() => setAttempt(value => value + 1)}>Registratie opnieuw afronden</button>}</p>}
    {session && !session.parent && <p><a className="account-primary" href="/inloggen?next=/onboarding">Log eerst veilig in</a></p>}
    {status && ['deletion_pending', 'deleting'].includes(status.state) ? <><p>Je account staat stil. Een gewone login herstelt het account niet.</p><a href="/profiel/account">Bekijk de verwijderstatus</a></> : session?.parent && status && <form onSubmit={submit}>
      {!parentNeedsOnboarding(status) && <p className="notice">Je ouderaccount is al afgerond. <a href="/gezin">Ga naar jullie gezinsomgeving</a>.</p>}
      {parentNeedsOnboarding(status) && <>
        <p>Je meldt je aan met {session.parent.email}.</p>
        <label className="account-check"><input type="checkbox" required checked={adult} onChange={e => setAdult(e.target.checked)} /><span>Ik ben 18 jaar of ouder en maak dit account aan als ouder met gezag of voogd.</span></label>
        <label className="account-check"><input type="checkbox" required checked={terms} onChange={e => setTerms(e.target.checked)} /><span>Ik ga akkoord met de <a href={`/algemene-voorwaarden?versie=${encodeURIComponent(status.termsVersion)}`} target="_blank" rel="noopener">algemene voorwaarden van Fabelpad</a> (versie {status.termsVersion}).</span></label>
        <p className="account-legal-note">Lees in de <a href={`/privacyverklaring?versie=${encodeURIComponent(status.privacyVersion)}`} target="_blank" rel="noopener">privacyverklaring</a> hoe DG Webservices met jouw gegevens en die van je kind omgaat. De privacyverklaring is informatie; je hoeft hiervoor geen toestemming te geven.</p>
        <p><a href="/privacy-voor-kinderen">Privacy voor kinderen</a></p>
        <button className="account-primary" disabled={busy || !adult || !terms} type="submit">{busy ? 'Je keuzes bewaren…' : 'Ouderaccount afronden'}</button>
      </>}
    </form>}
    {notice && <p className="account-feedback" role="status">{notice}</p>}
    <p><a href="/lezen">Verder lezen zonder online kinderprofiel →</a></p>
  </section></PageShell>;
}

function AccountSynchronization({ deviceCleared }: { deviceCleared: boolean }) {
  const { client, state } = useCloudFamily();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  async function refresh() {
    if (!client || busy || deviceCleared) return; setBusy(true); setNotice('');
    try { await client.flush(); await client.refresh(); const next = client.getState(); setNotice(next.phase === 'saved' || next.phase === 'empty' ? 'De gezinsgegevens zijn bijgewerkt.' : next.message || 'Nog niet alles is gesynchroniseerd. Je apparaatversie blijft behouden.'); }
    catch { setNotice('Bijwerken lukt nu niet. Je laatst bevestigde gegevens blijven behouden.'); }
    finally { setBusy(false); }
  }
  return <section className="fp-parent-panel" aria-labelledby="account-sync-heading"><div className="fp-parent-panel-heading"><RefreshCw size={24} aria-hidden="true" /><h2 id="account-sync-heading">Synchronisatie</h2></div>{deviceCleared ? <p role="status">De apparaatkopie is gewist. <a href="/gezin?ouders=1">Open Mijn gezin</a> om de online gegevens opnieuw op te halen.</p> : <><SyncBadge />{state.message && ['offline', 'error', 'signed-out'].includes(state.phase) && <p role="status">{state.message}</p>}<p>Op een ander apparaat vind je dezelfde kindprofielen en leesvoortgang zodra je met dit ouderaccount inlogt.</p>{state.dirty && <p className="fp-parent-export">{state.localDurable === false ? 'Deze browser kan de apparaatversie niet bewaren. Houd dit venster open totdat alles is opgeslagen.' : 'Nog niet alle veranderingen zijn centraal bewaard. De apparaatversie blijft beschikbaar.'}</p>}<button className="fp-parent-button" disabled={busy || !client || state.phase === 'saving' || state.phase === 'signed-out'} onClick={() => void refresh()}><RefreshCw size={17} aria-hidden="true" />{busy ? 'Bijwerken…' : 'Nu bijwerken'}</button>{state.phase === 'signed-out' && <p><a href="/inloggen?next=/profiel/account">Opnieuw inloggen om te synchroniseren</a></p>}</>}{notice && <p className="fp-parent-feedback" role="status">{notice}</p>}</section>;
}
function AccountPrivacyActions({ parentId, onCleared, deviceCleared }: { parentId: string; onCleared: () => void; deviceCleared: boolean }) {
  const { client, state } = useCloudFamily();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [clearing, setClearing] = useState(false);
  function download() {
    if (!client || !state.snapshot || deviceCleared) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(exportSnapshot(), null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'fabelpad-gezinsgegevens.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice('De gezinsgegevens van dit apparaat zijn klaargezet als download.');
  }
  async function logout() {
    if (busy) return; setBusy(true); setNotice('');
    try { const response = await fetch('/api/auth/signout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); if (!response.ok) throw new Error(); client?.dispose(); location.assign('/inloggen'); }
    catch { setBusy(false); setNotice('Uitloggen is niet gelukt. Je apparaatversie blijft bewaard. Probeer opnieuw.'); }
  }
  return <><div className="fp-parent-settings-row"><span className="fp-parent-setting-label">Toestemming voor kinderen</span><a href="/gezin?ouders=1">Beheer per kind</a></div><div className="fp-parent-settings-row"><span className="fp-parent-setting-label">Gezinsgegevens op dit apparaat</span><button className="fp-parent-button" disabled={!client || !state.snapshot || deviceCleared || busy} onClick={download}><Download size={17} aria-hidden="true" />Gezinsgegevens downloaden</button></div><div className="fp-parent-settings-row"><span className="fp-parent-setting-label">Hulp met je account</span><a href="/support">Bekijk hulp</a></div><div className="fp-parent-actions"><button className="fp-parent-button" disabled={busy} onClick={() => void logout()}><LogOut size={17} aria-hidden="true" />{busy ? 'Uitloggen…' : 'Uitloggen'}</button><button className="fp-parent-button" disabled={busy || deviceCleared || !client} onClick={() => setClearing(true)}>Gezinsgegevens van dit apparaat wissen</button></div>{state.dirty && <p className="fp-parent-export">Er zijn nog niet gesynchroniseerde wijzigingen. Uitloggen bewaart de apparaatversie; apparaatwissen verwijdert die.</p>}{notice && <p className="fp-parent-feedback" role="status">{notice}</p>}{clearing && <ParentDialog title="Apparaatgegevens wissen?" onClose={() => setClearing(false)}><p>De door Fabelpad beheerde gezinsgegevens van dit ouderaccount verdwijnen van dit apparaat. Nog niet gesynchroniseerde wijzigingen gaan verloren. De online gegevens en andere ouderaccounts blijven bestaan.</p><div className="fp-parent-dialog-actions"><button type="button" className="fp-parent-button" onClick={() => setClearing(false)}>Annuleren</button><button type="button" className="fp-parent-button fp-parent-danger" onClick={() => { client?.dispose(); clearParentDeviceData(parentId); onCleared(); setClearing(false); setNotice('De gezinsgegevens van dit ouderaccount zijn van dit apparaat gewist. Online gegevens zijn niet verwijderd.'); }}>Wis de apparaatkopie</button></div></ParentDialog>}</>;
}

export function ParentAccountPage() {
  const [session, setSession] = useState<AccountSession | null>(null);
  const [status, setStatus] = useState<ParentAccountStatus | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [deviceCleared, setDeviceCleared] = useState(false);
  const [reauth, setReauth] = useState(false);
  const [deletionPreview, setDeletionPreview] = useState<{ deletionDeadlineMinute: string; expiresAt?: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewGeneration = useRef(0);
  useEffect(() => { let active = true; void fetch('/api/auth/session', { cache: 'no-store' }).then(readAccountSession).then(async s => { if (!active) return; setSession(s); if (s.parent) { const next = await getStatus(); if (active) setStatus(next); } }).catch(e => { if (active) setNotice(e.message); }); return () => { active = false; }; }, []);
  useEffect(() => {
    if (!session?.parent) return;
    let active = true;
    const refresh = () => { if (document.visibilityState !== 'visible') return; void getStatus().then(next => { if (active) setStatus(next); }).catch(() => { if (active) setNotice('De accountstatus kan nu niet worden bijgewerkt. Je laatst bevestigde status blijft zichtbaar.'); }); };
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
    return () => { active = false; window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [session?.parent?.id]);
  async function action(kind: 'deletion' | 'restore') {
    if (busy || !session?.parent || kind === 'deletion' && (!confirmed || !deletionPreview || previewLoading)) return;
    setBusy(true); setNotice(''); setReauth(false);
    try {
      const response = await fetch(`/api/parent/${kind}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Fabelpad-Parent': session.parent.id }, body: JSON.stringify(kind === 'deletion' ? { confirm: true, expectedDeadlineMinute: deletionPreview!.deletionDeadlineMinute } : { confirmRestore: true }) });
      const value = await response.json();
      if (!response.ok) {
        if (kind === 'deletion' && response.status === 409 && value.error === 'deletion_preview_expired') {
          const refreshed = await loadDeletionPreview();
          if (refreshed) setNotice('De getoonde verwijderdatum is verlopen. Controleer de nieuwe datum en vink de bevestiging opnieuw aan. Er is nog geen verwijderaanvraag vastgelegd.');
          return;
        }
        if (value.error === 'fresh_auth_required' || response.status === 428 || response.status === 401) setReauth(true);
        throw new Error(value.message || 'Dit lukt nu niet. Probeer het opnieuw.');
      }
      const next: ParentAccountStatus | undefined = value.status || value.lifecycle || (value.state ? value : undefined);
      if (kind === 'deletion') {
        clearParentDeviceData(session.parent.id);
        setDeleting(false); setConfirmed(false); setDeletionPreview(null); previewGeneration.current += 1;
        if (next) setStatus(next);
        else if (value.deletionDeadline) setStatus(previous => previous ? { ...previous, state: 'deletion_pending', deletionDeadline: value.deletionDeadline, consents: [] } : previous);
        setNotice(value.message || 'Je account is direct stilgezet. Je kunt het alleen met een expliciete herstelactie vóór de genoemde deadline herstellen. Je ontvangt een bevestiging per e-mail.');
      } else { setStatus(next || await getStatus()); setNotice('Je account is hersteld. De termijn voor actief gebruik begint opnieuw. Er wordt geen abonnement of verlenging gestart.'); }
    } catch (error) { setNotice((error as Error).message); }
    finally { setBusy(false); }
  }
  async function loadDeletionPreview(): Promise<boolean> {
    const generation = ++previewGeneration.current;
    setDeletionPreview(null); setConfirmed(false); setPreviewLoading(true);
    try {
      const response = await fetch('/api/parent/deletion', { cache: 'no-store' });
      const value = await response.json();
      if (generation !== previewGeneration.current) return false;
      if (!response.ok) { if (value.error === 'fresh_auth_required' || response.status === 428 || response.status === 401) setReauth(true); throw new Error(value.message || 'De exacte verwijderdatum kan nu niet worden opgehaald. Er is niets gewijzigd.'); }
      if (typeof value.deletionDeadlineMinute !== 'string' || !Number.isFinite(Date.parse(value.deletionDeadlineMinute))) throw new Error('De exacte verwijderdatum kan nu niet worden gecontroleerd. Er is niets gewijzigd.');
      setDeletionPreview({ deletionDeadlineMinute: value.deletionDeadlineMinute, ...(typeof value.expiresAt === 'string' ? { expiresAt: value.expiresAt } : {}) });
      return true;
    } catch (error) { if (generation === previewGeneration.current) setNotice((error as Error).message); return false; }
    finally { if (generation === previewGeneration.current) setPreviewLoading(false); }
  }
  function openDeletion() { setDeleting(true); setNotice(''); setReauth(false); void loadDeletionPreview(); }
  function closeDeletion() { previewGeneration.current += 1; setDeleting(false); setConfirmed(false); setDeletionPreview(null); setPreviewLoading(false); }
  const pending = status?.state === 'deletion_pending';
  const activeAccount = !!session?.parent && !!status && status.state === 'active' && !parentNeedsOnboarding(status);
  const account = <>
    <div className="fp-parent-hero"><div><h1>Ouderaccount</h1><p>Beheer je account en de synchronisatie van je gezin.</p></div></div>
    {!session && !notice && <p role="status">Je account openen…</p>}
    {session && !session.parent && <p><a className="fp-parent-button fp-parent-button-primary" href="/inloggen?next=/profiel/account">Veilig inloggen om je account te beheren</a></p>}
    {session?.parent && !status && !notice && <p role="status">Je accountstatus ophalen…</p>}
    {session?.parent && status && <div className="fp-parent-settings-grid">
      <section className="fp-parent-panel" aria-labelledby="account-details-heading"><div className="fp-parent-panel-heading"><UserRound size={24} aria-hidden="true" /><h2 id="account-details-heading">Accountgegevens</h2></div><div className="fp-parent-settings-row"><span className="fp-parent-setting-label">E-mailadres</span><strong>{session.parent.email}</strong></div><div className="fp-parent-settings-row"><span className="fp-parent-setting-label">Accountstatus</span><strong className="fp-parent-pill">{pending ? 'Verwijdering aangevraagd' : status.state === 'deleting' ? 'Wordt verwijderd' : parentNeedsOnboarding(status) ? 'Nog afronden' : 'Actief'}</strong></div><div className="fp-parent-settings-row"><span className="fp-parent-setting-label">Kindprofielen</span><a href="/gezin?ouders=1">Naar Mijn gezin</a></div></section>
      {activeAccount ? <AccountSynchronization deviceCleared={deviceCleared} /> : <section className="fp-parent-panel"><h2>Synchronisatie</h2><p>{pending || status.state === 'deleting' ? 'De online gezinsgegevens zijn afgeschermd. Synchronisatie is gestopt.' : 'Rond eerst je ouderaccount af voordat kinderprofielen worden gesynchroniseerd.'}</p></section>}
      <section className="fp-parent-panel fp-parent-full fp-parent-subscription"><div><div className="fp-parent-panel-heading"><BookOpen size={24} aria-hidden="true" /><h2>Gezinsabonnement</h2></div><p>Bekijk jullie toegang, kortingscode, abonnement en bevestigde betalingen.</p></div><a className="fp-parent-button" href="/profiel/abonnement">Abonnement bekijken</a></section>
      <section className="fp-parent-panel fp-parent-full" aria-labelledby="account-privacy-heading"><div className="fp-parent-panel-heading"><ShieldCheck size={24} aria-hidden="true" /><h2 id="account-privacy-heading">Privacy en toegang</h2></div>
        {activeAccount && <AccountPrivacyActions parentId={session.parent.id} deviceCleared={deviceCleared} onCleared={() => setDeviceCleared(true)} />}
        <p>Voor inzage, export, correctie, bezwaar, beperking, intrekking of eerder wissen kun je schrijven naar <a href="mailto:support@fabelpad.nl">support@fabelpad.nl</a>. Begin met alleen je verzoek; stuur geen identiteitsdocument mee.</p><p>Een kind vanaf 12 jaar kan zelf schrijven over de eigen gegevens, zonder toegang tot dit ouderaccount.</p><p><a href="/privacyverklaring">Privacyverklaring</a> · <a href="/privacy-voor-kinderen">Privacy voor kinderen</a> · <a href="/privacyverzoek">Privacyverzoek</a></p>
        {status.acceptedTermsVersion && <p className="fp-parent-export">Voorwaarden aanvaard: versie {status.acceptedTermsVersion}. Getoonde privacyverklaring: versie {status.shownPrivacyVersion}.</p>}
      </section>
      <section className="fp-parent-panel fp-parent-full" aria-labelledby="account-access-heading"><div className="fp-parent-panel-heading"><ShieldCheck size={24} aria-hidden="true" /><h2 id="account-access-heading">{pending ? 'Account herstellen' : 'Account verwijderen'}</h2></div>
        {pending ? <><p>Je account staat stil. De definitieve verwijderdeadline is <strong>{localAccountDate(status.deletionDeadline)}</strong>. Je kinderprofielen en voortgang zijn afgeschermd.</p><p>Inloggen of opnieuw installeren herstelt niets. Alleen de onderstaande bewuste herstelactie vóór de deadline kan de aanvraag annuleren.</p><button className="fp-parent-button fp-parent-button-primary" disabled={busy} onClick={() => void action('restore')}>Ik wil mijn account herstellen</button></> : status.state === 'deleting' ? <p>De definitieve verwijdering is gestart. Het account kan niet meer worden hersteld.</p> : parentNeedsOnboarding(status) ? <p><a href="/onboarding">Rond eerst je ouderaccount af</a>.</p> : <><p>Laat je volledige online gezinsaccount en leesgegevens verwijderen.</p><button className="fp-parent-button fp-parent-danger" onClick={openDeletion}>Account verwijderen</button></>}
        <p><a href="/account-verwijderen">Uitleg over verwijderen en herstel</a></p>
      </section>
      {deleting && <section className="fp-parent-panel fp-parent-full account-deletion" aria-labelledby="delete-heading"><h2 id="delete-heading">Het hele gezinsaccount verwijderen?</h2><p>Alle online kinderprofielen, verhaalkeuzes, favorieten en leesvoortgang van dit gezin worden geraakt. Je account wordt meteen stilgezet zodra je de aanvraag bevestigt.</p>{previewLoading ? <p role="status">De exacte verwijderdatum ophalen…</p> : deletionPreview ? <p>Als je nu bevestigt, kun je het account alleen herstellen tot <strong>{localAccountDate(deletionPreview.deletionDeadlineMinute)}</strong>. Dit is de exacte uiterste herstelminuut, 30 dagen na de aanvraag.</p> : <p>De verwijderdatum is nog niet gecontroleerd. Er is niets gewijzigd. <button className="account-secondary" type="button" disabled={busy} onClick={() => void loadDeletionPreview()}>Verwijderdatum opnieuw ophalen</button></p>}<p>Tot die deadline kun je de aanvraag met een expliciete herstelactie annuleren. Daarna is herstel niet meer mogelijk. Gewoon inloggen annuleert de aanvraag nooit.</p><p>Bij accountverwijdering stopt automatische verlenging. Bestaande betalingen en eventuele terugbetalingen blijven afzonderlijk verwerkt worden. Bekijk je abonnement voor de bevestigde betaal- en terugbetaalstatus.</p><label className="account-check"><input type="checkbox" disabled={busy || previewLoading || !deletionPreview} checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /><span>Ik begrijp dat deze aanvraag het hele gezin raakt en wil mijn account stilzetten en laten verwijderen.</span></label><div className="account-actions"><button className="account-secondary" disabled={busy} onClick={closeDeletion}>Annuleren</button><button className="account-primary account-danger" disabled={busy || !confirmed || previewLoading || !deletionPreview} onClick={() => void action('deletion')}>{busy ? 'Aanvraag verwerken…' : 'Bevestig account verwijderen'}</button></div><a href="mailto:support@fabelpad.nl?subject=Fabelpad%20-%20gegevens%20eerder%20laten%20wissen">Gegevens eerder laten wissen</a></section>}
    </div>}
    {notice && <p className="fp-parent-feedback" role="status">{notice}</p>}
    {reauth && <p><a className="fp-parent-button fp-parent-button-primary" href="/inloggen?next=/profiel/account&reauth=1">Bevestig opnieuw met e-mailcode of Google</a></p>}
  </>;
  return <ParentShell active="account">{activeAccount ? <CloudBoundary parent={session!.parent} accountOnly>{account}</CloudBoundary> : account}</ParentShell>;
}
