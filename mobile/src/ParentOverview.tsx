import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { completedCount, effectiveReadingLevel, readingLevels } from './readingLevels';
import type { Profile, Store } from './types';

const avatars = ['🌿', '⭐', '🌙', '🚀'];

function SettingLink({ label, onPress, danger = false }: { label: string; onPress(): void; danger?: boolean }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={s.link}><Text style={[s.linkText, danger && s.danger]}>{label}</Text><Text accessible={false} style={[s.chevron, danger && s.danger]}>{danger ? '×' : '›'}</Text></Pressable>;
}

type Props = {
  store: Store;
  profile: Profile;
  today: string;
  onEdit(profile: Profile): void;
  onAdd(): void;
  onPreference(preference: 'calm' | 'largeText', value: boolean): void;
  onOffline(): void;
  onPrivacy(): void;
  onSupport(): void;
  onWipe(): void;
  onLock(): void;
  children?: React.ReactNode;
};

export function ParentOverview({ store, profile, today, onEdit, onAdd, onPreference, onOffline, onPrivacy, onSupport, onWipe, onLock, children }: Props) {
  return <>
    <View style={s.hero}><Text accessible={false} style={s.heroMark}>✧</Text><Text accessibilityRole="header" style={s.title}>Het ouderhoekje</Text><Text style={s.subtitle}>Instellingen voor dit apparaat</Text></View>
    <View style={s.card}>
      <View style={s.sectionHead}><View style={s.sectionCopy}><Text accessibilityRole="header" style={s.sectionTitle}>Kindprofielen</Text><Text style={s.small}>{store.profiles.length} van maximaal 5 · op dit apparaat</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Kindprofiel toevoegen" accessibilityState={{ disabled: store.profiles.length >= 5 }} disabled={store.profiles.length >= 5} onPress={onAdd} style={[s.add, store.profiles.length >= 5 && s.disabled]}><Text style={s.addText}>＋ Toevoegen</Text></Pressable></View>
      {store.profiles.map(child => <View key={child.id} style={s.profileRow}>
        <View style={s.avatar} accessible={false}><Text style={s.avatarText}>{avatars[child.avatar]}</Text></View>
        <View style={s.profileCopy}><Text style={s.profileName}>{child.name}</Text><Text style={s.small}>{completedCount(child)} stempels{child.id === store.activeId ? ' · actief' : ''}</Text><Text style={s.small}>{readingLevels.find(level => level.id === effectiveReadingLevel(child, child.readingLevel, today))?.label}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Kindprofiel van ${child.name} bewerken`} onPress={() => onEdit(child)} style={s.edit}><Text style={s.editText}>Bewerken</Text></Pressable>
      </View>)}
      {store.profiles.length >= 5 && <Text style={s.note}>Je hebt het maximum van vijf kindprofielen bereikt.</Text>}
    </View>
    <View style={s.card}>
      <Text accessibilityRole="header" style={s.sectionTitle}>Leesinstellingen</Text><Text style={s.small}>Voor het actieve profiel: {profile.name}</Text>
      <View style={s.setting}><Text style={s.settingLabel}>Rustige bewegingen</Text><View style={s.switchTarget}><Switch accessibilityLabel={`Rustige bewegingen voor ${profile.name}`} value={profile.calm} onValueChange={value => onPreference('calm', value)} trackColor={{ false: '#d5decf', true: '#9bb98b' }} thumbColor="#fffdf5" /></View></View>
      <View style={s.setting}><Text style={s.settingLabel}>Grotere verhaaltekst</Text><View style={s.switchTarget}><Switch accessibilityLabel={`Grotere verhaaltekst voor ${profile.name}`} value={profile.largeText} onValueChange={value => onPreference('largeText', value)} trackColor={{ false: '#d5decf', true: '#9bb98b' }} thumbColor="#fffdf5" /></View></View>
      <Text style={s.note}>De instelling voor minder beweging van Android wordt ook gevolgd.</Text>
      <SettingLink label="Verhalen voor onderweg" onPress={onOffline} />
    </View>
    {children}
    <View style={s.card}>
      <Text accessibilityRole="header" style={s.sectionTitle}>Privacy en hulp</Text><Text style={s.note}>Beheer hier je lokale appgegevens. Een website of e-mailapp openen is voor ouders.</Text>
      <SettingLink label="Privacybeleid" onPress={onPrivacy} /><SettingLink label="Contact en hulp" onPress={onSupport} /><SettingLink label="Alle gegevens op dit apparaat wissen" danger onPress={onWipe} />
    </View>
    <Pressable accessibilityRole="button" onPress={onLock} style={s.lock}><Text style={s.lockText}>Ouderhoekje vergrendelen</Text></Pressable>
    <Text style={s.sessionNote}>De ouderpoort sluit na vijf minuten en zodra je de app op de achtergrond zet.</Text>
  </>;
}

const s = StyleSheet.create({
  hero: { alignItems: 'center', paddingTop: 5, paddingBottom: 8, gap: 8 }, heroMark: { width: 54, height: 54, textAlign: 'center', textAlignVertical: 'center', fontSize: 35, color: '#527457', backgroundColor: '#e9efde', borderRadius: 18 }, title: { fontSize: 30, lineHeight: 38, fontWeight: '800', color: '#234d36', textAlign: 'center', letterSpacing: -.7 }, subtitle: { color: '#68775f', fontSize: 14, lineHeight: 22, textAlign: 'center' },
  card: { backgroundColor: '#fffdf6', borderWidth: 1, borderColor: '#e0e6d6', borderRadius: 23, padding: 18, gap: 8 }, sectionHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }, sectionCopy: { flexGrow: 1, flexShrink: 1 }, sectionTitle: { color: '#294f39', fontSize: 19, lineHeight: 27, fontWeight: '800' }, small: { color: '#68765f', fontSize: 12, lineHeight: 19 },
  add: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 14, backgroundColor: '#edf2e4' }, addText: { fontSize: 13, fontWeight: '800', color: '#2b563e' }, disabled: { opacity: .45 }, profileRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', borderTopWidth: 1, borderColor: '#e8ebdf', paddingTop: 15, paddingBottom: 7, gap: 10 }, avatar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eaf0dd', borderRadius: 16 }, avatarText: { fontSize: 24 }, profileCopy: { flex: 1, minWidth: 100 }, profileName: { color: '#294f39', fontSize: 17, lineHeight: 24, fontWeight: '800' }, edit: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 13, borderWidth: 1, borderColor: '#d7e1cb' }, editText: { fontSize: 12, fontWeight: '800', color: '#2d563e' },
  setting: { minHeight: 56, flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: '#e8ebdf' }, settingLabel: { flex: 1, color: '#35543f', fontSize: 15, lineHeight: 23 }, switchTarget: { minHeight: 48, minWidth: 48, justifyContent: 'center' }, note: { color: '#6b785f', fontSize: 12, lineHeight: 20, paddingVertical: 4 },
  link: { minHeight: 56, borderTopWidth: 1, borderColor: '#e8ebdf', flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }, linkText: { flex: 1, fontSize: 14, lineHeight: 22, fontWeight: '600', color: '#36553f' }, chevron: { fontSize: 25, color: '#587252' }, danger: { color: '#a04736' }, lock: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 12 }, lockText: { fontSize: 14, lineHeight: 22, color: '#496c4c', fontWeight: '700', textAlign: 'center' }, sessionNote: { fontSize: 11, lineHeight: 18, color: '#708066', textAlign: 'center', paddingHorizontal: 14, paddingBottom: 6 },
});
