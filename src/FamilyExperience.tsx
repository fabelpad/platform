'use client';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import App from './App';
import CloudBoundary, { ParentAccountPanel } from './CloudBoundary';
import { accountRequest, PageShell, readAccountSession, type AccountSession } from './AccountPage';
import { parentNeedsOnboarding, type ParentAccountStatus } from '../lib/parentAccount';
import { reportConsciousParentAction } from './parentActivity';
import ProfileReadingFields from './ProfileReadingFields';
import { amsterdamDate, isValidBirthDate } from './profileReading';
import { useAmsterdamDate } from './useAmsterdamDate';
import type { ReadingLevel, ReadingPrefs } from './readingLevel';
import { clearParentDeviceData, createChild, exportSnapshot, loadFamily, MAX_CHILDREN, readChild, saveChild, saveFamily, subscribeStorage } from './profileStorage';

function FamilySettings({ onBack, parentId }: { onBack: () => void; parentId: string }) {
  const today = useAmsterdamDate();
  const [birthDate, setBirthDate] = useState('');
  const [readingLevelOverride, setReadingLevelOverride] = useState<ReadingLevel | undefined>();
  const [family, setFamily] = useState(() => loadFamily());
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<ParentAccountStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const active = family.children.find(c => c.id === family.activeId) || family.children[0];
  const prefs = readChild<ReadingPrefs>(active.id, 'prefs', { muted: false, calm: false, textSize: 'normal' });
  useEffect(() => subscribeStorage(() => setFamily(loadFamily())), []);
  useEffect(() => { void fetch('/api/parent/status', { cache: 'no-store' }).then(r => r.json()).then(setStatus).catch(() => setNotice('De toestemmingsstatus is nu niet bereikbaar.')); }, []);
  async function update(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || busy || !editing && !consent) return;
    if (!editing && family.children.length >= MAX_CHILDREN) return;
    const previousChild = family.children.find(child => child.id === editing);
    if ((!editing || previousChild?.birthDate || birthDate) && !isValidBirthDate(birthDate, amsterdamDate())) { setNotice('Vul een geldige geboortedatum in die niet in de toekomst ligt.'); return; }
    setBusy(true); setNotice('');
    try {
      const child = editing ? null : { ...createChild(name, 0, birthDate), readingLevelOverride };
      if (child) await accountRequest('/api/parent/consent', { profileId: child.id, consent: true, guardianDeclaration: true }, parentId);
      const children = editing ? family.children.map(c => c.id === editing ? { ...c, name: name.trim().slice(0,20), ...(birthDate ? { birthDate } : {}), readingLevelOverride } : c) : [...family.children, child!];
      const next = { ...family, children }; saveFamily(next); setFamily(next); setName(''); setBirthDate(''); setReadingLevelOverride(undefined); setEditing(null); setConsent(false); setNotice('Profiel bijgewerkt. De opslagstatus toont of het ook is gesynchroniseerd.');
      reportConsciousParentAction(parentId);
      const response = await fetch('/api/parent/status', { cache: 'no-store' }); if (response.ok) setStatus(await response.json());
    } catch (error) { setNotice((error as Error).message); } finally { setBusy(false); }
  }
  async function remove(id: string) {
    if (busy) return; setBusy(true); setNotice('');
    try {
      const response = await fetch('/api/parent/consent', { method: 'DELETE', headers: { 'Content-Type': 'application/json', 'X-Fabelpad-Parent': parentId }, body: JSON.stringify({ profileId: id }) });
      const value = await response.json(); if (!response.ok) throw new Error(value.message || 'Intrekken lukt nu niet. Er is niets gewijzigd.');
      // Reload through the server; an old local snapshot must never re-upload the withdrawn child.
      clearParentDeviceData(parentId);
      location.replace('/gezin?ouders=1');
    } catch (error) { setNotice((error as Error).message); setBusy(false); }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(exportSnapshot(), null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'fabelpad-gezinsgegevens.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    reportConsciousParentAction(parentId);
  }
  function updatePreferences(value: typeof prefs) { saveChild(active.id, 'prefs', value); setFamily({ ...family }); reportConsciousParentAction(parentId); }
  return <PageShell><button className="account-secondary" onClick={onBack}>← Terug naar de verhalen</button><h1>Ons gezin.</h1><ParentAccountPanel />
    <section className="family-settings"><h2>Ieder een eigen plekje</h2><p>Gebruik een bijnaam. De geboortedatum bepaalt automatisch het leesniveau; alleen jij beheert die in de profielinstellingen. Een identiteitsdocument is niet nodig. <a href="/privacy-voor-kinderen">Privacy voor kinderen</a>.</p>
      {family.children.map(child => { const permission = status?.consents.find(item => item.profileId === child.id && !item.withdrawnAt); return <div className="family-profile-row" key={child.id}><div><strong>{child.name}</strong><small className="profile-consent-status">{permission ? `Toestemming gegeven op ${new Date(permission.grantedAt).toLocaleDateString('nl-NL')}` : 'Toestemmingsstatus wordt gecontroleerd'}</small></div><button className="account-secondary" disabled={busy} onClick={() => { setEditing(child.id); setName(child.name); setBirthDate(child.birthDate ?? ''); setReadingLevelOverride(child.readingLevelOverride); setNotice(''); }}>Bewerken</button><button className="account-secondary" disabled={busy} onClick={() => setDeleting(child.id)}>Toestemming intrekken</button></div>; })}
      {deleting && <div role="alert"><p>Toestemming voor {family.children.find(c => c.id === deleting)?.name} intrekken? Het online profiel en de bijbehorende leesgegevens worden gewist. Nieuwe synchronisatie voor dit profiel stopt. Andere profielen blijven bestaan.</p><div className="account-actions"><button className="account-secondary" disabled={busy} onClick={() => setDeleting(null)}>Annuleren</button><button className="account-primary" disabled={busy} onClick={() => void remove(deleting)}>Trek toestemming in en wis dit profiel</button></div></div>}
      <form onSubmit={update}><label>{editing ? 'Bijnaam aanpassen' : 'Nieuw online kinderprofiel'}<input required maxLength={20} placeholder="Bijvoorbeeld Avonturier" value={name} onChange={e => setName(e.target.value)} /></label><ProfileReadingFields id="family-profile" birthDate={birthDate} onBirthDateChange={setBirthDate} required={!editing || !!family.children.find(child => child.id === editing)?.birthDate} today={today} readingLevelOverride={readingLevelOverride} onOverrideChange={setReadingLevelOverride} legacyLevel={editing ? readChild<ReadingPrefs>(editing, 'prefs', { muted: false, calm: false }).readingLevel : undefined} />
        {!editing && <><label className="account-check"><input type="checkbox" required checked={consent} onChange={e => setConsent(e.target.checked)} /><span>Ik ben ouder met gezag of voogd en geef toestemming om de bijnaam, geboortedatum, avatar en leesgegevens van mijn kind te bewaren voor het kinderprofiel en om verder te lezen waar mijn kind is gebleven.</span></label><p className="account-legal-note">Deze keuze geldt alleen voor dit profiel. Je trekt toestemming hier even eenvoudig in. Het profiel blijft bewaard zolang de toestemming en het actieve gezinsaccount bestaan. <a href="/privacyverklaring">Lees meer over bewaren, inactiviteit en verwijderen</a>.</p></>}
        <button className="account-primary" disabled={busy || !editing && (family.children.length >= MAX_CHILDREN || !consent)}>{editing ? 'Wijziging bewaren' : 'Online kindprofiel toevoegen'}</button>{editing && <button className="account-secondary" type="button" onClick={() => { setEditing(null); setName(''); setBirthDate(''); setReadingLevelOverride(undefined); }}>Bewerken annuleren</button>}
      </form><small>Maximaal vijf profielen. <a href="/lezen">Lezen zonder online kinderprofiel</a> blijft mogelijk.</small>
    </section>
    <section className="family-settings"><h2>Fijn lezen voor {active.name}</h2>{[{ key: 'muted', label: 'Geluid uit' }, { key: 'calm', label: 'Minder beweging' }].map(item => <label key={item.key}><span><input style={{width:'auto'}} type="checkbox" checked={!!prefs[item.key as 'muted' | 'calm']} onChange={e => updatePreferences({ ...prefs, [item.key]: e.target.checked })} /> {item.label}</span></label>)}<label>Tekstgrootte<select value={prefs.textSize} onChange={e => updatePreferences({ ...prefs, textSize: e.target.value === 'large' ? 'large' : 'normal' })}><option value="normal">Normaal</option><option value="large">Groter</option></select></label></section>
    <section className="family-settings"><h2>Jullie gegevens</h2><p>Download de gezinsgegevens die op dit apparaat beschikbaar zijn.</p><button className="account-secondary" onClick={download}>Gezinsgegevens downloaden</button><p><a href="/profiel/account">Profiel → Account → Account verwijderen</a></p><p><a href="/profiel/abonnement">Jullie abonnement, kortingscode en betalingen beheren</a></p></section>{notice && <p role="status" className="account-feedback">{notice}</p>}
  </PageShell>;
}
export default function FamilyExperience() {
  const [session, setSession] = useState<AccountSession | null>(null);
  const [error, setError] = useState('');
  const [parents, setParents] = useState(false);
  useEffect(() => {
    let active = true; setParents(new URLSearchParams(location.search).get('ouders') === '1');
    fetch('/api/auth/session', { cache: 'no-store' }).then(readAccountSession).then(data => { if (active) setSession(data); }).catch(error => { if (active) setError(error.message?.includes('verwijderd') ? error.message : 'De accountverbinding is nu niet bereikbaar. Je gegevens worden niet vervangen.'); });
    return () => { active = false; };
  }, []);
  if (error || !session) return <PageShell><p role="status">{error || 'Jullie gezinsomgeving openen…'}</p>{error && <a href="/inloggen">Opnieuw inloggen</a>}</PageShell>;
  if (!session.configured) return <PageShell><h1>De gezinsomgeving is nu niet beschikbaar.</h1><p>Inloggen en online opslaan zijn tijdelijk niet mogelijk. Je kunt de verhalen op dit apparaat blijven lezen.</p><a className="account-primary" href="/lezen">Lees de verhalen</a></PageShell>;
  if (session.parent && (!session.lifecycle || parentNeedsOnboarding(session.lifecycle))) return <PageShell><h1>Rond je ouderaccount af.</h1><p>Bevestig eerst je ouderverklaring en de actuele voorwaarden. Er worden nog geen kinderprofielen gesynchroniseerd.</p><a className="account-primary" href="/onboarding">Ouderaccount afronden</a><p><a href="/lezen">Zonder online profiel verder lezen</a></p></PageShell>;
  if (session.lifecycle && ['deletion_pending', 'deleting'].includes(session.lifecycle.state)) return <PageShell><h1>Je account staat stil.</h1><p>Inloggen herstelt het account niet. Je kunt alleen via de accountpagina een expliciete herstelactie uitvoeren als de deadline nog niet is verstreken.</p><a className="account-primary" href="/profiel/account">Bekijk de verwijderstatus</a></PageShell>;
  return <CloudBoundary parent={session.parent}>{parents && session.parent ? <FamilySettings parentId={session.parent.id} onBack={() => setParents(false)} /> : <App cloudContent onRequestParents={() => setParents(true)} />}</CloudBoundary>;
}
