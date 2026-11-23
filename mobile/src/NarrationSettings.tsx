import React, { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { cueAssetForChoice, DEFAULT_NAME_CUES, DEFAULT_NARRATION_PRESETS, findNarrationName, normalizeVoiceSlot, type LocalNameMode, type NarrationCuePack, type NarrationVoice, type VoiceSlot } from '../../lib/narration/contracts';
import { Control } from './NarrationPlayer';
import { cancelParentRecording, deleteParentRecording, loadCuePack, loadNarrationVoices, localNameSettings, parentRecordings, playNarration, profileAudioScope, saveLocalNameSettings, saveParentRecording, startParentRecording, stopNarration, stopParentRecording, type AudioScope, type LocalNameSettings } from './narration';
import { stopSpeech } from './offlineSpeech';

export function NarrationSettings({ scope, profileId, profileName, voiceSlot, onVoiceChange }: { scope: AudioScope; profileId: string; profileName: string; voiceSlot?: VoiceSlot; onVoiceChange(value: VoiceSlot): void }) {
  const [voices, setVoices] = useState<NarrationVoice[]>(DEFAULT_NARRATION_PRESETS), [pack, setPack] = useState<NarrationCuePack | null>(null);
  const [name, setName] = useState<LocalNameSettings>({ mode: 'avonturier' }), [saved, setSaved] = useState<string[]>([]), [recording, setRecording] = useState(''), [pending, setPending] = useState('');
  const [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [defaultSlot, setDefaultSlot] = useState<VoiceSlot>('stem-1');
  const generation = useRef(0), initialGeneration = useRef(0), live = useRef(true), selectedSlot = normalizeVoiceSlot(voiceSlot, defaultSlot);
  const owner = scope.kind === 'local' ? 'local' : scope.parentId;
  useEffect(() => {
    live.current = true; const token = ++initialGeneration.current;
    void Promise.all([loadNarrationVoices(), localNameSettings(scope, profileId), parentRecordings(scope, profileId)]).then(([value, local, recordings]) => {
      if (!live.current || token !== initialGeneration.current) return;
      setVoices(value.voices); setDefaultSlot(value.defaultVoiceSlot); setName(local); setSaved(recordings); if (value.reason) setMessage(value.reason);
    }).catch(() => setMessage('De lokale voorleesinstellingen konden niet worden geopend.'));
    const app = AppState.addEventListener('change', state => { if (state !== 'active') { generation.current++; setRecording(''); setPending(''); void Promise.allSettled([stopNarration(), cancelParentRecording()]); } });
    return () => { live.current = false; initialGeneration.current++; generation.current++; app.remove(); void Promise.allSettled([stopNarration(), cancelParentRecording()]); };
  }, [owner, profileId]);
  useEffect(() => {
    const token = ++generation.current;
    const preset = voices.find(value => value.slotId === selectedSlot)?.presetVersion ?? 1;
    setPack(null); void stopNarration();
    void loadCuePack(selectedSlot, preset).then(value => { if (live.current && token === generation.current) setPack(value); });
  }, [selectedSlot, voices]);
  async function run(action: () => Promise<void>) { setBusy(true); setMessage(''); try { await action(); } catch (error) { if (live.current) setMessage(error instanceof Error ? error.message : 'Dit lukte nu niet.'); } finally { if (live.current) setBusy(false); } }
  async function saveName(next: LocalNameSettings) {
    await stopNarration(); await saveLocalNameSettings(scope, profileId, next);
    if (live.current) setName(next);
  }
  function changeMode(mode: LocalNameMode) {
    if (name.mode === 'recording' && mode !== 'recording' && saved.length) {
      Alert.alert('Eigen opnamen verwijderen?', 'Als je Zelf inspreken uitschakelt, verwijderen we de persoonlijke aanspreekzinnen van dit apparaat.', [{ text: 'Bewaren', style: 'cancel' }, { text: 'Uitschakelen en wissen', style: 'destructive', onPress: () => void run(async () => { await cancelParentRecording(); for (const cue of saved) await deleteParentRecording(scope, profileId, cue); setSaved([]); setPending(''); setRecording(''); await saveName({ mode }); }) }]);
    } else void run(() => saveName({ mode }));
  }
  async function preview(cueId?: string) {
    await Promise.allSettled([stopNarration(), stopSpeech()]);
    if (!pack) throw new Error('Het gedeelde namenpakket wacht nog op goedkeuring en publicatie.');
    const id = cueAssetForChoice(pack, cueId ?? pack.cues[0]?.id ?? 'kom-mee', name);
    if (!id) throw new Error('Voor deze zin is nog geen goedgekeurd luistervoorbeeld.');
    const result = await playNarration([{ kind: 'asset', scope: 'public', asset: pack.assets[id] }]);
    if (result === 'error') throw new Error('Het luistervoorbeeld kon niet worden afgespeeld.');
  }
  const matched = pack ? findNarrationName(profileName, pack.catalogue.filter(value => value.kind === 'firstName')) : null;
  const choices = pack?.catalogue.filter(value => value.kind === (name.mode === 'alias' ? 'alias' : 'firstName')) ?? [];
  const cues = pack?.cues ?? DEFAULT_NAME_CUES;
  return <View style={s.card}>
    <Text accessibilityRole="header" style={s.title}>Voorlezen</Text><Text style={s.small}>AI-voorleesstem · kies een vertelstem voor dit profiel. De stemkeuze wordt {scope.kind === 'family' ? 'binnen je gezin gedeeld' : 'op dit apparaat bewaard'}.</Text>
    <View accessibilityRole="radiogroup" style={s.list}>{voices.map(voice => <View key={voice.slotId} style={s.voice}>
      <Pressable accessibilityRole="radio" accessibilityState={{ checked: selectedSlot === voice.slotId }} disabled={busy || !!recording || !!pending} onPress={() => { void stopNarration(); onVoiceChange(voice.slotId); }} style={[s.choice, selectedSlot === voice.slotId && s.selected]}><Text style={s.option}>{selectedSlot === voice.slotId ? '◉ ' : '○ '}{voice.label}{voice.slotId === defaultSlot ? ' · standaard' : ''}</Text></Pressable>
      <Control label={`Luister naar ${voice.label}`} disabled={busy || !!recording || !!pending} onPress={() => void run(async () => {
        const previewPack = await loadCuePack(voice.slotId, voice.presetVersion); if (!previewPack) throw new Error('Deze stem wacht nog op een gepubliceerde luisterproef.');
        const assetId = cueAssetForChoice(previewPack, previewPack.cues[0]?.id ?? 'kom-mee', { mode: 'avonturier' }); if (!assetId) throw new Error('Het luistervoorbeeld is nog niet beschikbaar.');
        await stopNarration(); await stopSpeech(); await playNarration([{ kind: 'asset', scope: 'public', asset: previewPack.assets[assetId] }]);
      })} />
    </View>)}</View>
    <Text accessibilityRole="header" style={s.title}>Aanspreekzinnen op dit apparaat</Text><Text style={s.small}>De naamkeuze en persoonlijke opnamen blijven op dit toestel. We sturen de profielnaam of opname niet naar de aanbieder en nemen ze niet op in gezinsopslag of exports.</Text>
    <View accessibilityRole="radiogroup" style={s.list}>{([['avonturier', 'Avonturier'], ['name', 'Mijn naam'], ['alias', 'Mijn avonturiersnaam'], ['recording', 'Zelf inspreken']] as const).map(([mode, label]) => <Pressable key={mode} accessibilityRole="radio" accessibilityState={{ checked: name.mode === mode }} disabled={busy || !!recording} onPress={() => changeMode(mode)} style={[s.choice, name.mode === mode && s.selected]}><Text style={s.option}>{name.mode === mode ? '◉ ' : '○ '}{label}</Text></Pressable>)}</View>
    {name.mode === 'name' && <Text style={s.small}>{matched ? `Deze profielnaam staat in de ingesproken lijst. Bevestig hieronder de uitspraak van ${matched.displayName}.` : 'De profielnaam heeft geen zekere overeenkomst in de ingesproken lijst. Kies een aanwezige naam, Avonturier of spreek zelf een zin in.'}</Text>}
    {(name.mode === 'name' || name.mode === 'alias') && <>
      {choices.map(item => <Control key={item.id} label={`${name.catalogueId === item.id ? '✓ ' : ''}${item.displayName}`} disabled={busy} onPress={() => void run(() => saveName({ mode: name.mode, catalogueId: item.id, pronunciationId: item.pronunciations[0]?.id ?? 'nl' }))} />)}
      {!choices.length && <Text style={s.small}>De ingesproken lijst wordt beschikbaar na publicatie van het gedeelde namenpakket.</Text>}
    </>}
    {name.mode !== 'recording' && <Control label="Luister naar de gekozen aanspreekzin" disabled={busy || !pack} onPress={() => void run(() => preview())} />}
    {name.mode === 'recording' && <View style={s.list}><Text style={s.small}>Spreek iedere volledige zin zelf in, maximaal 30 seconden. Ontbrekende zinnen gebruiken Avonturier in de gekozen vertelstem. Je eigen stem blijft hoorbaar anders.</Text>
      {cues.map(cue => <View key={cue.id} style={s.cue}><Text style={s.option}>{cue.template.replace('{{naam}}', '…')}</Text>
        {recording === cue.id ? <Control label="Stop opname en luister terug" onPress={() => void run(async () => { await stopParentRecording(); setRecording(''); setPending(cue.id); })} />
          : <Control label={saved.includes(cue.id) ? 'Deze zin opnieuw inspreken' : 'Deze zin inspreken'} disabled={busy || !!recording || !!pending} onPress={() => void run(async () => { const token = generation.current; await startParentRecording(scope, profileId, cue.id, () => live.current && generation.current === token); if (live.current) setRecording(cue.id); })} />}
        {(saved.includes(cue.id) || pending === cue.id) && <Control label={pending === cue.id ? 'Nieuwe opname terugluisteren' : 'Opname terugluisteren'} disabled={busy || !!recording} onPress={() => void run(async () => { await playNarration([{ kind: 'recording', scope: await profileAudioScope(scope, profileId), cueId: cue.id, ...(pending === cue.id ? { pending: true } : {}) }]); })} />}
        {pending === cue.id && <><Control label="Nieuwe opname lokaal bewaren" disabled={busy} onPress={() => void run(async () => { await stopNarration(); await saveParentRecording(); setPending(''); setSaved(await parentRecordings(scope, profileId)); })} /><Control label="Nieuwe opname niet bewaren" disabled={busy} onPress={() => void run(async () => { await stopNarration(); await cancelParentRecording(); setPending(''); })} /></>}
        {saved.includes(cue.id) && !pending && <Control label="Deze persoonlijke opname wissen" disabled={busy || !!recording} onPress={() => void run(async () => { await deleteParentRecording(scope, profileId, cue.id); setSaved(await parentRecordings(scope, profileId)); })} />}
      </View>)}
    </View>}
    {!!message && <Text accessibilityLiveRegion="polite" style={s.small}>{message}</Text>}
  </View>;
}
const s = StyleSheet.create({ card: { borderRadius: 18, borderWidth: 1, borderColor: '#dce5d2', padding: 16, gap: 12, backgroundColor: '#fffdf6' }, title: { color: '#294f39', fontWeight: '800', fontSize: 19, lineHeight: 26 }, small: { fontSize: 13, lineHeight: 21, color: '#52634f' }, list: { gap: 10 }, voice: { gap: 6, borderBottomWidth: 1, borderColor: '#e5eadc', paddingBottom: 12 }, choice: { minHeight: 48, padding: 12, justifyContent: 'center', borderWidth: 1, borderColor: '#dce5d2', borderRadius: 12 }, selected: { backgroundColor: '#e4eed9', borderColor: '#77976d' }, option: { color: '#294f39', fontWeight: '700', fontSize: 14, lineHeight: 21 }, cue: { gap: 8, borderTopWidth: 1, borderColor: '#e5eadc', paddingTop: 12 } });
