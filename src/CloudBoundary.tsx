'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowRight, Check, Cloud, CloudOff, Download, LoaderCircle, LogIn, LogOut, RefreshCw, ShieldCheck, Sparkles, TriangleAlert, Users } from 'lucide-react';
import { FamilySyncClient } from './cloudSync';
import type { ParentIdentity, SyncState } from './cloudSync';
import { freshSnapshot, hydrateSnapshot, isLocalStorageDurable, legacySnapshotForParent, loadFamily, markLegacyImported, setStorageScope, subscribeStorage } from './profileStorage';
import type { FamilySnapshot } from './profileStorage';
import './cloud.css';
import './demo.css';
import { accountRequest } from './AccountPage';
import { ParentActivityQueue, READING_EVENT } from './parentActivity';

const SIGN_IN = '/inloggen';
async function signOut() {
  try { const response = await fetch('/api/auth/signout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); if (!response.ok) throw new Error(); location.assign('/inloggen'); }
  catch { window.alert('Uitloggen is niet gelukt. Probeer het opnieuw. Je apparaatversie blijft bewaard.'); }
}
const INITIAL: SyncState = { phase: 'loading', revision: 0, snapshot: null, dirty: false };
type CloudContextValue = { parent: ParentIdentity | null; state: SyncState; client: FamilySyncClient | null; guest: boolean };
const CloudContext = createContext<CloudContextValue>({ parent: null, state: INITIAL, client: null, guest: true });
const LocalContext = createContext(false);

/** Local reading opens independently of any authenticated parent. */
export function DemoBoundary({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setStorageScope('prototype-demo');
    loadFamily();
    setReady(true);
  }, []);
  if (!ready) return <div className="demo-loading" role="status">De verhalen komen eraan…</div>;
  return <LocalContext.Provider value={true}><CloudContext.Provider value={{ parent: null, state: INITIAL, client: null, guest: true }}>{children}</CloudContext.Provider></LocalContext.Provider>;
}

export function DemoLoginButton() {
  if (!useContext(LocalContext)) return null;
  return <div className="demo-login-control"><a className="demo-login-button" href={SIGN_IN}><LogIn size={16} /><span>Inloggen als ouder</span></a></div>;
}
function pendingImportKey(id: string) { return `fabelpad-import-pending-${encodeURIComponent(id)}`; }
function markImportPending(id: string, pending: boolean) { try { if (pending) localStorage.setItem(pendingImportKey(id), '1'); else localStorage.removeItem(pendingImportKey(id)); } catch { /* Session import remains explicit. */ } }
function importPending(id: string) { try { return localStorage.getItem(pendingImportKey(id)) === '1'; } catch { return false; } }

export default function CloudBoundary({ parent, children }: { parent: ParentIdentity | null; children: ReactNode }) {
  const [phase, setPhase] = useState<'loading' | 'login' | 'onboarding' | 'ready' | 'error'>('loading');
  const [state, setState] = useState<SyncState>(INITIAL);
  const [client, setClient] = useState<FamilySyncClient | null>(null);
  const [guest, setGuest] = useState(false);
  const [legacy, setLegacy] = useState<FamilySnapshot | null>(null);
  const [epoch, setEpoch] = useState(0);
  const [opening, setOpening] = useState(false);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [onboardingNotice, setOnboardingNotice] = useState('');
  const newSnapshot = useRef<FamilySnapshot | null>(null);
  const generation = useRef(0);
  const conflictCard = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = ++generation.current;
    setGuest(false); setPhase('loading'); setState(INITIAL);
    if (!parent) { setStorageScope('guest'); setClient(null); setLegacy(null); setPhase('login'); return; }
    setStorageScope(`parent:${parent.id}`);
    const nextClient = new FamilySyncClient(parent.id, { canApplyRemote: () => !document.querySelector('[role="dialog"]'), onMerged(snapshot) { if (generation.current === token) hydrateSnapshot(snapshot); }, onRemote(snapshot) {
      if (generation.current !== token) return;
      if (snapshot && snapshot.family.children.length > 0) { hydrateSnapshot(snapshot); setEpoch(value => value + 1); setPhase('ready'); }
      else { setLegacy(legacySnapshotForParent(parent!.id, true)); setPhase('onboarding'); }
    } });
    setClient(nextClient);
    const activity = new ParentActivityQueue(parent.id, { onBlocked: () => { void nextClient.verifyIdentity(); } });
    const cleared = (event: Event) => { if ((event as CustomEvent<{ parentId?: string }>).detail?.parentId === parent.id) activity.discard(); };
    window.addEventListener('fabelpad-parent-data-cleared', cleared);
    const reading = (event: Event) => {
      const profileId = (event as CustomEvent<{ profileId?: unknown }>).detail?.profileId;
      const family = loadFamily();
      if (generation.current === token && typeof profileId === 'string' && family.activeId === profileId && family.children.some(child => child.id === profileId) && !['signed-out', 'loading', 'error'].includes(nextClient.getState().phase)) activity.record(profileId);
    };
    window.addEventListener(READING_EVENT, reading);
    const stopState = nextClient.subscribe(next => {
      if (generation.current !== token) return;
      setState(next);
      if (next.phase === 'signed-out' || (next.phase === 'error' && !next.snapshot)) setPhase('error');
      if (next.phase === 'saved' && !next.dirty && importPending(parent.id)) { markLegacyImported(parent.id); markImportPending(parent.id, false); }
    });
    const stopStorage = subscribeStorage(snapshot => { if (generation.current === token) nextClient.enqueue(snapshot); });
    const online = () => { void activity.flush(); void nextClient.flush().then(() => { return document.querySelector('[role="dialog"]') ? nextClient.verifyIdentity() : nextClient.refresh(); }); };
    const focus = () => { if (document.visibilityState === 'visible') void (document.querySelector('[role="dialog"]') ? nextClient.verifyIdentity() : nextClient.refresh()); };
    window.addEventListener('online', online); window.addEventListener('focus', focus); document.addEventListener('visibilitychange', focus);
    void nextClient.load();
    return () => { generation.current += 1; activity.stop(); window.removeEventListener('fabelpad-parent-data-cleared', cleared); window.removeEventListener(READING_EVENT, reading); stopState(); stopStorage(); nextClient.dispose(); window.removeEventListener('online', online); window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', focus); };
  }, [parent?.id]);

  useEffect(() => {
    if (state.phase !== 'conflict') return;
    const previous = document.activeElement as HTMLElement | null;
    const items = () => Array.from(conflictCard.current?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href]') || []);
    items()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' && event.key !== 'Escape') return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.key === 'Escape') return;
      const targets = items();
      const index = targets.indexOf(document.activeElement as HTMLElement);
      const next = event.shiftKey ? (index <= 0 ? targets.length - 1 : index - 1) : (index + 1) % targets.length;
      targets[next]?.focus();
    };
    document.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('keydown', onKey, true); if (previous?.isConnected) previous.focus(); };
  }, [state.phase]);

  async function begin(snapshot: FamilySnapshot, fromLegacy: boolean) {
    if (!parent || !client || opening) return;
    if (!snapshot.family.children.every(child => permissions[fromLegacy ? child.id : 'new'])) return;
    setOpening(true);
    setOnboardingNotice('');
    try {
      for (const child of snapshot.family.children) await accountRequest('/api/parent/consent', { profileId: child.id, consent: true, guardianDeclaration: true }, parent.id);
      if (fromLegacy) markImportPending(parent.id, true);
      hydrateSnapshot(snapshot);
      client.enqueue(snapshot);
      await client.flush();
      if (client.getState().phase !== 'saved') { setOnboardingNotice('Toestemming is bewaard, maar het profiel is nog niet veilig opgeslagen. Probeer het opnieuw.'); return; }
      setEpoch(value => value + 1); setPhase('ready');
    } catch (error) { setOnboardingNotice((error as Error).message); }
    finally { setOpening(false); }
  }
  function enterGuest() { setStorageScope('guest'); setGuest(true); setPhase('ready'); setEpoch(value => value + 1); }
  const value: CloudContextValue = { parent: guest ? null : parent, state, client: guest ? null : client, guest };

  if (phase === 'loading') return <AccountShell><div className="account-loading" role="status"><LoaderCircle className="account-spin" size={25} /><span>We zoeken jullie verhalen erbij…</span></div></AccountShell>;
  if (phase === 'login') return <AccountShell><span className="account-eyebrow"><Sparkles size={16} /> IEDER KIND EEN EIGEN AVONTUUR</span><h1>Jullie verhalen.<br />Overal weer thuis.</h1><p>Log als ouder in. Daarna kiest ieder kind zijn eigen plaatje, vrienden en avonturen — ook op een andere telefoon of tablet.</p><a className="account-primary" href={SIGN_IN} target="_top"><LogIn size={19} />Inloggen als ouder<ArrowRight size={18} /></a><div className="account-login-note"><ShieldCheck size={17} /><span>Je logt als ouder in met een e-mailcode of Google. Kinderen hebben geen eigen e-mailadres nodig.</span></div><button className="account-guest" onClick={enterGuest}>Even rondkijken op dit apparaat <ArrowRight size={16} /></button></AccountShell>;
  if (phase === 'onboarding') return <AccountShell><span className="account-eyebrow"><Users size={16} /> EEN BEWUSTE KEUZE VOOR OUDERS</span><h1>Een online profiel<br />als jullie dat willen.</h1><p>Een online kinderprofiel is optioneel. We bewaren de bijnaam, standaardavatar en leesgegevens om op een ander apparaat verder te lezen. Gebruik een bijnaam; een geboortedatum of identiteitsdocument is niet nodig.</p><p>Je kunt per profiel toestemming intrekken bij Ons gezin. Dan stopt synchronisatie en wissen we dat profiel. Bij accountverwijdering worden de online gezinsgegevens volgens de aangegeven termijn gewist. De <a href="/privacyverklaring">privacyverklaring</a> legt ook uit wat geldt bij langdurige inactiviteit. <a href="/privacy-voor-kinderen">Privacy voor kinderen</a>.</p>
    {legacy && <><p>Op dit apparaat staan al profielen. Geef voor ieder profiel afzonderlijk toestemming voordat het wordt geüpload.</p><div className="account-import-preview">{legacy.family.children.map(child => <label className="account-check" key={child.id}><input type="checkbox" checked={!!permissions[child.id]} onChange={e => setPermissions(previous => ({ ...previous, [child.id]: e.target.checked }))} /><span>Ik ben ouder met gezag of voogd en geef toestemming om de bijnaam, avatar en leesgegevens van {child.name} te bewaren voor het kinderprofiel en om verder te lezen waar mijn kind is gebleven.</span></label>)}</div><button className="account-primary" disabled={opening || !legacy.family.children.every(child => permissions[child.id])} onClick={() => void begin(legacy, true)}><Download size={18} />Deze profielen online bewaren</button></>}
    <label className="account-check"><input type="checkbox" checked={!!permissions.new} onChange={e => setPermissions(previous => ({ ...previous, new: e.target.checked }))} /><span>Ik ben ouder met gezag of voogd en geef toestemming om de bijnaam, avatar en leesgegevens van mijn kind te bewaren voor het kinderprofiel en om verder te lezen waar mijn kind is gebleven.</span></label>
    <button className={legacy ? 'account-secondary' : 'account-primary'} disabled={opening || !permissions.new} onClick={() => { newSnapshot.current ??= freshSnapshot(); void begin(newSnapshot.current, false); }}>{opening ? 'Veilig bewaren…' : 'Start met een nieuw profiel Avonturier'}<ArrowRight size={18} /></button>
    {onboardingNotice && <p role="status" className="account-feedback">{onboardingNotice}</p>}
    <p><a href="/lezen">Verder lezen zonder online kinderprofiel →</a></p><p><a href="/profiel/account">Profiel → Account</a></p><p className="account-parent-name">Ingelogd als {parent?.displayName || parent?.email}</p></AccountShell>;
  if (phase === 'error') return <AccountShell><TriangleAlert size={31} className="account-alert-icon" /><h1>Even geen verbinding<br />met jullie verhalen.</h1><p>{state.message || 'Je gegevens worden niet vervangen. Probeer het over een moment nog eens.'}</p>{state.phase === 'signed-out' ? <a className="account-primary" href={SIGN_IN} target="_top"><LogIn size={18} />Opnieuw inloggen</a> : <button className="account-primary" onClick={() => { setPhase('loading'); void client?.load(); }}><RefreshCw size={18} />Opnieuw proberen</button>}</AccountShell>;

  return <CloudContext.Provider value={value}><div key={`${parent?.id || 'guest'}-${epoch}`} inert={state.phase === 'conflict' ? true : undefined} aria-hidden={state.phase === 'conflict' ? true : undefined}>{children}</div>{!guest && state.phase === 'conflict' && <div className="sync-conflict-overlay" role="dialog" aria-modal="true" aria-labelledby="sync-conflict-title"><div ref={conflictCard} className="sync-conflict-card"><TriangleAlert size={29} /><span className="account-eyebrow">EVEN VOOR DE OUDERS</span><h2 id="sync-conflict-title">Er is ook op een ander apparaat verder gelezen.</h2><p>We schrijven niets over zonder jouw keuze. Welke versie willen jullie verder gebruiken? {state.localDurable === false ? 'Deze browser kan geen herstelkopie bewaren. Houd dit venster open totdat je hebt gekozen.' : 'De andere versie blijft als herstelkopie op dit apparaat staan.'}</p><button className="account-primary" onClick={() => client?.chooseRemote()}><Cloud size={18} />De nieuwste opgeslagen versie ophalen</button><button className="account-secondary" onClick={() => { void client?.chooseLocal(); }}>De versie van dit apparaat bewaren</button></div></div>}{!guest && ['offline', 'error', 'signed-out'].includes(state.phase) && <div className="sync-notice" role="status"><CloudOff size={18} /><span>{state.localDurable === false && state.dirty ? 'Je browser kan nu niet opslaan. Houd dit venster open tot de verbinding terug is.' : state.message || 'Veranderingen staan nog op dit apparaat.'}</span>{state.phase === 'signed-out' ? <a href={SIGN_IN} target="_top">Inloggen</a> : <button onClick={() => { void client?.flush().then(() => client?.refresh()); }}>Opnieuw proberen</button>}</div>}</CloudContext.Provider>;
}

function AccountShell({ children }: { children: ReactNode }) { return <main className="account-page"><a className="account-logo" href="/"><img src="/brand/logo.webp" alt="Fabelpad" /></a><section className="account-card"><div className="account-mascot"><img src="/brand/mascot.webp" alt="" /></div>{children}</section><span className="account-bottom-line">Jij kiest het avontuur. Wij bewaren een plekje voor jullie fantasie.</span></main>; }

export function SyncBadge() {
  const [durable, setDurable] = useState(true);
  useEffect(() => { setDurable(isLocalStorageDurable()); return subscribeStorage(() => setDurable(isLocalStorageDurable())); }, []);
  const { guest, state } = useContext(CloudContext);
  const local = useContext(LocalContext);
  const text = local ? durable ? 'Op dit apparaat' : 'Alleen in dit venster · bewaren lukt niet' : guest ? 'Op dit apparaat' : state.phase === 'saved' && !state.dirty ? 'Avonturen bewaard' : state.phase === 'saving' || state.phase === 'pending' ? 'Even bewaren…' : state.phase === 'conflict' ? 'Versie kiezen' : state.phase === 'offline' ? state.localDurable === false && state.dirty ? 'Alleen in dit venster' : 'Op dit apparaat bewaard' : 'Nog niet gesynchroniseerd';
  const Icon = guest || state.phase === 'offline' ? CloudOff : state.phase === 'saving' || state.phase === 'pending' ? LoaderCircle : state.phase === 'saved' ? Check : TriangleAlert;
  return <span className={`sync-badge sync-${guest ? 'guest' : state.phase}`} role="status"><Icon size={13} className={state.phase === 'saving' ? 'account-spin' : undefined} /><span>{text}</span></span>;
}

export function ParentAccountPanel() {
  const { parent, guest, client, state } = useContext(CloudContext);
  const local = useContext(LocalContext);
  if (local) return <section className="parent-account-panel" aria-label="Lezen op dit apparaat"><div className="parent-account-heading"><ShieldCheck size={20} /><div><strong>Op dit apparaat</strong><small>Lezen zonder ouderaccount</small></div></div><SyncBadge /><p>Kindprofielen, keuzes en voortgang blijven op dit apparaat. Log als ouder in voor jullie online gezinsomgeving. Lokale profielen worden alleen na jouw keuze en toestemming online bewaard.</p><a className="account-primary" href={SIGN_IN}><LogIn size={17} />Inloggen als ouder</a></section>;
  return <section className="parent-account-panel" aria-label="Jouw ouderaccount"><div className="parent-account-heading"><ShieldCheck size={20} /><div><strong>{guest ? 'Rondkijken op dit apparaat' : 'Jouw ouderaccount'}</strong><small>{parent?.displayName || parent?.email || 'Nog niet ingelogd'}</small></div></div><SyncBadge />{guest ? <><p>Inloggen maakt een centrale plek voor jullie kindprofielen, verhaalgeheugen en voortgang.</p><a href={SIGN_IN} target="_top" className="account-primary"><LogIn size={17} />Inloggen als ouder</a></> : <><p>Dezelfde kindprofielen komen terug wanneer je op een ander apparaat met dit ouderaccount inlogt.</p><div className="parent-account-actions"><button onClick={() => { void client?.flush().then(() => client?.refresh()); }} disabled={state.phase === 'saving'}><RefreshCw size={15} />Nu bijwerken</button><button onClick={() => { void signOut(); }}><LogOut size={15} />Uitloggen</button></div>{state.dirty && <small className="parent-account-draft">{state.localDurable === false ? 'Je browser kan de apparaatversie niet bewaren. Houd dit venster open tot alles centraal is opgeslagen.' : 'Nog niet alles is centraal bewaard. Je apparaatversie blijft beschikbaar als je later met dit account terugkomt.'}</small>}</>}</section>;
}
