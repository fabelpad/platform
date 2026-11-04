'use client';
import { useEffect, useState } from 'react';
import App from './App';
import MarketingSite from './MarketingSite';
import ParentDashboard from './ParentDashboard';
import PlatformPrototype from './PlatformPrototype';
import { DemoBoundary } from './CloudBoundary';

function Reader() {
  const [story, setStory] = useState<string>();
  useEffect(() => { setStory(new URLSearchParams(location.search).get('story') || undefined); }, []);
  return <App key={story || 'library'} initialStory={story} onRequestParents={() => location.assign('/ouders')} />;
}
export default function LocalExperience({ surface }: { surface: 'website' | 'reader' | 'parents' | 'review' }) {
  if (surface === 'website') return <MarketingSite onOpenApp={() => location.assign('/lezen')} onOpenParents={() => location.assign('/ouders')} onOpenStory={id => location.assign(`/lezen?story=${encodeURIComponent(id)}`)} />;
  return <DemoBoundary>{surface === 'reader' ? <Reader /> : surface === 'review' ? <PlatformPrototype /> : <><div className="local-demo-note">Ouderdemo · gegevens blijven op dit apparaat. <a href="/inloggen">Naar je ouderaccount</a></div><ParentDashboard onOpenApp={() => location.assign('/lezen')} onOpenStory={id => location.assign(`/lezen?story=${encodeURIComponent(id)}`)} /></>}</DemoBoundary>;
}
