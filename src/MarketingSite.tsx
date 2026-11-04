'use client';

import { motion, useReducedMotion } from 'motion/react';
import { ArrowDown, ArrowRight, ArrowUpRight, BookOpen, Check, ChevronDown, Heart, Headphones, Leaf, MonitorSmartphone, Play, ShieldCheck, Sparkles, Star, Users } from 'lucide-react';
import { worlds } from './worlds';
import './marketing.css';

type Props = {
  onOpenApp: () => void;
  onOpenParents: () => void;
  onOpenStory: (id: string) => void;
};

const questions = [
  { question: 'Wat maakt een verhaal op Fabelpad interactief?', answer: 'Je leest of luistert samen en kiest op belangrijke momenten wat er gebeurt. Je keuze verandert het vervolg. In Het Verdwaalde Station kun je ook spelen in de illustratie. Een ander pad proberen? Dat kan bij een volgend avontuur.' },
  { question: 'Voor welke leeftijd zijn de verhalen bedoeld?', answer: 'De huidige verhalen zijn gemaakt voor kinderen van ongeveer 4 tot 8 jaar. Jongere kinderen kunnen samen met een volwassene ontdekken; kinderen die al lezen kunnen ook zelf hun pad kiezen.' },
  { question: 'Kunnen meerdere kinderen hun eigen avontuur bewaren?', answer: 'Ja. In deze demo kun je maximaal vijf kindprofielen maken. Elk profiel heeft een eigen naam, avatar, favorieten, keuzes en verzameling. De demo bewaart die gegevens op dit apparaat.' },
  { question: 'Moet ik een account maken om het prototype te proberen?', answer: 'Nee. De demoknop opent Fabelpad meteen. Demo inloggen vraagt geen e-mailadres of wachtwoord. Het is nog geen echt ouderaccount; koppeling met andere apparaten volgt in de uiteindelijke app.' },
  { question: 'Is Fabelpad al te downloaden in Google Play?', answer: 'De webdemo is nu te gebruiken op telefoon, tablet en computer. De Android-schermen zijn in dit prototype te bekijken. Een native Android-build en publicatie in Google Play zijn een volgende bouwstap.' },
  { question: 'Hoe werkt voorlezen in deze demo?', answer: 'De knop Lees voor gebruikt de beschikbare voorleesstem van je browser of apparaat. De stem en beschikbaarheid kunnen daardoor verschillen. Je kunt ook altijd zelf of samen lezen.' },
];

export default function MarketingSite({ onOpenApp, onOpenParents, onOpenStory }: Props) {
  const reducedMotion = useReducedMotion();
  const reveal = { initial: { opacity: 0, y: reducedMotion ? 0 : 18 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, amount: .12 }, transition: { duration: .45 } };

  return <div className="marketing-site">
    <a className="skip-link" href="#marketing-main">Naar de inhoud</a>
    <header className="mk-header mk-wrap">
      <a href="#marketing-main" className="mk-brand" aria-label="Fabelpad, naar boven"><img src="/brand/logo.webp" width="210" height="84" alt="Fabelpad" /></a>
      <nav className="mk-navigation" aria-label="Website-navigatie"><a href="#mk-stories">De verhalen</a><a href="#mk-how">Zo werkt het</a><a href="#mk-parents">Voor ouders</a></nav>
      <button className="mk-button mk-button-small mk-button-dark" onClick={onOpenApp}>Probeer de demo <ArrowUpRight size={17} /></button>
    </header>

    <main id="marketing-main">
      <section className="mk-hero mk-wrap">
        <motion.div className="mk-hero-copy" initial={{ opacity: 0, y: reducedMotion ? 0 : 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .55 }}>
          <span className="mk-eyebrow"><span className="mk-eyebrow-star"><Sparkles size={15} /></span> EEN KLEINE KEUZE. EEN GROOT AVONTUUR.</span>
          <h1>Er was eens…<br />een verhaal dat<br /><span>naar jou luisterde.</span></h1>
          <p>Een trein naar nergens. Een pakketje vol dromen. Een deur die alleen voor jou opengaat. Bij Fabelpad kies jij hoe het verhaal verdergaat.</p>
          <div className="mk-hero-actions"><button className="mk-button mk-button-yellow" onClick={onOpenApp}><Play size={18} fill="currentColor" />Ontdek jouw avontuur<ArrowRight size={19} /></button><a className="mk-text-link" href="#mk-how">Hoe werkt de magie? <ArrowDown size={16} /></a></div>
          <div className="mk-hero-notes"><span><Check size={14} />Direct proberen</span><span><Heart size={14} />Samen of zelf</span><span><BookOpen size={14} />4–8 jaar</span></div>
        </motion.div>
        <motion.div className="mk-hero-world" initial={{ opacity: 0, scale: reducedMotion ? 1 : .96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .7, delay: .1 }}>
          <div className="mk-world-frame"><img className="mk-station-art" src="/art/station.webp" alt="Een vos wacht bij een magische trein tussen de groene bergen" fetchPriority="high" /><div className="mk-world-shade" /><span className="mk-world-category"><Sparkles size={14} /> VANDAAG KAN ALLES</span><div className="mk-world-title"><span>Jouw eerste bestemming</span><h2>Het Verdwaalde<br />Station</h2><button onClick={() => onOpenStory('station')}>Stap maar in <ArrowUpRight size={18} /></button></div></div>
          <motion.div className="mk-fantasy-stamp" animate={reducedMotion ? {} : { rotate: [8, 11, 8] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}><Star size={23} /><span>Jij kiest<br />het avontuur!</span></motion.div>
          <div className="mk-choice-note"><span className="mk-note-icon"><ArrowRight size={18} /></span><span><small>HET VERHAAL WACHT OP JOU</small><strong>Welke kant gaan we op?</strong></span><span className="mk-note-dot" /></div>
          <span className="mk-hero-spark mk-hero-spark-one" aria-hidden="true">✦</span><span className="mk-hero-spark mk-hero-spark-two" aria-hidden="true">✧</span>
        </motion.div>
      </section>

      <div className="mk-ribbon" aria-label="Wat je kunt ontdekken"><div><span><BookOpen size={20} />Verhalen die vertakken</span><span className="mk-ribbon-dot">✦</span><span><Headphones size={20} />Lezen & luisteren</span><span className="mk-ribbon-dot">✦</span><span><Users size={20} />Ieder een eigen wereld</span><span className="mk-ribbon-dot">✦</span><span><Leaf size={20} />Ruimte voor fantasie</span></div></div>

      <motion.section {...reveal} className="mk-stories mk-wrap" id="mk-stories">
        <div className="mk-section-heading"><div><span className="mk-eyebrow">VERHALEN VOOR VERWONDERAARS</span><h2>Waar wil jij<br className="mk-mobile-break" /> vandaag naartoe? <span>✦</span></h2></div><button className="mk-text-link" onClick={onOpenApp}>Alle {worlds.length} verhalen <ArrowUpRight size={20} /></button></div>
        <div className="mk-story-grid">{[worlds[0], worlds[1], worlds[3]].map((world, index) => <article key={world.id} className={`mk-story-card mk-story-tone-${index}`}><button className="mk-story-art" onClick={() => onOpenStory(world.id)} aria-label={`Ontdek ${world.title}`}><img src={world.image} alt={world.imageAlt} loading="lazy" /><span className="mk-story-tag">{world.tag}</span><span className="mk-story-play"><ArrowUpRight size={24} /></span></button><div className="mk-story-info"><span className="mk-story-meta"><Headphones size={13} />{world.duration}<span>5 delen</span></span><h3><button onClick={() => onOpenStory(world.id)}>{world.title}</button></h3><p>{world.description}</p><button className="mk-story-link" onClick={() => onOpenStory(world.id)}>Dit avontuur kies ik<ArrowRight size={18} /></button></div></article>)}</div>
      </motion.section>

      <motion.section {...reveal} className="mk-how mk-wrap" id="mk-how"><div className="mk-how-heading"><span className="mk-eyebrow">ZO BEGINT EEN GROOT VERHAAL</span><h2>Een klein moment.<br /><span>Helemaal van jullie.</span></h2><p>Op de bank, onder een dekentje of nog even voor het slapen. Je hebt alleen een beetje nieuwsgierigheid nodig.</p></div><div className="mk-steps">{[{ number: '01', Icon: BookOpen, title: 'Kies een wereld', text: 'Volg je nieuwsgierigheid. Er wacht altijd een nieuw pad.' }, { number: '02', Icon: Headphones, title: 'Lees, luister en speel', text: 'Ontmoet bijzondere vrienden en ontdek wat er aan de hand is.' }, { number: '03', Icon: Sparkles, title: 'Maak het jouw verhaal', text: 'Jouw keuzes veranderen het vervolg. Waar komen jullie uit?' }].map(({ number, Icon, title, text }) => <article className="mk-step" key={number}><span className="mk-step-icon"><Icon size={23} /></span><div><small>{number} / HET AVONTUUR</small><h3>{title}</h3><p>{text}</p></div></article>)}</div></motion.section>

      <motion.section {...reveal} className="mk-parents mk-wrap" id="mk-parents"><div className="mk-parent-illustration"><span className="mk-parent-orbit" /><img src="/brand/mascot.webp" alt="De vrolijke groene Fabelpad-gids met een open verhalenboek" loading="lazy" /><div className="mk-parent-bubble">Fantasie aan.<br /><span>Gezellig samen.</span></div><Star className="mk-parent-star" size={37} /></div><div className="mk-parent-copy"><span className="mk-eyebrow"><ShieldCheck size={16} /> EVEN VOOR DE GROTE MENSEN</span><h2>Een eigen wereld.<br />Een vertrouwd<br /><span>moment samen.</span></h2><p>Kinderen kiezen hun eigen pad. Jij leest mee, luistert mee of kijkt hoe hun fantasie op reis gaat.</p><ul><li><Check size={17} /><span><strong>Ieder kind een eigen plekje</strong>Naam, favorieten en voortgang per kindprofiel.</span></li><li><Check size={17} /><span><strong>Vooraf geschreven avonturen</strong>Verhalen met keuzes, zonder open AI-chat.</span></li><li><Check size={17} /><span><strong>Ook fijn met minder beweging</strong>Kies rustige animaties in het ouderhoekje.</span></li></ul><button className="mk-text-link" onClick={onOpenParents}>Bekijk de ouderomgeving <ArrowUpRight size={20} /></button><small className="mk-demo-note">Deze demo bewaart profielen en voortgang op dit apparaat.</small></div></motion.section>

      <motion.section {...reveal} className="mk-everywhere mk-wrap"><div className="mk-everywhere-copy"><span className="mk-eyebrow"><MonitorSmartphone size={16} /> JOUW FAVORIETE PLEK IS GOED GENOEG</span><h2>Van het grote scherm<br />tot onder de dekens.</h2><p>Ontdek de webdemo op je computer, telefoon of tablet. De eigen Android-app krijgt dezelfde verhalenwereld, met een bediening die voor je telefoon is gemaakt.</p><button className="mk-button mk-button-dark" onClick={onOpenApp}>Open Fabelpad <ArrowRight size={18} /></button><small>Webdemo beschikbaar · Android-app in voorbereiding</small></div><div className="mk-device-scene" aria-hidden="true"><div className="mk-tablet"><span className="mk-device-logo">fabelpad<span>✦</span></span><span className="mk-device-greeting">Waar gaan we vandaag naartoe?</span><img src="/art/moonbakery.webp" alt="" loading="lazy" /><div><span>De Maanbakkerij</span><span>Begin het avontuur ↗</span></div></div><div className="mk-phone"><span className="mk-phone-camera" /><span className="mk-device-logo">fabelpad<span>✦</span></span><img src="/art/dream.webp" alt="" loading="lazy" /><strong>Een pakketje<br />vol dromen.</strong><span className="mk-phone-pill">Jij kiest het avontuur →</span><span className="mk-phone-bar" /></div><span className="mk-device-spark">✦</span></div></motion.section>

      <section className="mk-membership mk-wrap" aria-labelledby="mk-membership-title"><div><span className="mk-eyebrow">EERST EVEN VERWONDEREN</span><h2 id="mk-membership-title">De mooiste kennismaking?<br /><span>Een avontuur beleven.</span></h2><p>Probeer de verhalenwereld nu zonder account. De gratis kennismaking, abonnementen en founders-aanbieding worden in de ouderomgeving uitgewerkt.</p></div><div className="mk-membership-actions"><button className="mk-button mk-button-yellow" onClick={onOpenApp}>Probeer de demo <ArrowRight size={18} /></button><button className="mk-text-link" onClick={onOpenParents}>Bekijk het abonnementsvoorstel <ArrowUpRight size={17} /></button><small>Voorstel in ontwikkeling · geen betaling in deze demo</small></div></section>

      <section className="mk-faq mk-wrap" aria-labelledby="mk-faq-title"><div><span className="mk-eyebrow">NOG EVEN DIT</span><h2 id="mk-faq-title">Voor alle<br />nieuwsgierige<br /><span>grote mensen.</span></h2><p>Een paar antwoorden voordat jullie op pad gaan.</p></div><div className="mk-faq-list">{questions.map(({ question, answer }) => <details key={question}><summary>{question}<ChevronDown size={20} /></summary><p>{answer}</p></details>)}</div></section>

      <section className="mk-final-cta"><div className="mk-wrap"><span className="mk-final-star" aria-hidden="true">✦</span><span className="mk-eyebrow">HET VERHAAL BEGINT BIJ JOU</span><h2>Zullen we eens kijken<br />waar we uitkomen?</h2><button className="mk-button mk-button-yellow" onClick={onOpenApp}><Play size={17} fill="currentColor" />Ja, op avontuur!<ArrowRight size={18} /></button><span className="mk-final-small-star" aria-hidden="true">✧</span></div></section>
    </main>

    <footer className="mk-footer mk-wrap"><div className="mk-footer-main"><img src="/brand/logo.webp" alt="Fabelpad" width="170" height="70" loading="lazy" /><p>Jij kiest het avontuur.<br /><span>Er is altijd nog een ander pad.</span></p><div><a href="#mk-stories">De verhalen</a><button onClick={onOpenParents}>Voor ouders</button><button onClick={onOpenApp}>Open de demo <ArrowUpRight size={15} /></button></div></div><div className="mk-footer-bottom"><span>© {new Date().getFullYear()} Fabelpad</span><span>Interactief prototype · geen echte aankopen</span><span><Heart size={12} />Met ruimte voor fantasie</span></div></footer>
  </div>;
}
