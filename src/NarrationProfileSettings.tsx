'use client';
import { useEffect, useRef, useState } from 'react';
import { Mic, Play, Square, Trash2 } from 'lucide-react';
import { DEFAULT_NAME_CUES, cueAssetForChoice, findNarrationName, normalizeVoiceSlot, type NarrationVoices, type VoiceSlot } from '../lib/narration/contracts';
import { fetchNarrationVoices, fetchWholeCuePack, unavailableVoices, type LoadedCuePack } from './narrationClient';
import { currentStorageIdentity } from './profileStorage';
import { clearLocalNarration, readLocalNameChoice, readLocalRecording, removeLocalRecording, saveLocalNameChoice, saveLocalRecording, type LocalNarrationChoice, type LocalNameMode } from './narrationLocal';
import { claimNarrationAudio } from './narrationAudioSession';
import './narration.css';

export default function NarrationProfileSettings({ profileId, profileName, voiceSlot, onVoiceChange, disabled = false }: { profileId?: string; profileName?: string; voiceSlot?: VoiceSlot; onVoiceChange: (value: VoiceSlot) => void; disabled?: boolean }) {
  const [voices, setVoices] = useState<NarrationVoices>(unavailableVoices);
  const [pack, setPack] = useState<LoadedCuePack | null>(null);
  const [choice, setChoice] = useState<LocalNarrationChoice>({ mode: 'avonturier' });
  const [query, setQuery] = useState(''); const [problem, setProblem] = useState(''); const [notice, setNotice] = useState('');
  const [recording, setRecording] = useState(''); const [drafts, setDrafts] = useState<Record<string, Blob>>({}); const [saved, setSaved] = useState<string[]>([]);
  const player = useRef<HTMLAudioElement | null>(null); const objectUrl = useRef(''); const releaseAudio = useRef<(() => void) | null>(null);
  const recorder = useRef<MediaRecorder | null>(null); const stream = useRef<MediaStream | null>(null); const timeout = useRef<ReturnType<typeof setTimeout> | null>(null); const epoch = useRef(0);
  const slot = normalizeVoiceSlot(voiceSlot, voices.defaultVoiceSlot); const selected = voices.voices.find(value => value.slotId === slot);
  function stopPreview() { player.current?.pause(); player.current = null; releaseAudio.current?.(); releaseAudio.current = null; if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); objectUrl.current = ''; }
  function stopRecorder(discard = false) { if (discard) epoch.current++; if (timeout.current) clearTimeout(timeout.current); timeout.current = null; if (recorder.current?.state === 'recording') recorder.current.stop(); stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; recorder.current = null; setRecording(''); }
  useEffect(() => { const controller = new AbortController(); void fetchNarrationVoices(controller.signal).then(setVoices).catch(() => {}); return () => controller.abort(); }, []);
  useEffect(() => {
    const token = ++epoch.current; stopPreview(); stopRecorder(); setPack(null); setChoice({ mode: 'avonturier' }); setQuery(''); setDrafts({}); setSaved([]); setProblem(''); setNotice('');
    if (profileId) void readLocalNameChoice(profileId).then(value => { if (epoch.current === token) setChoice(value); });
    if (selected) void fetchWholeCuePack(slot, selected.presetVersion).then(async value => {
      if (epoch.current !== token) return; setPack(value);
      if (profileId) { const cues = value?.pack.cues ?? DEFAULT_NAME_CUES; const values = await Promise.all(cues.map(async cue => await readLocalRecording(profileId, cue.id) ? cue.id : null)); if (epoch.current === token) setSaved(values.filter((id): id is string => id !== null)); }
    });
    return () => { epoch.current++; stopPreview(); stopRecorder(); };
  }, [profileId, slot, selected?.presetVersion]);
  useEffect(() => {
    const stop = () => { if (document.visibilityState === 'hidden') { stopPreview(); stopRecorder(true); } };
    const clear = () => { stopPreview(); stopRecorder(true); setChoice({ mode: 'avonturier' }); setSaved([]); setDrafts({}); };
    document.addEventListener('visibilitychange', stop); window.addEventListener('pagehide', clear); window.addEventListener('fabelpad-storage-scope-change', clear); window.addEventListener('fabelpad-parent-data-cleared', clear); window.addEventListener('fabelpad-profile-data-cleared', clear);
    return () => { document.removeEventListener('visibilitychange', stop); window.removeEventListener('pagehide', clear); window.removeEventListener('fabelpad-storage-scope-change', clear); window.removeEventListener('fabelpad-parent-data-cleared', clear); window.removeEventListener('fabelpad-profile-data-cleared', clear); };
  }, []);
  async function saveChoice(next: LocalNarrationChoice) {
    if (!profileId || disabled) return; const token = epoch.current; setProblem(''); stopPreview();
    try { await saveLocalNameChoice(profileId, next); if (token === epoch.current) { setChoice(next); setNotice('Deze naamkeuze staat alleen op dit apparaat.'); } } catch (error) { if (token === epoch.current) setProblem((error as Error).message); }
  }
  function preview(source?: string | Blob | null) {
    stopPreview(); if (!source) { setNotice('Dit luistervoorbeeld wacht op de vrijgegeven opname. Avonturier blijft de terugval.'); return; }
    if (typeof source === 'string' && !source.startsWith('/api/')) return;
    const url = source instanceof Blob ? URL.createObjectURL(source) : source; if (source instanceof Blob) objectUrl.current = url;
    const audio = new Audio(url); player.current = audio; releaseAudio.current = claimNarrationAudio(stopPreview); audio.onended = stopPreview;
    void audio.play().catch(() => { if (player.current === audio) { stopPreview(); setProblem('Beluisteren lukt nu niet. Probeer het opnieuw.'); } });
  }
  function previewCue(cueId: string, value = choice) { const id = pack ? cueAssetForChoice(pack.pack, cueId, value) : null; preview(id ? pack?.blobs.get(id) : null); }
  async function record(cueId: string) {
    if (!profileId || disabled) return; stopPreview(); stopRecorder(true); const token = epoch.current; const scope = currentStorageIdentity(); setProblem(''); setNotice('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { setProblem('Deze browser ondersteunt lokaal opnemen niet. Kies Avonturier of een naam uit de bundel.'); return; }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (token !== epoch.current || scope !== currentStorageIdentity() || document.visibilityState === 'hidden') { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media; const value = new MediaRecorder(media); recorder.current = value; const chunks: Blob[] = [];
      value.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      value.onstop = () => { media.getTracks().forEach(track => track.stop()); if (token !== epoch.current || scope !== currentStorageIdentity()) return; const blob = new Blob(chunks, { type: value.mimeType || 'audio/webm' }); if (blob.size && blob.size <= 5 * 1024 * 1024) { setDrafts(current => ({ ...current, [cueId]: blob })); setNotice('Luister je volledige zin terug en kies daarna Opname bewaren.'); } else setProblem('De opname is leeg of te groot. Probeer een korte volledige zin.'); setRecording(''); };
      value.onerror = () => { stopRecorder(true); setProblem('Opnemen is gestopt. Probeer het opnieuw.'); };
      value.start(); setRecording(cueId); timeout.current = setTimeout(() => stopRecorder(), 30_000);
    } catch { if (token === epoch.current) setProblem('Microfoontoegang is niet beschikbaar of geweigerd. Je kunt Avonturier of een beschikbare naam blijven gebruiken.'); }
  }
  const cues = pack?.pack.cues ?? DEFAULT_NAME_CUES;
  const catalogue = pack?.pack.catalogue ?? [];
  const normalizedMatch = findNarrationName(query, catalogue.filter(entry => entry.kind === 'firstName'));
  const currentEntry = catalogue.find(entry => entry.id === choice.catalogueId);
  return <fieldset className="narration-profile" disabled={disabled}><legend>Voorlezen</legend><p>Kies een AI-voorleesstem. De stemkeuze hoort bij dit kindprofiel. Een profiel zonder voorkeur gebruikt de standaardstem.</p><div className="narration-voice-options" role="radiogroup" aria-label="Vertelstem">{voices.voices.map(voice => <div className="narration-voice-option" key={voice.slotId}><label><input type="radio" name={`narration-voice-${profileId || 'new'}`} checked={slot === voice.slotId} onChange={() => { stopPreview(); onVoiceChange(voice.slotId); }} /><span>{voice.label}{voice.slotId === voices.defaultVoiceSlot && <small> · Standaard</small>}</span></label><button type="button" aria-label={`Voorbeeld van ${voice.label}`} disabled={!voice.sampleUrl} onClick={() => preview(voice.sampleUrl)}><Play size={17} aria-hidden="true" /></button></div>)}</div>{!voices.available && <p role="status">{voices.reason || 'De nieuwe stemmen wachten op generatie en vrijgave. De bestaande lokale Nederlandse stem blijft bruikbaar als die op je apparaat staat.'}</p>}
    {profileId ? <div className="narration-name-panel"><h3>Hoe klinkt de aanspreekzin?</h3><p>Alleen de stem synchroniseert. Naamkeuze, uitspraak en eigen opnamen blijven op dit apparaat en staan niet in een gezinsdownload.</p><label>Naam bij het luisteren<select value={choice.mode} onChange={event => void saveChoice({ ...choice, mode: event.target.value as LocalNameMode })}><option value="avonturier">Avonturier</option><option value="name">Mijn naam</option><option value="alias">Mijn avonturiersnaam</option><option value="recording">Zelf inspreken</option></select></label>
      {choice.mode === 'avonturier' && <button className="account-secondary" type="button" disabled={!pack} onClick={() => previewCue(cues[0].id, { mode: 'avonturier' })}>Avonturier beluisteren</button>}
      {choice.mode === 'name' && <><label>Zoek een beschikbare naam<input type="search" autoComplete="off" maxLength={60} value={query} onChange={event => setQuery(event.target.value)} placeholder="Zoek op dit apparaat" /></label>{profileName && <button className="account-secondary" type="button" onClick={() => setQuery(profileName)}>Mijn profielnaam lokaal opzoeken</button>}{normalizedMatch ? <div><p>Beschikbaar: {normalizedMatch.displayName}.</p>{normalizedMatch.pronunciations.map(pronunciation => <div className="account-actions" key={pronunciation.id}><button type="button" className="account-secondary" onClick={() => previewCue(cues[0].id, { mode: 'name', catalogueId: normalizedMatch.id, pronunciationId: pronunciation.id })}>Uitspraak beluisteren ({pronunciation.id})</button><button className="account-secondary" type="button" onClick={() => void saveChoice({ mode: 'name', catalogueId: normalizedMatch.id, pronunciationId: pronunciation.id })}>Deze uitspraak op dit apparaat gebruiken</button></div>)}</div> : <p>{query.trim() ? 'Deze spelling is niet aanwezig in de ingesproken bundel. Kies Avonturier, een avonturiersnaam of spreek zelf volledige zinnen in.' : 'Je zoekopdracht blijft op dit apparaat. Een naam wordt pas gebruikt nadat je de uitspraak hebt gekozen.'}</p>}{currentEntry && <p>Lokale keuze: {currentEntry.displayName}.</p>}</>}
      {choice.mode === 'alias' && <><label>Avonturiersnaam<select value={choice.catalogueId || ''} onChange={event => void saveChoice({ mode: 'alias', catalogueId: event.target.value || undefined, pronunciationId: 'nl' })}><option value="">Avonturier gebruiken</option>{catalogue.filter(entry => entry.kind === 'alias').map(entry => <option value={entry.id} key={entry.id}>{entry.displayName}</option>)}</select></label><button className="account-secondary" type="button" disabled={!pack} onClick={() => previewCue(cues[0].id)}>Gekozen naam beluisteren</button></>}
      {choice.mode === 'recording' && <><p>Spreek als ouder iedere volledige zin in, met de gewenste naam. De opname blijft in deze browser. Ontbrekende zinnen gebruiken Avonturier in de gekozen vertelstem; het verschil met je eigen stem is hoorbaar.</p><div className="narration-recorder-list">{cues.map(cue => <article key={cue.id}><p>{cue.template.replace('{{naam}}', 'jouw gekozen naam')}</p><div className="narration-recorder-actions"><button type="button" onClick={() => recording === cue.id ? stopRecorder() : void record(cue.id)} disabled={!!recording && recording !== cue.id}>{recording === cue.id ? <><Square size={14} />Opname stoppen</> : <><Mic size={14} />{saved.includes(cue.id) ? 'Opnieuw inspreken' : 'Zin inspreken'}</>}</button><button type="button" disabled={!drafts[cue.id] && !saved.includes(cue.id)} onClick={() => { const token = epoch.current; const draft = drafts[cue.id]; if (draft) preview(draft); else void readLocalRecording(profileId, cue.id).then(blob => { if (token === epoch.current) preview(blob); }); }}><Play size={14} />Terugluisteren</button><button type="button" disabled={!drafts[cue.id]} onClick={() => { const token = epoch.current; void saveLocalRecording(profileId, cue.id, drafts[cue.id]).then(() => { if (token !== epoch.current) return; setSaved(current => [...new Set([...current, cue.id])]); setDrafts(current => { const next = { ...current }; delete next[cue.id]; return next; }); setNotice('De opname staat alleen op dit apparaat.'); }).catch(error => { if (token === epoch.current) setProblem(error.message); }); }}>Opname bewaren</button><button type="button" disabled={!drafts[cue.id] && !saved.includes(cue.id)} onClick={() => { stopPreview(); const token = epoch.current; void removeLocalRecording(profileId, cue.id).then(() => { if (token !== epoch.current) return; setSaved(current => current.filter(id => id !== cue.id)); setDrafts(current => { const next = { ...current }; delete next[cue.id]; return next; }); setNotice('De lokale opname is gewist. Deze zin gebruikt weer Avonturier.'); }).catch(error => { if (token === epoch.current) setProblem(error.message); }); }}><Trash2 size={14} />Wissen</button></div></article>)}</div></>}
      <button className="account-secondary" type="button" onClick={() => void saveChoice({ mode: 'avonturier' })}>Gebruik Avonturier</button>
      <button className="account-secondary" type="button" onClick={() => { stopPreview(); stopRecorder(true); const token = epoch.current; void clearLocalNarration(currentStorageIdentity(), profileId).then(() => { if (token === epoch.current) { setChoice({ mode: 'avonturier' }); setSaved([]); setDrafts({}); setQuery(''); setNotice('Alle lokale naamkeuzes en ouderopnamen voor dit profiel zijn gewist.'); } }).catch(error => { if (token === epoch.current) setProblem(error.message); }); }}>Wis lokale naamkeuze en alle ouderopnamen</button>
    </div> : <p>Bewaar eerst het kindprofiel. Daarna kun je op dit apparaat een naam of ouderopname kiezen.</p>}
    {problem && <p role="alert">{problem}</p>}{notice && <p role="status">{notice}</p>}
  </fieldset>;
}
