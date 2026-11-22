'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, CloudOff, Download, FileJson, Leaf, LoaderCircle, Pencil, Plus, ShieldCheck, Sparkles, Star, Trash2, Users, Volume2, Wifi, X } from 'lucide-react';
import { CHILD_FIELDS, createChild, exportSnapshot, loadFamily, MAX_CHILDREN, readChild, saveChild, saveFamily, subscribeStorage } from './profileStorage';
import type { ChildProfile, Family } from './profileStorage';
import { downloadStory, getDownloads, removeDownload, subscribeDownloads } from './prototypeDownloads';
import { worlds } from './worlds';
import { lockBodyScroll } from './modalScroll';
import './parent-dashboard.css';

type Props = { onOpenApp: () => void; onOpenStory: (id: string) => void };
type Tab = 'family' | 'downloads' | 'settings';
type Prefs = { muted: boolean; calm: boolean; textSize?: 'normal' | 'large' };
type Confirmation = { type: 'delete'; child: ChildProfile } | { type: 'export' } | null;
const avatarEmoji = ['🌿', '⭐', '🌙', '🚀'];
const navigation: { id: Tab; name: string; icon: typeof Users }[] = [{ id: 'family', name: 'Ons gezin', icon: Users }, { id: 'downloads', name: 'Voor onderweg', icon: Download }, { id: 'settings', name: 'Instellingen', icon: ShieldCheck }];

export default function ParentDashboard({ onOpenApp, onOpenStory }: Props) {
  const [family, setFamily] = useState<Family>(() => loadFamily());
  const [tab, setTab] = useState<Tab>('family');
  const [revision, setRevision] = useState(0);
  const [draft, setDraft] = useState<{ id: string | null; name: string; avatar: number } | null>(null);
  const [downloads, setDownloads] = useState<string[]>(() => getDownloads());
  const [busy, setBusy] = useState<string[]>([]);
  const [downloadError, setDownloadError] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [online, setOnline] = useState(() => navigator.onLine);
  const confirmationRef = useRef<HTMLElement>(null);
  const activeChild = family.children.find(child => child.id === family.activeId) || family.children[0];
  const prefs = readChild<Prefs>(activeChild.id, 'prefs', { muted: false, calm: false });
  const totalStarted = family.children.reduce((total, child) => total + readChild<string[]>(child.id, 'started', []).length, 0);
  const totalCompleted = family.children.reduce((total, child) => total + Object.keys(readChild<Record<string, unknown>>(child.id, 'completed', {})).length, 0);

  useEffect(() => subscribeStorage(() => { setFamily(loadFamily()); setRevision(value => value + 1); }), []);
  useEffect(() => subscribeDownloads(() => setDownloads(getDownloads())), []);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 4200); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => {
    if (!confirmation) return;
    const previous = document.activeElement as HTMLElement | null;
    const unlock = lockBodyScroll();
    const frame = requestAnimationFrame(() => confirmationRef.current?.querySelector<HTMLElement>('[data-confirm-cancel]')?.focus());
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setConfirmation(null); }
      if (event.key !== 'Tab') return;
      const buttons = confirmationRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])');
      if (!buttons?.length) return;
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (!confirmationRef.current?.contains(document.activeElement)) { event.preventDefault(); first.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', close);
    return () => { cancelAnimationFrame(frame); unlock(); document.removeEventListener('keydown', close); if (previous?.isConnected) previous.focus(); };
  }, [confirmation]);

  function updateFamily(next: Family) { saveFamily(next); setFamily(next); }
  function openAs(child: ChildProfile) { updateFamily({ ...family, activeId: child.id }); onOpenApp(); }
  function saveProfile() {
    if (!draft || !draft.name.trim()) return;
    if (draft.id) updateFamily({ ...family, children: family.children.map(child => child.id === draft.id ? { ...child, name: draft.name.trim().slice(0, 20), avatar: draft.avatar } : child) });
    else if (family.children.length < MAX_CHILDREN) {
      const child = createChild(draft.name, draft.avatar);
      updateFamily({ ...family, children: [...family.children, child] });
    }
    setDraft(null); setNotice('Het kindprofiel is op dit apparaat bewaard.');
  }
  function updatePrefs(next: Prefs) { saveChild(activeChild.id, 'prefs', next); setRevision(value => value + 1); }
  async function toggleDownload(id: string) {
    if (busy.includes(id)) return;
    setBusy(current => [...current, id]); setDownloadError(current => ({ ...current, [id]: '' }));
    try {
      if (getDownloads().includes(id)) { await removeDownload(id); setNotice('De download is van dit apparaat verwijderd. Je voortgang blijft bewaard.'); }
      else { await downloadStory(id); setNotice('De verhaalbestanden zijn op dit apparaat bewaard.'); }
      setDownloads(getDownloads());
    } catch (error) { setDownloadError(current => ({ ...current, [id]: error instanceof Error ? error.message : 'Bewaren lukte niet. Controleer je verbinding en probeer opnieuw.' })); }
    finally { setBusy(current => current.filter(item => item !== id)); }
  }
  function confirmAction() {
    if (confirmation?.type === 'delete') {
      const child = confirmation.child;
      if (family.children.length < 2) { setConfirmation(null); return; }
      for (const field of CHILD_FIELDS) saveChild(child.id, field, null);
      const children = family.children.filter(item => item.id !== child.id);
      updateFamily({ ...family, children, activeId: family.activeId === child.id ? children[0].id : family.activeId });
      setDraft(null); setNotice(`Het lokale profiel van ${child.name} is verwijderd.`);
    } else if (confirmation?.type === 'export') {
      const url = URL.createObjectURL(new Blob([JSON.stringify(exportSnapshot(), null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = 'Fabelpad-gezinsgegevens.json'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000); setNotice('De kopie van jullie lokale gezinsgegevens is gedownload.');
    }
    setConfirmation(null);
  }

  return <div className="pd-shell" data-revision={revision}>
    <aside className="pd-sidebar"><button className="pd-back" onClick={onOpenApp}><ArrowLeft size={17} /> Naar de verhalen</button><div className="pd-sidebar-title"><ShieldCheck size={27} /><span>Even voor<br /><strong>de grote mensen.</strong></span></div><nav aria-label="Ouderomgeving">{navigation.map(({ id, name, icon: Icon }) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => { setTab(id); setDraft(null); }} aria-current={tab === id ? 'page' : undefined}><Icon size={19} /><span>{name}</span><ChevronRight size={16} /></button>)}</nav><div className="pd-local-note"><CloudOff size={20} /><strong>Op dit apparaat</strong><p>Profielen en voortgang worden op dit apparaat bewaard.</p><span><a href="/inloggen">Inloggen als ouder →</a></span></div><img className="pd-sidebar-mascot" src="/brand/mascot.webp" alt="" /></aside>
    <main className="pd-main"><div className="pd-topline"><span><span className="pd-status-dot" /> OUDEROMGEVING</span><span className="pd-device-pill">Lokale profielen</span></div>
      {tab === 'family' && <><section className="pd-welcome"><div><span className="pd-eyebrow">SAMEN EEN WERELD RIJKER</span><h1>Hun avonturen.<br /><em>Jouw overzicht.</em></h1><p>Ieder kind een eigen plekje. Jij kijkt mee, stelt bij en maakt ruimte voor het volgende verhaal.</p><button className="pd-button pd-yellow" onClick={onOpenApp}>Samen een verhaal kiezen <ArrowRight size={19} /></button></div><img src="/brand/mascot.webp" alt="De Fabelpad-gids met zijn verhalenboek" /><span className="pd-welcome-star">✦</span></section>
        <div className="pd-stats"><div><Users /><strong>{family.children.length}</strong><span>{family.children.length === 1 ? 'eigen avonturier' : 'eigen avonturiers'}</span></div><div><BookOpen /><strong>{totalStarted}</strong><span>gestarte avonturen</span></div><div><Star /><strong>{totalCompleted}</strong><span>verzamelde stempels</span></div></div>
        <section className="pd-section"><div className="pd-section-heading"><div><span className="pd-eyebrow">IEDER EEN EIGEN PAD</span><h2>Wie gaat er op avontuur?</h2></div><span>{family.children.length} / {MAX_CHILDREN} profielen</span></div><div className="pd-children">{family.children.map(child => {
          const started = readChild<string[]>(child.id, 'started', []);
          const completed = readChild<Record<string, { ending: string }>>(child.id, 'completed', {});
          const resume = [...started].reverse().find(id => !completed[id]);
          const resumeWorld = worlds.find(world => world.id === resume);
          return <article className={`pd-child ${child.id === activeChild.id ? 'pd-child-active' : ''}`} key={child.id}><div className="pd-child-top"><span className={`pd-avatar pd-avatar-${child.avatar}`}>{avatarEmoji[child.avatar]}</span><div><h3>{child.name}</h3><span>{child.id === activeChild.id ? 'Nu gekozen' : 'Een eigen verhalenwereld'}</span></div><button className="pd-icon-button" onClick={() => setDraft({ id: child.id, name: child.name, avatar: child.avatar })} aria-label={`Profiel van ${child.name} bewerken`}><Pencil size={17} /></button></div><div className="pd-child-progress"><span><BookOpen size={15} /> {started.length} begonnen</span><span><Star size={15} /> {Object.keys(completed).length} stempels</span></div>{resumeWorld ? <button className="pd-resume" onClick={() => { updateFamily({ ...family, activeId: child.id }); onOpenStory(resumeWorld.id); }}><img src={resumeWorld.image} alt="" /><span><small>Verder met</small><strong>{resumeWorld.title}</strong></span><ArrowRight size={18} /></button> : <div className="pd-child-empty"><Sparkles size={17} /> Een nieuw avontuur staat klaar.</div>}<button className="pd-button pd-outline" onClick={() => openAs(child)}>Open de wereld van {child.name}<ArrowRight size={17} /></button></article>;
        })}{family.children.length < MAX_CHILDREN && <button className="pd-add-child" onClick={() => setDraft({ id: null, name: '', avatar: family.children.length % 4 })}><span><Plus size={27} /></span><strong>Een avonturier erbij</strong><small>Naam, plaatje, eigen verhalen.</small></button>}</div></section>
        {draft && <section className="pd-card pd-profile-editor" aria-labelledby="pd-profile-title"><button className="pd-editor-close pd-icon-button" onClick={() => setDraft(null)} aria-label="Profielbewerking sluiten"><X size={19} /></button><span className="pd-eyebrow">EEN EIGEN PLEKJE</span><h2 id="pd-profile-title">{draft.id ? 'Profiel aanpassen' : 'Nieuwe avonturier'}</h2><form onSubmit={event => { event.preventDefault(); saveProfile(); }}><label htmlFor="pd-name">Voornaam of bijnaam</label><input id="pd-name" value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} maxLength={20} required placeholder="Hoe mogen we je noemen?" /><fieldset><legend>Kies een plaatje</legend><div className="pd-avatar-picker">{avatarEmoji.map((emoji, index) => <button type="button" key={emoji} className={draft.avatar === index ? 'selected' : ''} aria-label={['Groen blaadje', 'Ster', 'Maan', 'Raket'][index]} aria-pressed={draft.avatar === index} onClick={() => setDraft({ ...draft, avatar: index })}>{emoji}{draft.avatar === index && <Check size={13} />}</button>)}</div></fieldset><div className="pd-form-actions"><button className="pd-button pd-green" type="submit">Profiel bewaren <Check size={17} /></button>{draft.id && family.children.length > 1 && <button className="pd-danger-link" type="button" onClick={() => { const child = family.children.find(item => item.id === draft.id); if (child) setConfirmation({ type: 'delete', child }); }}><Trash2 size={15} /> Profiel verwijderen</button>}</div></form></section>}
        <section className="pd-soft-card"><Leaf size={27} /><div><h3>Een fijn moment, op jullie manier.</h3><p>De rustige stand en het geluid stel je per kind in. Zo voelt iedere verhalenwereld vertrouwd.</p></div><button onClick={() => setTab('settings')}>Leesinstellingen <ArrowRight size={17} /></button></section>
      </>}
      {tab === 'downloads' && <><div className="pd-page-heading"><span className="pd-eyebrow">KLEINE AVONTUREN GAAN MEE</span><h1>Ook onderweg<br /><em>een wereld dichtbij.</em></h1><p>Bewaar verhaalbestanden in deze browser en beheer de downloads op dit apparaat.</p></div><div className={`pd-connection ${online ? '' : 'offline'}`}>{online ? <Wifi size={19} /> : <CloudOff size={19} />}<div><strong>{online ? 'Verbonden met internet' : 'Je bent nu offline'}</strong><span>{online ? 'Je kunt verhalen downloaden en opnieuw proberen.' : 'Nieuwe downloads wachten tot je weer verbinding hebt.'}</span></div><span>{downloads.length} bewaard</span></div><section className="pd-card pd-downloads">{worlds.map(world => { const saved = downloads.includes(world.id); const working = busy.includes(world.id); return <div className="pd-download-row" key={world.id}><img src={world.image} alt="" /><div className="pd-download-copy"><strong>{world.title}</strong><span>{working ? 'Even bezig…' : saved ? 'Verhaalbestanden bewaard' : '5 delen · illustraties en verhaal'}{downloadError[world.id] && <em role="alert">{downloadError[world.id]}</em>}</span></div><button className={`pd-download-action ${saved ? 'saved' : ''}`} disabled={working || (!saved && !online)} onClick={() => { void toggleDownload(world.id); }} aria-label={saved ? `${world.title} download verwijderen` : `${world.title} downloaden`}>{working ? <LoaderCircle className="pd-spin" size={19} /> : saved ? <Trash2 size={18} /> : <ArrowDownToLine size={19} />}<span>{working ? 'Bezig' : saved ? 'Verwijderen' : downloadError[world.id] ? 'Opnieuw' : 'Download'}</span></button></div>; })}</section><div className="pd-footnote"><ShieldCheck size={18} /><p>Deze browser bewaart de verhaalbestanden op dit apparaat. Voor het openen van de website kan een internetverbinding nodig zijn. Verwijder je een download, dan blijft je leesvoortgang bewaard. Voorlezen werkt alleen met een beschikbare lokale Nederlandse apparaatstem.</p></div></>}
      {tab === 'settings' && <><div className="pd-page-heading"><span className="pd-eyebrow">GEWOON ZOALS HET FIJN VOELT</span><h1>Kleine instellingen.<br /><em>Een eigen leesritme.</em></h1><p>Pas de beleving per kind aan en bekijk welke gegevens op dit apparaat staan.</p></div><section className="pd-card"><div className="pd-section-heading"><div><span className="pd-eyebrow">PER AVONTURIER</span><h2>Leesinstellingen</h2></div><span className="pd-label">{activeChild.name}</span></div><label className="pd-field-label" htmlFor="pd-settings-child">Voor welk kind?</label><select id="pd-settings-child" value={activeChild.id} onChange={event => updateFamily({ ...family, activeId: event.target.value })}>{family.children.map(child => <option key={child.id} value={child.id}>{child.name}</option>)}</select><div className="pd-toggles"><label><span><Volume2 /><span><strong>Geluid aan</strong><small>Voorlezen werkt met een beschikbare lokale Nederlandse apparaatstem.</small></span></span><input type="checkbox" role="switch" checked={!prefs.muted} onChange={event => updatePrefs({ ...prefs, muted: !event.target.checked })} /></label><label><span><Leaf /><span><strong>Rustige bewegingen</strong><small>Minder zwevende details en kortere overgangen.</small></span></span><input type="checkbox" role="switch" checked={prefs.calm} onChange={event => updatePrefs({ ...prefs, calm: event.target.checked })} /></label></div><label className="pd-field-label" htmlFor="pd-text-size">Tekstgrootte voor {activeChild.name}</label><select id="pd-text-size" value={prefs.textSize || 'normal'} onChange={event => updatePrefs({ ...prefs, textSize: event.target.value === 'large' ? 'large' : 'normal' })}><option value="normal">Normale verhaaltekst</option><option value="large">Grotere verhaaltekst</option></select><p className="pd-muted">De bewegingsvoorkeur van je apparaat wordt ook gerespecteerd.</p></section><section className="pd-card"><div className="pd-section-heading"><div><span className="pd-eyebrow">JULLIE LOKALE GEGEVENS</span><h2>Een kopie voor jezelf</h2></div><FileJson size={28} /></div><p>Download de lokale kindprofielen, favorieten, keuzes en voortgang als JSON-bestand. De kopie bevat de ingevoerde bijnamen.</p><button className="pd-button pd-outline" onClick={() => setConfirmation({ type: 'export' })}><Download size={17} /> Gegevens exporteren</button><div className="pd-footnote"><CloudOff size={17} /><p>Dit overzicht beheert de profielen in deze browser. Voor jullie online gezin gebruik je het ouderaccount via Inloggen.</p></div></section></>}
    </main>
    {notice && <div className="pd-toast" role="status"><Check size={18} />{notice}</div>}
    {confirmation && <div className="pd-confirm-backdrop" onClick={() => setConfirmation(null)}><section ref={confirmationRef} className="pd-confirm" role="dialog" aria-modal="true" aria-labelledby="pd-confirm-heading" onClick={event => event.stopPropagation()}><button className="pd-icon-button pd-editor-close" aria-label="Sluiten" onClick={() => setConfirmation(null)}><X size={20} /></button>{confirmation.type === 'delete' ? <><Trash2 size={30} /><h2 id="pd-confirm-heading">Profiel van {confirmation.child.name} verwijderen?</h2><p>De naam, favorieten, voortgang en herinneringen van dit kind verdwijnen uit deze browser. Andere kindprofielen blijven bewaard.</p></> : <><FileJson size={30} /><h2 id="pd-confirm-heading">Jullie gegevens downloaden?</h2><p>Het bestand bevat de namen en voortgang van alle lokale kindprofielen. Bewaar de kopie op een plek die voor jullie bestemd is.</p></>}<div className="pd-form-actions"><button className="pd-button pd-outline" onClick={() => setConfirmation(null)} data-confirm-cancel>Annuleren</button><button className={`pd-button ${confirmation.type === 'delete' ? 'pd-red' : 'pd-green'}`} onClick={confirmAction}>{confirmation.type === 'delete' ? 'Ja, lokaal verwijderen' : 'Download de kopie'}</button></div></section></div>}
  </div>;
}
