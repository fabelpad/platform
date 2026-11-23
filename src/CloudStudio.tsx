'use client';
import { useEffect, useState } from 'react';
import AdminShell from './AdminShell';
import { useAdminIdentity } from './useAdminIdentity';
import { worlds } from './worlds';
import { getScene } from './storyData';
import { getEditorialDraft, validateEditorialDraft, type EditorialDraft } from './editorialStore';
import { parentNeedsOnboarding } from '../lib/parentAccount';

type Recovery = { storyId: string; baseRevision: number; draft: EditorialDraft; savedAt: string };
const recoveryKey = (owner: string, story: string) => `fabelpad-studio-recovery-v1:${encodeURIComponent(owner)}:${story}`;
function readRecovery(owner: string, story: string): Recovery | null {
  try {
    const text = localStorage.getItem(recoveryKey(owner, story));
    if (!text || text.length > 2_000_000) return null;
    const value = JSON.parse(text) as Recovery;
    if (value.storyId !== story || !Number.isSafeInteger(value.baseRevision) || value.baseRevision < 0 || typeof value.savedAt !== 'string' || !Number.isFinite(Date.parse(value.savedAt)) || !value.draft || typeof value.draft.metadata?.title !== 'string' || typeof value.draft.metadata.description !== 'string' || typeof value.draft.metadata.image !== 'string' || !value.draft.chapters || typeof value.draft.chapters !== 'object') return null;
    if (Array.isArray(value.draft.chapters) || Object.entries(value.draft.chapters).some(([part, copy]) => !/^[0-4]$/u.test(part) || !copy || typeof copy !== 'object' || (copy.title !== undefined && typeof copy.title !== 'string') || (copy.text !== undefined && typeof copy.text !== 'string'))) return null;
    return value;
  } catch { return null; }
}
const paths = (part: number) => Array.from({ length: 2 ** part }, (_, index) => Array.from({ length: part }, (_, bit) => (index >> (part - bit - 1)) & 1));
const pathLabel = (route: number[]) => route.length ? route.map(choice => choice + 1).join(' → ') : 'Start';

export default function CloudStudio() {
  const [selected, setSelected] = useState('station');
  const [draft, setDraft] = useState<EditorialDraft | null>(null);
  const [revision, setRevision] = useState(0);
  const [chapter, setChapter] = useState(0);
  const [route, setRoute] = useState<number[]>([]);
  const [previewName, setPreviewName] = useState('Sam');
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [notice, setNotice] = useState('');
  const [problem, setProblem] = useState('');
  const [published, setPublished] = useState('');
  const [recovery, setRecovery] = useState<Recovery | null>(null);
  const [conflict, setConflict] = useState(false);
  const [loadVersion, setLoadVersion] = useState(0);
  const identity = useAdminIdentity(() => { setDraft(null); setRecovery(null); setPublished(''); setDirty(false); setConfirm(false); setConflict(false); setNotice(''); setProblem(''); setBusy(false); });
  const { session, checked, denied } = identity;
  const canManage = !!session?.admin && !!session.parent && !denied && !parentNeedsOnboarding(session.lifecycle) && session.lifecycle?.state === 'active';
  function failure(response: Response, message: string): never {
    if (response.status === 401 || response.status === 403) identity.invalidate('Je beheersessie is verlopen of je hebt geen toegang. Log opnieuw in als beheerder.');
    throw new Error(response.status === 401 || response.status === 403 ? 'Je beheersessie is verlopen of je hebt geen toegang. Log opnieuw in als beheerder.' : message);
  }
  useEffect(() => {
    if (!canManage || !session?.parent) return;
    const operation = identity.capture(); if (!operation) return;
    const controller = new AbortController();
    setDraft(null); setBusy(true); setDirty(false); setConfirm(false); setNotice(''); setProblem(''); setPublished(''); setConflict(false);
    setRecovery(readRecovery(session.parent.id, selected));
    fetch(`/api/content/drafts/${selected}`, { cache: 'no-store', signal: controller.signal, headers: { 'X-Fabelpad-Parent': operation.parentId } }).then(async response => {
      const data = await response.json();
      if (!identity.isCurrent(operation)) return null;
      if (!response.ok) failure(response, data.message || 'Het concept kon niet worden opgehaald.');
      return data;
    }).then(data => { if (data && !controller.signal.aborted && identity.isCurrent(operation)) { setDraft(data.draft); setRevision(data.revision); } }).catch(error => { if (!controller.signal.aborted && identity.isCurrent(operation)) setProblem(error.message); }).finally(() => { if (!controller.signal.aborted && identity.isCurrent(operation)) setBusy(false); });
    return () => controller.abort();
  }, [selected, canManage, session?.parent?.id, loadVersion]);
  useEffect(() => { const leave = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); }; window.addEventListener('beforeunload', leave); return () => window.removeEventListener('beforeunload', leave); }, [dirty]);
  function edit(next: EditorialDraft, baseRevision = revision) {
    if (!identity.capture()) return;
    const updated = { ...next, updatedAt: new Date().toISOString() };
    setDraft(updated); setDirty(true); setConfirm(false); setNotice(''); setProblem('');
    if (session?.parent) {
      const snapshot = { storyId: selected, baseRevision, draft: updated, savedAt: new Date().toISOString() };
      try { localStorage.setItem(recoveryKey(session.parent.id, selected), JSON.stringify(snapshot)); setRecovery(snapshot); }
      catch { setProblem('Browserherstel is niet beschikbaar. Download je concept voordat je dit venster sluit.'); }
    }
  }
  function downloadRecovery(snapshot?: Recovery) {
    if (!identity.capture()) return;
    const value = snapshot || (draft ? { storyId: selected, baseRevision: revision, draft, savedAt: new Date().toISOString() } : null);
    if (!value) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `fabelpad-concept-${value.storyId}-revisie-${value.baseRevision}.json`; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice('Je concept is gedownload. De serverpublicatie is niet gewijzigd.');
  }
  async function save() {
    const operation = identity.capture();
    if (!operation || !canManage || !draft || busy) return;
    const errors = validateEditorialDraft(selected, draft); if (errors.length) { setProblem(errors.join(' ')); return; }
    setBusy(true); setNotice(''); setProblem('');
    try {
      const response = await fetch(`/api/content/drafts/${selected}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Fabelpad-Parent': operation.parentId }, body: JSON.stringify({ baseRevision: revision, draft }) });
      const data = await response.json();
      if (!identity.isCurrent(operation)) return;
      if (response.status === 409) { setConflict(true); throw new Error('Een andere beheerder heeft dit concept gewijzigd. Jouw tekst is behouden. Download je concept voordat je de actuele serverversie laadt; vergelijk de versies en neem je wijzigingen bewust over.'); }
      if (!response.ok) failure(response, data.message || data.errors?.join(' ') || 'Bewaren is niet gelukt.');
      setRevision(data.revision); setDirty(false); setConflict(false); setRecovery(null);
      if (identity.isCurrent(operation)) { try { localStorage.removeItem(recoveryKey(operation.parentId, selected)); } catch {} }
      setNotice('Concept op de server bewaard. Lezers zien de huidige publicatie.');
    } catch (error) { if (identity.isCurrent(operation)) setProblem((error as Error).message); } finally { if (identity.isCurrent(operation)) setBusy(false); }
  }
  async function publish() {
    const operation = identity.capture();
    if (!operation || !canManage || !draft || busy || dirty || revision < 1) return;
    setBusy(true); setNotice(''); setProblem('');
    try {
      const response = await fetch(`/api/content/publish/${selected}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Fabelpad-Parent': operation.parentId }, body: JSON.stringify({ baseRevision: revision }) });
      const data = await response.json();
      if (!identity.isCurrent(operation)) return;
      if (!response.ok) failure(response, data.message || (response.status === 409 ? 'Het concept is inmiddels gewijzigd. Laad en controleer het opnieuw.' : 'Publiceren is niet gelukt.'));
      setPublished(data.release.contentVersion); setConfirm(false); setNotice(`Nieuwe contentrelease ${data.release.contentVersion} gepubliceerd. Begonnen avonturen blijven op hun bewaarde versie.`);
    } catch (error) { if (identity.isCurrent(operation)) setProblem((error as Error).message); } finally { if (identity.isCurrent(operation)) setBusy(false); }
  }
  const original = getScene(selected, chapter, route.slice(0, chapter), '{{naam}}');
  const override = draft?.chapters[String(chapter)] || {};
  const partComplete = (part: number) => paths(part).every(prefix => { const scene = getScene(selected, part, prefix, '{{naam}}'), copy = draft?.chapters[String(part)] || {}; return (copy.title ?? scene.title).trim() && (copy.text ?? scene.text).trim() && scene.choices.length === 2 && scene.choices.every(choice => choice.label.trim() && choice.hint.trim()); });
  const completedParts = draft ? Array.from({ length: 5 }, (_, part) => partComplete(part)).filter(Boolean).length : 0;
  const completePaths = draft ? Array.from({ length: 5 }, (_, part) => partComplete(part) ? 2 ** part : 0).reduce((a, b) => a + b, 0) : 0;
  const coverComplete = !!draft && worlds.some(world => world.image === draft.metadata.image);
  const totalComplete = completedParts + Number(coverComplete);
  const name = previewName.trim() || 'Sam';
  return <AdminShell><header className="admin-page-heading"><div><span className="admin-eyebrow">Schrijven & publiceren</span><h1>Verhalenstudio.</h1><p>Geef ieder avontuur aandacht. Bewerk een concept, bekijk de vertakkingen en publiceer een nieuwe editie.</p></div>{draft && <div className="admin-studio-status"><small>Revisie {revision}</small><strong>{dirty ? 'Onbewaarde wijzigingen' : 'Op de server bewaard'}</strong></div>}</header>
    {!checked ? <p role="status">Beheerrechten controleren…</p> : !session?.configured ? <p className="notice">De beheeromgeving is op dit moment niet beschikbaar. Probeer het later opnieuw of neem contact op via <a href="mailto:support@fabelpad.nl">support@fabelpad.nl</a>.</p> : !session.parent || denied ? <a className="account-primary" href="/inloggen?next=%2Fstudio">Inloggen als beheerder</a> : !canManage ? <p className="notice">Dit ouderaccount heeft geen toegang tot de verhalenstudio. Een actief ouderaccount met toegekende beheerrechten is vereist. <a href="/profiel/account">Naar je accountoverzicht</a></p> : <>
    <label className="studio-select">Verhaal<select disabled={busy} value={selected} onChange={event => { if (!dirty || window.confirm('Onbewaarde conceptwijzigingen verlaten? Je browserherstel blijft beschikbaar.')) { setSelected(event.target.value); setChapter(0); setRoute([]); } }}>{worlds.map(world => <option key={world.id} value={world.id}>{world.title}</option>)}</select></label>
    {recovery && !dirty && <section className="admin-recovery"><h2>Er staat een browserherstel klaar</h2><p>Onbewaarde tekst van {new Date(recovery.savedAt).toLocaleString('nl-NL')}, gebaseerd op revisie {recovery.baseRevision}. De server staat nu op revisie {revision}. Herstellen publiceert niets.</p><div className="account-actions"><button className="account-secondary" disabled={busy || !draft} onClick={() => { if (window.confirm('Deze hersteltekst in de editor overnemen? Controleer de verschillen met de serverversie voordat je bewaart.')) { edit(recovery.draft); setNotice('Hersteltekst overgenomen in de editor. Controleer je wijzigingen voordat je het huidige serverconcept vervangt.'); } }}>Browserherstel overnemen</button><button className="account-secondary" disabled={busy} onClick={() => downloadRecovery(recovery)}>Herstelkopie downloaden</button><button className="account-secondary" disabled={busy} onClick={() => { if (session.parent && window.confirm('Deze browserherstelkopie verwijderen?')) { try { localStorage.removeItem(recoveryKey(session.parent.id, selected)); } catch {} setRecovery(null); } }}>Herstelkopie verwijderen</button></div></section>}

    {draft && <fieldset disabled={busy}><div className="admin-studio-grid"><aside className="admin-story-nav" aria-label="Verhaalopbouw"><h2>Opbouw van het verhaal</h2><div>{Array.from({ length: 5 }, (_, part) => <button key={part} type="button" aria-current={chapter === part ? 'step' : undefined} onClick={() => { setChapter(part); setRoute(Array.from({ length: part }, (_, index) => route[index] || 0)); }}><span>Deel {part + 1}</span><small>{2 ** part} {part ? 'paden' : 'pad'} · {partComplete(part) ? 'compleet' : 'aanvullen'}</small></button>)}<a href="#studio-metadata">Omslag & gegevens</a></div><div className="admin-progress"><progress max={6} value={totalComplete} aria-label="Complete delen en omslag" /><small>{completedParts}/5 delen · {completePaths}/31 paden<br />Omslag {coverComplete ? 'aanwezig' : 'ontbreekt'}</small></div></aside><div>
    <section className="admin-card" id="studio-metadata"><h2>Het verhaal</h2><div className="admin-studio-fields"><div><label>Verhaaltitel<input maxLength={120} value={draft.metadata.title} onChange={event => edit({ ...draft, metadata: { ...draft.metadata, title: event.target.value } })} /></label><label>Korte omschrijving<textarea maxLength={600} value={draft.metadata.description} onChange={event => edit({ ...draft, metadata: { ...draft.metadata, description: event.target.value } })} /></label><label>Omslag<select value={draft.metadata.image} onChange={event => edit({ ...draft, metadata: { ...draft.metadata, image: event.target.value } })}>{worlds.map(world => <option key={world.id} value={world.image}>{world.title}</option>)}</select></label></div><img className="admin-cover" src={draft.metadata.image} alt="Omslag van het concept" /></div></section>
    <section className="admin-card"><div className="admin-editor-heading"><h2>Deel {chapter + 1}</h2><small>{2 ** chapter} {chapter ? 'vertakkingen' : 'begin'}</small></div><label>Deel<select value={chapter} onChange={event => { const part = Number(event.target.value); setChapter(part); setRoute(Array.from({ length: part }, (_, index) => route[index] || 0)); }}>{Array.from({ length: 5 }, (_, part) => <option key={part} value={part}>Deel {part + 1}</option>)}</select></label><p>Kies een pad om de oorspronkelijke vertakking en het voorbeeld te bekijken.</p><div className="admin-path-grid" role="group" aria-label={`Paden in deel ${chapter + 1}`}>{paths(chapter).map((prefix, index) => <button type="button" key={index} aria-pressed={prefix.join('') === route.slice(0, chapter).join('')} onClick={() => setRoute(prefix)}>{pathLabel(prefix)}</button>)}</div><p className="account-legal-note">Een aangepaste titel of tekst geldt voor <strong>alle routes van dit deel</strong>. Velden zonder aanpassing volgen de oorspronkelijke vertakkingen. Gebruik {'{{naam}}'} voor de kindnaam.</p><label>Hoofdstuktitel<input maxLength={200} value={override.title ?? original.title} onChange={event => edit({ ...draft, chapters: { ...draft.chapters, [String(chapter)]: { ...override, title: event.target.value } } })} /></label><label>Verhaaltekst<textarea rows={14} maxLength={20000} value={override.text ?? original.text} onChange={event => edit({ ...draft, chapters: { ...draft.chapters, [String(chapter)]: { ...override, text: event.target.value } } })} /></label><button type="button" className="account-secondary" disabled={!draft.chapters[String(chapter)]} onClick={() => { const chapters = { ...draft.chapters }; delete chapters[String(chapter)]; edit({ ...draft, chapters }); }}>Oorspronkelijke tekst van dit deel gebruiken</button>
    <section className="admin-preview" aria-label="Concept bekijken"><span className="admin-eyebrow">Leesvoorbeeld · pad {pathLabel(route.slice(0, chapter))}</span><label className="admin-preview-name">Voorbeeldnaam<input maxLength={40} value={previewName} onChange={event => setPreviewName(event.target.value)} /></label><h3>{(override.title ?? original.title).replaceAll('{{naam}}', name)}</h3>{(override.text ?? original.text).replaceAll('{{naam}}', name).split(/\n\s*\n/u).map((paragraph, index) => <p key={index}>{paragraph}</p>)}<div className="account-actions">{original.choices.map((choice, index) => <button type="button" className="account-secondary" key={index} disabled={chapter === 4} onClick={() => { setRoute([...route.slice(0, chapter), index]); setChapter(chapter + 1); }}>{choice.label} →</button>)}</div>{chapter === 4 && <small>Dit is het laatste deel. Kies hierboven een ander pad om verder te controleren.</small>}</section></section>
    <section className="admin-card"><h2>Bewaren & publiceren</h2><p>Bewaren wijzigt alleen het concept. Publiceren maakt een onveranderlijke editie voor nieuwe avonturen.</p><div className="account-actions"><button type="button" className="account-primary" onClick={() => void save()}>Concept bewaren</button><button type="button" className="account-secondary" onClick={() => { const errors = validateEditorialDraft(selected, draft); setProblem(errors.join(' ')); setNotice(errors.length ? '' : 'Alle vijf delen, 31 keuzeprefixen en de omslag zijn compleet.'); }}>Controleren</button><button type="button" className="account-secondary" disabled={dirty || revision < 1 || conflict} onClick={() => setConfirm(true)}>Publiceren…</button></div><div className="account-actions"><button type="button" className="account-secondary" onClick={() => downloadRecovery()}>Concept downloaden</button><button type="button" className="account-secondary" onClick={() => { if (window.confirm('Het lokale browserconcept expliciet in dit serverconcept overnemen? Bewaar en controleer het daarna.')) edit(getEditorialDraft(selected)); }}>Lokaal concept importeren</button><button type="button" className="account-secondary" onClick={() => { if (!dirty || window.confirm('De actuele serverversie laden? Je onbewaarde tekst blijft als browserherstel beschikbaar; download die ook voor je verdergaat.')) setLoadVersion(value => value + 1); }}>Actueel serverconcept laden</button></div>{confirm && <section className="notice" role="alert"><h2>Deze editie publiceren?</h2><p>Dit maakt een onveranderlijke release voor nieuwe avonturen. Eerdere edities blijven beschikbaar.</p><div className="account-actions"><button type="button" className="account-secondary" onClick={() => setConfirm(false)}>Nog even terug</button><button type="button" className="account-primary" onClick={() => void publish()}>Bevestig publicatie</button></div></section>}{published && <p><a href={`/api/content/${selected}?version=${encodeURIComponent(published)}`}>Gepubliceerde contentrelease bekijken →</a></p>}<small>Conceptrevisie {revision} · {dirty ? 'onbewaarde wijzigingen' : 'geen onbewaarde wijzigingen'}</small></section>
    </div></div></fieldset>}{busy && <p role="status">Een moment…</p>}</>}{(problem || identity.error) && <p className="account-feedback" role="alert">{problem || identity.error}</p>}{notice && <p className="account-feedback" role="status">{notice}</p>}
  </AdminShell>;
}
