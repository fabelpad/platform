import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, ArrowRight, BookOpen, Check, Compass, Heart, Leaf, Moon, Music2, Pause, Play, RotateCcw, Sparkles, VolumeX, X } from 'lucide-react';
import { getEnding, getScene } from './storyData';
import { DEFAULT_READING_LEVEL, isReadingLevel } from './readingLevel';
import type { ReadingLevel } from './readingLevel';
import IllustratedChoiceScene from './IllustratedChoiceScene';
import { storyPlayArt } from './storyPlayArt';
import { readingLevelsForRelease } from './contentReadingLevels';
import { currentStorageIdentity, readChild, saveChild } from './profileStorage';
import { backfillStoryMemory, continuityGreeting, getStoryMemory, openStoryThread, recordStoryProgress } from './storyMemory';
import { isStoryId, isOnlineStoryId, STORY_PARTS } from './storyCatalog';
import { worlds } from './worlds';
import { loadContentRelease, personalText } from './contentClient';
import type { ContentRelease } from '../lib/server/content';
import StationPlayScene from './StationPlayScene';
import { lockBodyScroll } from './modalScroll';
import { privateSpeechText, selectLocalDutchVoice } from './offlineSpeech';
import { normalizeVoiceSlot, segmentsForRoute, type NarrationManifest, type NarrationVoices, type VoiceSlot } from '../lib/narration/contracts';
import { fetchNarrationManifest, fetchNarrationVoices, unavailableVoices, WebNarrationPlayer, type WebNarrationState } from './narrationClient';
import { claimNarrationAudio } from './narrationAudioSession';
import './narration.css';
import { reportConsciousReading } from './parentActivity';
import './reader.css';
import './memory.css';
import './reader-extended.css';

type Props = { profileId: string; worldId: string; childName: string; muted: boolean; reducedMotion: boolean; textSize?: 'normal' | 'large'; readingLevel?: ReadingLevel; voiceSlot?: VoiceSlot; cloudContent?: boolean; previewLimit?: number; onRequestParents?: () => void; onClose: () => void; onComplete: (worldId: string, endingTitle: string) => void };
type Saved = { picks: number[]; updatedAt: number; contentVersion?: string; revision?: number; storyId?: string; lastCompletedPicks?: number[]; lastCompletedContentVersion?: string };
const iconMap = { heart: Heart, sparkles: Sparkles, music: Music2, moon: Moon, leaf: Leaf, compass: Compass };
const TOTAL = STORY_PARTS;

function loadPicks(profileId: string, world: string): number[] {
  try {
    const saved = readChild<Saved | null>(profileId, `story-${world}`, null);
    return saved && Array.isArray(saved.picks) && saved.picks.length <= TOTAL && saved.picks.every(v => v === 0 || v === 1) ? saved.picks : [];
  } catch { return []; }
}

export default function StoryReader({ profileId, worldId, childName, muted, reducedMotion, textSize, readingLevel, voiceSlot: preferredVoiceSlot, cloudContent = false, previewLimit, onRequestParents, onClose, onComplete }: Props) {
  const systemReducedMotion = useReducedMotion();
  const calmMotion = reducedMotion || systemReducedMotion === true;
  const world = (cloudContent ? isOnlineStoryId(worldId) : isStoryId(worldId)) ? worldId : 'station';
  const [saved] = useState(() => readChild<Saved | null>(profileId, `story-${world}`, null));
  const [release, setRelease] = useState<ContentRelease | null>(null);
  const [releaseError, setReleaseError] = useState('');
  const [durable, setDurable] = useState(false);
  const revision = useRef(saved?.revision || 0);
  const metadata = { ...(worlds.find(item => item.id === world)??worlds[0]), ...release?.metadata };
  useEffect(() => { let active=true;const load=()=>{void loadContentRelease(world,saved?.contentVersion,cloudContent).then(value=>{if(active){setRelease(value);setReleaseError('');}}).catch(error=>{if(active){setRelease(null);setReleaseError(error.message||'Dit verhaal kan nu niet worden geopend. Je keuzes blijven bewaard.');}});};const focus=()=>{if(cloudContent&&document.visibilityState==='visible')load();};load();window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus);return()=>{active=false;window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus);};},[world,saved?.contentVersion,cloudContent]);
  useEffect(()=>{
    if(!cloudContent||!release?.offlineUntil)return;
    const remaining=Date.parse(release.offlineUntil)-Date.now();
    const timer=setTimeout(()=>{setRelease(null);setReleaseError('Maak verbinding om jullie toegang opnieuw te controleren. Je leesplek blijft bewaard.');},Math.max(0,remaining));
    const revoked=()=>{setRelease(null);setReleaseError('De toegang tot dit gezin is ingetrokken. Je kunt terug naar het oudergedeelte.');};
    window.addEventListener('fabelpad-parent-data-cleared',revoked);
    return()=>{clearTimeout(timer);window.removeEventListener('fabelpad-parent-data-cleared',revoked);};
  },[cloudContent,release]);
  const [picks, setPicks] = useState(() => loadPicks(profileId, world));
  const [lastCompletedPicks, setLastCompletedPicks] = useState<number[] | undefined>(() => {
    const route = saved?.lastCompletedPicks ?? saved?.picks;
    return Array.isArray(route) && route.length === TOTAL && route.every(pick => pick === 0 || pick === 1) ? route : undefined;
  });
  const lastCompletedVersion = useRef(saved?.lastCompletedContentVersion ?? (picks.length === TOTAL ? saved?.contentVersion : undefined));
  const [replayRoute, setReplayRoute] = useState<number[] | null>(null);
  const [voiceState, setVoiceState] = useState<WebNarrationState>('idle');
  const [narrationVoices, setNarrationVoices] = useState<NarrationVoices>(unavailableVoices);
  const [narrationManifest, setNarrationManifest] = useState<NarrationManifest | null>(null);
  const [narrationMessage, setNarrationMessage] = useState('');
  const [continuousNarration, setContinuousNarration] = useState(false);
  const generatedPlayer = useRef<WebNarrationPlayer | null>(null);
  const localAudioRelease = useRef<(() => void) | null>(null);
  const continueRequested = useRef(false);
  const speechOrigin = useRef<'local' | 'generated'>('local');
  const narrationScope = currentStorageIdentity();
  const narrationSlot = normalizeVoiceSlot(preferredVoiceSlot, narrationVoices.defaultVoiceSlot);
  const [playEnabled, setPlayEnabled] = useState(true);
  const [modePageMinHeight, setModePageMinHeight] = useState(0);
  const [closing, setClosing] = useState(false);
  const closeRequested = useRef(false);
  const [greeting, setGreeting] = useState(() => (isStoryId(world)?continuityGreeting(getStoryMemory(profileId), world, childName):null));
  const dialogRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const modeButtonRef = useRef<HTMLButtonElement>(null);
  const modeScrollRestore = useRef<number | null>(null);
  const sceneHeadingRef = useRef<HTMLHeadingElement>(null);
  const focusNextScene = useRef(false);
  const currentPicks = useRef(picks);
  currentPicks.current = picks;
  const voiceToken = useRef(0);
  const closeRef = useRef(onClose);
  closeRef.current = requestClose;
  const complete = picks.length === TOTAL;
  const limit=release?.access==='preview'?1:previewLimit;
  const accessLocked = limit !== undefined && picks.length >= limit;
  const band = isReadingLevel(readingLevel) ? readingLevel : DEFAULT_READING_LEVEL;
  const levelContent = release ? readingLevelsForRelease(release)?.[band] : undefined;
  const canPlay = !accessLocked && !complete && !replayRoute;
  const specialPlay = world === 'station' && picks.length < 2;
  const showPlay = canPlay && playEnabled && !closing;
  const rawEnding = (levelContent?.endings ?? release?.endings)?.[picks.join('')] || (!cloudContent&&isStoryId(world)?getEnding(world,picks,childName):{title:'',text:'',keepsake:''});
  const ending = { ...rawEnding, title: personalText(rawEnding.title, childName), text: personalText(rawEnding.text, childName), keepsake: personalText(rawEnding.keepsake, childName) };
  const sceneStep = Math.min(picks.length, TOTAL - 1);
  const originalScene = (levelContent?.scenes ?? release?.scenes)?.[picks.slice(0, sceneStep).join('')] || (!cloudContent&&isStoryId(world)?getScene(world,sceneStep,picks,childName):{title:'',text:'',choices:[]});
  const scene = { ...originalScene, title: personalText(originalScene.title, childName), text: personalText(originalScene.text, childName), choices: originalScene.choices.map(choice => ({...choice,label:personalText(choice.label,childName),hint:personalText(choice.hint,childName)})) };
  const playArt = (isStoryId(world)?storyPlayArt[world]:undefined) ?? { image: metadata.image, imageAlt: metadata.imageAlt };
  const visibleGreeting = greeting && band === 'under6' ? `Welkom terug, ${childName}!` : greeting;
  const [localVoice, setLocalVoice] = useState<SpeechSynthesisVoice | null>(null);
  const speechAvailable = localVoice !== null;
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    const update = () => setLocalVoice(selectLocalDutchVoice(synth.getVoices()));
    update();
    synth.addEventListener('voiceschanged', update);
    return () => synth.removeEventListener('voiceschanged', update);
  }, []);
  const activeText = accessLocked ? 'Dit avontuur gaat verder in het gezinspakket. Vraag een grote avonturier om samen te kijken.' : complete ? `${ending.title}. ${ending.text}` : `${picks.length === 0 && visibleGreeting ? `${visibleGreeting} ` : ''}${scene.title}. ${scene.text}`;

  useEffect(() => { const controller = new AbortController(); void fetchNarrationVoices(controller.signal).then(setNarrationVoices).catch(() => {}); return () => controller.abort(); }, []);
  useEffect(() => {
    const controller = new AbortController(); setNarrationManifest(null); generatedPlayer.current?.stop();
    if (release && !accessLocked && narrationVoices.active) void fetchNarrationManifest(world, release.contentVersion, band, narrationSlot, controller.signal).then(value => { if (!controller.signal.aborted) setNarrationManifest(value); }).catch(() => {});
    return () => controller.abort();
  }, [release, world, band, narrationSlot, narrationVoices.active, narrationScope, accessLocked]);
  useEffect(() => {
    generatedPlayer.current?.stop(); localAudioRelease.current?.(); localAudioRelease.current = null;
    if (continueRequested.current && narrationManifest && !muted && !accessLocked) { continueRequested.current = false; void readGenerated(); }
  }, [picks.join(''), narrationManifest, profileId, band, narrationSlot, narrationScope, muted, accessLocked]);
  useEffect(() => {
    const stop = () => { continueRequested.current = false; generatedPlayer.current?.stop(); localAudioRelease.current?.(); localAudioRelease.current = null; voiceToken.current++; if ('speechSynthesis' in window) window.speechSynthesis.cancel(); setVoiceState('idle'); };
    window.addEventListener('fabelpad-storage-scope-change', stop); window.addEventListener('fabelpad-parent-data-cleared', stop); window.addEventListener('fabelpad-profile-data-cleared', stop);
    return () => { stop(); window.removeEventListener('fabelpad-storage-scope-change', stop); window.removeEventListener('fabelpad-parent-data-cleared', stop); window.removeEventListener('fabelpad-profile-data-cleared', stop); };
  }, []);


  useLayoutEffect(() => {
    if (!release || !focusNextScene.current) return;
    // The new scene, ending or access gate is already mounted. Never let an
    // outgoing animation or a play instruction move focus back to the choices.
    focusNextScene.current = false;
    scrollRef.current?.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    sceneHeadingRef.current?.focus({ preventScroll: true });
  }, [release, picks.length, accessLocked]);

  useLayoutEffect(() => {
    if (modeScrollRestore.current === null) return;
    const top = modeScrollRestore.current;
    modeScrollRestore.current = null;
    scrollRef.current?.scrollTo({ top, behavior: 'instant' });
    modeButtonRef.current?.focus({ preventScroll: true });
  }, [playEnabled]);

  useEffect(() => {
    const memory = backfillStoryMemory(profileId, childName);
    setGreeting(isStoryId(world)?continuityGreeting(memory, world, childName):null);
    if(isStoryId(world))openStoryThread(profileId, world, picks);
    // A visit must not re-date old choices. Only choose() records a new event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, world, childName]);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const unlockScroll = lockBodyScroll();
    const frame = requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus());
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); }
      if (event.key !== 'Tab') return;
      const items = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input, select:not([disabled]), [tabindex="0"]');
      if (!items?.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKey);
      unlockScroll();
      generatedPlayer.current?.stop();
      voiceToken.current += 1;
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      previouslyFocused?.focus();
    };
  }, []);

  useEffect(() => {
    if (release && !replayRoute) setDurable(saveChild(profileId, `story-${world}`, { picks: currentPicks.current, ...(lastCompletedPicks ? { lastCompletedPicks, lastCompletedContentVersion: lastCompletedVersion.current ?? release.contentVersion } : {}), updatedAt: saved?.updatedAt || Date.now(), storyId: world, contentVersion: release.contentVersion, revision: revision.current }));
    generatedPlayer.current?.stop();
    voiceToken.current += 1;
    if (speechAvailable) window.speechSynthesis.cancel();
    setVoiceState('idle');
  }, [release, profileId, world, speechAvailable]);

  useEffect(() => {
    generatedPlayer.current?.stop();
    voiceToken.current += 1;
    if (speechAvailable) window.speechSynthesis.cancel();
    setVoiceState('idle');
  }, [band, speechAvailable]);

  useEffect(() => {
    if (muted) { continueRequested.current = false; generatedPlayer.current?.stop(); voiceToken.current += 1; if ('speechSynthesis' in window) window.speechSynthesis.cancel(); setVoiceState('idle'); }
  }, [muted, speechAvailable]);

  useEffect(() => {
    const stop = (event: Event) => { if (event.type === 'pagehide' || document.visibilityState === 'hidden') { continueRequested.current = false; generatedPlayer.current?.stop(); voiceToken.current += 1; if (speechAvailable) window.speechSynthesis.cancel(); setVoiceState('idle'); } };
    document.addEventListener('visibilitychange', stop); window.addEventListener('pagehide', stop);
    return () => { document.removeEventListener('visibilitychange', stop); window.removeEventListener('pagehide', stop); };
  }, [speechAvailable]);

  function requestClose() {
    if (closeRequested.current) return;
    closeRequested.current = true;
    setClosing(true);
    generatedPlayer.current?.stop();
    voiceToken.current += 1;
    if (speechAvailable) window.speechSynthesis.cancel();
    onClose();
  }

  function choose(index: number) {
    if (!release || accessLocked || closeRequested.current || (index !== 0 && index !== 1) || picks.length >= TOTAL || currentPicks.current.length !== picks.length) return;
    continueRequested.current = continuousNarration && speechOrigin.current === 'generated' && ['speaking', 'loading'].includes(voiceState);
    const next = [...picks, index];
    currentPicks.current = next;
    if (!replayRoute) {
      if (cloudContent) reportConsciousReading(profileId);
      revision.current += 1;
      const completedRoute = next.length === TOTAL ? next : lastCompletedPicks;
      if (next.length === TOTAL) { setLastCompletedPicks(next); lastCompletedVersion.current = release.contentVersion; }
      setDurable(saveChild(profileId, `story-${world}`, { picks: next, ...(completedRoute ? { lastCompletedPicks: completedRoute, lastCompletedContentVersion: lastCompletedVersion.current ?? release.contentVersion } : {}), updatedAt: Date.now(), storyId: world, contentVersion: release.contentVersion, revision: revision.current }));
      if(isStoryId(world))recordStoryProgress(profileId, world, next, childName);
    }
    generatedPlayer.current?.stop();
    voiceToken.current += 1; if (speechAvailable) window.speechSynthesis.cancel(); setVoiceState('idle');
    setModePageMinHeight(0);
    focusNextScene.current = true;
    setPicks(next);
    if (next.length === TOTAL && !replayRoute) onComplete(world, personalText((levelContent?.endings ?? release.endings)[next.join('')].title, childName));
  }

  function restart(route?: number[]) {
    if (!release || closeRequested.current || currentPicks.current.length !== TOTAL) return;
    focusNextScene.current = true;
    setModePageMinHeight(0);
    continueRequested.current = false;
    setReplayRoute(route ?? null);
    setGreeting(route ? null : (isStoryId(world)?continuityGreeting(getStoryMemory(profileId), world, childName):null));
    currentPicks.current = [];
    if (!route) {
      if(isStoryId(world))openStoryThread(profileId, world, []);
      revision.current += 1;
      setDurable(saveChild(profileId, `story-${world}`, { picks: [], ...(lastCompletedPicks ? { lastCompletedPicks, lastCompletedContentVersion: lastCompletedVersion.current ?? release.contentVersion } : {}), updatedAt: Date.now(), storyId: world, contentVersion: release.contentVersion, revision: revision.current }));
    }
    generatedPlayer.current?.stop();
    voiceToken.current += 1;
    if (speechAvailable) window.speechSynthesis.cancel();
    setVoiceState('idle');
    setPicks([]);
  }

  function togglePlay(button: HTMLButtonElement) {
    const layout = scrollRef.current;
    const page = pageRef.current;
    if (layout && page) {
      const pageTop = page.getBoundingClientRect().top - layout.getBoundingClientRect().top + layout.scrollTop;
      // A shorter button list must not clamp the reader's current scroll
      // position. Keep only the already-visible viewport, not an empty scene.
      setModePageMinHeight(Math.max(0, Math.ceil(layout.scrollTop + layout.clientHeight - pageTop)));
      modeScrollRestore.current = layout.scrollTop;
    }
    setPlayEnabled(value => !value);
    button.focus({ preventScroll: true });
  }

  function readText(text: string) {
    if (!speechAvailable || muted) return;
    generatedPlayer.current?.stop(); speechOrigin.current = 'local';
    localAudioRelease.current?.(); localAudioRelease.current = claimNarrationAudio(() => { voiceToken.current++; window.speechSynthesis.cancel(); setVoiceState('idle'); });
    const synth = window.speechSynthesis;
    const token = ++voiceToken.current;
    synth.cancel();
    const voice = selectLocalDutchVoice(synth.getVoices());
    if (!voice) { setLocalVoice(null); setVoiceState('idle'); return; }
    const utterance = new SpeechSynthesisUtterance(privateSpeechText(text, childName));
    utterance.lang = 'nl-NL';
    utterance.rate = 0.88;
    utterance.voice = voice;
    const idle = () => { if (voiceToken.current === token) { setVoiceState('idle'); localAudioRelease.current?.(); localAudioRelease.current = null; } };
    utterance.onend = idle;
    utterance.onerror = idle;
    synth.speak(utterance);
    setVoiceState('speaking');
  }

  async function readGenerated(choiceIndex?: number) {
    if (!narrationManifest || muted || accessLocked || closeRequested.current) return;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    voiceToken.current++; localAudioRelease.current?.(); localAudioRelease.current = null;
    speechOrigin.current = 'generated'; setNarrationMessage('');
    if (!generatedPlayer.current) generatedPlayer.current = new WebNarrationPlayer((state, message) => { setVoiceState(state); if (message) setNarrationMessage(message); });
    const route = complete ? picks.join('') : picks.slice(0, sceneStep).join('');
    const segments = segmentsForRoute(narrationManifest, route, choiceIndex !== undefined ? 'choice' : complete ? 'ending' : 'scene', choiceIndex);
    await generatedPlayer.current.play(narrationManifest, segments, profileId, () => {
      continueRequested.current = false;
      setNarrationMessage('De AI-audio is nu niet beschikbaar. Je kunt met de lokale apparaatstem of samen verder lezen.');
      if (speechAvailable && !muted && !closeRequested.current) readText(choiceIndex === undefined ? activeText : `${scene.choices[choiceIndex]?.label ?? ''}. ${scene.choices[choiceIndex]?.hint ?? ''}`);
    });
  }
  function toggleSpeech() {
    if (muted) return;
    if (speechOrigin.current === 'generated' && generatedPlayer.current && ['speaking', 'paused', 'loading'].includes(voiceState)) {
      if (voiceState === 'paused') generatedPlayer.current.resume(); else generatedPlayer.current.pause(); return;
    }
    if (voiceState === 'speaking' && speechAvailable) { window.speechSynthesis.pause(); setVoiceState('paused'); return; }
    if (voiceState === 'paused' && speechAvailable) { window.speechSynthesis.resume(); setVoiceState('speaking'); return; }
    if (narrationManifest && !accessLocked) void readGenerated(); else readText(activeText);
  }
  function repeatSpeech() { generatedPlayer.current?.stop(); if ('speechSynthesis' in window) window.speechSynthesis.cancel(); setVoiceState('idle'); if (narrationManifest && !accessLocked) void readGenerated(); else readText(activeText); }


  if (!release || releaseError) return <div className="reader-backdrop"><div className="modal" role="dialog" aria-modal="true" aria-label="Verhaal openen"><h2>{releaseError ? 'Een klein omweggetje.' : 'We leggen je verhaal klaar…'}</h2><p role="status">{releaseError || 'De tekst en de bewaarde verhaalversie worden opgehaald.'}</p><button className="account-primary" onClick={requestClose}>Terug naar de verhalen</button></div></div>;

  return <motion.div className="reader-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: calmMotion ? 0 : .22 }}>
    <div ref={dialogRef} className={`reader-shell reader-world-${world} ${textSize === 'large' ? 'reader-large-text' : ''}`} role="dialog" aria-modal="true" aria-labelledby="reader-story-title">
      <header className="reader-topbar">
        <button className="reader-back" onClick={requestClose} aria-label="Terug naar je verhalen"><ArrowLeft size={20} /><span>Mijn verhalen</span></button>
        <div className="reader-book-title" id="reader-story-title"><BookOpen size={16} />{metadata.title}</div>
        <button className="reader-close" onClick={requestClose} aria-label="Verhaal sluiten"><X size={21} /></button>
      </header>
      <div ref={scrollRef} className="reader-layout">
        <div className="reader-art">
          <motion.img src={metadata.image} alt={metadata.imageAlt} initial={{ scale: calmMotion ? 1 : 1.04 }} animate={{ scale: 1 }} transition={{ duration: calmMotion ? 0 : 1.2 }} />
          <div className="reader-art-shade" />
          <span className="reader-art-badge"><Sparkles size={15} />Het avontuur van {childName}</span>
          <div className="reader-art-caption"><span>Fabelpad presenteert</span><p>{metadata.title}</p><small>Een kleine keuze. Een wereld vol verhalen.</small></div>
        </div>
        <div ref={pageRef} className="reader-page" style={modePageMinHeight && !accessLocked && !complete ? { minHeight: modePageMinHeight } : undefined}>
          <div className="reader-progress-row"><span>{complete ? 'Jouw avontuur is compleet' : `Deel ${picks.length + 1} van ${TOTAL}`}</span><div className="reader-progress-dots" aria-label={`${Math.min(picks.length + 1, TOTAL)} van ${TOTAL} delen`}>{Array.from({ length: TOTAL }, (_, i) => <i key={i} className={i <= picks.length ? 'is-active' : ''} />)}</div></div>
          {!accessLocked && !levelContent && <p className="reader-level-note">Deze bewaarde verhaalversie gebruikt de oorspronkelijke tekst.</p>}
          {visibleGreeting && !complete && <div className="reader-continuity"><Sparkles size={17} /><span>{visibleGreeting}</span></div>}
          {accessLocked ? <div className="reader-access-gate"><Sparkles size={34} /><span className="reader-eyebrow">ER WACHT NOG EEN HELE WERELD</span><h2 ref={sceneHeadingRef} tabIndex={-1}>Samen een nieuw<br />pad ontdekken?</h2><p>{limit === 1 ? 'Je eerste deel is uit. Je keuze en je plek blijven bewaard.' : 'Dit verhaal hoort bij het gezinspakket.'} Vraag een grote avonturier om samen te kijken.</p><button className="reader-primary" onClick={() => { requestClose(); onRequestParents?.(); }}>Even voor de ouders <ArrowRight size={17} /></button><button className="reader-restart" onClick={requestClose}>Terug naar de verhalen</button><small>Je leesplek blijft bewaard.</small></div> :
            <motion.div className="reader-scene" key={picks.length} initial={{ opacity: 0, y: calmMotion ? 0 : 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: calmMotion ? 0 : .2 }}>
              {complete && <div className="reader-ending-icon"><Check size={27} /></div>}
              <p className="reader-eyebrow">{complete ? 'Een einde dat jij hebt gekozen' : picks.length === 0 ? 'Er was eens…' : 'En toen…'}</p>
              <h2 ref={sceneHeadingRef} tabIndex={-1}>{complete ? ending.title : scene.title}</h2>
              <div className="reader-story-text">{(complete ? ending.text : scene.text).split(/\n\s*\n/u).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
              {complete ? <>
                <div className="reader-keepsake"><Sparkles size={23} /><div><span>Een herinnering voor je verzameling</span><strong>{ending.keepsake}</strong></div></div>
                <div className="reader-ending-actions"><button className="reader-primary" onClick={requestClose}>Terug naar de wereld <ArrowRight size={18} /></button>{lastCompletedPicks && <button className="reader-restart" onClick={() => restart(lastCompletedPicks)}><BookOpen size={17} />Lees je route opnieuw</button>}<button className="reader-restart" onClick={() => restart()}><RotateCcw size={17} />Een ander pad ontdekken</button></div>
              </> : replayRoute ? <div className="reader-choice-section reader-replay"><p>Je leest de keuzes van je laatst voltooide route.</p><button className="reader-primary" onClick={() => choose(replayRoute[sceneStep])}>{scene.choices[replayRoute[sceneStep]].label}<ArrowRight size={18} /></button></div> : <section className="reader-choice-section" aria-labelledby="reader-choice-title">
                <div className="reader-choice-heading"><h3 id="reader-choice-title">Wat kies jij?</h3>{canPlay && <button ref={modeButtonRef} className="reader-mode" onClick={event => togglePlay(event.currentTarget)} aria-pressed={playEnabled} aria-controls="reader-choice-content">{playEnabled ? 'Naar leesmodus' : 'Naar speelmodus'}</button>}</div>
                <div className="reader-choice-listen" role="group" aria-label="Keuzezinnen beluisteren">{scene.choices.map((choice, index) => <button type="button" key={index} disabled={muted || !narrationManifest && !speechAvailable} onClick={() => narrationManifest ? void readGenerated(index) : readText(`${choice.label}. ${choice.hint}`)}><Play size={13} aria-hidden="true" />Keuze {index + 1} beluisteren</button>)}</div>
                <div id="reader-choice-content">{showPlay && specialPlay ? <div className="reader-play-panel"><StationPlayScene key={`${world}-${picks.length}`} step={picks.length as 0 | 1} previousChoice={picks[0]} childName={childName} muted={muted} reducedMotion={calmMotion} onChoose={choose} onReadInstruction={readText} /></div> : showPlay ? <IllustratedChoiceScene {...playArt} choices={scene.choices} reducedMotion={calmMotion} onChoose={choose} /> : <div className="reader-choices">{scene.choices.map((choice, i) => { const Icon = iconMap[choice.icon]; return <motion.button key={choice.label} className="reader-choice" onClick={() => choose(i)} whileHover={calmMotion ? undefined : { y: -3 }} whileTap={calmMotion ? undefined : { scale: .98 }}><span className="reader-choice-icon"><Icon size={23} /></span><span><strong>{choice.label}</strong><small>{choice.hint}</small></span><ArrowRight className="reader-choice-arrow" size={20} /></motion.button>; })}</div>}</div>
              </section>}
            </motion.div>
          }
          <footer className="reader-controls"><button className={`reader-speech ${['speaking', 'paused', 'loading'].includes(voiceState) ? 'is-speaking' : ''}`} disabled={(!speechAvailable && !narrationManifest) || muted} onClick={toggleSpeech} title={!speechAvailable && !narrationManifest ? 'Er is geen vrijgegeven audio of offline Nederlandse stem beschikbaar. Lees samen verder of installeer een offline stem in je apparaatinstellingen.' : muted ? 'Zet het geluid aan in het ouderhoekje om te luisteren' : undefined}>{muted ? <VolumeX size={17} /> : voiceState === 'speaking' || voiceState === 'loading' ? <Pause size={17} /> : <Play size={17} fill="currentColor" />}<span>{muted ? 'Geluid staat uit' : voiceState === 'loading' ? 'Audio laden…' : voiceState === 'speaking' ? 'Even pauzeren' : voiceState === 'paused' ? 'Verder luisteren' : !speechAvailable && !narrationManifest ? 'Lees gezellig samen' : 'Lees voor'}</span></button><span className="reader-saved" role="status"><Check size={13} />{replayRoute ? 'Je leest jouw vorige route' : durable ? 'Je plek staat op dit apparaat' : 'Bewaren lukt niet · houd dit venster open'}</span></footer>
          <div className="reader-narration-extra"><span>{narrationManifest ? `AI-voorleesstem · ${narrationManifest.voice.label}` : speechAvailable ? 'Lokale Nederlandse apparaatstem' : 'Lees samen verder'}</span>{(speechAvailable || narrationManifest) && <button type="button" disabled={muted} onClick={repeatSpeech}><RotateCcw size={14} aria-hidden="true" />Opnieuw luisteren</button>}{narrationManifest && <label><input type="checkbox" checked={continuousNarration} onChange={event => setContinuousNarration(event.target.checked)} />Na mijn keuze verder voorlezen</label>}</div>
          {narrationMessage && <p className="reader-speech-note" role="status">{narrationMessage}</p>}{!speechAvailable && !narrationManifest && <p className="reader-speech-note">De nieuwe voorleesstemmen zijn voor deze versie nog niet beschikbaar. Voorlezen kan ook met een geïnstalleerde offline Nederlandse stem. Lees ondertussen gezellig samen.</p>}

        </div>
      </div>
    </div>
  </motion.div>;
}
