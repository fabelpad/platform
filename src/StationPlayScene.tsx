'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Check, KeyRound, Leaf, Music2, Sparkles, Star, Ticket, Volume2 } from 'lucide-react';
import { initialStationPlayState, reduceStationPlay, stationInstruction } from './storyPlayLogic';
import type { PlayChoice, StationPlayAction } from './storyPlayLogic';
import './story-play.css';

type Props = { step: 0 | 1; previousChoice?: number; childName: string; muted: boolean; reducedMotion: boolean; onChoose: (index: number) => void; onReadInstruction?: (text: string) => void };

function GoldenKey({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 180 100" fill="none" aria-hidden="true"><defs><linearGradient id="play-key-gold" x1="20" y1="10" x2="135" y2="90" gradientUnits="userSpaceOnUse"><stop stopColor="#ffe8a0" /><stop offset=".48" stopColor="#e8b344" /><stop offset="1" stopColor="#ae7325" /></linearGradient></defs><path d="M70 48h85v20h-15V56h-16v12h-15V56H70a29 29 0 1 1 0-8Z" fill="url(#play-key-gold)" stroke="#b9822c" strokeWidth="4" strokeLinejoin="round" /><circle cx="43" cy="52" r="13" fill="#fff4c8" stroke="#c39137" strokeWidth="4" /><path d="m37 22 3-5m18 10 4-4m24 24h61" stroke="#fff3b8" strokeWidth="3" strokeLinecap="round" /></svg>;
}
function MovingMap() {
  return <div className="play-rail-map" aria-label="Een kaart met twee bewegende spoorlijnen"><svg viewBox="0 0 240 160" fill="none" aria-hidden="true"><path d="M30 133Q55 90 100 95T182 23M30 133Q118 145 143 95T216 63" stroke="#a28245" strokeWidth="10" strokeLinecap="round" /><path className="play-map-track" d="M30 133Q55 90 100 95T182 23M30 133Q118 145 143 95T216 63" stroke="#f3d06a" strokeWidth="5" strokeDasharray="6 8" /><circle cx="30" cy="133" r="9" fill="#c17d3b" /><circle cx="182" cy="23" r="9" fill="#8caa70" /><circle cx="216" cy="63" r="9" fill="#bd9dce" /><path d="m53 34 3 8 8 1-6 5 2 9-7-5-7 5 2-9-6-5 9-1Z" fill="#d7ab48" /><path d="m159 128 2 6 7 1-5 4 2 7-6-4-5 4 1-7-5-4 7-1Z" fill="#bd9dce" /></svg><span>Een spoor naar overal</span></div>;
}

export default function StationPlayScene({ step, previousChoice, childName, muted, reducedMotion, onChoose, onReadInstruction }: Props) {
  const [state, setState] = useState(() => initialStationPlayState(step));
  const stateRef = useRef(state);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const committed = useRef(false);
  const active = useRef(true);
  const generation = useRef(0);
  const chooseCallback = useRef(onChoose); chooseCallback.current = onChoose;
  const readInstruction = useRef(onReadInstruction); readInstruction.current = onReadInstruction;
  const audio = useRef<AudioContext | null>(null);
  const instructionRef = useRef<HTMLHeadingElement>(null);
  const phaseFocus = useRef(false);
  const instruction = stationInstruction(state);
  const leaving = state.phase === 'leaving';
  const done = state.phase === 'repaired' || state.phase === 'map';

  useLayoutEffect(() => {
    active.current = true;
    if (stateRef.current.step !== step) {
      clearTimeout(timer.current); generation.current += 1;
      const initial = initialStationPlayState(step); stateRef.current = initial; setState(initial); committed.current = false;
    }
    return () => {
      active.current = false; generation.current += 1; clearTimeout(timer.current); timer.current = undefined;
      if (audio.current && audio.current.state !== 'closed') void audio.current.close().catch(() => {});
      audio.current = null;
      if (!readInstruction.current && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, [step]);
  useEffect(() => {
    if (phaseFocus.current) { instructionRef.current?.focus({ preventScroll: true }); phaseFocus.current = false; }
  }, [state.phase]);
  useEffect(() => {
    if (muted && audio.current && audio.current.state !== 'closed') void audio.current.suspend().catch(() => {});
    if (muted && !readInstruction.current && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  }, [muted]);

  function chime(success = false) {
    if (muted || !('AudioContext' in window)) return;
    try {
      const context = audio.current && audio.current.state !== 'closed' ? audio.current : new AudioContext(); audio.current = context;
      void context.resume().catch(() => {});
      (success ? [523.25, 659.25, 783.99] : [659.25]).forEach((frequency, index) => {
        const oscillator = context.createOscillator(), gain = context.createGain(), start = context.currentTime + index * .075;
        oscillator.type = 'sine'; oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(.0001, start); gain.gain.exponentialRampToValueAtTime(.04, start + .025); gain.gain.exponentialRampToValueAtTime(.0001, start + .26);
        oscillator.connect(gain); gain.connect(context.destination); oscillator.start(start); oscillator.stop(start + .3);
      });
    } catch { /* A visual response always remains available. */ }
  }
  function apply(action: StationPlayAction) {
    if (!active.current || committed.current) return;
    const next = reduceStationPlay(stateRef.current, action);
    if (next === stateRef.current) return;
    stateRef.current = next; phaseFocus.current = true; setState(next); chime(next.phase === 'repaired' || next.phase === 'map');
    if (next.phase === 'leaving' && next.choice !== null) {
      const token = generation.current, choice = next.choice;
      timer.current = setTimeout(() => {
        timer.current = undefined;
        if (!active.current || committed.current || generation.current !== token) return;
        committed.current = true; chooseCallback.current(choice);
      }, reducedMotion ? 100 : 1050);
    }
  }
  function listen() {
    if (muted) return;
    if (readInstruction.current) { readInstruction.current(instruction); return; }
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(instruction); utterance.lang = 'nl-NL'; utterance.rate = .88;
    const voice = window.speechSynthesis.getVoices().find(item => item.lang.toLowerCase().startsWith('nl'));
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  }
  const choose = (choice: PlayChoice) => apply({ type: 'choose', choice });

  return <section className={`station-play play-step-${step} play-phase-${state.phase} ${leaving ? `play-going-${state.choice === 0 ? 'left' : 'right'}` : ''} ${reducedMotion ? 'play-is-calm' : ''}`} aria-label={step === 0 ? 'Speel mee op het perron' : 'Bedien de spoorwissel'} aria-busy={leaving}>
    <img className="play-platform" src="/art/play/station-platform.webp" alt="Een uitnodigend sprookjesperron tussen groene heuvels" />
    <div className="play-scene-wash" />
    <div className="play-scene-dust" aria-hidden="true"><i /><i /><i /><i /><i /></div>
    <div className="play-scene-top"><span><Sparkles size={13} />JIJ LAAT HET GEBEUREN</span>{!muted && <button onClick={listen} disabled={leaving} aria-label="Luister naar de opdracht"><Volume2 size={19} /></button>}</div>
    {step === 1 && <div className="play-travel-companion"><Ticket size={13} />{previousChoice === 0 ? 'Dibbel reist met je mee' : 'Jouw sterrenkaart mag mee'}</div>}

    <div className="play-stage-content">
      {step === 0 && state.phase === 'choosing' && <div className="play-object-choices">
        <motion.button className="play-dibbel-choice" onClick={() => choose(0)} whileHover={reducedMotion ? undefined : { y: -5 }} whileTap={reducedMotion ? undefined : { scale: .97 }} aria-label="Help Dibbel met zijn gescheurde kaartje"><span className="play-dibbel-halo" /><img src="/art/play/dibbel.webp" alt="Dibbel het kleine draakje met zijn gescheurde treinkaartje" /><span className="play-object-label"><span>Help Dibbel</span><small>Zijn kaartje is gescheurd</small><ArrowRight size={16} /></span></motion.button>
        <motion.button className="play-key-choice" onClick={() => choose(1)} whileHover={reducedMotion ? undefined : { y: -5, rotate: 4 }} whileTap={reducedMotion ? undefined : { scale: .97 }} aria-label="Onderzoek de gouden sleutel"><span className="play-key-halo" /><GoldenKey /><span className="play-key-twinkle"><Sparkles size={25} /></span><span className="play-object-label"><span>De gouden sleutel</span><small>Waar zou die op passen?</small><ArrowRight size={16} /></span></motion.button>
      </div>}

      <AnimatePresence mode="wait">
        {step === 0 && (state.phase === 'ticket' || state.phase === 'repaired') && <motion.div className="play-ticket-task" key="ticket" initial={{ opacity: 0, y: reducedMotion ? 0 : 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
          <motion.img className="play-dibbel-friend" src="/art/play/dibbel.webp" alt={done ? 'Dibbel is blij dat zijn kaartje weer heel is' : 'Dibbel wacht op jouw hulp'} animate={done && !reducedMotion ? { y: [0, -13, 0] } : {}} transition={{ duration: .55, repeat: done ? 1 : 0 }} />
          <div className={`play-ticket ${done ? 'is-repaired' : ''}`}><span className="play-ticket-caption">DIBBELS KAARTJE</span><div className="play-ticket-train"><Ticket size={32} /><span>Een reis<br />naar overal</span></div><span className="play-ticket-tear" aria-hidden="true" /><span className="play-ticket-target" aria-hidden="true"><Star size={45} /></span>{done && <motion.span className="play-sticker-placed" initial={reducedMotion ? false : { scale: 1.8, rotate: -25, opacity: 0 }} animate={{ scale: 1, rotate: -9, opacity: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 16 }}><Star size={57} fill="currentColor" /></motion.span>}</div>
          {state.phase === 'ticket' ? <button className="play-sticker-button" onClick={() => apply({ type: 'repair' })}><span><Star size={34} fill="currentColor" /></span><strong>Plak de sterrensticker</strong><small>Een tikje is genoeg</small></button> : <div className="play-task-success" role="status"><Check size={20} /><span>Heel! Nu kan Dibbel mee.</span></div>}
        </motion.div>}

        {step === 0 && (state.phase === 'cabinet' || state.phase === 'map') && <motion.div className="play-cabinet-task" key="cabinet" initial={{ opacity: 0, y: reducedMotion ? 0 : 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
          <div className={`play-cabinet ${state.phase === 'map' ? 'is-unlocked' : ''}`}><div className="play-cabinet-inside"><MovingMap /></div><motion.div className="play-cabinet-door" animate={{ rotateY: state.phase === 'map' ? -120 : 0 }} transition={{ duration: reducedMotion ? 0 : .65 }}><span className="play-cabinet-star"><Star size={40} /></span><KeyRound size={25} /><span>Er zit iets<br />bijzonders in…</span></motion.div></div>
          {state.phase === 'cabinet' ? <button className="play-unlock-button" onClick={() => apply({ type: 'unlock' })}><GoldenKey /><span>Draai de gouden sleutel</span><ArrowRight size={18} /></button> : <div className="play-task-success" role="status"><Sparkles size={20} /><span>Jouw eigen spoorwegkaart!</span></div>}
        </motion.div>}
      </AnimatePresence>

      {step === 1 && <div className="play-switch-task">
        <svg className="play-fork-tracks" viewBox="0 0 600 330" fill="none" aria-hidden="true"><path d="M300 320V239Q300 180 220 133L101 55M300 320V239Q300 180 380 133L499 55" stroke="#f7ead5" strokeWidth="39" /><path className={state.choice === 0 ? 'is-chosen' : ''} d="M289 320V239Q289 184 214 142L92 63M311 320V239Q311 175 226 124L110 47" stroke="#8d7759" strokeWidth="5" /><path className={state.choice === 1 ? 'is-chosen' : ''} d="M289 320V239Q289 175 374 124L490 47M311 320V239Q311 184 386 142L508 63" stroke="#8d7759" strokeWidth="5" /></svg>
        <div className="play-route-buttons"><button className={`play-route play-route-music ${state.choice === 0 ? 'is-selected' : ''}`} onClick={() => choose(0)} disabled={leaving} aria-label="Zet de wissel naar het muziekbos"><span className="play-mini-forest" aria-hidden="true"><i /><i /><i /><Music2 size={31} /></span><strong>Het muziekbos</strong><small>Volg de melodie</small><span className="play-route-direction"><ArrowLeft size={16} />Kies dit spoor</span></button><button className={`play-route play-route-lanterns ${state.choice === 1 ? 'is-selected' : ''}`} onClick={() => choose(1)} disabled={leaving} aria-label="Zet de wissel naar de lantaarns"><span className="play-mini-lanterns" aria-hidden="true"><i /><i /><i /><Sparkles size={28} /></span><strong>De lantaarns</strong><small>Volg het gouden licht</small><span className="play-route-direction">Kies dit spoor<ArrowRight size={16} /></span></button></div>
        <div className="play-switch-base" aria-hidden="true"><span /><motion.i animate={{ rotate: state.choice === 0 ? -39 : state.choice === 1 ? 39 : 0 }} transition={{ type: 'spring', stiffness: 200, damping: 17 }} /><small>Jouw wissel</small></div>
      </div>}

      {leaving && <div className="play-departure-label" role="status"><Sparkles size={19} />{step === 0 ? 'Iedereen aan boord!' : state.choice === 0 ? 'Daar klinkt de muziek…' : 'Kijk, de lichtjes wijzen de weg!'}</div>}
      {(step === 1 || leaving) && <motion.img className="play-moving-train" src="/art/play/train.webp" alt="De magische trein rijdt over het gekozen spoor" initial={false} animate={leaving ? step === 0 ? { x: reducedMotion ? 0 : 270, opacity: reducedMotion ? 1 : 0, scale: .95 } : { x: reducedMotion ? 0 : state.choice === 0 ? -128 : 128, y: reducedMotion ? 0 : -150, scale: reducedMotion ? 1 : .62, opacity: reducedMotion ? 1 : .4 } : { x: 0, y: 0, scale: 1, opacity: 1 }} transition={{ duration: reducedMotion ? .05 : .95, ease: [.45, 0, .55, 1] }} />}
    </div>

    <div className="play-instruction-card"><div className="play-instruction-heading"><span className="play-instruction-step">{step + 1}</span><h3 ref={instructionRef} tabIndex={-1}>{instruction}</h3></div>{step === 0 && done && <button className="play-board-button" onClick={() => apply({ type: 'depart' })}>Instappen <ArrowRight size={19} /></button>}{!done && !leaving && <p>{step === 0 && state.phase === 'choosing' ? `${childName.trim() || 'Avonturier'}, jouw aanraking verandert het verhaal.` : step === 1 ? 'De trein wacht rustig op jouw keuze.' : 'Je mag rustig proberen. Er is geen haast.'}</p>}</div>
  </section>;
}
