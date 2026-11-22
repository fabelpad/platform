import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, ArrowRight, BookOpen, Check, Compass, Heart, Leaf, Moon, Music2, Pause, Play, RotateCcw, Sparkles, VolumeX, X } from 'lucide-react';
import { getEnding, getScene } from './storyData';
import { DEFAULT_READING_LEVEL, READING_LEVELS, isReadingLevel } from './readingLevel';
import type { ReadingLevel } from './readingLevel';
import IllustratedChoiceScene from './IllustratedChoiceScene';
import { storyPlayArt } from './storyPlayArt';
import { readingLevelsForRelease } from './contentReadingLevels';
import { readChild, saveChild } from './profileStorage';
import { backfillStoryMemory, continuityGreeting, getStoryMemory, openStoryThread, recordStoryProgress } from './storyMemory';
import { isStoryId, STORY_PARTS } from './storyCatalog';
import { worlds } from './worlds';
import { loadContentRelease, personalText } from './contentClient';
import type { ContentRelease } from '../lib/server/content';
import StationPlayScene from './StationPlayScene';
import { lockBodyScroll } from './modalScroll';
import { privateSpeechText, selectLocalDutchVoice } from './offlineSpeech';
import { reportConsciousReading } from './parentActivity';
import './reader.css';
import './memory.css';
import './reader-extended.css';

type Props = { profileId: string; worldId: string; childName: string; muted: boolean; reducedMotion: boolean; textSize?: 'normal' | 'large'; readingLevel?: ReadingLevel; onReadingLevelChange: (value: ReadingLevel) => void; cloudContent?: boolean; previewLimit?: number; onRequestParents?: () => void; onClose: () => void; onComplete: (worldId: string, endingTitle: string) => void };
type Saved = { picks: number[]; updatedAt: number; contentVersion?: string; revision?: number; storyId?: string; lastCompletedPicks?: number[]; lastCompletedContentVersion?: string };
const iconMap = { heart: Heart, sparkles: Sparkles, music: Music2, moon: Moon, leaf: Leaf, compass: Compass };
const TOTAL = STORY_PARTS;

function loadPicks(profileId: string, world: string): number[] {
  try {
    const saved = readChild<Saved | null>(profileId, `story-${world}`, null);
    return saved && Array.isArray(saved.picks) && saved.picks.length <= TOTAL && saved.picks.every(v => v === 0 || v === 1) ? saved.picks : [];
  } catch { return []; }
}

export default function StoryReader({ profileId, worldId, childName, muted, reducedMotion, textSize, readingLevel, onReadingLevelChange, cloudContent = false, previewLimit, onRequestParents, onClose, onComplete }: Props) {
  const systemReducedMotion = useReducedMotion();
  const calmMotion = reducedMotion || systemReducedMotion === true;
  const world = isStoryId(worldId) ? worldId : 'station';
  const [saved] = useState(() => readChild<Saved | null>(profileId, `story-${world}`, null));
  const [release, setRelease] = useState<ContentRelease | null>(null);
  const [releaseError, setReleaseError] = useState('');
  const [durable, setDurable] = useState(false);
  const revision = useRef(saved?.revision || 0);
  const metadata = { ...worlds.find(item => item.id === world)!, ...release?.metadata };
  useEffect(() => { let active = true; loadContentRelease(world, saved?.contentVersion, cloudContent).then(value => { if (active) setRelease(value); }).catch(error => { if (active) setReleaseError(error.message || 'Dit verhaal kan nu niet worden geopend. Je keuzes blijven bewaard.'); }); return () => { active = false; }; }, [world, saved?.contentVersion, cloudContent]);
  const [picks, setPicks] = useState(() => loadPicks(profileId, world));
  const [lastCompletedPicks, setLastCompletedPicks] = useState<number[] | undefined>(() => {
    const route = saved?.lastCompletedPicks ?? saved?.picks;
    return Array.isArray(route) && route.length === TOTAL && route.every(pick => pick === 0 || pick === 1) ? route : undefined;
  });
  const lastCompletedVersion = useRef(saved?.lastCompletedContentVersion ?? (picks.length === TOTAL ? saved?.contentVersion : undefined));
  const [replayRoute, setReplayRoute] = useState<number[] | null>(null);
  const [voiceState, setVoiceState] = useState<'idle' | 'speaking' | 'paused'>('idle');
  const [playEnabled, setPlayEnabled] = useState(true);
  const [modePageMinHeight, setModePageMinHeight] = useState(0);
  const [closing, setClosing] = useState(false);
  const closeRequested = useRef(false);
  const [greeting, setGreeting] = useState(() => continuityGreeting(getStoryMemory(profileId), world, childName));
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
  const accessLocked = previewLimit !== undefined && picks.length >= previewLimit;
  const band = isReadingLevel(readingLevel) ? readingLevel : DEFAULT_READING_LEVEL;
  const levelContent = release ? readingLevelsForRelease(release)?.[band] : undefined;
  const canPlay = !accessLocked && !complete && !replayRoute;
  const specialPlay = world === 'station' && picks.length < 2;
  const showPlay = canPlay && playEnabled && !closing;
  const rawEnding = (levelContent?.endings ?? release?.endings)?.[picks.join('')] || getEnding(world, picks, childName);
  const ending = { ...rawEnding, title: personalText(rawEnding.title, childName), text: personalText(rawEnding.text, childName), keepsake: personalText(rawEnding.keepsake, childName) };
  const sceneStep = Math.min(picks.length, TOTAL - 1);
  const originalScene = (levelContent?.scenes ?? release?.scenes)?.[picks.slice(0, sceneStep).join('')] || getScene(world, sceneStep, picks, childName);
  const scene = { ...originalScene, title: personalText(originalScene.title, childName), text: personalText(originalScene.text, childName), choices: originalScene.choices.map(choice => ({...choice,label:personalText(choice.label,childName),hint:personalText(choice.hint,childName)})) };
  const playArt = storyPlayArt[world] ?? { image: metadata.image, imageAlt: metadata.imageAlt };
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
    setGreeting(continuityGreeting(memory, world, childName));
    openStoryThread(profileId, world, picks);
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
      voiceToken.current += 1;
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      previouslyFocused?.focus();
    };
  }, []);

  useEffect(() => {
    if (release && !replayRoute) setDurable(saveChild(profileId, `story-${world}`, { picks: currentPicks.current, ...(lastCompletedPicks ? { lastCompletedPicks, lastCompletedContentVersion: lastCompletedVersion.current ?? release.contentVersion } : {}), updatedAt: saved?.updatedAt || Date.now(), storyId: world, contentVersion: release.contentVersion, revision: revision.current }));
    voiceToken.current += 1;
    if (speechAvailable) window.speechSynthesis.cancel();
    setVoiceState('idle');
  }, [release, profileId, world, speechAvailable]);

  useEffect(() => {
    voiceToken.current += 1;
    if (speechAvailable) window.speechSynthesis.cancel();
    setVoiceState('idle');
  }, [band, speechAvailable]);

  useEffect(() => {
    if (muted && speechAvailable) { voiceToken.current += 1; window.speechSynthesis.cancel(); setVoiceState('idle'); }
  }, [muted, speechAvailable]);

  useEffect(() => {
    const stop = (event: Event) => { if (event.type === 'pagehide' || document.visibilityState === 'hidden') { voiceToken.current += 1; if (speechAvailable) window.speechSynthesis.cancel(); setVoiceState('idle'); } };
    document.addEventListener('visibilitychange', stop); window.addEventListener('pagehide', stop);
    return () => { document.removeEventListener('visibilitychange', stop); window.removeEventListener('pagehide', stop); };
  }, [speechAvailable]);

  function requestClose() {
    if (closeRequested.current) return;
    closeRequested.current = true;
    setClosing(true);
    voiceToken.current += 1;
    if (speechAvailable) window.speechSynthesis.cancel();
    onClose();
  }

  function choose(index: number) {
    if (!release || accessLocked || closeRequested.current || (index !== 0 && index !== 1) || picks.length >= TOTAL || currentPicks.current.length !== picks.length) return;
    const next = [...picks, index];
    currentPicks.current = next;
    if (!replayRoute) {
      if (cloudContent) reportConsciousReading(profileId);
      revision.current += 1;
      const completedRoute = next.length === TOTAL ? next : lastCompletedPicks;
      if (next.length === TOTAL) { setLastCompletedPicks(next); lastCompletedVersion.current = release.contentVersion; }
      setDurable(saveChild(profileId, `story-${world}`, { picks: next, ...(completedRoute ? { lastCompletedPicks: completedRoute, lastCompletedContentVersion: lastCompletedVersion.current ?? release.contentVersion } : {}), updatedAt: Date.now(), storyId: world, contentVersion: release.contentVersion, revision: revision.current }));
      recordStoryProgress(profileId, world, next, childName);
    }
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
    setReplayRoute(route ?? null);
    setGreeting(route ? null : continuityGreeting(getStoryMemory(profileId), world, childName));
    currentPicks.current = [];
    if (!route) {
      openStoryThread(profileId, world, []);
      revision.current += 1;
      setDurable(saveChild(profileId, `story-${world}`, { picks: [], ...(lastCompletedPicks ? { lastCompletedPicks, lastCompletedContentVersion: lastCompletedVersion.current ?? release.contentVersion } : {}), updatedAt: Date.now(), storyId: world, contentVersion: release.contentVersion, revision: revision.current }));
    }
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
    const synth = window.speechSynthesis;
    const token = ++voiceToken.current;
    synth.cancel();
    const voice = selectLocalDutchVoice(synth.getVoices());
    if (!voice) { setLocalVoice(null); setVoiceState('idle'); return; }
    const utterance = new SpeechSynthesisUtterance(privateSpeechText(text, childName));
    utterance.lang = 'nl-NL';
    utterance.rate = 0.88;
    utterance.voice = voice;
    const idle = () => { if (voiceToken.current === token) setVoiceState('idle'); };
    utterance.onend = idle;
    utterance.onerror = idle;
    synth.speak(utterance);
    setVoiceState('speaking');
  }

  function toggleSpeech() {
    if (!speechAvailable || muted) return;
    const synth = window.speechSynthesis;
    if (voiceState === 'speaking') { synth.pause(); setVoiceState('paused'); return; }
    if (voiceState === 'paused') { synth.resume(); setVoiceState('speaking'); return; }
    readText(activeText);
  }

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
          <span className="reader-art-badge"><Sparkles size={15} />Dit is jouw avontuur</span>
          <div className="reader-art-caption"><span>Fabelpad presenteert</span><p>{metadata.title}</p><small>Een kleine keuze. Een wereld vol verhalen.</small></div>
        </div>
        <div ref={pageRef} className="reader-page" style={modePageMinHeight && !accessLocked && !complete ? { minHeight: modePageMinHeight } : undefined}>
          <div className="reader-progress-row"><span>{complete ? 'Jouw avontuur is compleet' : `Deel ${picks.length + 1} van ${TOTAL}`}</span><div className="reader-progress-dots" aria-label={`${Math.min(picks.length + 1, TOTAL)} van ${TOTAL} delen`}>{Array.from({ length: TOTAL }, (_, i) => <i key={i} className={i <= picks.length ? 'is-active' : ''} />)}</div></div>
          {!accessLocked && <div className="reader-level-row"><label className="reader-level">Leesniveau <select value={band} disabled={!levelContent} aria-describedby={!levelContent ? 'reader-level-legacy' : undefined} onChange={event => { if (isReadingLevel(event.target.value)) onReadingLevelChange(event.target.value); }}>{READING_LEVELS.map(level => <option key={level.id} value={level.id}>{level.label}</option>)}</select></label>{!levelContent && <p id="reader-level-legacy" className="reader-level-note">Deze bewaarde verhaalversie gebruikt de oorspronkelijke tekst. Nieuwe avonturen gebruiken je leesniveau.</p>}</div>}
          {visibleGreeting && !complete && <div className="reader-continuity"><Sparkles size={17} /><span>{visibleGreeting}</span></div>}
          {accessLocked ? <div className="reader-access-gate"><Sparkles size={34} /><span className="reader-eyebrow">ER WACHT NOG EEN HELE WERELD</span><h2 ref={sceneHeadingRef} tabIndex={-1}>Samen een nieuw<br />pad ontdekken?</h2><p>{previewLimit === 1 ? 'Je eerste deel is uit. Je keuze en je plek blijven bewaard.' : 'Dit verhaal hoort bij het gezinspakket.'} Vraag een grote avonturier om samen te kijken.</p><button className="reader-primary" onClick={() => { requestClose(); onRequestParents?.(); }}>Even voor de ouders <ArrowRight size={17} /></button><button className="reader-restart" onClick={requestClose}>Terug naar de verhalen</button><small>Voorbeeld van gratis toegang · er wordt niets gekocht.</small></div> :
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
                <div id="reader-choice-content">{showPlay && specialPlay ? <div className="reader-play-panel"><StationPlayScene key={`${world}-${picks.length}`} step={picks.length as 0 | 1} previousChoice={picks[0]} childName={childName} muted={muted} reducedMotion={calmMotion} onChoose={choose} onReadInstruction={readText} /></div> : showPlay ? <IllustratedChoiceScene {...playArt} choices={scene.choices} reducedMotion={calmMotion} onChoose={choose} /> : <div className="reader-choices">{scene.choices.map((choice, i) => { const Icon = iconMap[choice.icon]; return <motion.button key={choice.label} className="reader-choice" onClick={() => choose(i)} whileHover={calmMotion ? undefined : { y: -3 }} whileTap={calmMotion ? undefined : { scale: .98 }}><span className="reader-choice-icon"><Icon size={23} /></span><span><strong>{choice.label}</strong><small>{choice.hint}</small></span><ArrowRight className="reader-choice-arrow" size={20} /></motion.button>; })}</div>}</div>
              </section>}
            </motion.div>
          }
          <footer className="reader-controls"><button className={`reader-speech ${voiceState !== 'idle' ? 'is-speaking' : ''}`} disabled={!speechAvailable || muted} onClick={toggleSpeech} title={!speechAvailable ? 'Er is geen offline Nederlandse stem beschikbaar. Lees samen verder of installeer een offline stem in je apparaatinstellingen.' : muted ? 'Zet het geluid aan in het ouderhoekje om te luisteren' : undefined}>{muted ? <VolumeX size={17} /> : voiceState === 'speaking' ? <Pause size={17} /> : <Play size={17} fill="currentColor" />}<span>{!speechAvailable ? 'Lees gezellig samen' : muted ? 'Geluid staat uit' : voiceState === 'speaking' ? 'Even pauzeren' : voiceState === 'paused' ? 'Verder luisteren' : 'Lees voor'}</span></button><span className="reader-saved" role="status"><Check size={13} />{replayRoute ? 'Je leest jouw vorige route' : durable ? 'Je plek staat op dit apparaat' : 'Bewaren lukt niet · houd dit venster open'}</span></footer>{!speechAvailable && <p className="reader-speech-note">Voorlezen kan met een geïnstalleerde offline Nederlandse stem. Lees ondertussen gezellig samen.</p>}
        </div>
      </div>
    </div>
  </motion.div>;
}
