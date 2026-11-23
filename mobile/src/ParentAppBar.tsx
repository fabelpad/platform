import React, { useRef } from 'react';
import { AccessibilityInfo, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { assets } from './assets';
import { nativeTabs, type NativeScreen } from './parentNavigation';

type Props = {
  active: NativeScreen;
  menuOpen: boolean;
  onMenuChange(open: boolean): void;
  onNavigate(screen: NativeScreen): void;
  onStories(): void;
};

export function ParentAppBar({ active, menuOpen, onMenuChange, onNavigate, onStories }: Props) {
  const trigger = useRef<React.ComponentRef<typeof Pressable>>(null);
  const selected = useRef<React.ComponentRef<typeof Pressable>>(null);
  function close() {
    onMenuChange(false);
    requestAnimationFrame(() => { if (trigger.current) AccessibilityInfo.sendAccessibilityEvent(trigger.current, 'focus'); });
  }
  function navigate(section: NativeScreen) { close(); onNavigate(section); }
  return <View style={s.bar}>
    <Pressable accessibilityRole="button" accessibilityLabel="Terug naar de verhalen" accessibilityHint="Opent de verhalenbibliotheek" onPress={onStories} style={s.iconButton}>
      <View style={s.book} accessible={false}><View style={s.bookPage} /><View style={s.bookPage} /></View>
    </Pressable>
    <Image source={assets['/brand/logo.webp']} accessibilityLabel="Fabelpad" style={s.logo} resizeMode="contain" />
      <Pressable ref={trigger} accessibilityRole="button" accessibilityLabel={menuOpen ? 'Oudermenu sluiten' : 'Oudermenu openen'} accessibilityState={{ expanded: menuOpen }} onPress={() => onMenuChange(!menuOpen)} style={[s.iconButton, menuOpen && s.activeButton]}>
        <View style={s.hamburger} accessible={false}>{[0, 1, 2].map(line => <View key={line} style={s.line} />)}</View>
      </Pressable>
    <Modal transparent visible={menuOpen} animationType="fade" statusBarTranslucent onRequestClose={close} onShow={() => { if (selected.current) AccessibilityInfo.sendAccessibilityEvent(selected.current, 'focus'); }}>
      <SafeAreaView style={s.modal} edges={['top', 'bottom', 'left', 'right']}>
        <Pressable accessibilityLabel="Oudermenu sluiten" accessibilityRole="button" onPress={close} style={StyleSheet.absoluteFill} />
        <View style={s.menu} accessibilityViewIsModal>
          <View style={s.menuHeading}><Text accessibilityRole="header" style={s.menuTitle}>Fabelpad</Text><Pressable accessibilityRole="button" accessibilityLabel="Oudermenu sluiten" onPress={close} style={s.closeButton}><Text style={s.closeText}>×</Text></Pressable></View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.menuItems}>
            {nativeTabs.map(tab => <Pressable key={tab.id} ref={tab.id === active ? selected : undefined} accessibilityRole="button" accessibilityState={{ selected: tab.id === active }} accessibilityLabel={`${tab.label}${tab.id === active ? ', huidige pagina' : ''}`} onPress={() => navigate(tab.id)} style={[s.menuItem, tab.id === active && s.menuItemActive]}>
              <Text accessible={false} style={s.menuSymbol}>{tab.symbol}</Text><Text style={s.label}>{tab.label}</Text><Text accessible={false} style={s.marker}>{tab.id === active ? '✓' : '›'}</Text>
            </Pressable>)}
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  </View>;
}

const s = StyleSheet.create({
  bar: { minHeight: 64, paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: '#fffdf5', borderBottomWidth: 1, borderColor: '#e1e7d9' },
  logo: { width: 119, height: 45 },
  iconButton: { width: 48, height: 48, borderWidth: 1, borderColor: '#dce5d4', borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f4e8' }, activeButton: { backgroundColor: '#dfead5' },
  book: { width: 25, height: 21, flexDirection: 'row', gap: 2 }, bookPage: { flex: 1, borderWidth: 2, borderColor: '#28543d', borderTopLeftRadius: 4, borderTopRightRadius: 4, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  hamburger: { gap: 4 }, line: { width: 20, height: 2, backgroundColor: '#28543d', borderRadius: 2 },
  modal: { flex: 1, backgroundColor: 'rgba(20, 39, 29, .25)', padding: 16, alignItems: 'flex-end' },
  menu: { marginTop: 52, width: '100%', maxWidth: 360, maxHeight: '85%', flexShrink: 1, borderRadius: 24, padding: 10, backgroundColor: '#fffdf5', borderWidth: 1, borderColor: '#dce5d4', elevation: 10 },
  menuHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 12 }, menuTitle: { fontSize: 13, fontWeight: '800', color: '#5d735d', textTransform: 'uppercase', letterSpacing: 1 }, closeButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }, closeText: { fontSize: 28, color: '#28543d' },
  menuItems: { gap: 4 }, menuItem: { minHeight: 64, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }, menuItemActive: { backgroundColor: '#e7efdc' }, menuSymbol: { fontSize: 23, color: '#28543d', width: 28, textAlign: 'center' }, label: { flex: 1, color: '#244d36', fontSize: 16, fontWeight: '800', lineHeight: 23 }, description: { color: '#63755e', fontSize: 12, lineHeight: 19, marginTop: 2 }, marker: { fontSize: 23, color: '#28543d' },
});
