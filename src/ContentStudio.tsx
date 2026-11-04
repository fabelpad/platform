'use client';
import { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, Check, CheckCheck, ChevronRight, CircleAlert, Eye, FilePenLine, GitBranch, Image, Layers, RotateCcw, Save, Search, Send, ShieldCheck, Sparkles } from 'lucide-react';
import { worlds } from './worlds';
import { getScene } from './storyData';
import { getEditorialDraft, getEditorialPublication, publishEditorialDraft, resetEditorialDraft, saveEditorialDraft, subscribeEditorial, validateEditorialDraft } from './editorialStore';
import type { EditorialDraft } from './editorialStore';
import './content-studio.css';

type Props = { onPreview: (id: string) => void };
function prettyDate(value?: string) { return value ? new Date(value).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Originele editie'; }

export default function ContentStudio({ onPreview }: Props) {
  const [selected, setSelected] = useState<string>('station');
  const [draft, setDraft] = useState<EditorialDraft>(() => getEditorialDraft('station'));
  const [chapter, setChapter] = useState(0);
  const [route, setRoute] = useState<number[]>([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'story' | 'chapters' | 'preview'>('story');
  const [dirty, setDirty] = useState(false);
  const [durable, setDurable] = useState(true);
  const [errors, setErrors] = useState<string[] | null>(null);
  const [notice, setNotice] = useState('');
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [, refresh] = useState(0);
  const world = worlds.find(item => item.id === selected)!;
  const publication = getEditorialPublication(selected);
  const filtered = worlds.filter(item => `${item.title} ${item.tag}`.toLowerCase().includes(search.toLowerCase()));
  const activeScene = getScene(selected, chapter, route.slice(0, chapter), '{{naam}}');
  const override = draft.chapters[String(chapter)] || {};
  const previewTitle = override.title ?? activeScene.title;
  const previewText = override.text ?? activeScene.text;
  const changedParts = Object.values(draft.chapters).filter(value => Object.keys(value).length).length;

  useEffect(() => subscribeEditorial(() => refresh(value => value + 1)), []);
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => {
      const persisted = saveEditorialDraft(selected, draft);
      setDurable(persisted);
      setDirty(false);
      setNotice(persisted ? 'Concept automatisch op dit apparaat bewaard.' : 'Alleen in dit venster bewaard. Browseropslag is niet beschikbaar.');
    }, 650);
    return () => clearTimeout(timer);
  }, [draft, dirty, selected]);

  function selectStory(id: string) {
    if (dirty) saveEditorialDraft(selected, draft);
    setSelected(id); setDraft(getEditorialDraft(id)); setChapter(0); setRoute([]); setDirty(false); setErrors(null); setNotice(''); setConfirmPublish(false); setConfirmReset(false); setTab('story');
  }
  function edit(next: EditorialDraft) { setDraft(next); setDirty(true); setErrors(null); setNotice(''); setConfirmPublish(false); }
  function editChapter(field: 'title' | 'text', value: string) { edit({ ...draft, chapters: { ...draft.chapters, [String(chapter)]: { ...override, [field]: value } } }); }
  function restoreChapter() { const chapters = { ...draft.chapters }; delete chapters[String(chapter)]; edit({ ...draft, chapters }); }
  function save() {
    const persisted = saveEditorialDraft(selected, draft); setDirty(false); setDurable(persisted);
    setNotice(persisted ? 'Concept bewaard. De leesapp gebruikt nog de gepubliceerde editie.' : 'Concept alleen in dit venster bewaard; houd het venster open.');
  }
  function check() { const result = validateEditorialDraft(selected, draft); setErrors(result); setNotice(result.length ? '' : 'Alle vijf delen en alle 31 keuzeprefixen zijn gecontroleerd.'); return result; }
  function publish() {
    const result = publishEditorialDraft(selected, draft); setErrors(result.errors); setConfirmPublish(false);
    if (result.publication) { setDraft(getEditorialDraft(selected)); setDirty(false); setDurable(result.persisted); setNotice(`Editie ${result.publication.version} is gepubliceerd ${result.persisted ? 'op dit apparaat' : 'alleen in dit venster'}. De leesapp gebruikt deze editie wanneer je het verhaal opent.`); }
  }
  function reset() { resetEditorialDraft(selected); setDraft(getEditorialDraft(selected)); setDirty(false); setConfirmReset(false); setErrors(null); setNotice('Het concept is teruggezet naar de laatst gepubliceerde editie.'); }

  return <main className="cs-shell">
    <header className="cs-heading"><div><span className="cs-eyebrow"><FilePenLine size={15} /> FABELPAD VERHALENSTUDIO</span><h1>Hier begint<br /><em>een nieuw avontuur.</em></h1><p>Geef verhalen een eigen vorm. Controleer je concept en bekijk wat kinderen straks ontdekken.</p></div><div className="cs-edition"><Layers size={22} /><strong>{worlds.length} verhalen</strong><span>65 delen · 416 eindroutes</span></div></header>
    <div className="cs-demo-notice"><ShieldCheck size={18} /><span><strong>Lokale beheerdemo.</strong> Wijzigingen en publicaties blijven in deze browser. Er wordt niets naar een productiedatabase gestuurd.</span></div>
    <div className="cs-workspace">
      <aside className="cs-library" aria-label="Verhaal kiezen"><div className="cs-library-head"><h2>De boekenplank</h2><span>{worlds.length}</span></div><label className="cs-search"><Search size={17} /><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Zoek een verhaal" aria-label="Zoek in verhalenstudio" /></label><div className="cs-books">{filtered.map(item => { const published = getEditorialPublication(item.id); return <button key={item.id} onClick={() => selectStory(item.id)} className={item.id === selected ? 'cs-book is-selected' : 'cs-book'} aria-pressed={item.id === selected}><img src={item.image} alt="" /><span><strong>{published?.metadata.title || item.title}</strong><small>{published ? `Editie ${published.version} gepubliceerd` : 'Originele editie'}</small></span><ChevronRight size={15} /></button>; })}{!filtered.length && <p className="cs-no-results">Geen verhaal gevonden. Probeer een andere naam.</p>}</div><div className="cs-library-note"><Sparkles size={19} /><p>De vertakkingen blijven behouden.<br />Jij geeft de tekst een nieuwe jas.</p></div></aside>
      <section className="cs-editor" aria-label="Verhaal bewerken">
        <div className="cs-editor-top"><div><span className="cs-status"><i />{dirty ? 'Wijzigingen bewaren…' : durable ? 'Concept lokaal bewaard' : 'Alleen in dit venster bewaard'}</span><h2>{draft.metadata.title || 'Verhaal zonder titel'}</h2><p>{publication ? `Gepubliceerd: ${prettyDate(publication.publishedAt)} · editie ${publication.version}` : 'Je bewerkt een concept naast de oorspronkelijke editie.'}</p></div><button className="cs-icon-button" aria-label="Concept terugzetten" onClick={() => setConfirmReset(true)}><RotateCcw size={18} /></button></div>
        <nav className="cs-tabs" aria-label="Bewerkonderdelen">{([{ id: 'story', label: 'Verhaal & omslag', Icon: BookOpen }, { id: 'chapters', label: 'De vijf delen', Icon: GitBranch }, { id: 'preview', label: 'Concept bekijken', Icon: Eye }] as const).map(({ id, label, Icon }) => <button key={id} className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)} aria-pressed={tab === id}><Icon size={16} />{label}</button>)}</nav>
        <div className="cs-editor-body">
          {tab === 'story' && <div className="cs-story-form"><div className="cs-cover"><img src={draft.metadata.image} alt={world.imageAlt} /><span><Image size={15} />Omslagafbeelding</span></div><div className="cs-fields"><label>Verhaaltitel<input maxLength={120} value={draft.metadata.title} onChange={event => edit({ ...draft, metadata: { ...draft.metadata, title: event.target.value } })} /></label><label>Korte omschrijving<textarea rows={4} maxLength={600} value={draft.metadata.description} onChange={event => edit({ ...draft, metadata: { ...draft.metadata, description: event.target.value } })} /><small>{draft.metadata.description.length}/600 tekens · zichtbaar in de bibliotheek</small></label><label>Omslag uit de beeldcollectie<select value={draft.metadata.image} onChange={event => edit({ ...draft, metadata: { ...draft.metadata, image: event.target.value } })}>{worlds.map(item => <option key={item.id} value={item.image}>{item.title}</option>)}</select></label><div className="cs-field-note"><BookOpen size={20} /><p>Vijf delen, twee keuzes per deel en een eigen einde. De bestaande verhaalstructuur blijft intact.</p></div><button className="cs-link" onClick={() => setTab('chapters')}>Verder met de hoofdstukken<ArrowRight size={17} /></button></div></div>}
          {tab !== 'story' && <><div className="cs-chapter-selector" aria-label="Hoofdstuk kiezen">{Array.from({ length: 5 }, (_, index) => <button key={index} className={chapter === index ? 'is-active' : ''} onClick={() => { setChapter(index); setRoute(current => Array.from({ length: index }, (_, bit) => current[bit] || 0)); }} aria-pressed={chapter === index}><span>{index + 1}</span>Deel {index + 1}{draft.chapters[String(index)] && <i title="Tekst aangepast" />}</button>)}</div>{chapter > 0 && <div className="cs-route-picker"><span><GitBranch size={15} />Bekijk na deze eerdere keuzes:</span>{Array.from({ length: chapter }, (_, index) => <label key={index}>Deel {index + 1}<select aria-label={`Eerdere keuze deel ${index + 1}`} value={route[index] || 0} onChange={event => setRoute(current => Array.from({ length: chapter }, (_, bit) => bit === index ? Number(event.target.value) : current[bit] || 0))}><option value={0}>Keuze 1</option><option value={1}>Keuze 2</option></select></label>)}</div>}
          {tab === 'chapters' ? <div className="cs-chapter-form"><div className="cs-branch-note"><GitBranch size={19} /><p>Je ziet de gekozen verhaalroute. Een aangepaste titel of tekst geldt voor <strong>alle routes van dit deel</strong>. Onaangepaste velden blijven hun oorspronkelijke route volgen. Gebruik <code>{'{{naam}}'}</code> voor de voornaam.</p></div><label>Hoofdstuktitel<input value={previewTitle} maxLength={200} onChange={event => editChapter('title', event.target.value)} /></label><label>Verhaaltekst<textarea className="cs-story-textarea" rows={14} maxLength={20000} value={previewText} onChange={event => editChapter('text', event.target.value)} /><small>{previewText.split(/\s+/u).filter(Boolean).length} woorden · {override.text !== undefined ? 'aangepaste tekst' : 'oorspronkelijke tekst van deze route'}</small></label>{Object.keys(override).length > 0 && <button className="cs-link" onClick={restoreChapter}><RotateCcw size={15} />Oorspronkelijke route-afhankelijke tekst terugzetten</button>}<div className="cs-choice-heading"><h3>De keuzes blijven verbonden</h3><span><ShieldCheck size={14} />Route beschermd</span></div><div className="cs-choice-cards">{activeScene.choices.map((choice, index) => <article key={choice.label}><span>{index + 1}</span><div><strong>{choice.label}</strong><p>{choice.hint}</p><small>{chapter < 4 ? `Gaat naar deel ${chapter + 2} met keuze ${index + 1}` : `Bepaalt het einde van dit avontuur`}</small></div><ArrowRight size={17} /></article>)}</div></div> : <article className="cs-reading-preview"><span className="cs-eyebrow">CONCEPTVOORBEELD · DEEL {chapter + 1}</span><h3>{previewTitle}</h3>{previewText.replaceAll('{{naam}}', 'Sam').split(/\n\s*\n/u).map((paragraph, index) => <p key={index}>{paragraph}</p>)}<div className="cs-preview-choices">{activeScene.choices.map((choice, index) => <button key={choice.label} disabled={chapter === 4} onClick={() => { setRoute(current => [...current.slice(0, chapter), index]); setChapter(value => Math.min(4, value + 1)); }}>{choice.label}<ArrowRight size={17} /></button>)}</div><small>Dit voorbeeld toont het concept. De leesapp gebruikt uitsluitend de gepubliceerde editie.</small></article>}</>}
          {errors && <div className={errors.length ? 'cs-validation cs-validation-error' : 'cs-validation'} role="status">{errors.length ? <CircleAlert size={21} /> : <CheckCheck size={21} />}<div><strong>{errors.length ? `${errors.length} ${errors.length === 1 ? 'punt vraagt' : 'punten vragen'} aandacht` : 'Dit verhaal is klaar voor publicatie'}</strong>{errors.length ? <ul>{errors.map(error => <li key={error}>{error}</li>)}</ul> : <p>Verhaaltitel, omslag, vijf delen en alle keuzeprefixen zijn compleet.</p>}</div></div>}
          {notice && <p className="cs-save-notice" role="status"><Check size={16} />{notice}</p>}
          {confirmReset && <div className="cs-confirm-box" role="alert"><strong>Concept terugzetten?</strong><p>Je conceptwijzigingen verdwijnen. De laatste publicatie en de oorspronkelijke verhaalroutes blijven behouden.</p><div><button className="cs-secondary" onClick={() => setConfirmReset(false)}>Annuleren</button><button className="cs-primary" onClick={reset}>Concept terugzetten</button></div></div>}
          {confirmPublish && <div className="cs-confirm-box" role="alert"><span className="cs-eyebrow">EDITIE {(publication?.version || 0) + 1}</span><strong>Dit concept lokaal publiceren?</strong><p>{changedParts ? `${changedParts} ${changedParts === 1 ? 'deel krijgt' : 'delen krijgen'} aangepaste tekstvelden. ` : ''}De keuzelogica en vijfdelige volgorde veranderen niet; opgeslagen routes blijven geldig. Deze beheerdemo maakt de editie alleen in deze browser beschikbaar.</p><label className="cs-confirm-label"><ShieldCheck size={17} />In productie worden begonnen avonturen aan hun verhaalversie gekoppeld.</label><div><button className="cs-secondary" onClick={() => setConfirmPublish(false)}>Nog even terug</button><button className="cs-primary" onClick={publish}><Send size={16} />Publiceer lokaal</button></div></div>}
        </div>
        <footer className="cs-actions"><div className="cs-actions-left"><button className="cs-secondary" onClick={save}><Save size={16} />Bewaar concept</button><button className="cs-secondary" onClick={check}><CheckCheck size={17} />Controleer</button></div><button className="cs-primary" onClick={() => { if (!check().length) setConfirmPublish(true); }}><Send size={16} />Publiceren</button></footer>
        <div className="cs-open-published"><span>{publication ? `Editie ${publication.version}` : 'Originele editie'} in de leesapp bekijken</span><button onClick={() => { if (dirty) save(); onPreview(selected); }}>Open gepubliceerde versie<Eye size={16} /></button></div>
      </section>
    </div>
  </main>;
}
