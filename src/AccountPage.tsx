'use client';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { ParentIdentity } from './cloudSync';
import { safeNext } from '../lib/authNavigation';
import type { ParentAccountStatus } from '../lib/parentAccount';
import { parentNeedsOnboarding } from '../lib/parentAccount';
import LegalFooter from './LegalFooter';
import { TERMS_VERSION, PRIVACY_VERSION } from '../lib/legal/documents';
import { clearParentDeviceData } from './profileStorage';

export type AccountSession = { configured: boolean; parent: ParentIdentity | null; admin: boolean; providers?: { email: boolean; google: boolean }; lifecycle?: ParentAccountStatus; message?: string };
function clearDeletedParent(response: Response, value: { error?: unknown; cleanupParentId?: unknown }) {
  if (response.status === 410 && value.error === 'account_deleted' && typeof value.cleanupParentId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value.cleanupParentId)) clearParentDeviceData(value.cleanupParentId);
}
export async function readAccountSession(response: Response): Promise<AccountSession> {
  const result = await response.json().catch(() => null);
  if (!result || typeof result !== 'object') throw new Error('De accountverbinding is nu niet bereikbaar.');
  clearDeletedParent(response, result);
  if (!response.ok) throw new Error(result.message || 'De accountverbinding is nu niet bereikbaar.');
  return result;
}
export function PageShell({ children, adminNavigation = false }: { children: ReactNode; adminNavigation?: boolean }) {
  return <div className="simple-page"><header><a href="/" aria-label="Fabelpad startpagina"><img src="/brand/logo.webp" alt="Fabelpad" /></a><nav aria-label="Hoofdnavigatie"><a href="/lezen">Probeer de verhalen</a><a href="/gezin">Mijn gezin</a><a href="/profiel/account">Profiel → Account</a><a href="/support">Hulp</a>{adminNavigation && <><a href="/studio">Beheer</a><a href="/studio/privacy">Privacyverzoeken</a></>}</nav></header><main>{children}</main><LegalFooter /></div>;
}
export async function accountRequest(path: string, body: unknown = {}, parentId?: string) {
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(parentId ? { 'X-Fabelpad-Parent': parentId } : {}) }, body: JSON.stringify(body) });
  const result = await response.json().catch(() => null);
  if (!result || typeof result !== 'object') throw new Error('De accountverbinding is nu niet bereikbaar. Probeer het straks opnieuw.');
  clearDeletedParent(response, result);
  if (!response.ok) throw new Error(result.message || 'Dit lukt nu niet. Probeer het straks opnieuw.');
  return result;
}
export function LoginPage() {
  const [session, setSession] = useState<AccountSession | null>(null);
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [next, setNext] = useState('/gezin');
  const [reauthenticate, setReauthenticate] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [adult, setAdult] = useState(false);
  const [terms, setTerms] = useState(false);
  const [documents, setDocuments] = useState({ termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION });
  useEffect(() => {
    let active = true;
    fetch('/api/auth/session', { cache: 'no-store' }).then(readAccountSession).then(data => { if (active) setSession(data); }).catch(error => { if (active) setNotice(error.message?.includes('verwijderd') ? error.message : 'De accountverbinding is nu niet bereikbaar. Je kunt wel zonder account verder lezen.'); });
    const params = new URLSearchParams(location.search);
    setNext(safeNext(params.get('next')));
    setReauthenticate(params.get('reauth') === '1');
    if (params.has('error')) setNotice('Inloggen is niet voltooid. Probeer het opnieuw vanuit dit scherm.');
    void fetch('/api/legal/documents', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(data => { if (active && typeof data?.termsVersion === 'string' && typeof data?.privacyVersion === 'string') setDocuments({ termsVersion: data.termsVersion, privacyVersion: data.privacyVersion }); }).catch(() => { /* Server also validates the embedded versions before registration. */ });
    return () => { active = false; };
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setNotice('');
    try {
      if (sent) { const result = await accountRequest('/api/auth/verify', { email, token, next }); setToken(''); location.assign(safeNext(result.next)); }
      else { const result = await accountRequest('/api/auth/otp', { email, intent: mode, ...(mode === 'register' ? { parentDeclaration: adult, acceptTerms: terms, ...documents } : {}) }); setSent(true); setNotice(result.message || 'Als dit adres is toegestaan, ontvang je een Fabelpad-inlogcode. Vul de code uit je e-mail in.'); }
    } catch (error) { setNotice((error as Error).message); if (mode === 'register') { setAdult(false); setTerms(false); void refreshDocuments(); } } finally { setBusy(false); }
  }
  async function refreshDocuments() { try { const r = await fetch('/api/legal/documents', { cache: 'no-store' }); const data = await r.json(); if (r.ok && typeof data.termsVersion === 'string' && typeof data.privacyVersion === 'string') setDocuments({ termsVersion: data.termsVersion, privacyVersion: data.privacyVersion }); } catch { /* Keep registration server-validated and its error visible. */ } }
  async function google() {
    if (busy) return; setBusy(true); setNotice('');
    try { const result = await accountRequest('/api/auth/google', { next, intent: mode, ...(mode === 'register' ? { parentDeclaration: adult, acceptTerms: terms, ...documents } : {}) }); location.assign(result.url); }
    catch (error) { setNotice((error as Error).message); if (mode === 'register') { setAdult(false); setTerms(false); void refreshDocuments(); } setBusy(false); }
  }
  const pendingDeletion = session?.lifecycle?.state === 'deletion_pending' || session?.lifecycle?.state === 'deleting';
  return <PageShell><section className="account-form">
    <img src="/brand/mascot.webp" alt="" /><h1>Een plekje voor<br />jullie verhalen.</h1>
    <p>Log in of meld je aan als ouder. Kinderen hebben geen eigen e-mailadres nodig.</p>
    {!session && !notice && <p role="status">Accountverbinding controleren…</p>}
    {session?.parent && !reauthenticate ? <>
      <p>Je bent ingelogd als {session.parent.email}.</p>
      {pendingDeletion ? <><p>Je account staat stil vanwege een verwijderaanvraag. Inloggen herstelt je account niet.</p><a className="account-primary" href="/profiel/account">Bekijk de verwijderstatus</a></> : <a className="account-primary" href={parentNeedsOnboarding(session.lifecycle) ? '/onboarding' : '/gezin'}>{parentNeedsOnboarding(session.lifecycle) ? 'Rond je ouderaccount af' : 'Open jullie gezinsomgeving'}</a>}
      {session.admin && <p><a href="/studio">Open de verhalenstudio</a></p>}
    </> : session?.configured ? <>
      {!sent && <div className="account-mode" role="group" aria-label="Inloggen of een ouderaccount maken"><button type="button" className="account-secondary" aria-pressed={mode === 'login'} disabled={busy} onClick={() => { setMode('login'); setNotice(''); }}>Inloggen</button><button type="button" className="account-secondary" aria-pressed={mode === 'register'} disabled={busy || reauthenticate} onClick={() => { setMode('register'); setAdult(false); setTerms(false); setNotice(''); }}>Ouderaccount maken</button></div>}
      {mode === 'register' && !sent && <div><label className="account-check"><input type="checkbox" checked={adult} onChange={e => setAdult(e.target.checked)} /><span>Ik ben 18 jaar of ouder en maak dit account aan als ouder met gezag of voogd.</span></label><label className="account-check"><input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)} /><span>Ik ga akkoord met de <a href={`/algemene-voorwaarden?versie=${encodeURIComponent(documents.termsVersion)}`} target="_blank" rel="noopener">algemene voorwaarden van Fabelpad</a> (versie {documents.termsVersion}).</span></label><p className="account-legal-note">Lees in de <a href={`/privacyverklaring?versie=${encodeURIComponent(documents.privacyVersion)}`}>privacyverklaring</a> hoe DG Webservices met jouw gegevens en die van je kind omgaat.</p></div>}
      {session.providers?.email && <form onSubmit={submit}>
        <label>Jouw e-mailadres<input type="email" autoComplete="email" required maxLength={254} value={email} disabled={sent || busy} onChange={e => setEmail(e.target.value)} /></label>
        {sent && <label>6-cijferige code uit je e-mail<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required minLength={6} maxLength={6} value={token} onChange={e => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))} /></label>}
        <button className="account-primary" disabled={busy || !sent && mode === 'register' && (!adult || !terms)} type="submit">{busy ? 'Een moment…' : sent ? 'Veilig inloggen' : 'Stuur mij een inlogcode'}</button>
        {sent && <button type="button" className="account-secondary" disabled={busy} onClick={() => { setSent(false); setToken(''); }}>Ander adres of nieuwe code</button>}
      </form>}
      {session.providers?.google && <><div className="account-divider" aria-hidden="true">of</div><button className="google-signin-button" disabled={busy || mode === 'register' && (!adult || !terms)} onClick={google}><img src="/brand/google-g.svg" width="20" height="20" alt="" />Verder met Google</button></>}
      {!session.providers?.email && !session.providers?.google && <p className="notice">Inloggen is tijdelijk niet beschikbaar. Je kunt wel zonder account verder lezen.</p>}
      <div className="account-legal-note"><p>Voor een nieuw ouderaccount bevestig je na het inloggen dat je 18 jaar of ouder bent en ouder met gezag of voogd bent. Daarna ga je afzonderlijk akkoord met de <a href="/algemene-voorwaarden">algemene voorwaarden van Fabelpad</a>.</p><p>Lees in de <a href="/privacyverklaring">privacyverklaring</a> hoe DG Webservices met jouw gegevens en die van je kind omgaat.</p></div>
    </> : session && <p className="notice">Ouderaccounts zijn nog niet aangesloten. Je kunt zonder account alle lokale verhalen lezen.</p>}
    {notice && <p className="account-feedback" role="status">{notice}</p>}
    <p><a href="/lezen">Ontdek Fabelpad zonder account →</a></p><small>Zonder account blijven je profielen en voortgang op dit apparaat.</small>
  </section></PageShell>;
}

/** A human confirms the link, so mail scanners cannot consume it on GET. */
export function ConfirmAuthPage() {
  const initialized = useRef(false);
  const [confirmation, setConfirmation] = useState<{ tokenHash: string; type: string; next: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const params = new URLSearchParams(location.search);
    const tokenHash = params.get('token_hash') || '', type = params.get('type') || '';
    // Keep the one-time credential in memory, out of subsequent URLs/referrers.
    history.replaceState(null, '', '/auth/confirm');
    if (['email', 'invite', 'recovery', 'email_change'].includes(type) && /^[A-Za-z0-9_-]{16,512}$/u.test(tokenHash)) {
      setConfirmation({ tokenHash, type, next: safeNext(params.get('next')) });
    } else setNotice('Deze bevestigingslink is niet geldig. Vraag een nieuwe inlogcode aan.');
  }, []);
  async function confirm() {
    if (!confirmation || busy) return;
    setBusy(true); setNotice('');
    try {
      const result = await accountRequest('/api/auth/confirm', confirmation);
      setConfirmation(null);
      if (result.message) { setComplete(true); setNotice(result.message); }
      else location.replace(safeNext(result.next));
    } catch (error) { setNotice((error as Error).message); setBusy(false); }
  }
  return <PageShell><section className="account-form"><img src="/brand/mascot.webp" alt="" /><h1>{complete ? 'Je bevestiging is ontvangen.' : 'Bevestig je e-mailadres.'}</h1><p>Open alleen een link die je zelf hebt aangevraagd of een uitnodiging die je verwacht.</p>{confirmation && <button className="account-primary" disabled={busy} onClick={confirm}>{busy ? 'Een moment…' : 'Bevestig en ga verder'}</button>}{notice && <p className="account-feedback" role="status">{notice}</p>}<p><a href="/inloggen">Naar inloggen →</a></p></section></PageShell>;
}
