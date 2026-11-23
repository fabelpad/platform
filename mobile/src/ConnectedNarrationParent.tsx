import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { isVoiceSlot, type VoiceSlot } from '../../lib/narration/contracts';
import { cloneConnectedFamily } from './connected-contract';
import { connectedRequest, familySession, loadConnectedFamily, loadConnectedRelease, saveConnectedProgress, type ConnectedFamilyState } from './connected';
import { NarrationSettings } from './NarrationSettings';
import { NarrationDownloads } from './NarrationDownloads';
import { Control } from './NarrationPlayer';
import type { Profile, Story } from './types';

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
/** Mounted only inside the existing, unlocked parent area after active-account
 * confirmation. Personal name settings never enter the family mutation. */
export function ConnectedNarrationParent() {
  const [stored, setStored] = useState<ConnectedFamilyState | null>(null), [parentId, setParentId] = useState(''), [childId, setChildId] = useState('');
  const [catalogue, setCatalogue] = useState<Record<string, unknown>[]>([]), [selected, setSelected] = useState<Story | null>(null), [version, setVersion] = useState('');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''); const generation = useRef(0), live = useRef(true);
  useEffect(() => {
    live.current = true; const token = ++generation.current;
    void Promise.all([familySession(), loadConnectedFamily(), connectedRequest('/api/content')]).then(([session, family, catalogue]) => {
      if (!live.current || generation.current !== token || !session) return;
      setParentId(session.parentId); setStored(family); setChildId(family.snapshot?.family.activeId ?? ''); setCatalogue(Array.isArray(catalogue.stories) ? catalogue.stories.filter(object) : []);
    }).catch(() => setMessage('Maak verbinding om de online voorleesinstellingen en downloads te beheren.'));
    return () => { live.current = false; generation.current++; };
  }, []);
  const child = stored?.snapshot?.family.children.find(value => value.id === childId), fields = stored?.snapshot?.data[childId], prefs = object(fields?.prefs) ? fields.prefs : {};
  const profile: Profile | null = child ? { ...child, ...(isVoiceSlot(prefs.voiceSlot) ? { voiceSlot: prefs.voiceSlot } : {}), picks: {}, storyVersions: selected ? { [selected.id]: version } : {}, favorites: [], calm: prefs.calm === true, largeText: prefs.textSize === 'large' } : null;
  async function changeVoice(slot: VoiceSlot) {
    if (busy || !stored?.snapshot || !child) return;
    const token = generation.current, capturedParent = parentId; setBusy(true); setMessage('');
    try {
      const session = await familySession(); if (!session || session.parentId !== capturedParent || token !== generation.current) return;
      const next = cloneConnectedFamily(stored.snapshot); next.data[child.id] ||= {}; const rawPrefs = next.data[child.id].prefs; const before = object(rawPrefs) ? rawPrefs : {};
      next.data[child.id].prefs = { muted: false, calm: false, ...before, voiceSlot: slot };
      const saved = await saveConnectedProgress(stored.revision, stored.snapshot, next);
      if (live.current && token === generation.current) { setStored(saved); setMessage(saved.pending ? 'De stemvoorkeur is veilig op dit apparaat bewaard en wordt bij verbinding gedeeld.' : 'De stemvoorkeur is binnen je gezin opgeslagen.'); }
    } catch (error) { if (live.current) setMessage(error instanceof Error ? error.message : 'De voorkeur kon niet worden bewaard.'); }
    finally { if (live.current) setBusy(false); }
  }
  return <View style={s.card}><Text accessibilityRole="header" style={s.title}>Voorlezen in je online gezin</Text>
    {stored?.snapshot?.family.children.map(value => <Control key={value.id} label={`${childId === value.id ? '✓ ' : ''}${value.name}`} disabled={busy} onPress={() => { setChildId(value.id); setSelected(null); generation.current++; }} />)}
    {profile && parentId && <>
      <NarrationSettings key={childId} scope={{ kind: 'family', parentId }} profileId={childId} profileName={profile.name} voiceSlot={profile.voiceSlot} onVoiceChange={slot => { void changeVoice(slot); }} />
      <Text style={s.small}>Kies een online verhaal om de audio voor deze tekstversie, dit leesniveau en de gekozen stem te downloaden.</Text>
      {catalogue.map(story => <Control key={String(story.storyId)} label={`Audio bekijken: ${object(story.metadata) ? String(story.metadata.title) : String(story.storyId)}`} disabled={busy} onPress={() => {
        setBusy(true); setMessage(''); const token = generation.current;
        void loadConnectedRelease(String(story.storyId), String(story.contentVersion)).then(result => {
          if (!live.current || token !== generation.current || !object(result.release) || !object(result.release.metadata)) return;
          const value = result.release, metadata = value.metadata as Record<string, unknown>;
          setSelected({ ...value, id: String(value.storyId), title: String(metadata.title), description: String(metadata.description ?? ''), image: '', imageAlt: '', tag: '', stamp: '' } as unknown as Story); setVersion(String(value.contentVersion));
        }).catch(error => setMessage(error instanceof Error ? error.message : 'Het verhaal kon niet worden geladen.')).finally(() => { if (live.current) setBusy(false); });
      }} />)}
      {selected && <NarrationDownloads key={`${childId}:${selected.id}:${version}`} scope={{ kind: 'family', parentId }} profile={profile} stories={[selected]} currentVersion={version} />}
    </>}
    {!!message && <Text accessibilityLiveRegion="polite" style={s.small}>{message}</Text>}
  </View>;
}
const s = StyleSheet.create({ card: { gap: 12, borderTopWidth: 1, borderColor: '#d8e3cc', paddingTop: 16 }, title: { fontSize: 19, lineHeight: 26, fontWeight: '800', color: '#294f39' }, small: { fontSize: 13, lineHeight: 21, color: '#52634f' } });
