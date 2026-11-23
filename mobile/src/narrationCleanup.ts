import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo';

const native = requireOptionalNativeModule<{ clearAll?(): Promise<boolean>; clearProtected?(): Promise<boolean> }>('FabelpadNarration');
let generation = 0;
let writes: Promise<unknown> = Promise.resolve();
function serialize<T>(action: () => Promise<T>): Promise<T> { const next = writes.then(action, action); writes = next.catch(() => {}); return next; }
export function narrationLocalGeneration(): number { return generation; }
export function writeNarrationPreference<T>(expected: number, action: () => Promise<T>): Promise<T> {
  return serialize(async () => { if (generation !== expected) throw new Error('De lokale voorleesinstellingen zijn intussen gewist.'); const value = await action(); if (generation !== expected) throw new Error('De lokale voorleesinstellingen zijn intussen gewist.'); return value; });
}
export function clearProtectedNarrationData(): Promise<void> {
  generation++;
  return serialize(async () => { await native?.clearProtected?.(); const keys = (await AsyncStorage.getAllKeys()).filter(key => key.startsWith('fabelpad.narration.local.v1.connected.')); if (keys.length) await AsyncStorage.multiRemove(keys); });
}
/** Kept independent of the reader, recorder permissions and online family code.
 * Older builds without the optional module still remove the local preferences. */
export function clearAllNarration(): Promise<void> {
  generation++;
  return serialize(async () => { await native?.clearAll?.(); const keys = (await AsyncStorage.getAllKeys()).filter(key => key.startsWith('fabelpad.narration.local.v1.')); if (keys.length) await AsyncStorage.multiRemove(keys); });
}
