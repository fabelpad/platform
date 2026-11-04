'use client';
import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { ParentIdentity } from './cloudSync';

export type AccountSession = { configured: boolean; parent: ParentIdentity | null; admin: boolean; providers?: { email: boolean; google: boolean }; message?: string };
export function PageShell({ children }: { children: ReactNode }) {
  return <div className="simple-page"><header><a href="/" aria-label="Fabelpad startpagina"><img src="/brand/logo.webp" alt="Fabelpad" /></a><nav><a href="/lezen">Probeer de verhalen</a><a href="/gezin">Mijn gezin</a><a href="/support">Hulp</a></nav></header><main>{children}</main></div>;
}
export async function accountRequest(path: string, body: unknown = {}) {
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const result = await response.json();
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
  useEffect(() => {
    let active = true;
    fetch('/api/auth/session', { cache: 'no-store' }).then(r => r.json()).then(data => { if (active) setSession(data); }).catch(() => { if (active) setNotice('De accountverbinding is nu niet bereikbaar. Je kunt de demo wel openen.'); });
    const params = new URLSearchParams(location.search);
    if (params.has('error')) setNotice('Inloggen is niet voltooid. Probeer het opnieuw vanuit dit scherm.');
    return () => { active = false; };
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setNotice('');
    try {
      if (sent) { await accountRequest('/api/auth/verify', { email, token }); location.assign('/gezin'); }
      else { await accountRequest('/api/auth/otp', { email }); setSent(true); setNotice('Als je adres is toegelaten, ontvang je een code van Supabase. Vul de code hieronder in.'); }
    } catch (error) { setNotice((error as Error).message); } finally { setBusy(false); }
  }
  async function google() {
    if (busy) return; setBusy(true); setNotice('');
    try { const result = await accountRequest('/api/auth/google', { next: '/gezin' }); location.assign(result.url); }
    catch (error) { setNotice((error as Error).message); setBusy(false); }
  }
  return <PageShell><section className="account-form"><img src="/brand/mascot.webp" alt="" /><h1>Een plekje voor<br />jullie verhalen.</h1><p>Log in als ouder. Ieder kind krijgt een eigen profiel, zonder eigen e-mailadres.</p>{!session && !notice && <p role="status">Accountverbinding controleren…</p>}{session?.parent ? <><p>Je bent ingelogd als {session.parent.email}.</p><a className="account-primary" href="/gezin">Open jullie gezinsomgeving</a>{session.admin && <p><a href="/studio">Open de verhalenstudio</a></p>}</> : session?.configured ? <>{session.providers?.email && <form onSubmit={submit}><label>Jouw e-mailadres<input type="email" autoComplete="email" required maxLength={254} value={email} disabled={sent || busy} onChange={e => setEmail(e.target.value)} /></label>{sent && <label>Code uit je e-mail<input inputMode="numeric" autoComplete="one-time-code" required minLength={6} maxLength={10} value={token} onChange={e => setToken(e.target.value.replace(/\D/g, ''))} /></label>}<button className="account-primary" disabled={busy} type="submit">{busy ? 'Een moment…' : sent ? 'Veilig inloggen' : 'Stuur mij een inlogcode'}</button>{sent && <button type="button" className="account-secondary" disabled={busy} onClick={() => { setSent(false); setToken(''); }}>Ander adres of nieuwe code</button>}</form>}{session.providers?.google && <button className="account-secondary" disabled={busy} onClick={google}>Verder met Google</button>}{!session.providers?.email && !session.providers?.google && <p className="notice">Ouderaccounts worden nog ingericht. De verhalendemo is al beschikbaar.</p>}</> : session && <p className="notice">Ouderaccounts zijn nog niet aangesloten. Je kunt alvast alle verhalen ontdekken in de lokale demo.</p>}{notice && <p className="account-feedback" role="status">{notice}</p>}<p><a href="/lezen">Ontdek Fabelpad zonder account →</a></p><small>Een demo opent uitsluitend de gegevens op dit apparaat.</small></section></PageShell>;
}
