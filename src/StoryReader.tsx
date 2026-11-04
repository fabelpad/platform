import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ArrowRight, BookOpen, Check, Compass, Heart, Leaf, Moon, Music2, Pause, Play, RotateCcw, Sparkles, VolumeX, X } from 'lucide-react';
import { getEnding, getScene } from './storyData';
import { readChild, saveChild } from './profileStorage';
import { backfillStoryMemory, continuityGreeting, getStoryMemory, openStoryThread, recordStoryProgress } from './storyMemory';
import { isStoryId, STORY_PARTS } from './storyCatalog';
import { worlds } from './worlds';
import { getPublishedMetadata, getPublishedScene } from './editorialStore';
import StationPlayScene from './StationPlayScene';
import { lockBodyScroll } from './modalScroll';
import './reader.css';
import './memory.css';
import './reader-extended.css';

type Props = { profileId: string; worldId: string; childName: string; muted: boolean; reducedMotion: boolean; textSize?: 'normal' | 'large'; previewLimit?: number; onRequestParents?: () => void; onClose: () => void; onComplete: (worldId: string, endingTitle: string) => void };
type Saved = { picks: number[]; updatedAt: number };
const iconMap = { heart: Heart, sparkles: Sparkles, music: Music2, moon: Moon, leaf: Leaf, compass: Compass };
const TOTAL = STORY_PARTS;

function loadPicks(profileId: string, world: string): number[] {
  try {
    const saved = readChild<Saved | null>(profileId, `story-${world}`, null);
    return saved && Array.isArray(saved.picks) && saved.picks.length <= TOTAL && saved.picks.every(v => v === 0 || v === 1) ? saved.picks : [];
  } catch { return []; }
}

export default function StoryReader({ profileId, worldId, childName, muted, reducedMotion, textSize, previewLimit, onRequestParents, onClose, onComplete }: Props) {
  const world = isStoryId(worldId) ? worldId : 'station';
  const [publication] = useState(() => ({ metadata: getPublishedMetadata(world), scenes: Array.from({ length: TOTAL }, (_, i) => getPublishedScene(world, i)) }));
  const metadata = { ...worlds.find(item => item.id === world)!, ...publication.metadata };
  const [picks, setPicks] = useState(() => loadPicks(profileId, world));
  const [voiceState, setVoiceState] = useState<'idle' | 'speaking' | 'paused'>('idle');
  const [playEnabled, setPlayEnabled] = useState(true);
  const [closing, setClosing] = useState(false);
  const closeRequested = useRef(false);
  const [greeting, setGreeting] = useState(() => continuityGreeting(getStoryMemory(profileId), world, childName));
  const dialogRef = useRef<HTMLDivElement>(null);
  const sceneHeadingRef = useRef<HTMLHeadingElement>(null);
  const focusNextScene = useRef(false);
  const currentPicks = useRef(picks);
  currentPicks.current = picks;
  const voiceToken = useRef(0);
  const playPanel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = requestClose;
  const complete = picks.length === TOTAL;
  const accessLocked = previewLimit !== undefined && picks.length >= previewLimit;
  const canPlay = !accessLocked && world === 'station' && picks.length < 2;
  const showPlay = canPlay && playEnabled && !closing;
  const ending = getEnding(world, picks, childName);
  const sceneStep = Math.min(picks.length, TOTAL - 1);
  const originalScene = getScene(world, sceneStep, picks, childName);
  const sceneOverride = publication.scenes[sceneStep];
  const scene = { ...originalScene, ...(sceneOverride?.title === undefined ? {} : { title: sceneOverride.title.replaceAll('{{naam}}', childName) }), ...(sceneOverride?.text === undefined ? {} : { text: sceneOverride.text.replaceAll('{{naam}}', childName) }) };
  const speechAvailable = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const activeText = accessLocked ? 'Dit avontuur gaat verder in het gezinspakket. Vraag een grote avonturier om samen te kijken.' : complete ? `${ending.title}. ${ending.text}` : `${picks.length === 0 && greeting ? `${greeting} ` : ''}${scene.title}. ${scene.text}`;

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
      const items = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input, [tabindex="0"]');
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
    saveChild(profileId, `story-${world}`, { picks, updatedAt: Date.now() });
    voiceToken.current += 1;
    if (speechAvailable) window.speechSynthesis.cancel();
    setVoiceState('idle');
  }, [picks, profileId, world, speechAvailable]);

  useEffect(() => {
    if (muted && speechAvailable) { voiceToken.current += 1; window.speechSynthesis.cancel(); setVoiceState('idle'); }
  }, [muted, speechAvailable]);

  function requestClose() {
    if (closeRequested.current) return;
    closeRequested.current = true;
    setClosing(true);
    voiceToken.current += 1;
    if (speechAvailable) window.speechSynthesis.cancel();
    onClose();
  }

  function choose(index: number) {
    if (accessLocked || closeRequested.current || (index !== 0 && index !== 1) || picks.length >= TOTAL || currentPicks.current.length !== picks.length) return;
    const next = [...picks, index];
    currentPicks.current = next;
    recordStoryProgress(profileId, world, next, childName);
    focusNextScene.current = true;
    setPicks(next);
    if (next.length === TOTAL) onComplete(world, getEnding(world, next, childName).title);
  }

  function readText(text: string) {
    if (!speechAvailable || muted) return;
    const synth = window.speechSynthesis;
    const token = ++voiceToken.current;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'nl-NL';
    utterance.rate = 0.88;
    const voice = synth.getVoices().find(v => v.lang.toLowerCase().startsWith('nl'));
    if (voice) utterance.voice = voice;
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

  return <motion.div className="reader-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : .22 }}>
    <div ref={dialogRef} className={`reader-shell reader-world-${world} ${textSize === 'large' ? 'reader-large-text' : ''}`} role="dialog" aria-modal="true" aria-labelledby="reader-story-title">
      <header className="reader-topbar">
        <button className="reader-back" onClick={requestClose} aria-label="Terug naar je verhalen"><ArrowLeft size={20} /><span>Mijn verhalen</span></button>
        <div className="reader-book-title" id="reader-story-title"><BookOpen size={16} />{metadata.title}</div>
        {canPlay && <button className="reader-mode" onClick={() => { const next = !playEnabled; setPlayEnabled(next); if (next) requestAnimationFrame(() => playPanel.current?.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'start' })); }} aria-pressed={playEnabled}>{playEnabled ? 'Naar leesmodus' : 'Naar speelmodus'}</button>}
        <button className="reader-close" onClick={requestClose} aria-label="Verhaal sluiten"><X size={21} /></button>
      </header>
      <div className={`reader-layout ${showPlay ? 'reader-has-play' : ''}`}>
        {showPlay ? <div ref={playPanel} className="reader-play-panel"><StationPlayScene key={`${world}-${picks.length}`} step={picks.length as 0 | 1} previousChoice={picks[0]} childName={childName} muted={muted} reducedMotion={reducedMotion} onChoose={choose} onReadInstruction={readText} /></div> : <div className="reader-art">
          <motion.img src={metadata.image} alt={metadata.imageAlt} initial={{ scale: 1.04 }} animate={{ scale: 1 }} transition={{ duration: reducedMotion ? 0 : 1.2 }} />
          <div className="reader-art-shade" />
          <span className="reader-art-badge"><Sparkles size={15} />Dit is jouw avontuur</span>
          <div className="reader-art-caption"><span>Fabelpad presenteert</span><p>{metadata.title}</p><small>Een kleine keuze. Een wereld vol verhalen.</small></div>
        </div>}
        <div className="reader-page">
          <div className="reader-progress-row"><span>{complete ? 'Jouw avontuur is compleet' : `Deel ${picks.length + 1} van ${TOTAL}`}</span><div className="reader-progress-dots" aria-label={`${Math.min(picks.length + 1, TOTAL)} van ${TOTAL} delen`}>{Array.from({ length: TOTAL }, (_, i) => <i key={i} className={i <= picks.length ? 'is-active' : ''} />)}</div></div>
          {greeting && !complete && <div className="reader-continuity"><Sparkles size={17} /><span>{greeting}</span></div>}
          {accessLocked ? <div className="reader-access-gate"><Sparkles size={34} /><span className="reader-eyebrow">ER WACHT NOG EEN HELE WERELD</span><h2>Samen een nieuw<br />pad ontdekken?</h2><p>{previewLimit === 1 ? 'Je eerste deel is uit. Je keuze en je plek blijven bewaard.' : 'Dit verhaal hoort bij het gezinspakket.'} Vraag een grote avonturier om samen te kijken.</p><button className="reader-primary" onClick={() => { requestClose(); onRequestParents?.(); }}>Even voor de ouders <ArrowRight size={17} /></button><button className="reader-restart" onClick={requestClose}>Terug naar de verhalen</button><small>Voorbeeld van gratis toegang · er wordt niets gekocht.</small></div> : <AnimatePresence mode="wait" initial={false}>
            <motion.div className="reader-scene" key={picks.length} variants={{ hidden: { opacity: 0, y: reducedMotion ? 0 : 12 }, visible: { opacity: 1, y: 0 }, exit: { opacity: 0, y: reducedMotion ? 0 : -8 } }} initial="hidden" animate="visible" exit="exit" transition={{ duration: reducedMotion ? 0 : .2 }} onAnimationComplete={(definition) => { if (definition === 'visible' && focusNextScene.current) { if (showPlay) { playPanel.current?.querySelector<HTMLElement>('h3,button:not([disabled])')?.focus({ preventScroll: true }); playPanel.current?.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'start' }); } else sceneHeadingRef.current?.focus(); focusNextScene.current = false; } }}>
              {complete && <div className="reader-ending-icon"><Check size={27} /></div>}
              <p className="reader-eyebrow">{complete ? 'Een einde dat jij hebt gekozen' : picks.length === 0 ? 'Er was eens…' : 'En toen…'}</p>
              <h2 ref={sceneHeadingRef} tabIndex={-1}>{complete ? ending.title : scene.title}</h2>
              <div className="reader-story-text">{(complete ? ending.text : scene.text).split(/\n\s*\n/u).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
              {complete ? <>
                <div className="reader-keepsake"><Sparkles size={23} /><div><span>Een herinnering voor je verzameling</span><strong>{ending.keepsake}</strong></div></div>
                <div className="reader-ending-actions"><button className="reader-primary" onClick={requestClose}>Terug naar de wereld <ArrowRight size={18} /></button><button className="reader-restart" onClick={() => { focusNextScene.current = true; setGreeting(continuityGreeting(getStoryMemory(profileId), world, childName)); openStoryThread(profileId, world, []); currentPicks.current = []; setPicks([]); }}><RotateCcw size={17} />Een ander pad ontdekken</button></div>
              </> : showPlay ? <div className="reader-play-hint"><Sparkles size={20} /><div><strong>Jouw keuze komt tot leven.</strong><p>Speel in de prent, of kies leesmodus om de knoppen te gebruiken.</p></div><button onClick={() => playPanel.current?.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'start' })}>Naar de speelprent <ArrowRight size={16} /></button></div> : <div className="reader-choices"><p>Wat kies jij?</p>{scene.choices.map((choice, i) => { const Icon = iconMap[choice.icon]; return <motion.button key={choice.label} className="reader-choice" onClick={() => choose(i)} whileHover={reducedMotion ? undefined : { y: -3 }} whileTap={reducedMotion ? undefined : { scale: .98 }}><span className="reader-choice-icon"><Icon size={23} /></span><span><strong>{choice.label}</strong><small>{choice.hint}</small></span><ArrowRight className="reader-choice-arrow" size={20} /></motion.button>; })}</div>}
            </motion.div>
          </AnimatePresence>}
          <footer className="reader-controls"><button className={`reader-speech ${voiceState !== 'idle' ? 'is-speaking' : ''}`} disabled={!speechAvailable || muted} onClick={toggleSpeech} title={!speechAvailable ? 'Voorlezen is niet beschikbaar in deze browser' : muted ? 'Zet het geluid aan in het ouderhoekje om te luisteren' : undefined}>{muted ? <VolumeX size={17} /> : voiceState === 'speaking' ? <Pause size={17} /> : <Play size={17} fill="currentColor" />}<span>{!speechAvailable ? 'Lees gezellig samen' : muted ? 'Geluid staat uit' : voiceState === 'speaking' ? 'Even pauzeren' : voiceState === 'paused' ? 'Verder luisteren' : 'Lees voor'}</span></button><span className="reader-saved"><Check size={13} />Je plek blijft bewaard</span></footer>
        </div>
      </div>
    </div>
  </motion.div>;
}
