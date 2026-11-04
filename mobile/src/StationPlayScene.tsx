import React, { useEffect, useRef, useState } from 'react';
import { AppState, ImageBackground, StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { createStationInteraction, stationInstruction } from './stationInteraction';
import type { StationPlayAction } from './stationInteraction';

function Action({ title, detail, onPress, disabled = false }: { title: string; detail?: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.action, disabled && { opacity: .5 }]}><Text style={styles.actionTitle}>{title}</Text>{detail && <Text style={styles.body}>{detail}</Text>}</Pressable>;
}

export default function StationPlayScene({ step, calm, onChoose }: { step: 0 | 1; calm: boolean; onChoose: (index: number) => void }) {
  const callback = useRef(onChoose); callback.current = onChoose;
  const controller = useRef<ReturnType<typeof createStationInteraction> | null>(null);
  const [state, setState] = useState(() => ({ step, phase: 'choosing' as const, choice: null } as ReturnType<ReturnType<typeof createStationInteraction>['getState']>));
  const travel = useSharedValue(0), lever = useSharedValue(0);
  const trainStyle = useAnimatedStyle(() => ({ transform: [{ translateX: travel.value }] }));
  const leverStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${lever.value}deg` }] }));

  useEffect(() => {
    const interaction = createStationInteraction(step, setState, choice => callback.current(choice), calm ? 80 : 900);
    controller.current = interaction; setState(interaction.getState());
    const subscription = AppState.addEventListener('change', status => {
      if (status === 'active') interaction.resume();
      else { interaction.suspend(); cancelAnimation(travel); cancelAnimation(lever); travel.value = 0; lever.value = 0; }
    });
    return () => { interaction.dispose(); controller.current = null; subscription.remove(); cancelAnimation(travel); cancelAnimation(lever); };
  }, [step, calm, travel, lever]);
  useEffect(() => {
    travel.value = withTiming(state.phase === 'leaving' && !calm ? (state.choice === 0 ? -180 : 180) : 0, { duration: calm ? 0 : 800 });
    lever.value = withTiming(state.choice === null || step === 0 ? 0 : state.choice === 0 ? -35 : 35, { duration: calm ? 0 : 260 });
  }, [state, calm, step, travel, lever]);
  const apply = (action: StationPlayAction) => controller.current?.apply(action);
  const leaving = state.phase === 'leaving';

  return <View style={styles.frame} accessibilityLabel={step === 0 ? 'Speel mee op het perron' : 'Bedien de spoorwissel'}>
    <ImageBackground source={require('../assets/art/station.webp')} style={styles.scene} imageStyle={{ opacity: .2 }}>
      <Text style={styles.eyebrow}>JIJ LAAT HET GEBEUREN</Text>
      {state.phase === 'choosing' && step === 0 && <View style={styles.actions}>
        <Action title="🐉 Help Dibbel" detail="Zijn kaartje is gescheurd" onPress={() => apply({ type: 'choose', choice: 0 })} />
        <Action title="🗝 Ontdek de sleutel" detail="Wat zit er in het kastje?" onPress={() => apply({ type: 'choose', choice: 1 })} />
      </View>}
      {(state.phase === 'ticket' || state.phase === 'repaired') && <>
        <View style={styles.ticket}><Text style={styles.eyebrow}>DIBBELS KAARTJE</Text><Text style={styles.symbol}>🎫 {state.phase === 'repaired' ? '⭐' : '⋮'}</Text><Text style={styles.title}>Een reis naar overal</Text></View>
        {state.phase === 'ticket' && <Action title="⭐ Plak de sterrensticker" detail="Een tikje is genoeg" onPress={() => apply({ type: 'repair' })} />}
      </>}
      {(state.phase === 'cabinet' || state.phase === 'map') && <>
        <View style={styles.cabinet}><Text style={styles.symbol}>{state.phase === 'map' ? '🗺' : '🔒'}</Text><Text style={styles.title}>{state.phase === 'map' ? 'Een spoor naar overal' : 'Het geheimzinnige kastje'}</Text></View>
        {state.phase === 'cabinet' && <Action title="🗝 Draai de gouden sleutel" onPress={() => apply({ type: 'unlock' })} />}
      </>}
      {step === 1 && <>
        <View style={styles.actions}><Action title="♫ Het muziekbos" detail="Volg de melodie" disabled={leaving} onPress={() => apply({ type: 'choose', choice: 0 })} /><Action title="✦ De lantaarns" detail="Volg het gouden licht" disabled={leaving} onPress={() => apply({ type: 'choose', choice: 1 })} /></View>
        <View style={styles.switch}><Animated.View style={[styles.lever, leverStyle]} /><Text style={styles.body}>Jouw wissel</Text></View>
      </>}
      <Animated.View style={[styles.train, trainStyle]} accessible={false}><Text style={styles.symbol}>🚂</Text></Animated.View>
    </ImageBackground>
    <View style={styles.instruction}><Text accessibilityLiveRegion="polite" style={styles.title}>{stationInstruction(state)}</Text>{(state.phase === 'repaired' || state.phase === 'map') && <Action title="Instappen →" onPress={() => apply({ type: 'depart' })} />}{leaving && <Text style={styles.body}>Iedereen aan boord…</Text>}</View>
  </View>;
}

const styles = StyleSheet.create({
  frame: { marginTop: 16, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: '#ccdab9', backgroundColor: '#e8efda' },
  scene: { padding: 20, minHeight: 300, justifyContent: 'center', gap: 12 }, eyebrow: { color: '#52724b', fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
  title: { fontSize: 19, lineHeight: 28, color: '#244d36', fontWeight: '800' }, body: { color: '#52694c', fontSize: 14, lineHeight: 22 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, action: { flexGrow: 1, flexBasis: 130, minHeight: 64, padding: 17, backgroundColor: '#fffbee', borderRadius: 18, borderWidth: 1, borderColor: '#b9cba4', justifyContent: 'center', gap: 5 }, actionTitle: { color: '#244d36', fontSize: 17, fontWeight: '800' },
  ticket: { backgroundColor: '#ffeda8', padding: 22, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed', borderColor: '#b08d3b', alignItems: 'center' }, symbol: { fontSize: 48 },
  cabinet: { borderWidth: 7, borderColor: '#9a774e', padding: 22, borderRadius: 12, backgroundColor: '#e0c997', alignItems: 'center' },
  instruction: { backgroundColor: '#fff4d2', padding: 20, gap: 12 }, train: { alignItems: 'center', height: 62 }, switch: { alignItems: 'center', padding: 10 }, lever: { width: 12, height: 42, borderRadius: 6, backgroundColor: '#996a3d', marginBottom: 7 },
});
