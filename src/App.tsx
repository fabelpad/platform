'use client';
import './legal.css';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, ArrowUpRight, BookOpen, Check, ChevronRight, Compass, Download, Heart, Headphones, Leaf, LockKeyhole, Map, Moon, Play, Rocket, ShieldCheck, Sparkles, Star, Sun, Ticket, TrainFront, Volume2, VolumeX, X, Pencil, Plus, Users } from 'lucide-react';
import StoryReader from './StoryReader';
import { reportConsciousReading } from './parentActivity';
import { lockBodyScroll } from './modalScroll';
import type { BeforeInstallPromptEvent } from './pwa';
import { worlds as baseWorlds } from './worlds';
import { getPublishedMetadata, subscribeEditorial } from './editorialStore';
import { getStoryPreviewLimit } from './prototypeAccess';
import type { World } from './worlds';
import { createChild, loadFamily, MAX_CHILDREN, readChild, saveChild, saveFamily } from './profileStorage';
import type { Family } from './profileStorage';
import './profiles.css';
import StoryMemoryPanel from './StoryMemoryPanel';
import { DemoLoginButton, ParentAccountPanel, SyncBadge } from './CloudBoundary';
import { Search } from 'lucide-react';
import './bookshelf.css';

type Page = 'discover' | 'adventures' | 'treasures';
type Modal = 'profiles' | 'profile' | 'parents' | 'install' | null;
type Profile = { name: string; avatar: number };
type Completed = Record<string, { ending: string; date: string }>;
type Prefs = { muted: boolean; calm: boolean; textSize?: 'normal' | 'large' };
const avatarNames = ['Pad', 'Ster', 'Maan', 'Raket'];
const nav = [{ id: 'discover' as Page, title: 'Ontdek', Icon: Compass }, { id: 'adventures' as Page, title: 'Mijn avonturen', Icon: BookOpen }, { id: 'treasures' as Page, title: 'Schatkist', Icon: Star }];


function Doodle({ kind = 'star', className = '' }: { kind?: 'star' | 'spark' | 'sun'; className?: string }) {
  return <svg className={`doodle ${className}`} viewBox="0 0 100 100" fill="none" aria-hidden="true">{kind === 'star' ? <path d="m50 5 12 29 31 8-26 20 1 32-24-20-30 11 11-30L7 30l32 1Z" fill="currentColor" /> : kind === 'sun' ? <><circle cx="50" cy="50" r="20" stroke="currentColor" strokeWidth="5" /><path d="M50 5v12m0 66v12M5 50h12m66 0h12M18 18l9 9m46 46 9 9M18 82l9-9m46-46 9-9" stroke="currentColor" strokeWidth="5" strokeLinecap="round" /></> : <path d="M50 5c0 32-13 45-45 45 32 0 45 13 45 45 0-32 13-45 45-45C63 50 50 37 50 5Z" fill="currentColor" />}</svg>;
}
function Avatar({ value = 0, className = '' }: { value?: number; className?: string }) {
  return <span className={`avatar avatar-${value} ${className}`}>{value === 0 ? <img src="/brand/mascot.webp" alt="" /> : value === 1 ? <Star /> : value === 2 ? <Moon /> : <Rocket />}</span>;
}
function ModalShell({ children, onClose, className = '', label }: { children: ReactNode; onClose: () => void; className?: string; label: string }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const unlockScroll = lockBodyScroll();
    box.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const els = box.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),a[href],[tabindex="0"]');
        if (!els?.length) return;
        const first = els[0], last = els[els.length - 1];
        if (!box.current?.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
        else if (e.shiftKey && (document.activeElement === first || document.activeElement === box.current)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { unlockScroll(); document.removeEventListener('keydown', onKey); previous?.focus(); };
  }, [onClose]);
  return <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}><motion.div ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-label={label} className={`modal ${className}`} initial={{ y: 24, scale: .97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 16, opacity: 0 }} onClick={e => e.stopPropagation()}><button className="icon-button close-modal" onClick={onClose} aria-label="Sluiten"><X /></button>{children}</motion.div></motion.div>;
}

export default function App({ initialStory, initialPage, forceEmpty = false, onRequestParents, cloudContent = false }: { initialStory?: string; initialPage?: Page; forceEmpty?: boolean; onRequestParents?: () => void; cloudContent?: boolean } = {}) {
  const [, editorialChanged] = useState(0);
  const [cloudMetadata, setCloudMetadata] = useState<Record<string, { title: string; description: string; image: string }>>({});
  const worlds = baseWorlds.map(world => ({ ...world, ...(cloudContent ? cloudMetadata[world.id] : getPublishedMetadata(world.id)) }));
  useEffect(() => { if (!cloudContent) return subscribeEditorial(() => editorialChanged(value => value + 1)); }, [cloudContent]);
  useEffect(() => {
    if (!cloudContent) return;
    let active = true;
    fetch('/api/content', { cache: 'no-store' }).then(async response => { if (!response.ok) return; const data = await response.json(); if (active && Array.isArray(data.stories)) setCloudMetadata(Object.fromEntries(data.stories.map((entry: { storyId: string; metadata: { title: string; description: string; image: string } }) => [entry.storyId, entry.metadata]))); }).catch(() => { /* Bundled catalogue stays readable while offline. */ });
    return () => { active = false; };
  }, [cloudContent]);
  const [page, setPage] = useState<Page>(initialPage || 'discover');
  const [filter, setFilter] = useState('Alles');
  const [search, setSearch] = useState('');
  const [family, setFamily] = useState<Family>(() => loadFamily());
  const profile = family.children.find(child => child.id === family.activeId) || family.children[0];
  const [draft, setDraft] = useState<Profile>({ name: profile.name, avatar: profile.avatar });
  const [editingId, setEditingId] = useState<string | null>(profile.id);
  const [favorites, setFavorites] = useState<string[]>(() => readChild(profile.id, 'favorites', []));
  const [started, setStarted] = useState<string[]>(() => readChild(profile.id, 'started', []));
  const [completed, setCompleted] = useState<Completed>(() => readChild(profile.id, 'completed', {}));
  const [prefs, setPrefs] = useState<Prefs>(() => readChild(profile.id, 'prefs', { muted: false, calm: false }));
  const [reader, setReader] = useState<string | null>(() => worlds.some(w => w.id === initialStory) ? initialStory! : null);
  const [modal, setModal] = useState<Modal>(null);
  const [parentOpen, setParentOpen] = useState(false);
  const [parentAnswer, setParentAnswer] = useState('');
  const [parentError, setParentError] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches);
  const [toast, setToast] = useState('');
  const systemReduced = useReducedMotion();
  const initialStoryConsumed = useRef(false);
  useEffect(() => {
    if (initialStoryConsumed.current || !initialStory || !worlds.some(w => w.id === initialStory)) return;
    initialStoryConsumed.current = true;
    const next = [...new Set([...readChild<string[]>(profile.id, 'started', []), initialStory])];
    setStarted(next); saveChild(profile.id, 'started', next);
  }, [initialStory, profile.id]);
  const calm = prefs.calm || !!systemReduced;
  const closeModal = useRef(() => { setModal(null); setParentOpen(false); }).current;
  useEffect(() => { document.documentElement.dataset.calm = String(calm); }, [calm]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 3200); return () => clearTimeout(t); }, [toast]);
  useEffect(() => {
    const handle = (e: Event) => { e.preventDefault(); setInstallPrompt(e as BeforeInstallPromptEvent); };
    const done = () => { setInstalled(true); setInstallPrompt(null); setToast('Fabelpad staat op je beginscherm!'); };
    window.addEventListener('beforeinstallprompt', handle); window.addEventListener('appinstalled', done);
    return () => { window.removeEventListener('beforeinstallprompt', handle); window.removeEventListener('appinstalled', done); };
  }, []);
  const go = (target: Page) => { setPage(target); setFilter('Alles'); setSearch(''); window.scrollTo({ top: 0, behavior: calm ? 'instant' : 'smooth' }); };
  const openStory = (id: string) => { if (cloudContent) reportConsciousReading(profile.id); const next = [...new Set([...started, id])]; setStarted(next); saveChild(profile.id, 'started', next); setReader(id); };
  const toggleFavorite = (id: string) => { const next = favorites.includes(id) ? favorites.filter(x => x !== id) : [...favorites, id]; setFavorites(next); saveChild(profile.id, 'favorites', next); };
  const updatePrefs = (next: Prefs) => { setPrefs(next); saveChild(profile.id, 'prefs', next); };
  const completeStory = (id: string, ending: string) => { setCompleted(previous => { const next = { ...previous, [id]: { ending, date: new Date().toISOString() } }; saveChild(profile.id, 'completed', next); return next; }); };
  function switchChild(id: string, nextFamily: Family = family) {
    const child = nextFamily.children.find(item => item.id === id);
    if (!child) return;
    const next: Family = { ...nextFamily, activeId: child.id };
    setReader(null);
    setFamily(next); saveFamily(next);
    setFavorites(readChild<string[]>(id, 'favorites', []));
    setStarted(readChild<string[]>(id, 'started', []));
    setCompleted(readChild<Completed>(id, 'completed', {}));
    setPrefs(readChild<Prefs>(id, 'prefs', { muted: false, calm: false }));
    setFilter('Alles'); setSearch(''); setPage('discover'); setParentOpen(false); setModal(null);
    window.scrollTo({ top: 0, behavior: 'instant' });
    setToast(`Welkom terug, ${child.name}!`);
  }
  function editChild(id: string | null) {
    if (cloudContent) { openParents(); return; }
    if (id === null && family.children.length >= MAX_CHILDREN) return;
    const child = family.children.find(item => item.id === id);
    setEditingId(id);
    setDraft(child ? { name: child.name, avatar: child.avatar } : { name: '', avatar: family.children.length % 4 });
    setModal('profile');
  }
  function saveProfile() {
    if (cloudContent) { openParents(); return; }
    const name = draft.name.trim() || 'Avonturier';
    if (editingId) {
      const next: Family = { ...family, children: family.children.map(child => child.id === editingId ? { ...child, name, avatar: draft.avatar } : child) };
      setFamily(next); saveFamily(next); setModal('profiles'); setToast(`Het profiel van ${name} is bewaard.`);
    } else {
      if (family.children.length >= MAX_CHILDREN) return;
      const child = createChild(name, draft.avatar);
      const next: Family = { ...family, children: [...family.children, child], activeId: child.id };
      switchChild(child.id, next); setToast(`Jouw eigen wereld staat klaar, ${name}!`);
    }
  }
  const openProfile = () => setModal('profiles');
  const openParents = () => { setParentAnswer(''); setParentError(false); setModal('parents'); };
  async function installApp() {
    if (!installPrompt) { setModal('install'); return; }
    await installPrompt.prompt(); const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') { setInstallPrompt(null); setModal(null); } else setToast('Je kunt Fabelpad later ook toevoegen.');
  }
  const visibleWorlds = worlds.filter(w => (filter === 'Alles' || filter === w.tag || (filter === 'Nieuw' && w.isNew) || (filter === 'Favorieten' && favorites.includes(w.id))) && `${w.title} ${w.description} ${w.subtitle}`.toLocaleLowerCase('nl-NL').includes(search.trim().toLocaleLowerCase('nl-NL')));

  function WorldCard({ world, index = 0, saved = false }: { world: World; index?: number; saved?: boolean }) {
    const Icon = world.icon === 'train' ? TrainFront : world.icon === 'moon' ? Moon : Star;
    return <motion.article className={`world-card ${world.color}`} initial={{ opacity: 0, y: calm ? 0 : 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .1 }} transition={{ delay: (index % 3) * .07 }}>
      <div className="world-image-wrap"><button className="world-image-button" onClick={() => openStory(world.id)} aria-label={`Open ${world.title}`}><img className={`world-image image-${world.id}`} src={world.image} alt={world.imageAlt} loading="lazy" /><span className="world-open"><Play fill="currentColor" size={21} /></span></button><span className="world-label"><Icon size={14} />{world.tag}</span><button className={`favorite-button ${favorites.includes(world.id) ? 'is-favorite' : ''}`} aria-label={favorites.includes(world.id) ? `${world.title} uit favorieten halen` : `${world.title} bewaren als favoriet`} aria-pressed={favorites.includes(world.id)} onClick={() => toggleFavorite(world.id)}><Heart size={20} fill={favorites.includes(world.id) ? 'currentColor' : 'none'} /></button></div>
      <div className="world-content">{(world.isNew || world.id === 'station') && <span className="book-new-label"><Sparkles size={11} />{world.id === 'station' ? 'Speel in het verhaal' : 'Nieuw avontuur'}</span>}<div className="world-meta"><span><Headphones size={13} />{world.duration}</span><span>{completed[world.id] ? <><Check size={13} /> Avontuur beleefd</> : '5 delen · 4–8 jaar'}</span></div><h3><button onClick={() => openStory(world.id)}>{world.title}</button></h3><p>{world.description}</p><button className="world-cta" onClick={() => openStory(world.id)}>{saved && !completed[world.id] ? 'Verder met jouw avontuur' : completed[world.id] ? 'Nog een keer op avontuur' : 'Dit avontuur kies ik'}<ArrowUpRight size={22} /></button></div>
    </motion.article>;
  }

  return <div className="app-shell">
    <a className="skip-link" href="#main">Naar de inhoud</a>
    <header className="site-header"><div className="header-inner"><button className="brand-button" onClick={() => go('discover')} aria-label="Fabelpad, naar Ontdek"><img src="/brand/logo.webp" alt="Fabelpad" width="220" height="88" /></button><nav className="desktop-nav" aria-label="Hoofdnavigatie">{nav.map(({ id, title, Icon }) => <button key={id} className={page === id ? 'active' : ''} onClick={() => go(id)} aria-current={page === id ? 'page' : undefined}><Icon size={18} strokeWidth={2.2} />{title}{page === id && <motion.span layoutId="navigation-active" className="nav-marker" transition={{ type: 'spring', stiffness: 400, damping: 35 }} />}</button>)}</nav><div className="header-actions"><DemoLoginButton /><button className="parent-button" onClick={openParents} aria-label="Voor ouders"><ShieldCheck size={17} /><span>Voor ouders</span></button><button className="profile-button" onClick={openProfile} aria-label="Kindprofiel kiezen"><Avatar value={profile.avatar} /><span>{profile.name}<small>Wissel van avonturier</small></span><ChevronRight size={16} /></button><button className="icon-button mobile-sound" onClick={() => updatePrefs({ ...prefs, muted: !prefs.muted })} aria-label={prefs.muted ? 'Geluid aanzetten' : 'Geluid uitzetten'}>{prefs.muted ? <VolumeX /> : <Volume2 />}</button></div></div></header>

    <main id="main"><AnimatePresence mode="wait"><motion.div key={page} initial={{ opacity: 0, y: calm ? 0 : 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: calm ? 0 : -8 }} transition={{ duration: .24 }}>
      {page === 'discover' && <>
        <section className="welcome-section page-container"><div className="welcome-copy"><div className="eyebrow"><span className="tiny-sun"><Sun size={16} /></span> HÉ, {profile.name.toLocaleUpperCase('nl-NL')}!</div><h1>Waar gaan we <span>vandaag naartoe?<svg viewBox="0 0 470 25" preserveAspectRatio="none" aria-hidden="true"><path d="M5 16Q220-4 463 10M37 23Q210 8 409 16" /></svg></span></h1><p>Open een verhaal. Volg je fantasie. Jij kiest het avontuur.</p></div><div className="welcome-doodle"><Doodle kind="star" /><span>Jouw keuze.<br />Jouw magie.</span><svg viewBox="0 0 110 70" aria-hidden="true"><path d="M8 8q90-7 84 42M76 38l16 16 13-20" /></svg></div></section>

        <section className="hero-section page-container" aria-label="Uitgelicht avontuur"><motion.div className="adventure-hero" initial={{ opacity: 0, scale: .985 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .65 }}><img className="hero-art" src="/art/station.webp" alt="Een stoomtrein en vos wachten op jou op een magisch station" fetchPriority="high" /><div className="hero-shade" /><div className="hero-copy"><span className="hero-eyebrow"><Ticket size={16} /> EEN SPEELBAAR VERHALENBOEK</span><h2>Volgende halte:<br /><span>verwondering.</span></h2><p>Het Verdwaalde Station staat op je te wachten. Waar de trein naartoe gaat? Dat bepaal jij.</p><button className="button button-yellow" onClick={() => openStory('station')}><Play size={19} fill="currentColor" />{started.includes('station') && !completed.station ? 'Ga verder op avontuur' : 'Begin het avontuur'}<ArrowRight size={20} /></button><div className="hero-details"><span><Headphones size={15} /> Voorlezen of zelf lezen</span><span className="hero-dot" /><span>4–8 jaar</span></div></div><motion.div className="hero-sticker" animate={calm ? {} : { rotate: [-8, -3, -8], y: [0, -5, 0] }} transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}><Sparkles size={23} /><span>Elke keuze<br />een nieuw pad!</span><svg viewBox="0 0 130 130" aria-hidden="true"><path d="M65 4 77 12 92 9 99 22 114 27 116 42 128 53 121 67 125 82 112 91 108 107 92 110 82 123 67 119 53 127 41 117 26 116 22 101 8 93 11 77 3 65 12 52 9 36 23 29 28 14 44 14 55 3Z" /></svg></motion.div></motion.div></section>

        <section className="worlds-section page-container" aria-labelledby="worlds-title"><div className="section-top"><div><div className="eyebrow"><span className="eyebrow-line" /> KLEINE KEUZES, GROTE AVONTUREN</div><h2 id="worlds-title">Een wereld voor elke bui <Doodle kind="spark" /></h2></div><span className="section-aside">{worlds.length} werelden · 5 delen per avontuur</span></div><div className="bookshelf-tools"><label className="story-search"><Search size={19} /><input type="search" aria-label="Zoek een verhaal" placeholder="Zoek een verhaal…" value={search} onChange={event => setSearch(event.target.value)} /></label><span className="story-results" role="status">{visibleWorlds.length} {visibleWorlds.length === 1 ? 'verhaal' : 'verhalen'} om te ontdekken</span></div><div className="filter-row" aria-label="Verhalen filteren">{['Alles', 'Nieuw', 'Avontuur', 'Dromen', 'Grappig', 'Favorieten'].map(f => <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f} className={`filter-chip ${filter === f ? 'selected' : ''}`}>{f === 'Nieuw' ? <Sparkles size={16} /> : f === 'Alles' ? <Compass size={16} /> : f === 'Avontuur' ? <Map size={16} /> : f === 'Dromen' ? <Moon size={16} /> : f === 'Grappig' ? <Sun size={16} /> : <Heart size={16} />}{f}</button>)}</div><div className="world-grid">{visibleWorlds.map((w, i) => <WorldCard key={w.id} world={w} index={i} />)}</div>{!visibleWorlds.length && <div className="empty-small">{search.trim() ? <Search /> : <Heart />}<h3>{search.trim() ? 'Dit verhaal hebben we nog niet gevonden' : 'Bewaar je lievelingsverhaal'}</h3><p>{search.trim() ? 'Probeer een andere naam of ontdek een van de andere werelden.' : 'Tik op het hartje bij een avontuur. Dan vind je het hier terug.'}</p><button className="text-link" onClick={() => { setFilter('Alles'); setSearch(''); }}>Alle verhalen bekijken <ArrowRight size={18} /></button></div>}</section>

        <section className="companion-section page-container"><div className="companion-card"><div className="companion-art"><span className="companion-blob" /><img src="/brand/mascot.webp" alt="Jouw vrolijke Fabelpad-gids met zijn verhalenboek" loading="lazy" /><Doodle kind="spark" className="companion-spark" /><span className="speech-bubble">Psst… je fantasie<br />mag mee!</span></div><div className="companion-copy"><div className="eyebrow">DIT IS PAS HET BEGIN</div><h2>Jij maakt het<br />verhaal bijzonder.</h2><p>Help een nieuwe vriend, ontdek een geheime deur of kies de langste omweg. In Fabelpad telt jouw keuze. En morgen? Dan kan alles weer anders.</p><div className="companion-benefits"><span><BookOpen size={18} /> Lezen op jouw manier</span><span><Leaf size={18} /> Rustig op avontuur</span><span><Heart size={18} /> Samen of lekker zelf</span></div><button className="text-link" onClick={openParents}>Even voor de grote mensen <ArrowUpRight size={20} /></button></div></div></section>

        <section className="coming-soon page-container"><div className="coming-image"><img src="/art/weather-v2.webp" alt="Mopperwolk in zijn winkel vol potjes met zonneschijn en regen" loading="lazy" /><span className="soon-stamp">De winkel<br />is open!</span></div><div><span className="eyebrow">TIEN NIEUWE WERELDEN WACHTEN OP JE</span><h2>Mopperwolks Weerwinkel</h2><p>Een beetje zon, een potje regen en een wolk met een héél eigen willetje. Help Mopperwolk zijn bijzondere bestelling te bezorgen. Vijf delen, jouw keuzes en een schat om te bewaren.</p><button className="button button-green" onClick={() => openStory('weather')}>Naar de Weerwinkel <ArrowRight size={18} /></button></div><Doodle kind="sun" /></section>
      </>}

      {page === 'adventures' && <section className="library-page page-container"><div className="eyebrow"><BookOpen size={16} /> JOUW VERHALENBOEK</div><h1>Hier gaat jouw<br /><span>avontuur verder.</span></h1><p className="page-subtitle">Al jouw ontdekte werelden, precies waar je gebleven bent.</p>{started.length && !forceEmpty ? <div className="world-grid">{worlds.filter(w => started.includes(w.id)).map((w, i) => <WorldCard key={w.id} world={w} index={i} saved />)}</div> : <div className="empty-state"><div className="empty-illustration"><img src="/brand/mascot.webp" alt="" /><Doodle kind="star" /></div><h2>Jouw eerste avontuur wacht op je</h2><p>Kies een wereld en zet je eerste stap. We bewaren je plek in jouw eigen kindprofiel.</p><button className="button button-green" onClick={() => go('discover')}>Ontdek de verhalen <ArrowRight size={20} /></button></div>}<StoryMemoryPanel profileId={profile.id} childName={profile.name} onOpenWorld={openStory} /></section>}

      {page === 'treasures' && <section className="treasure-page page-container"><div className="eyebrow"><Sparkles size={16} /> HERINNERINGEN OM TE BEWAREN</div><div className="treasure-heading"><div><h1>Een schatkist vol<br /><span>jouw avonturen.</span></h1><p className="page-subtitle">Elk beleefd verhaal geeft je een bijzondere stempel.</p></div><div className="passport-count"><Ticket size={24} /><strong>{Object.keys(completed).length}<small> / {worlds.length}</small></strong><span>stempels verzameld</span></div></div><div className="stamp-grid">{worlds.map(w => { const unlocked = !!completed[w.id]; const Icon = w.icon === 'train' ? TrainFront : w.icon === 'moon' ? Moon : Star; return <article key={w.id} className={`stamp-card ${w.color} ${unlocked ? 'unlocked' : 'locked'}`}><div className="stamp-art"><div className="stamp-perforated"><Icon size={66} strokeWidth={1.3} /><span>FABELPAD</span></div>{unlocked ? <span className="stamp-check"><Check size={18} /></span> : <span className="stamp-lock"><LockKeyhole size={16} /></span>}</div><h2>{w.stamp}</h2><p>{unlocked ? completed[w.id].ending : `Beleef ${w.title} en ontdek deze stempel.`}</p><button className="text-link" onClick={() => openStory(w.id)}>{unlocked ? 'Beleef het nog eens' : 'Op avontuur'}<ArrowRight size={18} /></button></article>; })}</div><div className="treasure-note"><img src="/brand/mascot.webp" alt="" /><p>De mooiste schatten?<br /><strong>De verhalen die je zelf hebt gemaakt.</strong></p><Doodle kind="spark" /></div></section>}
    </motion.div></AnimatePresence></main>

    <footer className="site-footer page-container"><div className="footer-top"><img src="/brand/logo.webp" alt="Fabelpad" loading="lazy" /><p>Jij kiest het avontuur.<br /><span>Wij bewaren een plekje voor je fantasie.</span></p><button className="footer-install" onClick={installApp}><Download size={19} /><span>{installed ? 'Fabelpad is jouw app' : 'Neem Fabelpad mee'}<small>{installed ? 'Klaar voor je volgende avontuur' : 'Ook fijn op je beginscherm'}</small></span><ArrowUpRight size={19} /></button></div><div className="footer-bottom"><span>© {new Date().getFullYear()} Fabelpad · Met een beetje magie gemaakt.</span><SyncBadge /><button onClick={openParents}><ShieldCheck size={14} /> Voor ouders</button><nav className="legal-inline-links" aria-label="Privacy en informatie"><a href="/privacy-voor-kinderen">Privacy voor kinderen</a><a href="/algemene-voorwaarden">Voorwaarden</a><a href="/privacyverklaring">Privacy</a><a href="/bedrijfsgegevens">Bedrijfsgegevens</a></nav></div></footer>
    <nav className="mobile-nav" aria-label="App-navigatie">{nav.map(({ id, title, Icon }) => <button key={id} className={page === id ? 'active' : ''} onClick={() => go(id)} aria-current={page === id ? 'page' : undefined}><Icon size={23} strokeWidth={page === id ? 2.5 : 1.8} /><span>{title}</span></button>)}<button onClick={openProfile}><Avatar value={profile.avatar} /><span>Wie speelt?</span></button></nav>

    <AnimatePresence>{reader && <StoryReader key={`${profile.id}-${reader}`} profileId={profile.id} worldId={reader} childName={profile.name} muted={prefs.muted} reducedMotion={calm} textSize={prefs.textSize} cloudContent={cloudContent} previewLimit={cloudContent ? undefined : getStoryPreviewLimit(reader)} onRequestParents={onRequestParents || openParents} onClose={() => setReader(null)} onComplete={completeStory} />}</AnimatePresence>
    <AnimatePresence>{(modal === 'profiles' || modal === 'profile') && <ModalShell label={modal === 'profiles' ? 'Kies jouw kindprofiel' : 'Kindprofiel bewerken'} onClose={closeModal} className="children-modal">{modal === 'profiles' ? <><div className="modal-eyebrow"><Users size={18} /> IEDER EEN EIGEN VERHAAL</div><h2>Wie gaat er mee<br />op avontuur?</h2><p>Kies je eigen plaatje. We onthouden jouw naam, je verhalen en waar je gebleven bent.</p><div className="children-list">{family.children.map(child => { const childStarted = readChild<string[]>(child.id, 'started', []); const childCompleted = readChild<Completed>(child.id, 'completed', {}); return <div className={`child-row ${child.id === profile.id ? 'current-child' : ''}`} key={child.id}><button className="choose-child" onClick={() => switchChild(child.id)} aria-label={`Verder als ${child.name}`}><Avatar value={child.avatar} /><span><strong>{child.name}</strong><small>{childStarted.length ? `${childStarted.length} ${childStarted.length === 1 ? 'avontuur' : 'avonturen'} · ${Object.keys(childCompleted).length} ${Object.keys(childCompleted).length === 1 ? 'stempel' : 'stempels'}` : 'Jouw avontuur begint hier'}</small></span>{child.id === profile.id ? <span className="active-child-check"><Check size={17} /></span> : <ChevronRight size={18} />}</button><button className="edit-child" onClick={() => editChild(child.id)} aria-label={`Profiel van ${child.name} bewerken`}><Pencil size={16} /></button></div>; })}</div><button className="add-child" onClick={() => editChild(null)} disabled={family.children.length >= MAX_CHILDREN}><Plus size={19} />Nieuw kindprofiel<span>{family.children.length}/{MAX_CHILDREN}</span></button><p className="children-note"><ShieldCheck size={15} />Iedere avonturier heeft een eigen plek en verhaalgeheugen.</p></> : <><button className="profile-form-back text-link" onClick={() => setModal('profiles')}>← Alle kindprofielen</button><div className="modal-eyebrow"><Sparkles size={18} /> HELEMAAL JIJ</div><h2>{editingId ? 'Dit is jouw' : 'Een eigen'}<br />plekje op Fabelpad.</h2><p>Kies jouw plaatje en vertel hoe we je mogen noemen.</p><div className="avatar-options">{avatarNames.map((name, index) => <button key={name} className={draft.avatar === index ? 'chosen' : ''} onClick={() => setDraft({ ...draft, avatar: index })} aria-label={`${name} kiezen`} aria-pressed={draft.avatar === index}><Avatar value={index} />{draft.avatar === index && <span><Check size={13} /></span>}</button>)}</div><form onSubmit={e => { e.preventDefault(); saveProfile(); }}><label className="field-label" htmlFor="child-name">Jouw voornaam of bijnaam</label><input id="child-name" value={draft.name} maxLength={20} onChange={e => setDraft({ ...draft, name: e.target.value })} autoComplete="off" placeholder="Hoe heet jij?" autoFocus required /><span className="input-hint">Je bijnaam is ook helemaal goed.</span><button type="submit" className="button button-green">{editingId ? 'Bewaar mijn profiel' : 'Dit wordt mijn wereld!'} <ArrowRight size={20} /></button></form></>}</ModalShell>}</AnimatePresence>
    <AnimatePresence>{modal === 'parents' && <ModalShell label="Voor ouders" onClose={closeModal} className="parent-modal"><div className="modal-eyebrow"><ShieldCheck size={18} /> VOOR DE GROTE MENSEN</div>{!parentOpen ? <><h2>Even een klein<br />grote-mensen-vraagje.</h2><p>Dit hoekje is voor ouders en verzorgers. Hoeveel is zeven plus vijf?</p><form onSubmit={e => { e.preventDefault(); if (parentAnswer.trim() === '12') { setParentError(false); if (onRequestParents) { setModal(null); onRequestParents(); } else setParentOpen(true); } else setParentError(true); }}><label className="field-label" htmlFor="parent-answer">7 + 5 =</label><input id="parent-answer" value={parentAnswer} onChange={e => setParentAnswer(e.target.value)} inputMode="numeric" autoComplete="off" placeholder="Jouw antwoord" aria-invalid={parentError} />{parentError && <span className="form-error">Dat is nog niet het goede antwoord. Probeer het nog eens.</span>}<button className="button button-green">Naar het ouderhoekje <ArrowRight size={19} /></button></form></> : <><h2>Ruimte voor<br />kleine avonturiers.</h2><p>Fabelpad is er om samen te ontdekken, te luisteren en te kiezen. Dit prototype bevat {worlds.length} complete interactieve verhalen.</p><ParentAccountPanel /><div className="settings-list"><label><span><Volume2 size={20} /><span>Geluid aan<small>De voorleesstem mag worden afgespeeld.</small></span></span><input type="checkbox" role="switch" checked={!prefs.muted} onChange={e => updatePrefs({ ...prefs, muted: !e.target.checked })} /></label><label><span><Leaf size={20} /><span>Rustige bewegingen<small>Beperk animaties en zwevende details.</small></span></span><input type="checkbox" role="switch" checked={prefs.calm} onChange={e => updatePrefs({ ...prefs, calm: e.target.checked })} /></label></div><div className="parent-info"><ShieldCheck size={22} /><p>Elk kindprofiel heeft een eigen naam, favorieten, voortgang, stempels en verhaalgeheugen. Verhalen zijn vooraf geschreven; er is in dit prototype geen open AI-chat.</p></div><button className="button button-green" onClick={installApp}><Download size={19} /> {installed ? 'App-informatie bekijken' : 'Zet op je beginscherm'}</button></>}</ModalShell>}</AnimatePresence>
    <AnimatePresence>{modal === 'install' && <ModalShell label="Fabelpad als app" onClose={closeModal}><div className="install-mascot"><img src="/brand/mascot.webp" alt="" /></div><h2>Je avontuur<br />gaat met je mee.</h2><p>Voeg Fabelpad toe aan je beginscherm. Dan open je de verhalen net zo makkelijk als een app.</p>{installed ? <div className="parent-info"><Check /><p>Je gebruikt Fabelpad al als app. Veel plezier met je volgende avontuur!</p></div> : installPrompt ? <button className="button button-green" onClick={installApp}><Download size={20} /> Fabelpad installeren</button> : <ol className="install-steps"><li>Open deze website in Safari of Chrome op je telefoon.</li><li>Tik op <strong>Delen</strong> (Safari) of het <strong>menu ⋮</strong> (Chrome).</li><li>Kies <strong>Zet op beginscherm</strong> of <strong>App installeren</strong>.</li></ol>}<button className="text-link" onClick={() => setModal(null)}>Terug naar de verhalen <ArrowRight size={18} /></button></ModalShell>}</AnimatePresence>
    <AnimatePresence>{toast && <motion.div role="status" className="toast" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}><Check size={19} />{toast}</motion.div>}</AnimatePresence>
  </div>;
}
