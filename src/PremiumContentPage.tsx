'use client';
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { PageShell } from './AccountPage';
import { useAdminIdentity } from './useAdminIdentity';
import './billing.css';

export default function PremiumContentPage() {
  const [storyId, setStoryId] = useState('');
  const [payload, setPayload] = useState<unknown>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const fileGeneration = useRef(0);
  const identity = useAdminIdentity(() => {
    fileGeneration.current++;
    setStoryId(''); setPayload(null); setConfirmed(false); setNotice(''); setBusy(false);
    if (input.current) input.current.value = '';
  });
  const allowed = !!identity.session?.admin && !identity.denied;
  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const operation = identity.capture();
    const generation = ++fileGeneration.current;
    const file = event.target.files?.[0];
    setPayload(null); setConfirmed(false); setNotice('');
    if (!operation || !file) return;
    if (file.size > 4 * 1024 * 1024) { setNotice('Het verhaalbestand is te groot.'); return; }
    try {
      const text = await file.text();
      if (!identity.isCurrent(operation) || generation !== fileGeneration.current) return;
      setPayload(JSON.parse(text)); setNotice('Bestand ingelezen. De volledige inhoud wordt voor publicatie gecontroleerd.');
    } catch {
      if (identity.isCurrent(operation) && generation === fileGeneration.current) setNotice('Dit bestand bevat geen geldig verhaal.');
    }
  }
  async function publish(event: FormEvent) {
    event.preventDefault();
    const operation = identity.capture();
    if (!operation || !confirmed || !payload || busy) return;
    setBusy(true); setNotice('');
    try {
      const response = await fetch('/api/admin/content/premium', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json', 'X-Fabelpad-Parent': operation.parentId }, body: JSON.stringify({ storyId, payload, confirmPrivate: confirmed }) });
      const result = await response.json();
      if (!identity.isCurrent(operation)) return;
      if ([401, 403].includes(response.status)) { identity.invalidate(result.message); return; }
      if (!response.ok) throw new Error(result.message || 'Deze handeling kon niet worden uitgevoerd.');
      setNotice(`Verhaal gepubliceerd. Versie ${String(result.contentVersion)}. ${result.audio ? 'Voorleesaudio is vastgelegd voor deze verhaalversie; de audiowachtrij toont de voortgang en eventuele wachtreden.' : 'Bekijk de audiowachtrij voor de beschikbare voorleesopdrachten.'}`);
      fileGeneration.current++; setPayload(null); setConfirmed(false); if (input.current) input.current.value = '';
    } catch (error) { if (identity.isCurrent(operation)) setNotice(error instanceof Error ? error.message : 'Publiceren lukt nu niet.'); }
    finally { if (identity.isCurrent(operation)) setBusy(false); }
  }
  return <PageShell adminNavigation><div className="billing-page"><h1>Online verhalen publiceren</h1><p>Nieuwe verhaalteksten worden in de afgeschermde verhalenopslag bewaard. De bibliotheek toont de titel en omslag; de server bepaalt welke delen een gezin mag ophalen. Publiceren maakt een vaste verhaalversie aan zodat opgeslagen leesplekken naar dezelfde tekst blijven verwijzen.</p>
    {!identity.checked ? <p role="status">Beheerrechten controleren…</p> : !allowed ? <p className="billing-notice">{identity.error || 'Voor deze pagina is een actief beheeraccount nodig.'} <a href="/inloggen?next=%2Fstudio%2Fpremium">Inloggen als beheerder</a></p> : <form className="billing-card" onSubmit={event => void publish(event)}><fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}><label>Verhaalcode<input value={storyId} required pattern="[a-z][a-z0-9_-]{1,79}" maxLength={80} onChange={event => setStoryId(event.target.value)} /></label><label>Verhaalbestand (JSON)<input ref={input} type="file" accept="application/json,.json" required onChange={event => void readFile(event)} /></label><p>Gebruik het bestaande releaseformaat: metadata, vijf delen, scenes, endings en eventueel de drie leesniveaus. Upload alleen verhaalinhoud en een verwijzing naar een openbare omslag; geen persoonsgegevens of sleutels.</p><label className="billing-check"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>Ik heb dit verhaal gecontroleerd en wil een vaste, afgeschermde release publiceren.</span></label><button className="account-primary" disabled={!payload || !confirmed || busy}>{busy ? 'Verhaal publiceren…' : 'Verhaal publiceren'}</button></fieldset></form>}
    {notice && <p role="status" className="billing-notice">{notice}</p>}<a href="/studio/voorlezen">Voorleesaudio en catalogusdekking bekijken →</a><p><a href="/studio">Terug naar de verhalenstudio</a></p>
  </div></PageShell>;
}
