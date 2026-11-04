import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Store } from './types';

const KEY = 'fabelpad-native-prototype-v1';
let writes: Promise<void> = Promise.resolve();
export function freshStore(contentVersion: string): Store {
  return { schemaVersion: 1, contentVersion, activeId: 'demo-child', profiles: [{ id: 'demo-child', name: 'Avonturier', avatar: 0, picks: {}, favorites: [], calm: false, largeText: false }] };
}
export async function loadStore(contentVersion: string, storyIds: string[]): Promise<{ store: Store; contentChanged: boolean }> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return { store: freshStore(contentVersion), contentChanged: false };
  const value = JSON.parse(raw) as Store;
  if (value.schemaVersion !== 1 || !Array.isArray(value.profiles) || !value.profiles.length || value.profiles.length > 5) throw new Error('De opgeslagen demo heeft een onbekend formaat.');
  const ids = new Set<string>();
  for (const p of value.profiles) {
    if (!p || typeof p.id !== 'string' || ids.has(p.id) || typeof p.name !== 'string' || !p.name.trim() || !p.picks || typeof p.picks !== 'object' || !Array.isArray(p.favorites)) throw new Error('Een demo-kindprofiel kan niet worden ingelezen.');
    ids.add(p.id);
    p.name = p.name.slice(0, 20);
    p.avatar = Number.isInteger(p.avatar) && p.avatar >= 0 && p.avatar < 4 ? p.avatar : 0;
    p.favorites = p.favorites.filter(id => storyIds.includes(id));
    for (const [id, picks] of Object.entries(p.picks)) {
      if (!storyIds.includes(id) || !Array.isArray(picks) || picks.length > 5 || !picks.every(n => n === 0 || n === 1)) delete p.picks[id];
    }
    p.calm = !!p.calm; p.largeText = !!p.largeText;
  }
  if (!ids.has(value.activeId)) value.activeId = value.profiles[0].id;
  // A content mismatch is surfaced. Never silently move saved choices onto edited text.
  return { store: value, contentChanged: value.contentVersion !== contentVersion };
}
export function persistStore(value: Store): Promise<void> {
  const serialized = JSON.stringify(value);
  const operation = writes.catch(() => {}).then(() => AsyncStorage.setItem(KEY, serialized));
  writes = operation;
  return operation;
}
export async function removeStore(): Promise<void> { await writes.catch(() => {}); await AsyncStorage.removeItem(KEY); }
