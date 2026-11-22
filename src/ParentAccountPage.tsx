'use client';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { accountRequest, PageShell, readAccountSession, type AccountSession } from './AccountPage';
import { localAccountDate, parentNeedsOnboarding, type ParentAccountStatus } from '../lib/parentAccount';
import { safeNext } from '../lib/authNavigation';
import { clearParentDeviceData } from './profileStorage';

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
  useEffect(() => { let active = true; void fetch('/api/auth/session', { cache: 'no-store' }).then(readAccountSession).then(async s => { if (!active) return; setSession(s); if (s.parent) { const next = await getStatus(); if (active) setStatus(next); } }).catch(e => { if (active) setNotice(e.message); }); return () => { active = false; }; }, []);
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

export function ParentAccountPage() {
  const [session, setSession] = useState<AccountSession | null>(null);
  const [status, setStatus] = useState<ParentAccountStatus | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [reauth, setReauth] = useState(false);
  useEffect(() => { let active = true; void fetch('/api/auth/session', { cache: 'no-store' }).then(readAccountSession).then(async s => { if (!active) return; setSession(s); if (s.parent) { const next = await getStatus(); if (active) setStatus(next); } }).catch(e => { if (active) setNotice(e.message); }); return () => { active = false; }; }, []);
  async function action(kind: 'deletion' | 'restore') {
    if (busy || !session?.parent || kind === 'deletion' && !confirmed) return;
    setBusy(true); setNotice(''); setReauth(false);
    try {
      const response = await fetch(`/api/parent/${kind}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Fabelpad-Parent': session.parent.id }, body: JSON.stringify(kind === 'deletion' ? { confirm: true } : { confirmRestore: true }) });
      const value = await response.json();
      if (!response.ok) { if (value.error === 'fresh_auth_required' || response.status === 428 || response.status === 401) setReauth(true); throw new Error(value.message || 'Dit lukt nu niet. Probeer het opnieuw.'); }
      const next: ParentAccountStatus | undefined = value.status || value.lifecycle || (value.state ? value : undefined);
      if (kind === 'deletion') {
        clearParentDeviceData(session.parent.id);
        setDeleting(false); setConfirmed(false);
        if (next) setStatus(next);
        else if (value.deletionDeadline) setStatus(previous => previous ? { ...previous, state: 'deletion_pending', deletionDeadline: value.deletionDeadline, consents: [] } : previous);
        setNotice(value.message || 'Je account is direct stilgezet. Je kunt het alleen met een expliciete herstelactie vóór de genoemde deadline herstellen. Je ontvangt een bevestiging per e-mail.');
      } else { setStatus(next || await getStatus()); setNotice('Je account is hersteld. De termijn voor actief gebruik begint opnieuw. Er wordt geen abonnement of verlenging gestart.'); }
    } catch (error) { setNotice((error as Error).message); }
    finally { setBusy(false); }
  }
  const pending = status?.state === 'deletion_pending';
  return <PageShell><p><a href="/gezin">← Profiel</a> → Account</p><h1>Jouw ouderaccount.</h1>
    {!session && !notice && <p role="status">Je account openen…</p>}
    {session && !session.parent && <p><a className="account-primary" href="/inloggen?next=/profiel/account">Veilig inloggen om je account te beheren</a></p>}
    {session?.parent && status && <>
      <section className="family-settings"><h2>Accountstatus</h2><p>{session.parent.email}</p>
        {pending ? <><p>Je account staat stil. De definitieve verwijderdeadline is <strong>{localAccountDate(status.deletionDeadline)}</strong>. Je kinderprofielen en voortgang zijn afgeschermd.</p><p>Inloggen of opnieuw installeren herstelt niets. Alleen de onderstaande bewuste herstelactie vóór de deadline kan de aanvraag annuleren.</p><button className="account-primary" disabled={busy} onClick={() => void action('restore')}>Ik wil mijn account herstellen</button></> : status.state === 'deleting' ? <p>De definitieve verwijdering is gestart. Het account kan niet meer worden hersteld.</p> : parentNeedsOnboarding(status) ? <p><a href="/onboarding">Rond eerst je ouderaccount af</a>.</p> : <><p>Je ouderaccount is actief. Via jullie gezinsomgeving beheer je de toestemming per online kinderprofiel.</p><p><a href="/gezin?ouders=1">Toestemming voor kinderprofielen beheren</a></p><p>Voorwaarden aanvaard: versie {status.acceptedTermsVersion}. Getoonde privacyverklaring: versie {status.shownPrivacyVersion}.</p><button className="account-secondary account-danger" onClick={() => setDeleting(true)}>Account verwijderen</button></>}
      </section>
      {deleting && <section className="family-settings account-deletion" aria-labelledby="delete-heading"><h2 id="delete-heading">Het hele gezinsaccount verwijderen?</h2><p>Alle online kinderprofielen, verhaalkeuzes, favorieten en leesvoortgang van dit gezin worden geraakt. Je account wordt meteen stilgezet. De server legt daarna de exacte deadline van 30 dagen vast.</p><p>Tot die deadline kun je de aanvraag met een expliciete herstelactie annuleren. Daarna is herstel niet meer mogelijk. Gewoon inloggen annuleert de aanvraag nooit.</p><p>Fabelpad biedt nu geen betaalde abonnementen aan. Bij toekomstige betaalde toegang worden verlenging en ongebruikt vooruitbetaald tegoed vóór bevestiging afzonderlijk afgehandeld.</p><label className="account-check"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /><span>Ik begrijp dat deze aanvraag het hele gezin raakt en wil mijn account stilzetten en laten verwijderen.</span></label><div className="account-actions"><button className="account-secondary" disabled={busy} onClick={() => { setDeleting(false); setConfirmed(false); }}>Annuleren</button><button className="account-primary account-danger" disabled={busy || !confirmed} onClick={() => void action('deletion')}>{busy ? 'Aanvraag verwerken…' : 'Bevestig account verwijderen'}</button></div><a href="mailto:support@fabelpad.nl?subject=Fabelpad%20-%20gegevens%20eerder%20laten%20wissen">Gegevens eerder laten wissen</a></section>}
      <section className="family-settings"><h2>Privacy en je gegevens</h2><p>Voor inzage, export, correctie, bezwaar, beperking, intrekking of eerder wissen kun je schrijven naar <a href="mailto:support@fabelpad.nl">support@fabelpad.nl</a>. Begin met alleen je verzoek; stuur geen identiteitsdocument mee.</p><p>Een kind vanaf 12 jaar kan zelf schrijven over de eigen gegevens, zonder toegang tot dit ouderaccount.</p><p><a href="/account-verwijderen">Account verwijderen en gegevens eerder laten wissen</a> · <a href="/privacyverklaring">Privacyverklaring</a> · <a href="/privacy-voor-kinderen">Privacy voor kinderen</a></p><button className="account-secondary" onClick={() => { clearParentDeviceData(session.parent!.id); setNotice('De door Fabelpad beheerde gezinsgegevens van dit ouderaccount zijn van dit apparaat gewist. Online gegevens worden hierdoor niet verwijderd.'); }}>Gezinsgegevens van dit apparaat wissen</button></section>
    </>}
    {notice && <p className="account-feedback" role="status">{notice}</p>}
    {reauth && <p><a className="account-primary" href="/inloggen?next=/profiel/account&reauth=1">Bevestig opnieuw met e-mailcode of Google</a></p>}
  </PageShell>;
}
