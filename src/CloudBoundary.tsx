'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowRight, Check, Cloud, CloudOff, Download, LoaderCircle, LogIn, LogOut, RefreshCw, ShieldCheck, Sparkles, TriangleAlert, Users } from 'lucide-react';
import { FamilySyncClient } from './cloudSync';
import type { ParentIdentity, SyncState } from './cloudSync';
import { freshSnapshot, hydrateSnapshot, legacySnapshotForParent, loadFamily, markLegacyImported, setStorageScope, subscribeStorage } from './profileStorage';
import type { FamilySnapshot } from './profileStorage';
import './cloud.css';
import './demo.css';

const SIGN_IN = '/signin-with-chatgpt?return_to=%2F';
const SIGN_OUT = '/signout-with-chatgpt?return_to=%2F';
const INITIAL: SyncState = { phase: 'loading', revision: 0, snapshot: null, dirty: false };
type CloudContextValue = { parent: ParentIdentity | null; state: SyncState; client: FamilySyncClient | null; guest: boolean };
const CloudContext = createContext<CloudContextValue>({ parent: null, state: INITIAL, client: null, guest: true });
type DemoSession = { loggedIn: boolean; login: () => void; logout: () => void };
const DemoContext = createContext<DemoSession | null>(null);

/** The prototype opens locally, independently of any authenticated parent. */
export function DemoBoundary({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  useEffect(() => {
    setStorageScope('prototype-demo');
    loadFamily();
    setReady(true);
  }, []);
  if (!ready) return <div className="demo-loading" role="status">De verhalen komen eraan…</div>;
  const demo = { loggedIn, login: () => setLoggedIn(true), logout: () => setLoggedIn(false) };
  return <DemoContext.Provider value={demo}><CloudContext.Provider value={{ parent: null, state: INITIAL, client: null, guest: true }}>{children}</CloudContext.Provider></DemoContext.Provider>;
}

export function DemoLoginButton() {
  const demo = useContext(DemoContext);
  if (!demo) return null;
  return <div className="demo-login-control"><button className="demo-login-button" onClick={demo.loggedIn ? demo.logout : demo.login}>{demo.loggedIn ? <LogOut size={16} /> : <LogIn size={16} />}<span>{demo.loggedIn ? 'Demo uitloggen' : 'Demo inloggen'}</span></button><span className="demo-login-status" role="status">{demo.loggedIn ? 'Ingelogd als Demo-ouder' : ''}</span></div>;
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
  const generation = useRef(0);
  const conflictCard = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = ++generation.current;
    setGuest(false); setPhase('loading'); setState(INITIAL);
    if (!parent) { setStorageScope('guest'); setClient(null); setLegacy(null); setPhase('login'); return; }
    setStorageScope(`parent:${parent.id}`);
    const nextClient = new FamilySyncClient(parent.id, { canApplyRemote: () => !document.querySelector('[role="dialog"]'), onMerged(snapshot) { if (generation.current === token) hydrateSnapshot(snapshot); }, onRemote(snapshot) {
      if (generation.current !== token) return;
      if (snapshot) { hydrateSnapshot(snapshot); setEpoch(value => value + 1); setPhase('ready'); }
      else { setLegacy(legacySnapshotForParent(parent!.id)); setPhase('onboarding'); }
    } });
    setClient(nextClient);
    const stopState = nextClient.subscribe(next => {
      if (generation.current !== token) return;
      setState(next);
      if (next.phase === 'signed-out' || (next.phase === 'error' && !next.snapshot)) setPhase('error');
      if (next.phase === 'saved' && !next.dirty && importPending(parent.id)) { markLegacyImported(parent.id); markImportPending(parent.id, false); }
    });
    const stopStorage = subscribeStorage(snapshot => { if (generation.current === token) nextClient.enqueue(snapshot); });
    const online = () => { void nextClient.flush().then(() => { return document.querySelector('[role="dialog"]') ? nextClient.verifyIdentity() : nextClient.refresh(); }); };
    const focus = () => { if (document.visibilityState === 'visible') void (document.querySelector('[role="dialog"]') ? nextClient.verifyIdentity() : nextClient.refresh()); };
    window.addEventListener('online', online); window.addEventListener('focus', focus); document.addEventListener('visibilitychange', focus);
    void nextClient.load();
    return () => { generation.current += 1; stopState(); stopStorage(); nextClient.dispose(); window.removeEventListener('online', online); window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', focus); };
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

  function begin(snapshot: FamilySnapshot, fromLegacy: boolean) {
    if (!parent || !client || opening) return;
    setOpening(true);
    if (fromLegacy) markImportPending(parent.id, true);
    hydrateSnapshot(snapshot);
    client.enqueue(snapshot);
    setEpoch(value => value + 1); setPhase('ready');
    void client.flush().finally(() => setOpening(false));
  }
  function enterGuest() { setStorageScope('guest'); setGuest(true); setPhase('ready'); setEpoch(value => value + 1); }
  const value: CloudContextValue = { parent: guest ? null : parent, state, client: guest ? null : client, guest };

  if (phase === 'loading') return <AccountShell><div className="account-loading" role="status"><LoaderCircle className="account-spin" size={25} /><span>We zoeken jullie verhalen erbij…</span></div></AccountShell>;
  if (phase === 'login') return <AccountShell><span className="account-eyebrow"><Sparkles size={16} /> IEDER KIND EEN EIGEN AVONTUUR</span><h1>Jullie verhalen.<br />Overal weer thuis.</h1><p>Log als ouder in. Daarna kiest ieder kind zijn eigen plaatje, vrienden en avonturen — ook op een andere telefoon of tablet.</p><a className="account-primary" href={SIGN_IN} target="_top"><LogIn size={19} />Inloggen als ouder<ArrowRight size={18} /></a><div className="account-login-note"><ShieldCheck size={17} /><span>Voor dit prototype log je veilig in met ChatGPT. Kinderen hebben geen eigen e-mailadres nodig.</span></div><button className="account-guest" onClick={enterGuest}>Even rondkijken op dit apparaat <ArrowRight size={16} /></button></AccountShell>;
  if (phase === 'onboarding') return <AccountShell><span className="account-eyebrow"><Users size={16} /> WELKOM, GROTE AVONTURIER</span><h1>Een eigen plek<br />voor jullie gezin.</h1><p>{legacy ? 'Er staan al kindprofielen op dit apparaat. Wil je die meenemen naar jouw ouderaccount?' : 'We maken een plek waar de namen, keuzes en avonturen van jullie kinderen bewaard blijven.'}</p>{legacy && <div className="account-import-preview">{legacy.family.children.map(child => <span key={child.id}><Check size={15} />{child.name}</span>)}<small>Deze profielen komen alleen in jouw ouderaccount terecht.</small></div>}{legacy && <button className="account-primary" disabled={opening} onClick={() => begin(legacy, true)}><Download size={18} />Profielen van dit apparaat meenemen</button>}<button className={legacy ? 'account-secondary' : 'account-primary'} disabled={opening} onClick={() => begin(freshSnapshot(), false)}>{legacy ? 'Met een nieuwe omgeving beginnen' : 'Maak onze gezinsomgeving'}<ArrowRight size={18} /></button><p className="account-parent-name">Ingelogd als {parent?.displayName || parent?.email}</p></AccountShell>;
  if (phase === 'error') return <AccountShell><TriangleAlert size={31} className="account-alert-icon" /><h1>Even geen verbinding<br />met jullie verhalen.</h1><p>{state.message || 'Je gegevens worden niet vervangen. Probeer het over een moment nog eens.'}</p>{state.phase === 'signed-out' ? <a className="account-primary" href={SIGN_IN} target="_top"><LogIn size={18} />Opnieuw inloggen</a> : <button className="account-primary" onClick={() => { setPhase('loading'); void client?.load(); }}><RefreshCw size={18} />Opnieuw proberen</button>}</AccountShell>;

  return <CloudContext.Provider value={value}><div key={`${parent?.id || 'guest'}-${epoch}`} inert={state.phase === 'conflict' ? true : undefined} aria-hidden={state.phase === 'conflict' ? true : undefined}>{children}</div>{!guest && state.phase === 'conflict' && <div className="sync-conflict-overlay" role="dialog" aria-modal="true" aria-labelledby="sync-conflict-title"><div ref={conflictCard} className="sync-conflict-card"><TriangleAlert size={29} /><span className="account-eyebrow">EVEN VOOR DE OUDERS</span><h2 id="sync-conflict-title">Er is ook op een ander apparaat verder gelezen.</h2><p>We schrijven niets over zonder jouw keuze. Welke versie willen jullie verder gebruiken? {state.localDurable === false ? 'Deze browser kan geen herstelkopie bewaren. Houd dit venster open totdat je hebt gekozen.' : 'De andere versie blijft als herstelkopie op dit apparaat staan.'}</p><button className="account-primary" onClick={() => client?.chooseRemote()}><Cloud size={18} />De nieuwste opgeslagen versie ophalen</button><button className="account-secondary" onClick={() => { void client?.chooseLocal(); }}>De versie van dit apparaat bewaren</button></div></div>}{!guest && ['offline', 'error', 'signed-out'].includes(state.phase) && <div className="sync-notice" role="status"><CloudOff size={18} /><span>{state.localDurable === false && state.dirty ? 'Je browser kan nu niet opslaan. Houd dit venster open tot de verbinding terug is.' : state.message || 'Veranderingen staan nog op dit apparaat.'}</span>{state.phase === 'signed-out' ? <a href={SIGN_IN} target="_top">Inloggen</a> : <button onClick={() => { void client?.flush().then(() => client?.refresh()); }}>Opnieuw proberen</button>}</div>}</CloudContext.Provider>;
}

function AccountShell({ children }: { children: ReactNode }) { return <main className="account-page"><a className="account-logo" href="/"><img src="/brand/logo.webp" alt="Fabelpad" /></a><section className="account-card"><div className="account-mascot"><img src="/brand/mascot.webp" alt="" /></div>{children}</section><span className="account-bottom-line">Jij kiest het avontuur. Wij bewaren een plekje voor jullie fantasie.</span></main>; }

export function SyncBadge() {
  const { guest, state } = useContext(CloudContext);
  const demo = useContext(DemoContext);
  const text = demo ? 'Demo · op dit apparaat' : guest ? 'Op dit apparaat' : state.phase === 'saved' && !state.dirty ? 'Avonturen bewaard' : state.phase === 'saving' || state.phase === 'pending' ? 'Even bewaren…' : state.phase === 'conflict' ? 'Versie kiezen' : state.phase === 'offline' ? state.localDurable === false && state.dirty ? 'Alleen in dit venster' : 'Op dit apparaat bewaard' : 'Nog niet gesynchroniseerd';
  const Icon = guest || state.phase === 'offline' ? CloudOff : state.phase === 'saving' || state.phase === 'pending' ? LoaderCircle : state.phase === 'saved' ? Check : TriangleAlert;
  return <span className={`sync-badge sync-${guest ? 'guest' : state.phase}`} role="status"><Icon size={13} className={state.phase === 'saving' ? 'account-spin' : undefined} /><span>{text}</span></span>;
}

export function ParentAccountPanel() {
  const { parent, guest, client, state } = useContext(CloudContext);
  const demo = useContext(DemoContext);
  if (demo) return <section className="parent-account-panel" aria-label="Demoaccount"><div className="parent-account-heading"><ShieldCheck size={20} /><div><strong>Demoaccount</strong><small>{demo.loggedIn ? 'Ingelogd als Demo-ouder' : 'Ontdekken zonder account'}</small></div></div><SyncBadge /><p>Dit is de prototypeomgeving. Kindprofielen, keuzes en voortgang blijven op dit apparaat bewaard. Demo inloggen werkt direct, zonder e-mailadres of wachtwoord.</p><button className="account-primary" onClick={demo.loggedIn ? demo.logout : demo.login}>{demo.loggedIn ? <LogOut size={17} /> : <LogIn size={17} />}{demo.loggedIn ? 'Demo uitloggen' : 'Demo inloggen'}</button></section>;
  return <section className="parent-account-panel" aria-label="Jouw ouderaccount"><div className="parent-account-heading"><ShieldCheck size={20} /><div><strong>{guest ? 'Rondkijken op dit apparaat' : 'Jouw ouderaccount'}</strong><small>{parent?.displayName || parent?.email || 'Nog niet ingelogd'}</small></div></div><SyncBadge />{guest ? <><p>Inloggen maakt een centrale plek voor jullie kindprofielen, verhaalgeheugen en voortgang.</p><a href={SIGN_IN} target="_top" className="account-primary"><LogIn size={17} />Inloggen als ouder</a></> : <><p>Dezelfde kindprofielen komen terug wanneer je op een ander apparaat met dit ouderaccount inlogt.</p><div className="parent-account-actions"><button onClick={() => { void client?.flush().then(() => client?.refresh()); }} disabled={state.phase === 'saving'}><RefreshCw size={15} />Nu bijwerken</button><a href={SIGN_OUT} target="_top"><LogOut size={15} />Uitloggen</a></div>{state.dirty && <small className="parent-account-draft">{state.localDurable === false ? 'Je browser kan de apparaatversie niet bewaren. Houd dit venster open tot alles centraal is opgeslagen.' : 'Nog niet alles is centraal bewaard. Je apparaatversie blijft beschikbaar als je later met dit account terugkomt.'}</small>}</>}</section>;
}
