'use client';
import { useEffect, useState } from 'react';
import './email-settings.css';
import { PageShell, readAccountSession, type AccountSession } from './AccountPage';
import { worlds } from './worlds';
import { getScene } from './storyData';
import { getEditorialDraft, validateEditorialDraft, type EditorialDraft } from './editorialStore';
import { parentNeedsOnboarding } from '../lib/parentAccount';

export default function CloudStudio() {
  const [session, setSession] = useState<AccountSession | null>(null);
  const [selected, setSelected] = useState('station');
  const [draft, setDraft] = useState<EditorialDraft | null>(null);
  const [revision, setRevision] = useState(0);
  const [chapter, setChapter] = useState(0);
  const [route, setRoute] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [notice, setNotice] = useState('');
  const [published, setPublished] = useState('');
  useEffect(() => { fetch('/api/auth/session', { cache: 'no-store' }).then(readAccountSession).then(setSession).catch(error => setNotice(error.message || 'De accountverbinding is niet bereikbaar.')); }, []);
  useEffect(() => {
    if (!session?.admin || parentNeedsOnboarding(session.lifecycle) || session.lifecycle?.state !== 'active') return;
    const controller = new AbortController(); setDraft(null); setBusy(true); setDirty(false); setConfirm(false); setNotice(''); setPublished('');
    fetch(`/api/content/drafts/${selected}`, { cache: 'no-store', signal: controller.signal }).then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.message || 'Het concept kon niet worden opgehaald.'); return data; }).then(data => { setDraft(data.draft); setRevision(data.revision); }).catch(error => { if (error.name !== 'AbortError') setNotice(error.message); }).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [selected, session?.admin]);
  useEffect(() => { const leave = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); }; window.addEventListener('beforeunload', leave); return () => window.removeEventListener('beforeunload', leave); }, [dirty]);
  function edit(next: EditorialDraft) { setDraft(next); setDirty(true); setConfirm(false); setNotice(''); }
  async function save(): Promise<number | null> {
    if (!draft || busy) return null;
    const errors = validateEditorialDraft(selected, draft); if (errors.length) { setNotice(errors.join(' ')); return null; }
    setBusy(true); setNotice('');
    try {
      const response = await fetch(`/api/content/drafts/${selected}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseRevision: revision, draft }) });
      const data = await response.json();
      if (response.status === 409) throw new Error('Een andere beheerder heeft dit concept gewijzigd. Jouw tekst blijft in dit venster. Kopieer je werk en laad daarna het actuele concept opnieuw.');
      if (!response.ok) throw new Error(data.message || data.errors?.join(' ') || 'Bewaren is niet gelukt.');
      setRevision(data.revision); setDirty(false); setNotice('Concept op de server bewaard. Lezers zien de huidige publicatie.'); return data.revision;
    } catch (error) { setNotice((error as Error).message); return null; } finally { setBusy(false); }
  }
  async function publish() {
    if (!draft || busy || dirty || revision < 1) return;
    setBusy(true); setNotice('');
    try {
      const response = await fetch(`/api/content/publish/${selected}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseRevision: revision }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || (response.status === 409 ? 'Het concept is inmiddels gewijzigd. Publiceer pas na opnieuw controleren.' : 'Publiceren is niet gelukt.'));
      setPublished(data.release.contentVersion); setConfirm(false); setNotice(`Nieuwe contentrelease ${data.release.contentVersion} gepubliceerd. Begonnen avonturen blijven op hun bewaarde versie.`);
    } catch (error) { setNotice((error as Error).message); } finally { setBusy(false); }
  }
  const original = getScene(selected, chapter, route.slice(0,chapter), '{{naam}}');
  const override = draft?.chapters[String(chapter)] || {};
  if (session?.parent && session.lifecycle && session.lifecycle.state !== 'active') return <PageShell><h1>Je ouderaccount</h1><p>Rond eerst je ouderaccount af of bekijk de verwijderstatus.</p><a href={session.lifecycle.state === 'onboarding' ? '/onboarding?next=/studio' : '/profiel/account'}>Naar je accountoverzicht</a></PageShell>;
  return <PageShell adminNavigation={!!session?.admin}>{session?.admin && <nav className="studio-navigation" aria-label="Beheeronderdelen"><a href="/studio" aria-current="page">Verhalen</a><a href="/studio/email">E-mailinstellingen</a><a href="/studio/email/templates">E-mailtemplates</a><a href="/studio/privacy">Privacyverzoeken</a></nav>}<h1>Verhalenstudio.</h1><p>Een plek voor nieuwe woorden. Concepten zijn alleen toegankelijk voor toegekende beheerders.</p>{!session ? <p role="status">Beheerrechten controleren…</p> : !session.configured ? <p className="notice">De beheeromgeving is op dit moment niet beschikbaar. Probeer het later opnieuw of neem contact op via <a href="mailto:support@fabelpad.nl">support@fabelpad.nl</a>.</p> : !session.parent ? <a className="account-primary" href="/inloggen?next=%2Fstudio">Inloggen als beheerder</a> : !session.admin ? <p className="notice">Dit ouderaccount heeft geen toegang tot de verhalenstudio.</p> : <><label className="studio-select">Verhaal<select disabled={busy} value={selected} onChange={e => { if (!dirty || window.confirm('Onbewaarde conceptwijzigingen verlaten?')) { setSelected(e.target.value); setChapter(0); setRoute([]); } }}>{worlds.map(w => <option key={w.id} value={w.id}>{w.title}</option>)}</select></label>{draft && <fieldset disabled={busy} style={{border:0,padding:0,minWidth:0}}><section className="family-settings"><h2>Het verhaal</h2><label>Verhaaltitel<input maxLength={120} value={draft.metadata.title} onChange={e => edit({...draft,metadata:{...draft.metadata,title:e.target.value}})} /></label><label>Korte omschrijving<textarea maxLength={600} value={draft.metadata.description} onChange={e => edit({...draft,metadata:{...draft.metadata,description:e.target.value}})} /></label><label>Omslag<select value={draft.metadata.image} onChange={e => edit({...draft,metadata:{...draft.metadata,image:e.target.value}})}>{worlds.map(w => <option key={w.id} value={w.image}>{w.title}</option>)}</select></label><img src={draft.metadata.image} alt="Omslag van het concept" style={{width:240,borderRadius:18}} /></section><section className="family-settings"><h2>De vijf delen</h2><label>Deel<select value={chapter} onChange={e => { setChapter(Number(e.target.value)); setRoute(Array.from({length:Number(e.target.value)},(_,i)=>route[i] || 0)); }}>{Array.from({length:5},(_,i)=><option key={i} value={i}>Deel {i+1}</option>)}</select></label><div className="studio-branches">{Array.from({length:chapter},(_,i)=><label key={i}>Eerdere keuze {i+1}<select value={route[i] || 0} onChange={e=>setRoute(current=>Array.from({length:chapter},(_,j)=>i===j?Number(e.target.value):current[j] || 0))}><option value={0}>Keuze 1</option><option value={1}>Keuze 2</option></select></label>)}</div><p>Een aangepaste tekst geldt voor alle routes van dit deel. Niet aangepaste velden volgen de oorspronkelijke vertakkingen. Gebruik {'{{naam}}'} voor de kindnaam.</p><label>Hoofdstuktitel<input maxLength={200} value={override.title ?? original.title} onChange={e=>edit({...draft,chapters:{...draft.chapters,[String(chapter)]:{...override,title:e.target.value}}})} /></label><label>Verhaaltekst<textarea rows={15} maxLength={20000} value={override.text ?? original.text} onChange={e=>edit({...draft,chapters:{...draft.chapters,[String(chapter)]:{...override,text:e.target.value}}})} /></label><button className="account-secondary" onClick={()=>{const chapters={...draft.chapters}; delete chapters[String(chapter)]; edit({...draft,chapters});}}>Oorspronkelijke tekst van dit deel gebruiken</button><h2>Concept bekijken</h2><h3>{(override.title ?? original.title).replaceAll('{{naam}}','Sam')}</h3>{(override.text ?? original.text).replaceAll('{{naam}}','Sam').split(/\n\s*\n/u).map((p,i)=><p key={i}>{p}</p>)}<div className="account-actions">{original.choices.map((choice,i)=><button className="account-secondary" key={i} disabled={chapter===4} onClick={()=>{setRoute([...route.slice(0,chapter),i]);setChapter(chapter+1);}}>{choice.label} →</button>)}</div></section><div className="account-actions"><button className="account-primary" disabled={busy} onClick={()=>{void save();}}>Concept bewaren</button><button className="account-secondary" disabled={busy} onClick={()=>{const errors=validateEditorialDraft(selected,draft);setNotice(errors.length?errors.join(' '):'Alle vijf delen, 31 keuzeprefixen en de omslag zijn compleet.');}}>Controleren</button><button className="account-secondary" disabled={busy || dirty || revision<1} onClick={()=>setConfirm(true)}>Publiceren…</button><button className="account-secondary" disabled={busy} onClick={()=>{if(window.confirm('Het lokale browserconcept expliciet in dit serverconcept overnemen? Bewaar en controleer het daarna.'))edit(getEditorialDraft(selected));}}>Lokaal concept importeren</button></div>{confirm && <section className="notice" role="alert"><h2>Deze editie publiceren?</h2><p>Dit maakt een onveranderlijke release voor nieuwe avonturen. Eerdere edities blijven beschikbaar.</p><div className="account-actions"><button className="account-secondary" disabled={busy} onClick={()=>setConfirm(false)}>Nog even terug</button><button className="account-primary" disabled={busy} onClick={()=>{void publish();}}>Bevestig publicatie</button></div></section>}{published && <p><a href={`/api/content/${selected}?version=${published}`}>Gepubliceerde contentrelease bekijken →</a></p>}<small>Conceptrevisie {revision} · {dirty?'onbewaarde wijzigingen':'geen onbewaarde wijzigingen'}</small></fieldset>}{busy && <p role="status">Een moment…</p>}</>}{notice && <p role="status" className="account-feedback">{notice}</p>}</PageShell>;
}
