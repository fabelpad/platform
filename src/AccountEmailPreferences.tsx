'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Mail } from 'lucide-react';
import { MARKETING_CONSENT_TEXT, type ParentEmailPreferences as EmailPreferences } from '../lib/email/marketingConsent';

class PreferenceRequestError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function requestPreferences(parentId: string, signal: AbortSignal, marketingConsent?: boolean): Promise<EmailPreferences> {
  const response = await fetch('/api/parent/email-preferences', {
    method: marketingConsent === undefined ? 'GET' : 'POST', cache: 'no-store', signal,
    headers: { 'Content-Type': 'application/json', 'X-Fabelpad-Parent': parentId },
    ...(marketingConsent === undefined ? {} : { body: JSON.stringify({ marketingConsent }) }),
  });
  const value = await response.json();
  if (!response.ok) throw new PreferenceRequestError(value.message || 'Je e-mailvoorkeur is nu niet bereikbaar. Probeer het opnieuw.', response.status);
  if (!value || typeof value.marketingConsent !== 'boolean' || value.updatedAt !== null && (typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.updatedAt))) || marketingConsent !== undefined && value.marketingConsent !== marketingConsent) throw new Error('Je e-mailvoorkeur kon niet worden gecontroleerd. Probeer het opnieuw.');
  return value;
}

export default function AccountEmailPreferences({ parentId }: { parentId: string }) {
  const [saved, setSaved] = useState<EmailPreferences | null>(null);
  const [selected, setSelected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0);
  const lifetime = useRef<AbortController | null>(null);
  useEffect(() => {
    function refresh() {
      if (document.visibilityState !== 'visible') return;
      lifetime.current?.abort();
      const controller = new AbortController(); lifetime.current = controller;
      // Recheck the expected actor when returning from another tab. A response
      // from before that check cannot restore the previous account's preference.
      setSaved(null); setSelected(false); setNotice(''); setBusy(false);
      void requestPreferences(parentId, controller.signal).then(value => {
        if (!controller.signal.aborted) { setSaved(value); setSelected(value.marketingConsent); }
      }).catch(error => { if (!controller.signal.aborted) setNotice((error as Error).message); });
    }
    refresh();
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
    return () => { lifetime.current?.abort(); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [parentId, attempt]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const controller = lifetime.current;
    if (!saved || busy || !controller || controller.signal.aborted || selected === saved.marketingConsent) return;
    setBusy(true); setNotice('');
    try {
      const value = await requestPreferences(parentId, controller.signal, selected);
      if (controller.signal.aborted) return;
      setSaved(value); setSelected(value.marketingConsent);
      setNotice(value.marketingConsent ? 'Je toestemming voor promotionele e-mails en Fabelpad-updates is opgeslagen.' : 'Je toestemming is ingetrokken. Je ontvangt geen promotionele e-mails en Fabelpad-updates meer.');
    } catch (error) {
      if (!controller.signal.aborted) {
        if (error instanceof PreferenceRequestError && [401, 403, 410].includes(error.status)) { setSaved(null); setSelected(false); }
        setNotice((error as Error).message);
      }
    }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  return <section className="fp-parent-panel fp-parent-full" aria-labelledby="account-email-heading">
    <div className="fp-parent-panel-heading"><Mail size={24} aria-hidden="true" /><h2 id="account-email-heading">E-mailvoorkeuren</h2></div>
    <p>Deze toestemming is vrijwillig. Noodzakelijke berichten over je account, beveiliging en betalingen blijf je ontvangen.</p>
    {saved ? <form onSubmit={submit}>
      <label className="account-check"><input type="checkbox" checked={selected} disabled={busy} onChange={event => { setSelected(event.target.checked); setNotice(''); }} /><span>{MARKETING_CONSENT_TEXT}</span></label>
      <button type="submit" className="fp-parent-button" disabled={busy || selected === saved.marketingConsent}>{busy ? 'Keuze opslaan…' : 'E-mailvoorkeur opslaan'}</button>
    </form> : notice ? <button type="button" className="fp-parent-button" onClick={() => setAttempt(value => value + 1)}>E-mailvoorkeur opnieuw ophalen</button> : <p role="status">Je e-mailvoorkeur ophalen…</p>}
    {notice && <p className="fp-parent-feedback" role="status">{notice}</p>}
  </section>;
}
