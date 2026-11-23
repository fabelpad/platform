'use client';
import { useEffect, useState } from 'react';
import App from './App';
import MarketingSite from './MarketingSite';
import ParentDashboard from './ParentDashboard';
import { DemoBoundary } from './CloudBoundary';

function Reader({cloudContent=false}:{cloudContent?:boolean}) {
  const [story, setStory] = useState<string>();
  useEffect(() => { setStory(new URLSearchParams(location.search).get('story') || undefined); }, []);
  return <App key={story ? `story-${story}` : 'library'} initialStory={story} cloudContent={cloudContent} onRequestParents={() => location.assign('/ouders')} />;
}
export default function LocalExperience({ surface,cloudContent=false }: { surface: 'website' | 'reader' | 'parents';cloudContent?:boolean }) {
  if (surface === 'website') return <MarketingSite onOpenApp={() => location.assign('/lezen')} onOpenParents={() => location.assign('/ouders')} onOpenStory={id => location.assign(`/lezen?story=${encodeURIComponent(id)}`)} />;
  return <DemoBoundary>{surface === 'reader' ? <Reader cloudContent={cloudContent}/> : <ParentDashboard onOpenApp={() => location.assign('/lezen')} onOpenStory={id => location.assign(`/lezen?story=${encodeURIComponent(id)}`)} />}</DemoBoundary>;
}
