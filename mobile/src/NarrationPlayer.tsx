import React, { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { cueAssetForChoice, normalizeVoiceSlot, segmentsForRoute, type NarrationCuePack, type NarrationManifest, type NarrationReadingLevel, type VoiceSlot } from '../../lib/narration/contracts';
import { personalizeStoryText } from '../../src/storyPersonalization';
import { speakOffline, stopSpeech } from './offlineSpeech';
import { audioScope, loadCuePack, loadNarrationManifest, loadNarrationVoices, localNameSettings, narrationEvents, parentRecordings, pauseNarration, playNarration, prepareNarrationAssets, profileAudioScope, resumeNarration, stopNarration, type AudioScope, type NativeDownload, type NativePlayable } from './narration';

type Props = {
  scope: AudioScope; profileId: string; storyId: string; contentVersion: string; readingLevel: NarrationReadingLevel; voiceSlot?: VoiceSlot;
  route: string; ending: boolean; text: string; choices?: string[]; muted?: boolean;
};
export function NarrationPlayer({ scope, profileId, storyId, contentVersion, readingLevel, voiceSlot, route, ending, text, choices = [], muted = false }: Props) {
  const [defaultSlot, setDefaultSlot] = useState<VoiceSlot>('stem-1');
  const slot = normalizeVoiceSlot(voiceSlot, defaultSlot), ownerIdentity = scope.kind === 'local' ? 'local' : scope.parentId;
  const identity = `${ownerIdentity}:${profileId}:${storyId}:${contentVersion}:${readingLevel}:${slot}`;
  const contextKey = `${identity}:${ending ? 'ending' : 'scene'}:${route}:${muted}`;
  const [manifest, setManifest] = useState<NarrationManifest | null>(null), [download, setDownload] = useState<NativeDownload>();
  const [pack, setPack] = useState<NarrationCuePack | null>(null), [status, setStatus] = useState('idle'), [notice, setNotice] = useState(''), [continuous, setContinuous] = useState(false);
  const generation = useRef(0), latest = useRef({ manifest, download, pack, scope, profileId, route, ending, text, muted });
  latest.current = { manifest, download, pack, scope, profileId, route, ending, text, muted };
  const previous = useRef({ identity, route }), continuousRef = useRef(continuous); continuousRef.current = continuous;
  useEffect(() => { let active = true; void loadNarrationVoices().then(value => { if (active) setDefaultSlot(value.defaultVoiceSlot); }); return () => { active = false; }; }, []);
  async function stop() { generation.current++; await Promise.allSettled([stopNarration(), stopSpeech()]); setStatus('idle'); }
  async function play(choiceIndex?: number, forceLocal = false) {
    if (latest.current.muted) return;
    const token = ++generation.current, current = latest.current;
    await Promise.allSettled([stopNarration(), stopSpeech()]);
    if (generation.current !== token) return;
    setStatus('loading'); setNotice('');
    try {
      if (!current.manifest || forceLocal) {
        // Always use editorial/generic source. A child's personal name never
        // reaches an Android TTS engine, even if it incorrectly uses a network voice.
        const generic = personalizeStoryText(choiceIndex === undefined ? current.text : choices[choiceIndex] ?? '', 'Avonturier');
        if (!generic.trim()) throw new Error('Deze keuze heeft geen voorleestekst.');
        setStatus('local'); const result = await speakOffline(generic);
        if (generation.current === token) { setStatus(result === 'done' ? 'done' : 'idle'); setNotice('Lokale Nederlandse apparaatstem.'); }
        return;
      }
      const selected = segmentsForRoute(current.manifest, current.route, choiceIndex === undefined ? current.ending ? 'ending' : 'scene' : 'choice', choiceIndex);
      if (!selected.length) throw new Error('Voor dit deel is nog geen passende opname vrijgegeven.');
      const name = await localNameSettings(current.scope, current.profileId), recordings = name.mode === 'recording' ? await parentRecordings(current.scope, current.profileId) : [];
      const owner = await audioScope(current.scope), personalOwner = await profileAudioScope(current.scope, current.profileId);
      const items: NativePlayable[] = [], prepareIds = new Set<string>();
      for (const segment of selected) {
        if (segment.kind === 'nameCue' && name.mode === 'recording' && recordings.includes(segment.cueId)) { items.push({ kind: 'recording', scope: personalOwner, cueId: segment.cueId }); continue; }
        const cueId = segment.kind === 'nameCue' && current.pack ? cueAssetForChoice(current.pack, segment.cueId, name) : null;
        if (cueId && current.pack?.assets[cueId]) { items.push({ kind: 'asset', scope: 'public', asset: current.pack.assets[cueId] }); continue; }
        const asset = current.manifest.assets[segment.kind === 'asset' ? segment.asset : segment.fallbackAsset];
        if (!asset) throw new Error('Een opname ontbreekt. Je kunt wel verder lezen.');
        items.push({ kind: 'asset', scope: owner, asset, ...(current.download ? { key: current.download.key } : {}) });
        if (!current.download) prepareIds.add(asset.id);
      }
      if (prepareIds.size) await prepareNarrationAssets(current.manifest, [...prepareIds], current.scope);
      if (generation.current !== token) return;
      const result = await playNarration(items);
      if (generation.current === token) {
        setStatus(result === 'done' ? 'done' : 'idle');
        if (result === 'error') setNotice('Deze audio kon niet worden afgespeeld. Kies de lokale apparaatstem of lees verder.');
      }
    } catch (error) {
      if (generation.current !== token) return;
      setStatus('idle'); setNotice(error instanceof Error ? error.message : 'Voorlezen is nu niet beschikbaar. Je kunt verder lezen.');
    }
  }
  const playRef = useRef(play); playRef.current = play;
  useEffect(() => {
    const token = ++generation.current, auto = continuousRef.current && previous.current.identity === identity && previous.current.route !== route;
    previous.current = { identity, route }; setManifest(null); setDownload(undefined); setPack(null); setStatus('idle'); setNotice('');
    void Promise.allSettled([stopNarration(), stopSpeech()]);
    if (!muted) void loadNarrationManifest({ storyId, contentVersion, readingLevel, voiceSlot: slot }, scope).then(async result => {
      if (generation.current !== token) return;
      const names = result.manifest ? await loadCuePack(slot, result.manifest.voice.presetVersion, result.manifest.cuePack) : null;
      if (generation.current !== token) return;
      setManifest(result.manifest); setDownload(result.download); setPack(names); setNotice(result.reason ?? '');
      latest.current = { ...latest.current, manifest: result.manifest, download: result.download, pack: names };
      if (auto && result.manifest) void playRef.current();
    }).catch(() => { if (generation.current === token) setNotice('De opnamen konden niet worden gecontroleerd. Je kunt de lokale apparaatstem proberen.'); });
    return () => { generation.current++; void Promise.allSettled([stopNarration(), stopSpeech()]); };
  }, [contextKey]); // The complete account/profile/release/route identity invalidates every late callback.
  useEffect(() => {
    const events = narrationEvents('onPlayback', value => {
      if (value.status === 'playing') setStatus('playing');
      else if (value.status === 'paused') setStatus('paused');
      else if (value.status === 'interrupted') { generation.current++; setStatus('idle'); setNotice('Voorlezen is onderbroken. Tik zelf op afspelen om verder te luisteren.'); }
    });
    const app = AppState.addEventListener('change', value => { if (value !== 'active') { generation.current++; setStatus('idle'); void Promise.allSettled([stopNarration(), stopSpeech()]); } });
    return () => { events.remove(); app.remove(); };
  }, []);
  return <View style={styles.card}>
    <Text style={styles.label}>Voorlezen{manifest ? ' · AI-voorleesstem' : ' · apparaatstem'}</Text>
    <View style={styles.row}>
      {status === 'playing' ? <Control label="Pauzeer voorlezen" onPress={() => { void pauseNarration().then(() => setStatus('paused')); }} />
        : status === 'paused' ? <Control label="Hervat voorlezen" onPress={() => { void resumeNarration(); }} />
          : status === 'local' ? <Control label="Stop apparaatstem" onPress={() => { void stop(); }} />
            : <Control label={status === 'loading' ? 'Audio laden…' : 'Speel voorlezen af'} disabled={status === 'loading' || muted} onPress={() => { void play(); }} />}
      <Control label="Opnieuw voorlezen" disabled={muted} onPress={() => { void play(); }} />
    </View>
    {manifest && <View style={styles.row}><Switch accessibilityLabel="Doorluisteren na mijn keuze" value={continuous} onValueChange={setContinuous} /><Text style={styles.small}>Doorluisteren na mijn keuze</Text></View>}
    {choices.map((_, index) => <Control key={index} label={`Luister naar keuze ${index + 1}`} disabled={muted} onPress={() => { void play(index); }} />)}
    {!!notice && <Text accessibilityLiveRegion="polite" style={styles.small}>{notice}</Text>}
    {manifest && notice && <Control label="Gebruik lokale apparaatstem" disabled={muted} onPress={() => { void play(undefined, true); }} />}
    {muted && <Text style={styles.small}>Geluid staat uit voor dit profiel.</Text>}
  </View>;
}
export function Control({ label, onPress, disabled = false }: { label: string; onPress(): void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.button, disabled && { opacity: .45 }]}><Text style={styles.buttonText}>{label}</Text></Pressable>;
}
const styles = StyleSheet.create({ card: { borderWidth: 1, borderColor: '#d9e3d0', borderRadius: 18, padding: 14, gap: 10, backgroundColor: '#f3f6e9' }, label: { fontWeight: '800', fontSize: 15, color: '#294f39' }, small: { color: '#52634f', fontSize: 13, lineHeight: 20, flexShrink: 1 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' }, button: { minHeight: 48, justifyContent: 'center', borderRadius: 12, backgroundColor: '#e1ebd7', padding: 12 }, buttonText: { color: '#294f39', fontSize: 13, fontWeight: '700' } });
