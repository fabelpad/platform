import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Control } from './NarrationPlayer';
import { clearNarrationFixtureSharedCache, corruptNarrationFixture, damageNarrationFixtureCue, downloadedNarration, expireNarrationFixture, installNarrationFixture, narrationEvents, narrationFixtureEnabled, pauseNarration, playNarration, removeNarrationDownload, resumeNarration, stopNarration, type NativeDownload } from './narration';

/** This panel cannot appear in a normal or signed build. It exercises real
 * Android files/decoder/focus using a deterministic tone, never provider audio. */
export function NarrationFixture() {
  const [fixture, setFixture] = useState<NativeDownload | null>(null), [status, setStatus] = useState('Geen fixture'), [message, setMessage] = useState(''), [index, setIndex] = useState(0), [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!narrationFixtureEnabled) return;
    let active = true;
    void downloadedNarration({ kind: 'local' }).then(values => { if (active) { const value = values.find(item => item.manifest.storyId === 'ci-audio-fixture' && item.complete); setFixture(value ?? null); if (value) setMessage('Fixturepakket offline beschikbaar'); } });
    const event = narrationEvents('onPlayback', value => { if (active) { setStatus(String(value.status)); setIndex(Number(value.index ?? 0)); } });
    return () => { active = false; event.remove(); void stopNarration(); };
  }, []);
  if (!narrationFixtureEnabled) return null;
  async function run(action: () => Promise<void>) { setBusy(true); try { await action(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Fixturecontrole mislukt'); } finally { setBusy(false); } }
  async function play(ids: string[]) {
    if (!fixture) return;
    setMessage('Synthetische proeftoon, geen Nederlandse providerstem');
    void playNarration(ids.map(id => ({ kind: 'asset', scope: fixture.scope, key: fixture.key, asset: fixture.manifest.assets[id] })));
  }
  async function checkCue(missing: boolean, sidecar = false) {
    if (!fixture) return; await stopNarration(); await damageNarrationFixtureCue(fixture, missing, sidecar);
    const values = await downloadedNarration({ kind: 'local' }); if (!values.some(value => value.key === fixture.key && !value.complete)) throw new Error('Beschadigde naamvariant bleef compleet');
    setFixture(null); const repaired = await installNarrationFixture(); setFixture(repaired.download);
    setMessage(sidecar ? 'Ontbrekende naammetadata geweigerd en hersteld' : missing ? 'Ontbrekende ongekozen naamvariant geweigerd en hersteld' : 'Naamvariant met gelijke lengte en foute checksum geweigerd en hersteld');
  }
  async function checkCueLease() {
    if (!fixture) return; await stopNarration(); const started = Date.now(), assets = Object.values(fixture.cuePack.assets);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let event: ReturnType<typeof narrationEvents> | undefined;
    try {
      const interrupted = new Promise<void>((resolve, reject) => { event = narrationEvents('onPlayback', value => { if (value.status === 'interrupted') resolve(); }); timeout = setTimeout(() => reject(new Error('De naamzin bleef na de leeslease doorspelen')), 10_000); });
      const [result] = await Promise.all([playNarration([{ kind: 'asset', scope: fixture.scope, key: fixture.key, asset: assets[assets.length - 1], offlineUntil: new Date(started + 3_000).toISOString() }]), interrupted]);
      if (result !== 'stopped' || Date.now() - started < 2_500 || Date.now() - started >= 10_000) throw new Error('De cuelease is niet vóór het eerste verhaalfragment aangetoond');
      setMessage('Naamzinlease onderbreekt vóór enig verhaalfragment');
    } finally { if (timeout) clearTimeout(timeout); event?.remove(); }
  }
  const ids = fixture ? Object.keys(fixture.manifest.assets) : [];
  return <View style={s.card}><Text accessibilityRole="header" style={s.title}>CI-audiofixture</Text><Text style={s.small}>Alleen ongesigneerde CI · synthetische WAV · geen provider of profielgegevens</Text>
    <Text accessibilityLiveRegion="polite" style={s.small}>Fixturestatus: {status} · fragment {index + 1}</Text>
    <Control label={`Fixturepakket voorbereiden${fixture ? ' · offline beschikbaar' : ''}`} disabled={busy} onPress={() => void run(async () => { const value = await installNarrationFixture(); setFixture(value.download); setMessage('Fixturepakket offline beschikbaar'); })} />
    <Control label={`Fixturedownload pauzeren en hervatten${message === 'Downloadpauze en hervatten gecontroleerd' ? ' · gecontroleerd' : ''}`} disabled={busy} onPress={() => void run(async () => { if (fixture) await removeNarrationDownload(fixture.scope, fixture.key); setFixture(null); const value = await installNarrationFixture(true); setFixture(value.download); setMessage(value.pauseVerified ? 'Downloadpauze en hervatten gecontroleerd' : 'Downloadpauze niet aangetoond'); })} />
    <Control label={`Speel twee fixturefragmenten · ${status} · ${index + 1}`} disabled={busy || !fixture} onPress={() => { void play(ids.slice(0, 2)); }} />
    <Control label={`Pauzeer fixtureaudio · ${status}`} disabled={!fixture} onPress={() => { void pauseNarration(); }} />
    <Control label={`Hervat fixtureaudio · ${status}`} disabled={!fixture} onPress={() => { void resumeNarration(); }} />
    <Control label={`Luister fixturekeuze 1 · ${status}`} disabled={!fixture} onPress={() => { void play(ids.slice(2, 3)); }} />
    <Control label={`Luister fixture-einde 2 · ${status}`} disabled={!fixture} onPress={() => { void play(ids.slice(5, 6)); }} />
    <Control label={`Speel fixture naamzin · ${status}`} disabled={busy || !fixture} onPress={() => { if (fixture) { const assets = Object.values(fixture.cuePack.assets); void playNarration([{ kind: 'asset', scope: fixture.scope, key: fixture.key, asset: assets[assets.length - 1] }]); } }} />
    <Control label="Stop fixtureaudio" onPress={() => { void stopNarration(); }} />
    <Control label={`Controleer beschadigd fixturepakket${message === 'Checksumfout geweigerd en pakket veilig hersteld' ? ' · gecontroleerd' : ''}`} disabled={busy || !fixture} onPress={() => void run(async () => { if (!fixture) return; await stopNarration(); await corruptNarrationFixture(fixture); const values = await downloadedNarration({ kind: 'local' }); if (!values.some(value => value.key === fixture.key && !value.complete)) throw new Error('Beschadiging werd niet afgekeurd'); setFixture(null); const repaired = await installNarrationFixture(); setFixture(repaired.download); setMessage('Checksumfout geweigerd en pakket veilig hersteld'); })} />
    <Control label={`Controleer ontbrekende naamvariant${message === 'Ontbrekende ongekozen naamvariant geweigerd en hersteld' ? ' · gecontroleerd' : ''}`} disabled={busy || !fixture} onPress={() => void run(() => checkCue(true))} />
    <Control label={`Controleer beschadigde naamvariant${message === 'Naamvariant met gelijke lengte en foute checksum geweigerd en hersteld' ? ' · gecontroleerd' : ''}`} disabled={busy || !fixture} onPress={() => void run(() => checkCue(false))} />
    <Control label={`Controleer ontbrekende naammetadata${message === 'Ontbrekende naammetadata geweigerd en hersteld' ? ' · gecontroleerd' : ''}`} disabled={busy || !fixture} onPress={() => void run(() => checkCue(false, true))} />
    <Control label={`Controleer naamzinlease zonder verhaalfragment${message === 'Naamzinlease onderbreekt vóór enig verhaalfragment' ? ' · gecontroleerd' : ''}`} disabled={busy || !fixture} onPress={() => void run(checkCueLease)} />
    <Control label={`Controleer verlopen fixturepakket${message === 'Verlopen pakket geweigerd; nieuwe download gecontroleerd' ? ' · gecontroleerd' : ''}`} disabled={busy || !fixture} onPress={() => void run(async () => { if (!fixture) return; await stopNarration(); await expireNarrationFixture(fixture); const values = await downloadedNarration({ kind: 'local' }); if (values.some(value => value.key === fixture.key)) throw new Error('Verlopen pakket bleef beschikbaar'); setFixture(null); const restored = await installNarrationFixture(); setFixture(restored.download); setMessage('Verlopen pakket geweigerd; nieuwe download gecontroleerd'); })} />
    <Control label={`Wis gedeelde fixturecache${message === 'Gedeelde cache gewist; pakketnaamzinnen onafhankelijk beschikbaar' ? ' · gecontroleerd' : ''}`} disabled={busy || !fixture} onPress={() => void run(async () => { if (!fixture) return; await stopNarration(); await clearNarrationFixtureSharedCache(); const value = (await downloadedNarration({ kind: 'local' })).find(item => item.key === fixture.key && item.complete); if (!value) throw new Error('Gedeelde cache bleek een pakketafhankelijkheid'); setFixture(value); setMessage('Gedeelde cache gewist; pakketnaamzinnen onafhankelijk beschikbaar'); })} />
    <Text accessibilityLiveRegion="polite" style={s.small}>{message}</Text>
  </View>;
}
const s = StyleSheet.create({ card: { gap: 9, padding: 15, borderWidth: 1, borderColor: '#dce5d2', borderRadius: 18 }, title: { fontSize: 18, fontWeight: '800', color: '#294f39' }, small: { fontSize: 12, lineHeight: 20, color: '#52634f' } });
