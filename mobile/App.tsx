import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Alert, Animated, AppState, BackHandler, FlatList, Image, Linking, Pressable, ScrollView, StatusBar, StyleSheet, Switch, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { appendChoice } from './src/readerProgress';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { runtimeConfig, closeBirthDatePicker, pickBirthDate, speakOffline, stopSpeech } from './src/offlineSpeech';
import content from './src/content.json';
import { releaseCatalog } from './src/releaseCatalog';
import { storiesForProfile } from './src/storyReleases';
import { assets } from './src/assets';
import { freshStore, loadStore, persistStore, removeStore } from './src/storage';
import { completedCount, completedRoute, completedVersion, amsterdamDate, automaticReadingLevel, effectiveReadingLevel, isValidBirthDate, nextAmsterdamDayDelay, profileWithReadingSettings, readingContent, readingLevels, withCompatibleReading } from './src/readingLevels';
import type { Choice, Profile, ReadingLevel, Store, Story } from './src/types';
import { personalizeStoryText } from '../src/storyPersonalization';
import { PARENT_SESSION_MS, parentSessionIsActive, parentYearAllowsAccess } from './src/parentAccess';
import { ConnectedParentArea, ConnectedLibrary } from './src/ConnectedFamily';

const stories = content.stories as Story[];
const avatars = ['🌿', '⭐', '🌙', '🚀'];
type Screen = 'library' | 'connected-library' | 'reader' | 'profiles' | 'parent' | 'parent-gate' | 'profile-settings' | 'treasures';
type Replay = { storyId: string; version: string; route: number[]; step: number };
const personalize = personalizeStoryText;

function Button({ label, onPress, secondary = false, disabled = false }: { label: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [s.button, secondary && s.secondary, disabled && { opacity: .45 }, pressed && { opacity: .8 }]}><Text style={[s.buttonText, secondary && s.secondaryText]}>{label}</Text></Pressable>;
}

function ReadingLevelPicker({ value, onChange }: { value: ReadingLevel; onChange: (value: ReadingLevel) => void }) {
  return <View style={s.levelPicker}><Text style={s.settingLabel}>Handmatig leesniveau</Text><View style={s.chips} accessibilityRole="radiogroup">{readingLevels.map(level => <Pressable key={level.id} accessibilityRole="radio" accessibilityState={{ checked: value === level.id }} onPress={() => onChange(level.id)} style={[s.chip, s.levelOption, value === level.id && s.chipActive]}><Text style={[s.chipText, value === level.id && s.chipTextActive]}>{level.label}</Text></Pressable>)}</View></View>;
}

function IllustratedChoices({ choices, image, imageAlt, childName, onChoose }: { choices: Choice[]; image: string; imageAlt: string; childName: string; onChoose: (choice: number) => void }) {
  const symbols: Record<string, string> = { heart: '♥', sparkles: '✦', music: '♫', moon: '☾', leaf: '❧', compass: '✧' };
  return <View style={s.playPrent}>
    <Image source={assets[image]} style={s.playArt} resizeMode="cover" accessibilityLabel={imageAlt} />
    <View pointerEvents="none" style={s.playShade} />
    <View style={s.playChoices}>{choices.map((choice, index) => <Pressable key={index} accessibilityRole="button" accessibilityLabel={personalize(choice.label, childName)} accessibilityHint={personalize(choice.hint, childName)} onPress={() => onChoose(index)} style={({ pressed }) => [s.choice, s.illustratedChoice, pressed && { backgroundColor: '#dbe9cf' }]}>
      <View style={[s.choiceSymbol, index === 1 && s.choiceSymbolGold]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><Text style={s.choiceGlyph}>{symbols[choice.icon] || '✦'}</Text></View>
      <View style={s.choiceCopy}><Text style={s.choiceTitle}>{personalize(choice.label, childName)}</Text>{!!choice.hint && <Text style={s.body}>{personalize(choice.hint, childName)}</Text>}</View>
    </Pressable>)}</View>
  </View>;
}

export default function App() { return <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaProvider><Fabelpad /></SafeAreaProvider></GestureHandlerRootView>; }
function Fabelpad() {
  const [store, setStore] = useState<Store | null>(null);
  const [screen, setScreen] = useState<Screen>('library');
  const [storyId, setStoryId] = useState('station');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Alles');
  const [draftName, setDraftName] = useState('');
  const [draftAvatar, setDraftAvatar] = useState(0);
  const [draftBirthDate, setDraftBirthDate] = useState('');
  const [draftOverride, setDraftOverride] = useState<ReadingLevel | undefined>();
  const [profileError, setProfileError] = useState('');
  const [today, setToday] = useState(amsterdamDate);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [parentSessionUntil, setParentSessionUntil] = useState(0);
  const parentSessionRef = useRef(0);
  const parentAction = useRef<(() => void) | null>(null);
  const [parentYear, setParentYear] = useState('');
  const [saving, setSaving] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [contentChanged, setContentChanged] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [playMode, setPlayMode] = useState(true);
  const [replay, setReplay] = useState<Replay | null>(null);
  const replayRef = useRef<Replay | null>(null); replayRef.current = replay;
  const [readerVisit, setReaderVisit] = useState(0);
  const [readerMinHeight, setReaderMinHeight] = useState(0);
  const storeRef = useRef(store); storeRef.current = store;
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const passageTitle = useRef<React.ComponentRef<typeof Text>>(null);
  const modeButton = useRef<React.ComponentRef<typeof Pressable>>(null);
  const readerFrame = useRef<number | null>(null);
  const readyReaderContent = useRef<string | null>(null);
  const readerActionGeneration = useRef(0);
  const readerScrollOffset = useRef(0);
  const readerViewportHeight = useRef(0);
  const playModeRef = useRef(playMode); playModeRef.current = playMode;
  const screenRef = useRef(screen); screenRef.current = screen;
  const opacity = useRef(new Animated.Value(1)).current;
  const speechToken = useRef(0);
  const saveToken = useRef(0);
  const { width, fontScale } = useWindowDimensions();
  const hasParentAccess = parentSessionIsActive(parentSessionUntil);
  const profile = store?.profiles.find(p => p.id === store.activeId) || store?.profiles[0];
  const profileStories = profile ? storiesForProfile(stories, releaseCatalog, profile) : stories;
  const storyVersion = replay?.version || profile?.storyVersions?.[storyId] || content.contentVersion;
  const pinnedStory = releaseCatalog[storyVersion]?.stories.find(item => item.id === storyId) || stories.find(item => item.id === storyId) || stories[0];
  const story = withCompatibleReading(pinnedStory, stories.find(item => item.id === pinnedStory.id));
  const picks = replay ? replay.route.slice(0, replay.step) : profile?.picks[story.id] || [];
  const complete = picks.length === content.parts;
  const readingLevel = effectiveReadingLevel(profile, profile?.readingLevel, today);
  const activeContent = readingContent(story, readingLevel);
  const passage = complete ? activeContent.endings[picks.join('')] : activeContent.scenes[picks.join('')];
  const choices = activeContent.scenes[picks.join('')]?.choices;
  const calm = !!profile?.calm || reducedMotion;
  const playable = !complete && !replay;
  const playImage = story.id === 'station' && picks.length < 2 ? '/art/play/station-platform.webp' : story.playImage || story.image;
  const readerContentKey = `${readerVisit}:${profile?.id}:${storyVersion}:${story.id}:${picks.join('')}:${readingLevel}`;
  const readerContentRef = useRef(readerContentKey); readerContentRef.current = readerContentKey;

  useEffect(() => {
    let active = true;
    void loadStore(content.contentVersion, [...new Set(Object.values(releaseCatalog).flatMap(release => release.stories.map(item => item.id)))], Object.keys(releaseCatalog)).then(result => { if (active) { setStore(result.store); setContentChanged(result.contentChanged); } }).catch(() => { if (active) { setStore(freshStore(content.contentVersion)); setStorageError(true); setMessage('Opgeslagen gegevens konden niet worden geopend. Deze sessie blijft tijdelijk; je eerdere gegevens worden niet overschreven.'); } });
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReducedMotion(value); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => { active = false; subscription.remove(); };
  }, []);
  useEffect(() => { const sub = BackHandler.addEventListener('hardwareBackPress', () => { if (screen !== 'library') { leaveReader('library'); return true; } return false; }); return () => sub.remove(); }, [screen]);
  useEffect(() => {
    speechToken.current += 1; void stopSpeech().catch(() => {}); setSpeaking(false);
    opacity.stopAnimation(); opacity.setValue(calm ? 1 : .4);
    if (!calm) Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    return () => opacity.stopAnimation();
  }, [screen, storyId, profile?.id, picks.length, readingLevel, calm, opacity]);
  useEffect(() => () => { if (readerFrame.current !== null) cancelAnimationFrame(readerFrame.current); }, []);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refreshDate = () => {
      clearTimeout(timer);
      const now = new Date(); setToday(amsterdamDate(now));
      timer = setTimeout(refreshDate, nextAmsterdamDayDelay(now));
    };
    refreshDate();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') refreshDate();
      else { parentSessionRef.current = 0; setParentSessionUntil(0); setParentYear(''); void closeBirthDatePicker().catch(() => {}); speechToken.current += 1; void stopSpeech().catch(() => {}); setSpeaking(false); }
    });
    return () => { clearTimeout(timer); subscription.remove(); speechToken.current += 1; void stopSpeech().catch(() => {}); };
  }, []);

  useEffect(() => {
    if (!parentSessionIsActive(parentSessionUntil)) return;
    const timer = setTimeout(() => { parentSessionRef.current = 0; setParentSessionUntil(0); setParentYear(''); void closeBirthDatePicker().catch(() => {}); }, Math.max(1, parentSessionUntil - Date.now()));
    return () => clearTimeout(timer);
  }, [parentSessionUntil]);

  function commit(next: Store) {
    storeRef.current = next; setStore(next);
    if (storageError) { setMessage('Alleen in deze sessie bewaard. Herstel eerst de apparaatopslag in het ouderhoekje.'); return; }
    const token = ++saveToken.current; setSaving(true);
    void persistStore(next).then(() => { if (token === saveToken.current) { setSaving(false); setMessage('Op dit apparaat bewaard.'); } }).catch(() => { if (token === saveToken.current) { setSaving(false); setStorageError(true); setMessage('Bewaren op dit apparaat lukt niet. Houd de app open; je keuzes staan nog in deze sessie.'); } });
  }
  function updateProfile(fn: (p: Profile) => Profile) {
    const current = storeRef.current;
    if (!current || !profile) return;
    commit({ ...current, profiles: current.profiles.map(p => p.id === profile.id ? fn(p) : p) });
  }
  function openStory(id: string) {
    setToday(amsterdamDate());
    if (contentChanged) { Alert.alert('Nieuwe verhaalversie', 'De gebundelde verhalen zijn gewijzigd. Kies in het ouderhoekje bewust of je met deze versie opnieuw wilt beginnen. Je oude keuzes worden niet automatisch gebruikt.'); openParentArea(); return; }
    readerActionGeneration.current += 1;
    replayRef.current = null; setReplay(null);
    readerScrollOffset.current = 0; setReaderMinHeight(0);
    setReaderVisit(value => value + 1); setStoryId(id); setScreen('reader');
    if (profile && !Object.hasOwn(profile.picks, id)) updateProfile(p => ({ ...p, picks: { ...p.picks, [id]: [] }, storyVersions: { ...p.storyVersions, [id]: content.contentVersion } }));
  }
  function choose(index: number) {
    const current = storeRef.current;
    if (contentChanged || !profile || !current || screenRef.current !== 'reader') return;
    if (replay) {
      if (replayRef.current !== replay || index !== replay.route[replay.step]) return;
      const next = { ...replay, step: replay.step + 1 };
      replayRef.current = next; setReplay(next);
      readerActionGeneration.current += 1; readerScrollOffset.current = 0; setReaderMinHeight(0);
      return;
    }
    const next = appendChoice(current, profile.id, story.id, picks, index, content.parts);
    if (next !== current) { readerActionGeneration.current += 1; readerScrollOffset.current = 0; setReaderMinHeight(0); commit(next); }
  }
  function leaveReader(next: Screen) {
    // Invalidate scene callbacks immediately, before React unmounts the old play scene.
    readerActionGeneration.current += 1; screenRef.current = next; setScreen(next);
    replayRef.current = null; setReplay(null);
    readerScrollOffset.current = 0; setReaderMinHeight(0);
    if (readerFrame.current !== null) { cancelAnimationFrame(readerFrame.current); readerFrame.current = null; }
  }
  function readerContentReady(key: string) {
    // onLayout can fire again after a mode or text-size change. Only a new passage resets.
    if (screenRef.current !== 'reader' || readerContentRef.current !== key || readyReaderContent.current === key) return;
    readyReaderContent.current = key;
    if (readerFrame.current !== null) cancelAnimationFrame(readerFrame.current);
    readerFrame.current = requestAnimationFrame(() => {
      readerFrame.current = null;
      if (screenRef.current !== 'reader' || readerContentRef.current !== key) return;
      if (passageTitle.current) AccessibilityInfo.sendAccessibilityEvent(passageTitle.current, 'focus');
      scroll.current?.scrollTo({ y: 0, animated: false });
    });
  }
  function toggleReaderMode() {
    readerActionGeneration.current += 1;
    // A shorter mode must still reach the bottom of the current viewport. Reserve only
    // that required space so ScrollView cannot clamp its offset when the play scene unmounts.
    setReaderMinHeight(Math.ceil(Math.max(0, readerScrollOffset.current) + Math.max(0, readerViewportHeight.current)));
    playModeRef.current = !playModeRef.current; setPlayMode(playModeRef.current);
    // Keep accessibility focus on the same mounted button without changing the scroll position.
    if (modeButton.current) AccessibilityInfo.sendAccessibilityEvent(modeButton.current, 'focus');
  }
  function restart() {
    Alert.alert('Een ander pad ontdekken?', 'Je begint dit verhaal bij hoofdstuk 1 met de nieuwste verhaalversie. Je laatst voltooide route en aandenken blijven bewaard.', [{ text: 'Terug', style: 'cancel' }, { text: 'Opnieuw beginnen', onPress: () => {
      readerActionGeneration.current += 1; readerScrollOffset.current = 0; setReaderMinHeight(0); setReaderVisit(value => value + 1);
      replayRef.current = null; setReplay(null);
      updateProfile(p => {
        const previous = completedRoute(p, story.id), previousVersion = completedVersion(p, story.id);
        return { ...p, ...(previous ? { lastCompletedPicks: { ...p.lastCompletedPicks, [story.id]: [...previous] }, lastCompletedStoryVersions: { ...p.lastCompletedStoryVersions, [story.id]: previousVersion || storyVersion } } : {}), picks: { ...p.picks, [story.id]: [] }, storyVersions: { ...p.storyVersions, [story.id]: content.contentVersion } };
      });
    } }]);
  }
  function reread(id: string) {
    setToday(amsterdamDate());
    if (!profile) return;
    const route = completedRoute(profile, id), version = completedVersion(profile, id) || content.contentVersion;
    if (!route || !releaseCatalog[version]?.stories.some(item => item.id === id)) return;
    const next = { storyId: id, version, route: [...route], step: 0 };
    readerActionGeneration.current += 1; readerScrollOffset.current = 0; setReaderMinHeight(0);
    replayRef.current = next; setReplay(next); setReaderVisit(value => value + 1); setStoryId(id); setScreen('reader');
  }
  function speak() {
    if (!passage || !profile) return;
    if (speaking) { speechToken.current += 1; void stopSpeech().catch(() => {}); setSpeaking(false); return; }
    const token = ++speechToken.current;
    void stopSpeech().then(() => {
      if (speechToken.current !== token) return;
      // Saved child names never leave React state for the separate Android TTS engine.
      const text = personalize(`${passage.title}. ${passage.text}`, 'Avonturier');
      setSpeaking(true);
      return speakOffline(text).then(() => { if (speechToken.current === token) setSpeaking(false); });
    }).catch(() => { if (speechToken.current === token) { setSpeaking(false); setMessage('Voorlezen vraagt een geïnstalleerde Nederlandse offline apparaatstem. Je kunt wel verder lezen.'); } });
  }
  function requireParentAccess(action: () => void) {
    if (parentSessionIsActive(parentSessionRef.current)) { action(); return; }
    parentAction.current = action; setParentYear(''); setScreen('parent-gate');
  }
  function openParentArea() { requireParentAccess(() => setScreen('parent')); }
  function confirmParentAccess() {
    if (!parentYearAllowsAccess(parentYear)) return;
    const until = Date.now() + PARENT_SESSION_MS;
    parentSessionRef.current = until; setParentSessionUntil(until); setParentYear('');
    const action = parentAction.current;
    parentAction.current = null;
    if (action) action();
    else if (screen === 'parent-gate') setScreen('parent');
  }
  function openParentLink(url: string) {
    requireParentAccess(() => { setScreen('parent'); void Linking.openURL(url).catch(() => setMessage('De externe app kon niet worden geopend.')); });
  }
  function openProfileSettings(target?: Profile) {
    requireParentAccess(() => {
      setToday(amsterdamDate()); setProfileError('');
      setEditingId(target?.id || null); setDraftName(target?.name || '');
      setDraftAvatar(target?.avatar || 0); setDraftBirthDate(target?.birthDate || '');
      setDraftOverride(target?.readingLevelOverride); setScreen('profile-settings');
    });
  }
  function chooseBirthDate() {
    if (!parentSessionIsActive(parentSessionRef.current)) { requireParentAccess(() => setScreen('profile-settings')); return; }
    setProfileError('');
    const currentDay = amsterdamDate(); setToday(currentDay);
    void pickBirthDate(isValidBirthDate(draftBirthDate, currentDay) ? draftBirthDate : '', currentDay).then(value => {
      if (value !== null && isValidBirthDate(value, amsterdamDate())) setDraftBirthDate(value);
      else if (value !== null) setProfileError('Vul een geldige geboortedatum in die niet in de toekomst ligt.');
    }).catch(() => setProfileError('De datumkiezer kon niet worden geopend. Probeer het opnieuw in de actuele Android-app.'));
  }
  function saveProfile() {
    if (!parentSessionIsActive(parentSessionRef.current)) { requireParentAccess(() => setScreen('profile-settings')); return; }
    const current = storeRef.current, name = draftName.trim().slice(0, 20);
    if (!current || !name) { setProfileError('Vul een voornaam of bijnaam in.'); return; }
    if (!editingId && current.profiles.length >= 5) return;
    const id = editingId || `child-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const previous = current.profiles.find(p => p.id === editingId);
    const base: Profile = previous || { id, name, avatar: draftAvatar, picks: {}, lastCompletedPicks: {}, lastCompletedStoryVersions: {}, favorites: [], calm: false, largeText: false };
    try {
      const next = profileWithReadingSettings({ ...base, name, avatar: draftAvatar, isPersonal: true }, draftBirthDate, draftOverride, !editingId || previous?.isPersonal === false);
      const profiles = editingId ? current.profiles.map(p => p.id === id ? next : p) : [...current.profiles, next];
      commit({ ...current, profiles, activeId: id }); setEditingId(null); setDraftName(''); setDraftBirthDate(''); setDraftOverride(undefined); setProfileError(''); setScreen('parent');
    } catch (error) { setProfileError(error instanceof Error ? error.message : 'Controleer de geboortedatum.'); }
  }

  if (!store || !profile) return <SafeAreaView style={s.root}><View style={s.center}><ActivityIndicator color="#24543e" size="large" /><Text style={s.body}>Jouw verhalen komen eraan…</Text></View></SafeAreaView>;
  const visible = profileStories.filter(item => (filter !== 'Favorieten' || profile.favorites.includes(item.id)) && (filter !== 'Verder lezen' || Object.hasOwn(profile.picks, item.id)) && `${item.title} ${item.description}`.toLocaleLowerCase('nl-NL').includes(query.toLocaleLowerCase('nl-NL')));

  return <SafeAreaView style={s.root} edges={['top', 'left', 'right']}><StatusBar barStyle="dark-content" />
    {screen === 'reader' ? <View style={s.readerBar}>
      <Pressable accessibilityRole="button" accessibilityLabel="Terug naar mijn verhalen" onPress={() => leaveReader('library')} style={s.readerBack}><Text style={s.readerBackText}>←</Text></Pressable>
      <Text style={s.readerBookTitle}>{story.title}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Verhaal sluiten" onPress={() => leaveReader('library')} style={s.readerBack}><Text style={s.readerBackText}>×</Text></Pressable>
    </View> : <View style={s.header}><Pressable accessibilityRole="button" accessibilityLabel="Naar je verhalen" onPress={() => setScreen('library')}><Image source={assets['/brand/logo.webp']} style={s.logo} resizeMode="contain" /></Pressable><Pressable style={s.profileButton} accessibilityRole="button" accessibilityLabel="Kies een kindprofiel" onPress={() => setScreen('profiles')}><Text style={s.avatar}>{avatars[profile.avatar]}</Text><Text style={s.profileName}>{profile.name}</Text></Pressable></View>}
    {screen === 'library' && <FlatList key={width > 700 ? 'tablet' : 'phone'} data={visible} numColumns={width > 700 ? 2 : 1} keyExtractor={item => item.id} contentContainerStyle={s.library} ListHeaderComponent={<><Text style={s.eyebrow}>HÉ, {profile.name.toLocaleUpperCase('nl-NL')}!</Text><Text style={s.heading}>Waar gaan we{ '\n' }vandaag naartoe?</Text><Text style={s.subtitle}>Jij kiest het avontuur. Neem je fantasie mee.</Text><Pressable onPress={() => openStory('station')} accessibilityRole="button" accessibilityLabel="Open Het Verdwaalde Station" style={s.hero}><Image source={assets['/art/station.webp']} style={s.heroImage} /><View style={s.heroLabel}><Text style={s.heroTitle}>Volgende halte:{'\n'}verwondering.</Text><Text style={s.heroAction}>Begin het avontuur →</Text></View></Pressable><TextInput style={s.search} value={query} onChangeText={setQuery} placeholder="Zoek een verhaal…" accessibilityLabel="Zoek een verhaal" placeholderTextColor="#6c7968" /><View style={s.chips}>{['Alles', 'Verder lezen', 'Favorieten'].map(label => <Pressable key={label} accessibilityRole="button" accessibilityState={{ selected: filter === label }} onPress={() => setFilter(label)} style={[s.chip, filter === label && s.chipActive]}><Text style={[s.chipText, filter === label && s.chipTextActive]}>{label}</Text></Pressable>)}</View></>} renderItem={({ item }) => <View style={[s.card, width > 700 && { flex: 1, maxWidth: '49%' }]}><Pressable accessibilityRole="button" onPress={() => openStory(item.id)}><Image source={assets[item.image]} accessibilityLabel={item.imageAlt} style={s.cardImage} /><View style={s.cardCopy}><Text style={s.eyebrow}>{item.tag.toLocaleUpperCase('nl-NL')} · 5 DELEN</Text><Text style={s.cardTitle}>{item.title}</Text><Text style={s.body}>{item.description}</Text><Text style={s.readLink}>{(profile.picks[item.id]?.length || 0) === 5 ? 'Nog een keer beleven' : (profile.picks[item.id]?.length || 0) > 0 ? `Verder bij deel ${profile.picks[item.id].length + 1}` : 'Dit avontuur kies ik'} →</Text></View></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`${profile.favorites.includes(item.id) ? 'Verwijder' : 'Bewaar'} ${item.title} als favoriet`} onPress={() => updateProfile(p => ({ ...p, favorites: p.favorites.includes(item.id) ? p.favorites.filter(id => id !== item.id) : [...p.favorites, item.id] }))} style={s.heart}><Text style={s.heartText}>{profile.favorites.includes(item.id) ? '♥' : '♡'}</Text></Pressable></View>} ListEmptyComponent={<View style={s.empty}><Text style={s.cardTitle}>Hier is nog ruimte voor avontuur.</Text><Text style={s.body}>Kies een verhaal of probeer een andere zoekterm.</Text></View>} ListFooterComponent={<>{runtimeConfig.connected && <Button label="Open mijn online gezinsbibliotheek" onPress={() => setScreen('connected-library')} />}<Text style={s.demoNote}>{runtimeConfig.production ? 'Alle 13 verhalen en illustraties zitten in deze app. Voorlezen werkt alleen met een geïnstalleerde Nederlandse offline apparaatstem.' : 'Native prototype · alle 13 verhalen zitten in deze app. Voorlezen gebruikt alleen een geïnstalleerde Nederlandse offline apparaatstem.'}</Text></>} />}
    {screen === 'connected-library' && runtimeConfig.connected && <ConnectedLibrary onClose={() => setScreen('library')} />}
    {screen === 'reader' && passage && <ScrollView ref={scroll} onLayout={event => { readerViewportHeight.current = event.nativeEvent.layout.height; }} onScroll={event => { readerScrollOffset.current = Math.max(0, event.nativeEvent.contentOffset.y); }} scrollEventThrottle={16} contentContainerStyle={[s.reader, width >= 700 && s.readerWide, { minHeight: readerMinHeight }]}>
      <View style={[s.readerHero, { height: Math.round((width >= 700 ? 300 : 220) * Math.max(1, Math.min(fontScale, 1.6))) }]}>
        <Image source={assets[story.image]} resizeMode="cover" style={s.readerImage} accessibilityLabel={story.imageAlt} />
        <View pointerEvents="none" style={s.readerHeroLabel}><Text style={s.readerHeroTitle}>{story.title}</Text></View>
      </View>
      <View style={s.readerInfo}>
        <Text style={s.eyebrow}>Het avontuur van {profile.name}</Text>
        <Text style={s.progress}>{complete ? 'Jouw avontuur is compleet' : `Deel ${picks.length + 1} van 5`}</Text>
        <View style={s.dots}>{[0, 1, 2, 3, 4].map(n => <View key={n} style={[s.dot, n <= picks.length && s.dotFilled]} />)}</View>
        {!story.readingLevels && <Text style={s.small}>Dit bewaarde avontuur gebruikt de oorspronkelijke verhaaltekst.</Text>}
        {!!replay && <Text style={s.small}>Je leest je laatst voltooide route. Je actieve avontuur blijft bewaard.</Text>}
      </View>
      <Animated.View key={readerContentKey} onLayout={() => readerContentReady(readerContentKey)} style={{ opacity: calm ? 1 : opacity }}>
        <Text ref={passageTitle} accessibilityRole="header" accessible style={s.readerTitle}>{personalize(passage.title, profile.name)}</Text>
        {personalize(passage.text, profile.name).split(/\n\s*\n/u).map((paragraph, index) => <Text key={index} style={[s.readerText, profile.largeText && { fontSize: 23, lineHeight: 36 }]}>{paragraph}</Text>)}
        {complete ? <View style={s.keepsake}>
          <Text style={s.avatar}>✨</Text><Text style={s.eyebrow}>EEN HERINNERING VOOR JOU</Text><Text style={s.cardTitle}>{story.endings[picks.join('')].keepsake}</Text>
          <Button label="Naar mijn schatkist" onPress={() => leaveReader('treasures')} />
          <Button secondary label="Lees deze route terug vanaf hoofdstuk 1" onPress={() => reread(story.id)} />
          <Button secondary label="Een ander pad ontdekken" onPress={restart} />
        </View> : <View style={s.readerChoices}>
          <View style={s.readerChoiceHeading}>
            <Text accessibilityRole="header" style={[s.cardTitle, s.readerChoiceTitle]}>Wat kies jij?</Text>
            {playable && <Pressable ref={modeButton} accessibilityRole="button" accessibilityLabel={playMode ? 'Naar leesmodus' : 'Naar speelmodus'} onPress={toggleReaderMode} style={[s.readerMode, (width < 390 || fontScale > 1.3) && s.readerModeFull]}><Text style={s.readerModeText}>{playMode ? 'Naar leesmodus' : 'Naar speelmodus'}</Text></Pressable>}
          </View>
          {replay && choices ? <Button label={`${personalize(choices[replay.route[replay.step]].label, profile.name)} →`} onPress={() => choose(replay.route[replay.step])} /> : choices && playMode ? <IllustratedChoices choices={choices} image={playImage} imageAlt={story.playImageAlt || story.imageAlt} childName={profile.name} onChoose={choose} /> : choices?.map((choice, index) => <Pressable key={`${picks.length}-${index}`} accessibilityRole="button" onPress={() => choose(index)} style={({ pressed }) => [s.choice, pressed && { backgroundColor: '#dbe9cf' }]}><Text style={s.choiceTitle}>{personalize(choice.label, profile.name)} →</Text>{!!choice.hint && <Text style={s.body}>{personalize(choice.hint, profile.name)}</Text>}</Pressable>)}
        </View>}
      </Animated.View>
      <View style={s.readerControls}>
        <Button secondary label={speaking ? '■ Stop voorlezen' : '▶ Lees voor met offline apparaatstem'} onPress={speak} />
        {!!message && <Text accessibilityLiveRegion="polite" style={s.demoNote}>{message}</Text>}
        <Text style={s.demoNote}>{storageError ? 'Alleen in deze sessie' : saving ? 'Even bewaren…' : replay ? 'Je leest je bewaarde route.' : 'Je plek blijft op dit apparaat bewaard.'}</Text>
      </View>
      <SafeAreaView edges={['bottom']} />
    </ScrollView>}
    {screen === 'profiles' && <ScrollView contentContainerStyle={s.panel}>
      <Text style={s.eyebrow}>IEDER EEN EIGEN WERELD</Text><Text style={s.heading}>Wie gaat er mee?</Text>
      {store.profiles.map(p => <View style={s.profileRow} key={p.id}><Pressable style={s.profileSelect} accessibilityRole="button" onPress={() => { setToday(amsterdamDate()); commit({ ...store, activeId: p.id }); setScreen('library'); }}><Text style={s.avatar}>{avatars[p.avatar]}</Text><View><Text style={s.cardTitle}>{p.name}</Text><Text style={s.small}>{completedCount(p)} stempels</Text></View></Pressable></View>)}
      <Button secondary label="Kindprofielen beheren bij Ouders" onPress={openParentArea} />
    </ScrollView>}
    {(screen === 'parent-gate' || ((screen === 'parent' || screen === 'profile-settings') && !hasParentAccess)) && <ScrollView contentContainerStyle={s.panel}>
      <Text style={s.eyebrow}>VOOR OUDERS</Text><Text style={s.heading}>Het ouderhoekje.</Text>
      <View style={s.settingCard}><Text style={s.body}>Vul je geboortejaar in om kindprofielen en instellingen te beheren. Dit antwoord wordt niet bewaard of verzonden.</Text>
        <TextInput accessibilityLabel="Geboortejaar van de ouder" value={parentYear} onChangeText={setParentYear} keyboardType="number-pad" maxLength={4} placeholder="Geboortejaar" style={s.search} />
        <Button label="Open het ouderhoekje" disabled={!parentYearAllowsAccess(parentYear, today)} onPress={confirmParentAccess} />
        <Button secondary label="Terug naar de verhalen" onPress={() => { parentAction.current = null; setParentYear(''); setScreen('library'); }} />
      </View>
    </ScrollView>}
    {screen === 'profile-settings' && hasParentAccess && <ScrollView contentContainerStyle={s.panel}>
      <Text style={s.eyebrow}>VOOR OUDERS</Text><Text style={s.heading}>{editingId ? 'Profielinstellingen' : 'Nieuw kindprofiel'}</Text>
      <View style={s.settingCard}>
        <TextInput accessibilityLabel="Voornaam of bijnaam" style={s.search} value={draftName} maxLength={20} placeholder="Voornaam of bijnaam" onChangeText={setDraftName} />
        <View style={s.chips}>{avatars.map((avatar, index) => <Pressable key={index} onPress={() => setDraftAvatar(index)} accessibilityLabel={`Avatar ${index + 1}`} accessibilityRole="button" accessibilityState={{ selected: index === draftAvatar }} style={[s.chip, draftAvatar === index && s.chipActive]}><Text style={s.avatar}>{avatar}</Text></Pressable>)}</View>
        <Text style={s.settingLabel}>Geboortedatum{!editingId || store.profiles.find(p => p.id === editingId)?.isPersonal === false ? ' (verplicht)' : ''}</Text>
        <Text style={s.small}>We gebruiken de geboortedatum om het leesniveau te kiezen. De datum blijft op dit apparaat en is alleen hier in de profielinstellingen zichtbaar.</Text>
        <Button secondary label={draftBirthDate ? draftBirthDate.split('-').reverse().join('-') : 'Geboortedatum toevoegen'} onPress={chooseBirthDate} />
        <Text style={s.small}>Dag · maand · jaar</Text>
        {editingId && !draftBirthDate && <Text style={s.body}>Je bestaande avonturen blijven beschikbaar. Voeg de geboortedatum toe om het leesniveau automatisch te laten meegroeien.</Text>}
      </View>
      <View style={s.settingCard}>
        <Text style={s.cardTitle}>Leesniveau</Text>
        <Text style={s.body}>{automaticReadingLevel(draftBirthDate, today) ? `Automatisch · ${readingLevels.find(level => level.id === automaticReadingLevel(draftBirthDate, today))?.label}` : `Zonder geboortedatum gebruiken we tijdelijk ${readingLevels.find(level => level.id === effectiveReadingLevel(undefined, store.profiles.find(p => p.id === editingId)?.readingLevel, today))?.label}.`}</Text>
        <View style={s.chips} accessibilityRole="radiogroup">
          <Pressable accessibilityRole="radio" accessibilityState={{ checked: !draftOverride }} onPress={() => setDraftOverride(undefined)} style={[s.chip, !draftOverride && s.chipActive]}><Text style={[s.chipText, !draftOverride && s.chipTextActive]}>Automatisch</Text></Pressable>
          <Pressable accessibilityRole="radio" accessibilityState={{ checked: !!draftOverride }} onPress={() => setDraftOverride(value => value || effectiveReadingLevel({ birthDate: draftBirthDate }, store.profiles.find(p => p.id === editingId)?.readingLevel, today))} style={[s.chip, !!draftOverride && s.chipActive]}><Text style={[s.chipText, !!draftOverride && s.chipTextActive]}>Handmatig</Text></Pressable>
        </View>
        {draftOverride && <><ReadingLevelPicker value={draftOverride} onChange={setDraftOverride} /><Text style={s.small}>Deze handmatige voorkeur blijft actief, ook na een verjaardag of datumwijziging.</Text><Button secondary label="Gebruik automatisch leesniveau" onPress={() => setDraftOverride(undefined)} /></>}
      </View>
      {!!profileError && <Text accessibilityLiveRegion="polite" style={s.error}>{profileError}</Text>}
      <Button label={editingId ? 'Bewaar dit profiel' : 'Maak mijn wereld'} disabled={!draftName.trim() || (!editingId && store.profiles.length >= 5)} onPress={saveProfile} />
      <Button secondary label="Annuleren" onPress={() => { setEditingId(null); setDraftName(''); setDraftBirthDate(''); setDraftOverride(undefined); setProfileError(''); setScreen('parent'); }} />
    </ScrollView>}
    {screen === 'treasures' && <ScrollView contentContainerStyle={s.panel}>
      <Text style={s.eyebrow}>HERINNERINGEN OM TE BEWAREN</Text><Text style={s.heading}>Jouw schatkist.</Text>
      {[...new Set([...profileStories.map(item => item.id), ...Object.keys(profile.lastCompletedPicks || {})])].map(id => {
        const route = completedRoute(profile, id), version = completedVersion(profile, id) || content.contentVersion;
        const item = releaseCatalog[version]?.stories.find(value => value.id === id);
        if (!route || !item?.endings[route.join('')]) return null;
        return <View key={id} style={s.settingCard}><Text style={s.avatar}>⭐</Text><Text style={s.cardTitle}>{item.stamp}</Text><Text style={s.body}>{item.endings[route.join('')].keepsake}</Text><Button secondary label="Lees mijn route terug" onPress={() => reread(id)} /><Button secondary label="Open mijn avontuur" onPress={() => openStory(id)} /></View>;
      })}
      {completedCount(profile) === 0 && <View style={s.empty}><Image source={assets['/brand/mascot.webp']} style={s.mascot} resizeMode="contain" /><Text style={s.cardTitle}>Je eerste schat wacht op je.</Text><Text style={s.body}>Beleef een verhaal helemaal en ontdek jouw herinnering.</Text><Button label="Kies een avontuur" onPress={() => setScreen('library')} /></View>}
    </ScrollView>}
    {screen === 'parent' && hasParentAccess && <ScrollView contentContainerStyle={s.panel}><Text style={s.eyebrow}>VOOR DE GROTE MENSEN</Text><Text style={s.heading}>Hun wereld.{ '\n' }Jouw overzicht.</Text><Text style={s.body}>{runtimeConfig.connected ? 'De dertien meegeleverde verhalen en je lokale profielen blijven beschikbaar. Verbind hieronder zelf je gezin voor de aanvullende online bibliotheek.' : runtimeConfig.production ? 'Fabelpad bewaart kindprofielen met geboortedatum, favorieten, verhaalroutes en voorkeuren op dit apparaat. Je leest zonder account. Alle dertien verhalen zijn inbegrepen.' : 'Demo op dit apparaat. Er is geen ouderaccount, betaling of cloudsynchronisatie aangesloten. Kinderen hebben hier geen e-mailadres nodig.'}</Text><View style={s.settingCard}><Text style={s.cardTitle}>{profile.name}</Text><Text style={s.body}>{Object.keys(profile.picks).length} ontdekte verhalen · {completedCount(profile)} stempels</Text><Text style={s.small}>Beheer geboortedatum en leesniveau uitsluitend in de profielinstellingen.</Text>{store.profiles.map(p => <Button key={p.id} secondary label={`Profielinstellingen van ${p.name}`} onPress={() => openProfileSettings(p)} />)}<Button secondary label="Nieuw kindprofiel" disabled={store.profiles.length >= 5} onPress={() => openProfileSettings()} /></View><View style={s.settingCard}><View style={s.setting}><Text style={s.settingLabel}>Rustige bewegingen</Text><Switch accessibilityLabel="Rustige bewegingen" value={profile.calm} onValueChange={value => updateProfile(p => ({ ...p, calm: value }))} /></View><View style={s.setting}><Text style={s.settingLabel}>Grotere verhaaltekst</Text><Switch accessibilityLabel="Grotere verhaaltekst" value={profile.largeText} onValueChange={value => updateProfile(p => ({ ...p, largeText: value }))} /></View><Text style={s.small}>De voorkeur voor minder beweging van het besturingssysteem wordt ook gevolgd.</Text></View><View style={s.settingCard}><Text style={s.cardTitle}>Verhalen voor onderweg</Text><Text style={s.body}>{runtimeConfig.connected ? 'De dertien meegeleverde verhalen blijven zonder internet beschikbaar. Online gezinsverhalen kun je tijdelijk offline lezen binnen het laatst door de server bevestigde recht; afgeschermde downloads worden bij uitloggen of accountintrekking gewist zodra de app die status ophaalt.' : 'Alle verhaalteksten en illustraties zitten in de app. Je kunt zonder internet lezen.'} Voorlezen gebruikt uitsluitend een geïnstalleerde Nederlandse offline apparaatstem; de naam uit het kindprofiel wordt niet aan die stem doorgegeven.</Text></View>{contentChanged && <View style={s.settingCard}><Text style={s.cardTitle}>Nieuwe verhaalversie</Text><Text style={s.body}>Een eerder opgeslagen verhaalversie ontbreekt. Je oude routes zijn bewaard en worden niet op andere teksten toegepast. Je kunt bewust opnieuw beginnen met de meegeleverde verhalen.</Text><Button label="Met nieuwe verhalen opnieuw beginnen" onPress={() => Alert.alert('Alle verhaalroutes opnieuw beginnen?', 'Profielen en favorieten blijven bewaard. De oude routes worden gewist.', [{ text: 'Terug', style: 'cancel' }, { text: 'Opnieuw beginnen', style: 'destructive', onPress: () => { const next = { ...store, contentVersion: content.contentVersion, profiles: store.profiles.map(p => ({ ...p, picks: {}, storyVersions: {}, lastCompletedPicks: {}, lastCompletedStoryVersions: {} })) }; setContentChanged(false); commit(next); } }])} /></View>}{storageError && <View style={s.settingCard}><Text style={s.cardTitle}>Opslag vraagt aandacht</Text><Text style={s.body}>{message}</Text><Button label="Deze sessie alsnog bewaren" onPress={() => { setSaving(true); void persistStore(store).then(() => { setStorageError(false); setSaving(false); setMessage('Deze sessie is nu bewaard.'); }).catch(() => { setSaving(false); setMessage('Bewaren lukt nog niet. Houd de app open.'); }); }} /></View>}<View style={s.settingCard}><Text style={s.cardTitle}>{runtimeConfig.production ? 'Meegeleverde verhalen inbegrepen' : 'Demo-abonnement'}</Text><Text style={s.body}>{runtimeConfig.connected ? 'De dertien meegeleverde verhalen blijven gratis en offline beschikbaar. Online gezinstoegang en Google Play-abonnementen beheer je hieronder afzonderlijk.' : runtimeConfig.production ? 'Alle dertien verhalen zijn beschikbaar. De app bevat geen advertenties, betaalde aankopen of abonnementen.' : 'Alle verhalen zijn voor deze native prototype-test toegankelijk. Aankopen en abonnementen zijn niet aangesloten.'}</Text></View>{runtimeConfig.connected && <ConnectedParentArea store={store} />}{runtimeConfig.production && <View style={s.settingCard}><Text style={s.cardTitle}>Privacy en hulp</Text><Text style={s.body}>{runtimeConfig.connected ? 'Je kiest als ouder zelf welke lokale kindprofielen en leesgegevens je online binnen je gezin deelt. Je ouderaanmelding staat in beveiligde opslag en afgeschermde downloads zijn op dit apparaat versleuteld.' : 'Kindprofielen en leesgegevens blijven op dit apparaat.'} Je kunt alle lokale gegevens hieronder wissen. Een externe website of e-mailapp openen is voor ouders.</Text>{!!runtimeConfig.privacyUrl && <Button secondary label="Privacybeleid" onPress={() => openParentLink(runtimeConfig.privacyUrl)} />}{!!runtimeConfig.supportUrl && <Button secondary label="Contact en hulp" onPress={() => openParentLink(runtimeConfig.supportUrl)} />}</View>}<Button secondary label={runtimeConfig.production ? 'Alle gegevens op dit apparaat wissen' : 'Demo op dit apparaat wissen'} onPress={() => Alert.alert(runtimeConfig.production ? 'Alle lokale gegevens wissen?' : 'Alle demogegevens wissen?', 'Alle kindprofielen, favorieten, routes en voorkeuren worden van dit apparaat verwijderd. Daarna begin je met een nieuw leeg profiel.', [{ text: 'Bewaren', style: 'cancel' }, { text: 'Wissen', style: 'destructive', onPress: () => { void removeStore().then(() => { const fresh = freshStore(content.contentVersion); storeRef.current = fresh; setStore(fresh); setStorageError(false); setContentChanged(false); setScreen('library'); }).catch(() => setMessage('Wissen is niet gelukt.')); } }])} /></ScrollView>}
    {!!message && screen === 'parent' && hasParentAccess && <Text accessibilityLiveRegion="polite" style={s.status}>{message}</Text>}
    {screen !== 'reader' && <SafeAreaView edges={['bottom']} style={s.bottom}><View style={s.tabs}>{([{ id: 'library', text: '⌂ Ontdek' }, { id: 'treasures', text: '☆ Schatkist' }, { id: 'profiles', text: '☺ Wie speelt?' }, { id: 'parent', text: '⚙ Ouders' }] as { id: Screen; text: string }[]).map(tab => <Pressable key={tab.id} onPress={() => { if (tab.id === 'parent') openParentArea(); else setScreen(tab.id); }} accessibilityRole="button" accessibilityState={{ selected: screen === tab.id }} style={s.tab}><Text style={[s.tabText, screen === tab.id && s.tabActive]}>{tab.text}</Text></Pressable>)}</View></SafeAreaView>}
  </SafeAreaView>;
}

const s = StyleSheet.create({
  error: { color: '#8f342a', backgroundColor: '#ffebdf', padding: 16, borderRadius: 12, fontSize: 15, lineHeight: 23 },
  levelPicker: { gap: 11, marginTop: 18, marginBottom: 12 }, levelOption: { minHeight: 48, justifyContent: 'center' },
  playPrent: { marginTop: 18, borderRadius: 24, overflow: 'hidden', backgroundColor: '#214d38', minHeight: 460, justifyContent: 'flex-end' },
  playArt: { position: 'absolute', width: '100%', height: '100%' },
  playShade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(17, 42, 29, .27)' },
  playChoices: { padding: 16, paddingTop: 200, gap: 12 },
  illustratedChoice: { flexDirection: 'row', gap: 13, alignItems: 'center', marginTop: 0, backgroundColor: '#fffbee', minHeight: 72 },
  choiceSymbol: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#dceacc', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  choiceSymbolGold: { backgroundColor: '#f8e3a2' }, choiceGlyph: { fontSize: 25, color: '#24543e' }, choiceCopy: { flex: 1 },
  root: { flex: 1, backgroundColor: '#fffbee' }, center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20 }, header: { paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: '#e5e8d7' }, logo: { width: 135, height: 54 }, profileButton: { flexDirection: 'row', alignItems: 'center', gap: 7, padding: 9, borderRadius: 18, backgroundColor: '#e9efdc', maxWidth: 180 }, profileName: { fontWeight: '700', color: '#244d36', flexShrink: 1 }, avatar: { fontSize: 27 }, library: { padding: 20, gap: 20, paddingBottom: 35 }, eyebrow: { fontSize: 11, fontWeight: '800', color: '#547559', letterSpacing: 1.4, marginBottom: 8 }, heading: { fontSize: 37, lineHeight: 41, color: '#214d38', fontWeight: '800', letterSpacing: -1.2 }, subtitle: { fontSize: 15, color: '#697260', lineHeight: 23, marginTop: 12, marginBottom: 23 }, hero: { borderRadius: 28, overflow: 'hidden', backgroundColor: '#214d38', marginBottom: 23 }, heroImage: { height: 230, width: '100%' }, heroLabel: { padding: 21 }, heroTitle: { fontSize: 29, fontWeight: '800', lineHeight: 32, color: '#fffbee' }, heroAction: { color: '#ffda72', fontWeight: '800', marginTop: 15, fontSize: 16 }, search: { backgroundColor: '#fffef8', borderColor: '#d4ddc7', borderWidth: 1, borderRadius: 16, padding: 15, minHeight: 50, color: '#244d36', fontSize: 16, marginTop: 12, marginBottom: 12 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 }, chip: { paddingHorizontal: 16, paddingVertical: 11, backgroundColor: '#edf0df', borderRadius: 24, minHeight: 44 }, chipActive: { backgroundColor: '#24543e' }, chipText: { color: '#516b51', fontWeight: '700' }, chipTextActive: { color: '#fffbee' }, card: { borderWidth: 1, borderColor: '#dde3cd', backgroundColor: '#fffef8', borderRadius: 25, overflow: 'hidden', marginBottom: 20 }, cardImage: { width: '100%', height: 210 }, cardCopy: { padding: 21 }, cardTitle: { color: '#244d36', fontSize: 24, fontWeight: '800', lineHeight: 29, marginBottom: 9 }, body: { color: '#68745f', fontSize: 15, lineHeight: 24 }, small: { color: '#6a765f', fontSize: 12, lineHeight: 20 }, readLink: { fontWeight: '800', color: '#24543e', marginTop: 20, fontSize: 15 }, heart: { position: 'absolute', right: 14, top: 14, backgroundColor: '#fffbee', width: 47, height: 47, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }, heartText: { color: '#436d4c', fontSize: 30 }, demoNote: { color: '#77806d', fontSize: 12, lineHeight: 20, marginTop: 17, marginBottom: 12 }, button: { backgroundColor: '#24543e', borderRadius: 16, minHeight: 50, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, marginTop: 12 }, buttonText: { color: '#fffbee', fontSize: 15, fontWeight: '800', textAlign: 'center' }, secondary: { backgroundColor: '#e8eedb' }, secondaryText: { color: '#24543e' }, readerBar: { minHeight: 64, paddingHorizontal: 12, paddingVertical: 8, gap: 10, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: '#e5e8d7', backgroundColor: '#fffbee' }, readerBack: { minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e8eedb', borderRadius: 16 }, readerBackText: { fontSize: 27, color: '#24543e' }, readerBookTitle: { flex: 1, color: '#244d36', fontSize: 18, fontWeight: '800', lineHeight: 26 }, reader: { padding: 22, maxWidth: 860, alignSelf: 'center', width: '100%', paddingBottom: 24 }, readerWide: { paddingHorizontal: 36, paddingTop: 28 }, readerHero: { width: '100%', borderRadius: 24, overflow: 'hidden', backgroundColor: '#214d38' }, readerImage: { width: '100%', height: '100%' }, readerHeroLabel: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(20, 49, 35, .83)', paddingHorizontal: 20, paddingVertical: 14 }, readerHeroTitle: { color: '#fffbee', fontSize: 22, lineHeight: 30, fontWeight: '800' }, readerInfo: { marginTop: 23 }, readerTitle: { color: '#244d36', fontSize: 32, fontWeight: '800', lineHeight: 37, marginVertical: 20 }, readerText: { color: '#364a36', fontSize: 19, lineHeight: 31, marginBottom: 21 }, readerChoices: { marginTop: 7 }, readerChoiceHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, readerChoiceTitle: { flexGrow: 1, flexShrink: 1, flexBasis: 155, marginBottom: 0 }, readerMode: { minWidth: 48, minHeight: 48, marginLeft: 'auto', paddingHorizontal: 15, paddingVertical: 12, borderRadius: 16, backgroundColor: '#e8eedb', alignItems: 'center', justifyContent: 'center' }, readerModeFull: { width: '100%' }, readerModeText: { color: '#24543e', fontSize: 14, lineHeight: 22, fontWeight: '800', textAlign: 'center' }, readerControls: { marginTop: 24 }, progress: { color: '#68745f', fontSize: 13 }, dots: { flexDirection: 'row', gap: 6, marginTop: 11 }, dot: { height: 6, width: 34, backgroundColor: '#e2e6d4', borderRadius: 4 }, dotFilled: { backgroundColor: '#7c9d60' }, choice: { padding: 20, backgroundColor: '#eff3e3', borderWidth: 1, borderColor: '#d8e1c5', borderRadius: 20, marginTop: 13, minHeight: 85 }, choiceTitle: { color: '#24543e', fontSize: 18, fontWeight: '800', marginBottom: 5 }, keepsake: { backgroundColor: '#f3e6ae', borderRadius: 22, padding: 25, marginVertical: 16 }, panel: { padding: 23, gap: 18, width: '100%', maxWidth: 850, alignSelf: 'center', paddingBottom: 35 }, settingCard: { padding: 22, backgroundColor: '#f0f2e3', borderColor: '#dfe5cf', borderWidth: 1, borderRadius: 22, gap: 8 }, setting: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 54 }, settingLabel: { fontSize: 15, fontWeight: '700', color: '#34533d', flexShrink: 1 }, profileRow: { flexDirection: 'row', padding: 14, backgroundColor: '#eff3e3', borderRadius: 22, alignItems: 'center', justifyContent: 'space-between', gap: 12 }, profileSelect: { flex: 1, flexDirection: 'row', gap: 13, alignItems: 'center', padding: 7 }, empty: { padding: 28, alignItems: 'center', backgroundColor: '#edf0df', borderRadius: 23, marginTop: 16 }, mascot: { height: 180, width: 180, marginBottom: 20 }, bottom: { backgroundColor: '#fffdf4', borderTopWidth: 1, borderColor: '#dde3cd' }, tabs: { flexDirection: 'row', paddingVertical: 13 }, tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, tabText: { fontSize: 11, fontWeight: '700', color: '#8b927f' }, tabActive: { color: '#24543e' }, status: { padding: 12, backgroundColor: '#e9efdc', color: '#34533d', fontSize: 12, textAlign: 'center' },
});
