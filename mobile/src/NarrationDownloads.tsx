import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { normalizeVoiceSlot, type NarrationManifest, type VoiceSlot } from '../../lib/narration/contracts';
import { Control } from './NarrationPlayer';
import { downloadedNarration, downloadNarration, loadNarrationManifest, loadNarrationVoices, narrationEvents, pauseNarrationDownload, removeNarrationDownload, type AudioScope, type NativeDownload } from './narration';
import { completeNarrationManifest } from './narrationContract';
import { effectiveReadingLevel, readingContent, readingLevels, withCompatibleReading } from './readingLevels';
import type { Profile, Story } from './types';

export function NarrationDownloads({ scope, profile, stories, currentVersion, resolveStory }: { scope: AudioScope; profile: Profile; stories: Story[]; currentVersion: string; resolveStory?(story: Story, version: string): Story | undefined }) {
  const [downloads, setDownloads] = useState<NativeDownload[]>([]), [planned, setPlanned] = useState<NarrationManifest | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [progress, setProgress] = useState<Record<string, unknown> | null>(null), live = useRef(true);
  const [defaultSlot, setDefaultSlot] = useState<VoiceSlot>('stem-1');
  const slot = normalizeVoiceSlot(profile.voiceSlot, defaultSlot), level = effectiveReadingLevel(profile, profile.readingLevel), owner = scope.kind === 'local' ? 'local' : scope.parentId;
  async function refresh() { const values = await downloadedNarration(scope); if (live.current) setDownloads(values); }
  useEffect(() => { live.current = true; void refresh(); void loadNarrationVoices().then(value => { if (live.current) setDefaultSlot(value.defaultVoiceSlot); }); const event = narrationEvents('onDownload', value => { if (live.current) setProgress(value); }); return () => { live.current = false; event.remove(); }; }, [owner]);
  async function run(action: () => Promise<void>) { setBusy(true); setMessage(''); try { await action(); } catch (error) { if (live.current) setMessage(error instanceof Error ? error.message : 'Dit audiopakket kon niet worden opgehaald.'); } finally { if (live.current) { setBusy(false); await refresh(); } } }
  async function fetchPackage(manifest: NarrationManifest) {
    await downloadNarration(manifest, scope); setPlanned(null); setMessage('Alle scènes, keuzen, eindes en de gedeelde naamzinnen zijn gecontroleerd en offline beschikbaar.');
  }
  return <View style={s.card}>
    <Text accessibilityRole="header" style={s.heading}>Voorleesaudio voor onderweg</Text><Text style={s.small}>Download per verhaalversie, leesniveau en vertelstem. {scope.kind === 'local' ? 'Een account is niet nodig voor audio van de meegeleverde verhalen.' : 'Gezinsdownloads volgen de door de server bevestigde geldigheid en worden bij uitloggen verwijderd.'} Je leesvoortgang blijft bij verwijderen bewaard.</Text>
    <Text style={s.small}>Voor {profile.name} · {readingLevels.find(item => item.id === level)?.label} · {slot}</Text>
    {stories.map(story => <Control key={story.id} label={`Audio controleren voor ${story.title}`} disabled={busy} onPress={() => void run(async () => {
      const contentVersion = profile.storyVersions?.[story.id] ?? currentVersion, source = resolveStory?.(story, contentVersion) ?? story;
      const identity = { storyId: story.id, contentVersion, readingLevel: level, voiceSlot: slot };
      const result = await loadNarrationManifest(identity, scope);
      if (!result.manifest) throw new Error(result.reason ?? 'De opnamen zijn nog niet vrijgegeven.');
      if (!completeNarrationManifest(result.manifest, identity, readingContent(withCompatibleReading(source, story), level))) throw new Error('Deze audio dekt nog niet alle bereikbare scènes, keuzes en eindes van de gekozen tekstversie.');
      setPlanned(result.manifest); setMessage('Controleer de omvang en start daarna zelf de download.');
    })} />)}
    {planned && <View style={s.package}><Text style={s.small}>Gekozen: {planned.storyId} · versie {planned.contentVersion} · {planned.readingLevel} · {planned.voice.label}. {(Object.values(planned.assets).reduce((sum, asset) => sum + asset.byteLength, 0) / 1_000_000).toFixed(1)} MB plus het gedeelde namenpakket.</Text><Control label="Dit volledige audiopakket downloaden" disabled={busy} onPress={() => void run(() => fetchPackage(planned))} /><Control label="Downloadkeuze sluiten" disabled={busy} onPress={() => setPlanned(null)} /></View>}
    {progress && <View style={s.package}><Text accessibilityLiveRegion="polite" style={s.small}>{progress.status === 'downloading' ? `Download ${Math.floor(Number(progress.completedBytes) / Math.max(1, Number(progress.totalBytes)) * 100)}% · ${(Number(progress.completedBytes) / 1_000_000).toFixed(1)} van ${(Number(progress.totalBytes) / 1_000_000).toFixed(1)} MB` : progress.status === 'complete' ? 'Download volledig gecontroleerd.' : progress.status === 'paused' ? 'Download gepauzeerd; gecontroleerde fragmenten blijven bewaard.' : 'Download onderbroken. Je kunt de bewaarde voortgang hervatten.'}</Text>{progress.status === 'downloading' && typeof progress.key === 'string' && <Control label="Download pauzeren" onPress={() => { void pauseNarrationDownload(String(progress.key)); }} />}</View>}
    {downloads.map(item => <View key={item.key} style={s.package}><Text style={s.small}>{item.manifest.storyId} · {item.manifest.contentVersion} · {item.manifest.readingLevel} · {item.manifest.voice.label} · {(item.byteLength / 1_000_000).toFixed(1)} MB · {item.complete ? 'offline beschikbaar' : 'gedeeltelijk, hervatten mogelijk'}{item.expiresAt < Number.MAX_SAFE_INTEGER ? ` · geldig tot ${new Date(item.expiresAt).toLocaleString('nl-NL')}` : ''}</Text>
      {!item.complete && <Control label="Download hervatten" disabled={busy} onPress={() => void run(() => fetchPackage(item.manifest))} />}
      <Control label="Alleen dit audiopakket verwijderen" disabled={busy} onPress={() => void run(async () => { await removeNarrationDownload(item.scope, item.key); setMessage('Audio verwijderd. Je leesvoortgang is bewaard.'); })} />
    </View>)}
    {!downloads.length && <Text style={s.small}>Nog geen audiopakketten opgeslagen. Gewoon lezen en een aanwezige lokale Nederlandse apparaatstem blijven beschikbaar.</Text>}
    {!!message && <Text accessibilityLiveRegion="polite" style={s.small}>{message}</Text>}
  </View>;
}
const s = StyleSheet.create({ card: { padding: 16, borderRadius: 18, backgroundColor: '#fffdf6', borderWidth: 1, borderColor: '#dce5d2', gap: 10 }, heading: { fontSize: 19, fontWeight: '800', color: '#294f39' }, small: { color: '#52634f', fontSize: 13, lineHeight: 21 }, package: { borderTopWidth: 1, borderColor: '#dce5d2', paddingTop: 12, gap: 8 } });
