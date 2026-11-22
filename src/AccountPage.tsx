'use client';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { ParentIdentity } from './cloudSync';
import { safeNext } from '../lib/authNavigation';

export type AccountSession = { configured: boolean; parent: ParentIdentity | null; admin: boolean; providers?: { email: boolean; google: boolean }; message?: string };
export function PageShell({ children }: { children: ReactNode }) {
  return <div className="simple-page"><header><a href="/" aria-label="Fabelpad startpagina"><img src="/brand/logo.webp" alt="Fabelpad" /></a><nav><a href="/lezen">Probeer de verhalen</a><a href="/gezin">Mijn gezin</a><a href="/support">Hulp</a></nav></header><main>{children}</main></div>;
}
export async function accountRequest(path: string, body: unknown = {}) {
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const result = await response.json().catch(() => null);
  if (!result || typeof result !== 'object') throw new Error('De accountverbinding is nu niet bereikbaar. Probeer het straks opnieuw.');
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
  useEffect(() => {
    let active = true;
    fetch('/api/auth/session', { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(data => { if (active) setSession(data); }).catch(() => { if (active) setNotice('De accountverbinding is nu niet bereikbaar. Je kunt wel zonder account verder lezen.'); });
    const params = new URLSearchParams(location.search);
    setNext(safeNext(params.get('next')));
    if (params.has('error')) setNotice('Inloggen is niet voltooid. Probeer het opnieuw vanuit dit scherm.');
    return () => { active = false; };
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setNotice('');
    try {
      if (sent) { const result = await accountRequest('/api/auth/verify', { email, token, next }); setToken(''); location.assign(safeNext(result.next)); }
      else { const result = await accountRequest('/api/auth/otp', { email }); setSent(true); setNotice(result.message || 'Als dit adres is toegestaan, ontvang je een Fabelpad-inlogcode. Vul de code uit je e-mail in.'); }
    } catch (error) { setNotice((error as Error).message); } finally { setBusy(false); }
  }
  async function google() {
    if (busy) return; setBusy(true); setNotice('');
    try { const result = await accountRequest('/api/auth/google', { next }); location.assign(result.url); }
    catch (error) { setNotice((error as Error).message); setBusy(false); }
  }
  return <PageShell><section className="account-form"><img src="/brand/mascot.webp" alt="" /><h1>Een plekje voor<br />jullie verhalen.</h1><p>Log in als ouder. Ieder kind krijgt een eigen profiel, zonder eigen e-mailadres.</p>{!session && !notice && <p role="status">Accountverbinding controleren…</p>}{session?.parent ? <><p>Je bent ingelogd als {session.parent.email}.</p><a className="account-primary" href="/gezin">Open jullie gezinsomgeving</a>{session.admin && <p><a href="/studio">Open de verhalenstudio</a></p>}</> : session?.configured ? <>{session.providers?.email && <form onSubmit={submit}><label>Jouw e-mailadres<input type="email" autoComplete="email" required maxLength={254} value={email} disabled={sent || busy} onChange={e => setEmail(e.target.value)} /></label>{sent && <label>Code uit je e-mail<input inputMode="numeric" autoComplete="one-time-code" required minLength={6} maxLength={10} value={token} onChange={e => setToken(e.target.value.replace(/\D/g, ''))} /></label>}<button className="account-primary" disabled={busy} type="submit">{busy ? 'Een moment…' : sent ? 'Veilig inloggen' : 'Stuur mij een inlogcode'}</button>{sent && <button type="button" className="account-secondary" disabled={busy} onClick={() => { setSent(false); setToken(''); }}>Ander adres of nieuwe code</button>}</form>}{session.providers?.google && <button className="account-secondary" disabled={busy} onClick={google}>Verder met Google</button>}{!session.providers?.email && !session.providers?.google && <p className="notice">Inloggen is tijdelijk niet beschikbaar. Je kunt wel zonder account verder lezen.</p>}</> : session && <p className="notice">Ouderaccounts zijn nog niet aangesloten. Je kunt zonder account alle lokale verhalen lezen.</p>}{notice && <p className="account-feedback" role="status">{notice}</p>}<p><a href="/lezen">Ontdek Fabelpad zonder account →</a></p><small>Zonder account blijven je profielen en voortgang op dit apparaat.</small></section></PageShell>;
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
