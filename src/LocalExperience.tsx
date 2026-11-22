'use client';
import { useEffect, useState } from 'react';
import App from './App';
import MarketingSite from './MarketingSite';
import ParentDashboard from './ParentDashboard';
import { DemoBoundary } from './CloudBoundary';

function Reader() {
  const [story, setStory] = useState<string>();
  useEffect(() => { setStory(new URLSearchParams(location.search).get('story') || undefined); }, []);
  return <App key={story || 'library'} initialStory={story} onRequestParents={() => location.assign('/ouders')} />;
}
export default function LocalExperience({ surface }: { surface: 'website' | 'reader' | 'parents' }) {
  if (surface === 'website') return <MarketingSite onOpenApp={() => location.assign('/lezen')} onOpenParents={() => location.assign('/ouders')} onOpenStory={id => location.assign(`/lezen?story=${encodeURIComponent(id)}`)} />;
  return <DemoBoundary>{surface === 'reader' ? <Reader /> : <ParentDashboard onOpenApp={() => location.assign('/lezen')} onOpenStory={id => location.assign(`/lezen?story=${encodeURIComponent(id)}`)} />}</DemoBoundary>;
}
