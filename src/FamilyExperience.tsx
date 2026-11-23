'use client';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import App from './App';
import CloudBoundary, { SyncBadge, useCloudFamily } from './CloudBoundary';
import ParentShell, { ParentDialog } from './ParentShell';
import { BookOpen, Check, Moon, Pencil, Plus, Rocket, ShieldCheck, Star, UserRound } from 'lucide-react';
import { accountRequest, PageShell, readAccountSession, type AccountSession } from './AccountPage';
import { parentNeedsOnboarding, type ParentAccountStatus } from '../lib/parentAccount';
import { reportConsciousParentAction } from './parentActivity';
import ProfileReadingFields from './ProfileReadingFields';
import NarrationProfileSettings from './NarrationProfileSettings';
import { amsterdamDate, isValidBirthDate } from './profileReading';
import { useAmsterdamDate } from './useAmsterdamDate';
import type { ReadingLevel, ReadingPrefs } from './readingLevel';
import { createChild, loadFamily, MAX_CHILDREN, readChild, saveChild, saveFamily, subscribeStorage } from './profileStorage';

function ChildAvatar({ avatar }: { avatar: number }) {
  return <span className={`fp-parent-avatar fp-parent-avatar-${avatar}`} aria-hidden="true">{avatar === 0 ? <img src="/brand/mascot.webp" alt="" /> : avatar === 1 ? <Star size={25} /> : avatar === 2 ? <Moon size={25} /> : <Rocket size={25} />}</span>;
}
function FamilySettings({ onBack, parentId }: { onBack: () => void; parentId: string }) {
  const today = useAmsterdamDate();
  const { client, state: sync } = useCloudFamily();
  const [birthDate, setBirthDate] = useState('');
  const [readingLevelOverride, setReadingLevelOverride] = useState<ReadingLevel | undefined>();
  const [readingPrefs, setReadingPrefs] = useState<ReadingPrefs>({ muted: false, calm: false, textSize: 'normal' });
  const [family, setFamily] = useState(() => loadFamily());
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<ParentAccountStatus | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [busy, setBusy] = useState(false);
  const paused = !!sync.consentReloadRequired;
  const edited = family.children.find(child => child.id === editing);
  const prefs = editing ? readingPrefs : null;
  useEffect(() => { const refresh = () => { const current = client?.getState(); setFamily(current?.consentReloadRequired && current.snapshot ? current.snapshot.family : loadFamily()); }; const stop = subscribeStorage(refresh); window.addEventListener('fabelpad-storage-change', refresh); return () => { stop(); window.removeEventListener('fabelpad-storage-change', refresh); }; }, [client]);
  async function refreshStatus() {
    try { const response = await fetch('/api/parent/status', { cache: 'no-store' }); const value = await response.json(); if (!response.ok || !Array.isArray(value.consents)) throw new Error(); setStatus(value); setStatusError(false); }
    catch { setStatusError(true); }
  }
  useEffect(() => { void refreshStatus(); const foreground = () => { if (document.visibilityState === 'visible') void refreshStatus(); }; window.addEventListener('focus', foreground); document.addEventListener('visibilitychange', foreground); return () => { window.removeEventListener('focus', foreground); document.removeEventListener('visibilitychange', foreground); }; }, []);
  function openProfile(id: string | null) {
    const child = family.children.find(item => item.id === id);
    setEditing(id); setName(child?.name ?? ''); setBirthDate(child?.birthDate ?? ''); setAvatar(child?.avatar ?? family.children.length % 4); setReadingLevelOverride(child?.readingLevelOverride); setReadingPrefs(child ? readChild<ReadingPrefs>(child.id, 'prefs', { muted: false, calm: false, textSize: 'normal' }) : { muted: false, calm: false, textSize: 'normal' }); setConsent(false); setDeleting(false); setNotice(''); setFormOpen(true);
  }
  function closeProfile() { if (!busy) { setFormOpen(false); setEditing(null); setDeleting(false); } }
  async function update(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || busy || paused || !editing && !consent) return;
    if (!editing && family.children.length >= MAX_CHILDREN) return;
    if ((!editing || edited?.birthDate || birthDate) && !isValidBirthDate(birthDate, amsterdamDate())) { setNotice('Vul een geldige geboortedatum in die niet in de toekomst ligt.'); return; }
    setBusy(true); setNotice('');
    try {
      const child = editing ? null : { ...createChild(name, avatar, birthDate), readingLevelOverride };
      if (child) await accountRequest('/api/parent/consent', { profileId: child.id, consent: true, guardianDeclaration: true }, parentId);
      const children = editing ? family.children.map(c => c.id === editing ? { ...c, avatar, name: name.trim().slice(0,20), ...(birthDate ? { birthDate } : {}), readingLevelOverride } : c) : [...family.children, child!];
      saveChild(editing ?? child!.id, 'prefs', readingPrefs);
      const next = { ...family, children }; saveFamily(next); setFamily(next); setFormOpen(false); setEditing(null); setNotice('Profiel bijgewerkt. De opslagstatus toont of het ook is gesynchroniseerd.');
      reportConsciousParentAction(parentId); void refreshStatus();
    } catch (error) { setNotice((error as Error).message); } finally { setBusy(false); }
  }
  async function remove() {
    if (busy || !editing || !client) return; setBusy(true); setNotice('');
    try {
      const response = await fetch('/api/parent/consent', { method: 'DELETE', headers: { 'Content-Type': 'application/json', 'X-Fabelpad-Parent': parentId }, body: JSON.stringify({ profileId: editing }) });
      const value = await response.json(); if (!response.ok) throw new Error(value.message || 'Intrekken lukt nu niet. Er is niets gewijzigd.');
      const id = editing; setFormOpen(false); setDeleting(false); setEditing(null);
      await client.reloadAfterConsentWithdrawal(id);
      setNotice('De toestemming is ingetrokken. Het online profiel en de leesgegevens zijn verwijderd.');
      void refreshStatus();
    } catch (error) { setNotice((error as Error).message); } finally { setBusy(false); }
  }
  async function retryWithdrawal() { if (!client || !sync.consentReloadRequired || busy) return; setBusy(true); try { await client.reloadAfterConsentWithdrawal(sync.consentReloadRequired); setNotice('De bevestigde gezinsgegevens zijn opgehaald.'); } catch { setNotice('Ophalen lukt nog niet. De ingetrokken toestemming blijft van kracht en synchronisatie blijft gepauzeerd.'); } finally { setBusy(false); } }
  function updatePreferences(value: ReadingPrefs) { if (paused) return; setReadingPrefs(value); }
  return <ParentShell active="family" onStories={onBack}>
    <div className="fp-parent-hero fp-parent-family-hero"><div><h1>Ons gezin</h1><p>Beheer de leesprofielen van je kinderen.</p></div><span className="fp-parent-hero-art" aria-hidden="true"><BookOpen size={43} /></span></div>
    <div className="fp-parent-family-layout">
      <section aria-labelledby="family-profiles-heading"><div className="fp-parent-section-bar"><div className="fp-parent-section-label"><h2 id="family-profiles-heading">Kindprofielen</h2><span className="fp-parent-count">{family.children.length} van {MAX_CHILDREN} profielen</span></div><button type="button" className="fp-parent-button fp-parent-button-primary" disabled={busy || paused || family.children.length >= MAX_CHILDREN} onClick={() => openProfile(null)}><Plus size={18} aria-hidden="true" />Toevoegen</button></div>
        {family.children.length >= MAX_CHILDREN && <p className="fp-parent-export">Je kunt maximaal vijf online kindprofielen beheren.</p>}
        <div className="fp-parent-panel fp-parent-profile-list">{family.children.map(child => { const permission = status?.consents.find(item => item.profileId === child.id && !item.withdrawnAt); return <div className="fp-parent-profile" key={child.id}><ChildAvatar avatar={child.avatar} /><div className="fp-parent-profile-copy"><strong>{child.name}</strong><small>{permission ? <><Check size={14} aria-hidden="true" />Toestemming gegeven op {new Date(permission.grantedAt).toLocaleDateString('nl-NL')}</> : statusError ? 'Toestemmingsstatus nu niet bereikbaar' : status ? 'Geen actieve toestemming bevestigd' : 'Toestemming controleren…'}</small></div><button className="fp-parent-edit" type="button" aria-label={family.children.length > 1 ? `Bewerken van ${child.name}` : 'Bewerken'} title={`Profiel van ${child.name} bewerken`} disabled={busy || paused} onClick={() => openProfile(child.id)}><Pencil size={17} aria-hidden="true" /><span>Bewerken</span><span className="fp-parent-sr">{family.children.length > 1 ? ` van ${child.name}` : ''}</span></button></div>; })}</div>
        {statusError && <p className="fp-parent-export" role="status">De toestemmingsstatus kon niet worden gecontroleerd. <button type="button" className="fp-parent-button" onClick={() => void refreshStatus()}>Opnieuw controleren</button></p>}
        <details className="fp-parent-guide"><summary><ShieldCheck size={18} aria-hidden="true" />Privacy voor kinderen</summary><p>Gebruik een bijnaam. De geboortedatum bepaalt automatisch het leesniveau; alleen jij beheert die in de profielinstellingen. Een identiteitsdocument is niet nodig. Je beheert en trekt toestemming in bij Bewerken. <a href="/privacy-voor-kinderen">Privacy voor kinderen</a> · <a href="/privacyverklaring">Privacyverklaring</a>.</p></details>
      </section>
      <aside className="fp-parent-panel fp-parent-account-preview"><div className="fp-parent-panel-heading"><UserRound size={23} aria-hidden="true" /><h2>Ouderaccount</h2></div><SyncBadge /><p>Je gezin leest verder op elk apparaat waarop je met hetzelfde ouderaccount inlogt.</p><a className="fp-parent-button" href="/profiel/account">Ouderaccount openen</a><p><a href="/profiel/abonnement">Abonnement, kortingscode en betalingen</a></p></aside>
    </div>
    {paused && <div className="fp-parent-feedback fp-parent-feedback-error" role="status"><p>{sync.message}</p><button type="button" className="fp-parent-button" disabled={busy} onClick={() => void retryWithdrawal()}>Bevestigde gezinsgegevens opnieuw ophalen</button></div>}
    {notice && !formOpen && <p role="status" className="fp-parent-feedback">{notice}</p>}
    {formOpen && <ParentDialog title={deleting ? 'Toestemming intrekken?' : editing ? `Profiel van ${edited?.name ?? name}` : 'Nieuw kindprofiel'} onClose={closeProfile} busy={busy}>
      {deleting ? <><p>Toestemming voor <strong>{edited?.name}</strong> intrekken? Het online profiel en de bijbehorende leesgegevens worden gewist. Nieuwe synchronisatie voor dit profiel stopt. Andere profielen blijven bestaan.</p><div className="fp-parent-dialog-actions"><button className="fp-parent-button" type="button" disabled={busy} onClick={() => setDeleting(false)}>Annuleren</button><button className="fp-parent-button fp-parent-danger" type="button" disabled={busy} onClick={() => void remove()}>{busy ? 'Toestemming intrekken…' : 'Trek toestemming in en wis dit profiel'}</button></div></> : <>
        <form onSubmit={update}><label>{editing ? 'Bijnaam aanpassen' : 'Nieuw online kinderprofiel'}<input autoFocus required maxLength={20} autoComplete="off" placeholder="Bijvoorbeeld Avonturier" value={name} onChange={e => setName(e.target.value)} /></label>
          <fieldset><legend>Profielfiguur</legend><div className="fp-parent-avatar-options">{['Pad', 'Ster', 'Maan', 'Raket'].map((label, index) => <button key={label} type="button" aria-label={`${label} kiezen`} aria-pressed={avatar === index} onClick={() => setAvatar(index)}><ChildAvatar avatar={index} /></button>)}</div></fieldset>
          <ProfileReadingFields id="family-profile" birthDate={birthDate} onBirthDateChange={setBirthDate} required={!editing || !!edited?.birthDate} today={today} readingLevelOverride={readingLevelOverride} onOverrideChange={setReadingLevelOverride} legacyLevel={editing ? readChild<ReadingPrefs>(editing, 'prefs', { muted: false, calm: false }).readingLevel : undefined} />
          {!editing && <><label className="account-check"><input type="checkbox" required checked={consent} onChange={e => setConsent(e.target.checked)} /><span>Ik ben ouder met gezag of voogd en geef toestemming om de bijnaam, geboortedatum, avatar en leesgegevens van mijn kind te bewaren voor het kinderprofiel en om verder te lezen waar mijn kind is gebleven.</span></label><p className="account-legal-note">Deze keuze geldt alleen voor dit profiel. Je trekt toestemming hier even eenvoudig in. Het profiel blijft bewaard zolang de toestemming en het actieve gezinsaccount bestaan. <a href="/privacyverklaring">Meer over bewaren en verwijderen</a>.</p></>}
          {editing && prefs && <details className="fp-parent-guide"><summary>Leesinstellingen voor {edited?.name}</summary>{[{ key: 'muted', label: 'Geluid uit' }, { key: 'calm', label: 'Minder beweging' }].map(item => <label className="account-check" key={item.key}><input type="checkbox" checked={!!prefs[item.key as 'muted' | 'calm']} onChange={e => updatePreferences({ ...prefs, [item.key]: e.target.checked })} /><span>{item.label}</span></label>)}<label>Tekstgrootte<select value={prefs.textSize ?? 'normal'} onChange={e => updatePreferences({ ...prefs, textSize: e.target.value === 'large' ? 'large' : 'normal' })}><option value="normal">Normaal</option><option value="large">Groter</option></select></label></details>}
          <NarrationProfileSettings key={editing ?? 'new'} profileId={editing ?? undefined} profileName={name} voiceSlot={readingPrefs.voiceSlot} onVoiceChange={voiceSlot => updatePreferences({ ...readingPrefs, voiceSlot })} disabled={busy || paused} />
          <div className="fp-parent-dialog-actions"><button className="fp-parent-button" type="button" disabled={busy} onClick={closeProfile}>Annuleren</button><button className="fp-parent-button fp-parent-button-primary" disabled={busy || paused || !editing && (family.children.length >= MAX_CHILDREN || !consent)}>{busy ? 'Bewaren…' : editing ? 'Wijziging bewaren' : 'Online kindprofiel toevoegen'}</button></div>
        </form>
        {editing && <section className="fp-parent-consent-section"><h3>Toestemming voor dit profiel</h3><p>Je kunt de toestemming voor dit online profiel intrekken. Het profiel en de leesgegevens worden dan verwijderd.</p><button className="fp-parent-button fp-parent-danger" type="button" disabled={busy || paused} onClick={() => setDeleting(true)}>Toestemming intrekken</button></section>}
      </>}{notice && <p role="status" className="account-feedback">{notice}</p>}
    </ParentDialog>}
  </ParentShell>;
}
export default function FamilyExperience() {
  const [session, setSession] = useState<AccountSession | null>(null);
  const [error, setError] = useState('');
  const [parents, setParents] = useState(false);
  useEffect(() => {
    let active = true; const navigation = () => setParents(new URLSearchParams(location.search).get('ouders') === '1'); navigation(); window.addEventListener('popstate', navigation);
    fetch('/api/auth/session', { cache: 'no-store' }).then(readAccountSession).then(data => { if (active) setSession(data); }).catch(error => { if (active) setError(error.message?.includes('verwijderd') ? error.message : 'De accountverbinding is nu niet bereikbaar. Je gegevens worden niet vervangen.'); });
    return () => { active = false; window.removeEventListener('popstate', navigation); };
  }, []);
  if (error || !session) return <PageShell><p role="status">{error || 'Jullie gezinsomgeving openen…'}</p>{error && <a href="/inloggen">Opnieuw inloggen</a>}</PageShell>;
  if (!session.configured) return <PageShell><h1>De gezinsomgeving is nu niet beschikbaar.</h1><p>Inloggen en online opslaan zijn tijdelijk niet mogelijk. Je kunt de verhalen op dit apparaat blijven lezen.</p><a className="account-primary" href="/lezen">Lees de verhalen</a></PageShell>;
  if (session.parent && (!session.lifecycle || parentNeedsOnboarding(session.lifecycle))) return <PageShell><h1>Rond je ouderaccount af.</h1><p>Bevestig eerst je ouderverklaring en de actuele voorwaarden. Er worden nog geen kinderprofielen gesynchroniseerd.</p><a className="account-primary" href="/onboarding">Ouderaccount afronden</a><p><a href="/lezen">Zonder online profiel verder lezen</a></p></PageShell>;
  if (session.lifecycle && ['deletion_pending', 'deleting'].includes(session.lifecycle.state)) return <PageShell><h1>Je account staat stil.</h1><p>Inloggen herstelt het account niet. Je kunt alleen via de accountpagina een expliciete herstelactie uitvoeren als de deadline nog niet is verstreken.</p><a className="account-primary" href="/profiel/account">Bekijk de verwijderstatus</a></PageShell>;
  return <CloudBoundary parent={session.parent}>{parents && session.parent ? <FamilySettings parentId={session.parent.id} onBack={() => { history.pushState(null, '', '/gezin'); setParents(false); }} /> : <App cloudContent onRequestParents={() => { history.pushState(null, '', '/gezin?ouders=1'); setParents(true); }} />}</CloudBoundary>;
}
