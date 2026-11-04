'use client';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, Code2, LayoutDashboard, Monitor, Smartphone, Sparkles, Tablet, Users, WifiOff } from 'lucide-react';
import App from './App';
import MarketingSite from './MarketingSite';
import ParentDashboard from './ParentDashboard';
import ContentStudio from './ContentStudio';
import './platform-prototype.css';

type Surface = 'website' | 'app' | 'android' | 'parents' | 'studio';
const surfaces: { id: Surface; label: string; Icon: typeof Monitor }[] = [
  { id: 'website', label: 'Website', Icon: Monitor }, { id: 'app', label: 'Webapp', Icon: BookOpen },
  { id: 'android', label: 'Android', Icon: Smartphone }, { id: 'parents', label: 'Ouders', Icon: Users },
  { id: 'studio', label: 'Verhalenstudio', Icon: LayoutDashboard },
];
function currentSurface(): Surface {
  if (typeof window === 'undefined') return 'website';
  const value = new URLSearchParams(location.search).get('surface');
  return surfaces.some(item => item.id === value) ? value as Surface : 'website';
}
function AndroidPreview() {
  const [tablet, setTablet] = useState(false);
  const [scenario, setScenario] = useState('normal');
  const [reload, setReload] = useState(0);
  return <main className="native-preview"><section className="native-preview-copy"><span className="prototype-eyebrow"><Smartphone size={16} /> ANDROID · ONTWERPPREVIEW</span><h1>Dezelfde magie.<br /><em>In je broekzak.</em></h1><p>Doorloop de leesapp op telefoonformaat. Kies een kind, speel een verhaal en open het later weer op dezelfde plek.</p><div className="native-device-toggle" aria-label="Apparaatformaat"><button aria-pressed={!tablet} onClick={() => setTablet(false)}><Smartphone size={17} />Telefoon</button><button aria-pressed={tablet} onClick={() => setTablet(true)}><Tablet size={17} />Tablet</button></div><label className="native-scenario-label">Bekijk een schermtoestand<select value={scenario} onChange={event => setScenario(event.target.value)}><option value="normal">Normale leesapp</option><option value="offline">Verbinding tijdelijk weg (voorbeeld)</option><option value="loading">Verhaal laden (voorbeeld)</option><option value="error">Laden mislukt (voorbeeld)</option><option value="empty">Nog geen avonturen (voorbeeld)</option></select></label><button className="native-reset" onClick={() => setReload(value => value + 1)}>Scherm opnieuw openen <ArrowRight size={16} /></button><div className="native-honesty"><Code2 size={21} /><div><strong>Ontwerp en flow in de browser</strong><p>Dit venster is geen draaiende Android-build. De echte Expo/React Native-broncode en het bouwplan zijn voorbereid voor Codex. Android-prestaties worden op een toestel getest.</p></div></div><div className="native-checks"><span><Check size={16} /> 13 complete verhalen</span><span><Check size={16} /> Eigen voortgang per kind</span><span><Check size={16} /> Rustige modus</span></div></section><div className={`native-device ${tablet ? 'native-device-tablet' : ''}`}><div className="native-device-status"><span>9:41</span><span>● ● ▰</span></div><iframe key={`${scenario}-${reload}`} title="Interactieve Android-schermpreview" src={`/demo?surface=app&embedded=1&scenario=${scenario}`} /><div className="native-device-home" /></div></main>;
}
export default function PlatformPrototype() {
  const [surface, setSurface] = useState<Surface>(() => currentSurface());
  const [story, setStory] = useState(() => typeof window === 'undefined' ? undefined : new URLSearchParams(location.search).get('story') || undefined);
  const params = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(location.search);
  const embedded = params.get('embedded') === '1';
  const scenario = params.get('scenario');
  const [scenarioDismissed, setScenarioDismissed] = useState(false);
  useEffect(() => {
    const change = () => { setSurface(currentSurface()); setStory(new URLSearchParams(location.search).get('story') || undefined); };
    window.addEventListener('popstate', change); return () => window.removeEventListener('popstate', change);
  }, []);
  function navigate(next: Surface, id?: string) {
    const url = new URL(location.href); url.search = ''; url.searchParams.set('surface', next); if (id) url.searchParams.set('story', id);
    history.pushState({}, '', url); setStory(id); setSurface(next); window.scrollTo({ top: 0, behavior: 'instant' });
  }
  const openApp = () => navigate('app');
  const openStory = (id: string) => navigate('app', id);
  const app = <App key={story || 'library'} initialStory={story} initialPage={scenario === 'empty' && !scenarioDismissed ? 'adventures' : undefined} forceEmpty={scenario === 'empty' && !scenarioDismissed} onRequestParents={() => navigate('parents')} />;
  if (embedded) {
    if (!scenarioDismissed && (scenario === 'loading' || scenario === 'error')) return <div className="native-state-screen"><img src="/brand/mascot.webp" alt="" /><span className="prototype-eyebrow">SCHERMVOORBEELD</span><h1>{scenario === 'loading' ? 'Een momentje magie…' : 'Een klein omweggetje.'}</h1><p>{scenario === 'loading' ? 'We leggen jouw avontuur klaar.' : 'Dit verhaal kon niet geladen worden. Je bewaarde plek blijft staan.'}</p><button onClick={() => setScenarioDismissed(true)}>{scenario === 'loading' ? 'Toon het geladen verhaal' : 'Opnieuw proberen'}<ArrowRight size={18} /></button></div>;
    return <div className="embedded-app">{scenario === 'offline' && <div className="native-offline-note"><WifiOff size={14} />Offline voorbeeld · je plek staat op dit apparaat</div>}{app}</div>;
  }
  return <><aside className="prototype-toolbar" aria-label="Fabelpad prototype-onderdelen"><button className="prototype-wordmark" onClick={() => navigate('website')}><Sparkles size={15} /><span>Fabelpad<small>PROTOTYPE</small></span></button><nav>{surfaces.map(({ id, label, Icon }) => <button key={id} aria-current={surface === id ? 'page' : undefined} onClick={() => navigate(id)}><Icon size={16} /><span>{label}</span></button>)}</nav><span className="prototype-save-note"><span />Lokaal werkende demo</span></aside>{surface === 'website' ? <MarketingSite onOpenApp={openApp} onOpenParents={() => navigate('parents')} onOpenStory={openStory} /> : surface === 'app' ? <><button className="prototype-app-back" onClick={() => navigate('website')}><ArrowLeft size={14} />Naar de website</button>{app}</> : surface === 'android' ? <AndroidPreview /> : surface === 'parents' ? <ParentDashboard onOpenApp={openApp} onOpenStory={openStory} /> : <ContentStudio onPreview={openStory} />}</>;
}
