'use client';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import App from './App';
import CloudBoundary, { ParentAccountPanel } from './CloudBoundary';
import { PageShell, type AccountSession } from './AccountPage';
import { CHILD_FIELDS, createChild, exportSnapshot, loadFamily, MAX_CHILDREN, readChild, saveChild, saveFamily, subscribeStorage } from './profileStorage';

function FamilySettings({ onBack }: { onBack: () => void }) {
  const [family, setFamily] = useState(() => loadFamily());
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const active = family.children.find(c => c.id === family.activeId) || family.children[0];
  const prefs = readChild(active.id, 'prefs', { muted: false, calm: false, textSize: 'normal' });
  useEffect(() => subscribeStorage(() => setFamily(loadFamily())), []);
  function update(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    if (!editing && family.children.length >= MAX_CHILDREN) return;
    const children = editing ? family.children.map(c => c.id === editing ? { ...c, name: name.trim().slice(0,20) } : c) : [...family.children, createChild(name, family.children.length % 4)];
    const next = { ...family, children }; saveFamily(next); setFamily(next); setName(''); setEditing(null); setNotice('Profiel lokaal bijgewerkt. De opslagstatus toont of het ook is gesynchroniseerd.');
  }
  function remove(id: string) {
    if (family.children.length <= 1) return;
    const children = family.children.filter(c => c.id !== id);
    for (const field of CHILD_FIELDS) saveChild(id, field, null);
    const next = { ...family, children, activeId: family.activeId === id ? children[0].id : family.activeId };
    saveFamily(next); setFamily(next); setDeleting(null); setNotice('Kindprofiel verwijderd uit dit gezin.');
  }
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(exportSnapshot(), null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'fabelpad-gezinsgegevens.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <PageShell><button className="account-secondary" onClick={onBack}>← Terug naar de verhalen</button><h1>Ons gezin.</h1><ParentAccountPanel /><section className="family-settings"><h2>Ieder een eigen plekje</h2>{family.children.map(child => <div className="family-profile-row" key={child.id}><strong>{child.name}</strong><button className="account-secondary" onClick={() => { setEditing(child.id); setName(child.name); }}>Bewerken</button><button className="account-secondary" disabled={family.children.length <= 1} onClick={() => setDeleting(child.id)}>Verwijderen</button></div>)}{deleting && <div role="alert"><p>Profiel en voortgang van {family.children.find(c => c.id === deleting)?.name} uit dit gezin verwijderen?</p><div className="account-actions"><button className="account-secondary" onClick={() => setDeleting(null)}>Annuleren</button><button className="account-primary" onClick={() => remove(deleting)}>Bevestig verwijderen</button></div></div>}<form onSubmit={update}><label>{editing ? 'Voornaam aanpassen' : 'Nieuw kindprofiel'}<input required maxLength={20} value={name} onChange={e => setName(e.target.value)} /></label><button className="account-primary" disabled={!editing && family.children.length >= MAX_CHILDREN}>{editing ? 'Wijziging bewaren' : 'Kind toevoegen'}</button></form><small>Er zijn voorlopig maximaal vijf profielen. Definitieve pakketten volgen.</small></section><section className="family-settings"><h2>Fijn lezen voor {active.name}</h2>{[{ key: 'muted', label: 'Geluid uit' }, { key: 'calm', label: 'Minder beweging' }].map(item => <label key={item.key}><span><input style={{width:'auto'}} type="checkbox" checked={!!prefs[item.key as 'muted' | 'calm']} onChange={e => { saveChild(active.id,'prefs',{...prefs,[item.key]:e.target.checked}); setFamily({...family}); }} /> {item.label}</span></label>)}<label>Tekstgrootte<select value={prefs.textSize} onChange={e => { saveChild(active.id,'prefs',{...prefs,textSize:e.target.value}); setFamily({...family}); }}><option value="normal">Normaal</option><option value="large">Groter</option></select></label></section><section className="family-settings"><h2>Jullie gegevens</h2><p>Download de gezinsgegevens die op dit apparaat beschikbaar zijn. Niet gesynchroniseerd werk blijft bij dit ouderaccount op dit apparaat bewaard.</p><button className="account-secondary" onClick={download}>Gezinsgegevens downloaden</button><p><a href="/account-verwijderen">Account verwijderen</a></p><p>Abonnementen en aankopen worden nog ingericht.</p></section>{notice && <p role="status" className="account-feedback">{notice}</p>}</PageShell>;
}
export default function FamilyExperience() {
  const [session, setSession] = useState<AccountSession | null>(null);
  const [error, setError] = useState('');
  const [parents, setParents] = useState(false);
  useEffect(() => {
    let active = true;
    fetch('/api/auth/session', { cache: 'no-store' }).then(async r => { if (!r.ok) throw new Error(); return r.json(); }).then(data => { if (active) setSession(data); }).catch(() => { if (active) setError('De accountverbinding is nu niet bereikbaar. Je gegevens worden niet vervangen.'); });
    return () => { active = false; };
  }, []);
  if (error || !session) return <PageShell><p role="status">{error || 'Jullie gezinsomgeving openen…'}</p>{error && <a href="/inloggen">Opnieuw inloggen</a>}</PageShell>;
  if (!session.configured) return <PageShell><h1>Een plekje voor jullie gezin.</h1><p>De gezinsomgeving wordt nog aangesloten. De lokale verhalendemo is alvast beschikbaar.</p><a className="account-primary" href="/lezen">Ontdek de verhalen</a></PageShell>;
  return <CloudBoundary parent={session.parent}>{parents ? <FamilySettings onBack={() => setParents(false)} /> : <App cloudContent onRequestParents={() => setParents(true)} />}</CloudBoundary>;
}
