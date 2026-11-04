'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, Gem, HeartHandshake, Sparkles, Users } from 'lucide-react';
import { backfillStoryMemory, getStoryMemory, worldName } from './storyMemory';
import type { StoryMemory } from './storyMemory';
import './memory.css';

type Props = { profileId: string; childName: string; onOpenWorld: (worldId: string) => void };

export default function StoryMemoryPanel({ profileId, childName, onOpenWorld }: Props) {
  const [memory, setMemory] = useState<StoryMemory>(() => getStoryMemory(profileId));
  const [showAllFriends, setShowAllFriends] = useState(false);
  const [showAllItems, setShowAllItems] = useState(false);
  useEffect(() => {
    setMemory(backfillStoryMemory(profileId, childName));
    setShowAllFriends(false); setShowAllItems(false);
    const refresh = () => setMemory(getStoryMemory(profileId));
    window.addEventListener('fabelpad-storage-change', refresh);
    return () => window.removeEventListener('fabelpad-storage-change', refresh);
  }, [profileId, childName]);
  const hasHistory = !!(memory.encounters.length || memory.items.length || memory.openThreads.length);
  const friends = showAllFriends ? memory.encounters : memory.encounters.slice(-3);
  const items = showAllItems ? memory.items : memory.items.slice(-3);

  return <section className="story-memory" aria-labelledby="story-memory-title">
    <div className="memory-heading"><div><div className="eyebrow"><Sparkles size={14} /> JOUW VERHAALGEHEUGEN</div><h2 id="story-memory-title">Wat we samen hebben beleefd</h2><p>Vrienden, schatten en avonturen die bij jouw verhaal horen.</p></div><span className="memory-name-tag">Van {childName}</span></div>
    {!hasHistory ? <div className="memory-empty"><HeartHandshake size={35} /><div><h3>Er staat een wereld voor je klaar.</h3><p>Ontmoet je eerste verhaalvriend. Dan bewaren we hier wat jullie samen beleven.</p></div><button className="text-link" onClick={() => onOpenWorld('station')}>Op avontuur <ArrowRight size={18} /></button></div> : <div className="memory-grid">
      <article className="memory-card memory-friends"><div className="memory-card-title"><span><Users size={20} /></span><h3>Jouw verhaalvrienden</h3><small>{memory.encounters.length}</small></div>{friends.length ? <ul>{friends.map(friend => <li key={friend.id}><span className={`memory-world-dot memory-dot-${friend.worldId}`} /><div><strong>{friend.name}</strong><p>{friend.facts[friend.facts.length - 1]}</p></div></li>)}</ul> : <p className="memory-card-empty">Je eerste ontmoeting wacht in het verhaal.</p>}{memory.encounters.length > 3 && <button className="memory-show-all" onClick={() => setShowAllFriends(v => !v)}>{showAllFriends ? 'Laat minder vrienden zien' : `Bekijk alle ${memory.encounters.length} vrienden`}</button>}</article>
      <article className="memory-card memory-items"><div className="memory-card-title"><span><Gem size={20} /></span><h3>Gevonden schatten</h3><small>{memory.items.length}</small></div>{items.length ? <ul>{items.map(item => <li key={item.id}><span className="memory-item-spark"><Sparkles size={16} /></span><div><strong>{item.name}</strong><p>{item.endingTitle}</p></div></li>)}</ul> : <p className="memory-card-empty">Na een compleet avontuur bewaar je hier jouw bijzondere aandenken.</p>}{memory.items.length > 3 && <button className="memory-show-all" onClick={() => setShowAllItems(v => !v)}>{showAllItems ? 'Laat minder schatten zien' : `Bekijk alle ${memory.items.length} schatten`}</button>}</article>
      <article className="memory-card memory-threads"><div className="memory-card-title"><span><BookOpen size={20} /></span><h3>Hier gaat het verder</h3><small>{memory.openThreads.length}</small></div>{memory.openThreads.length ? <div className="memory-thread-list">{memory.openThreads.map(thread => <button key={thread.id} onClick={() => onOpenWorld(thread.worldId)}><span><strong>{worldName(thread.worldId)}</strong><small>Verder bij hoofdstuk {thread.nextChapter}</small><span>{thread.label}</span></span><ArrowRight size={18} /></button>)}</div> : <p className="memory-card-empty">Alle begonnen avonturen zijn afgerond. Je vrienden blijven je herkennen als je terugkomt.</p>}</article>
    </div>}
    <p className="memory-footnote"><Sparkles size={13} /> We onthouden alleen wat je in de verhalen hebt meegemaakt.</p>
  </section>;
}
