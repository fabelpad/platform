import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Store } from './types';
import { createStorageQueue } from './storageQueue';
import { normalizeStoryVersions } from './storyReleases';
import { normalizeReadingHistory } from './readingLevels';
import { isVoiceSlot } from '../../lib/narration/contracts';

const KEY = 'fabelpad-native-prototype-v1';
const queue = createStorageQueue(AsyncStorage, KEY);
export function freshStore(contentVersion: string): Store {
  return { schemaVersion: 1, contentVersion, activeId: 'local-child', profiles: [{ id: 'local-child', name: 'Avonturier', avatar: 0, isPersonal: false, picks: {}, storyVersions: {}, lastCompletedPicks: {}, lastCompletedStoryVersions: {}, readingLevel: '6to8', favorites: [], calm: false, largeText: false }] };
}
export async function loadStore(contentVersion: string, storyIds: string[], availableVersions = [contentVersion]): Promise<{ store: Store; contentChanged: boolean }> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return { store: freshStore(contentVersion), contentChanged: false };
  const value = JSON.parse(raw) as Store;
  if (!value || value.schemaVersion !== 1 || typeof value.contentVersion !== 'string' || !Array.isArray(value.profiles) || !value.profiles.length || value.profiles.length > 5) throw new Error('De opgeslagen gegevens hebben een onbekend formaat.');
  const ids = new Set<string>();
  for (const p of value.profiles) {
    if (!p || typeof p.id !== 'string' || !p.id || ids.has(p.id) || typeof p.name !== 'string' || !p.name.trim() || !p.picks || typeof p.picks !== 'object' || Array.isArray(p.picks) || !Array.isArray(p.favorites)) throw new Error('Een lokaal kindprofiel kan niet worden ingelezen.');
    ids.add(p.id);
    p.name = p.name.slice(0, 20);
    p.avatar = Number.isInteger(p.avatar) && p.avatar >= 0 && p.avatar < 4 ? p.avatar : 0;
    p.favorites = p.favorites.filter(id => storyIds.includes(id));
    for (const [id, picks] of Object.entries(p.picks)) {
      if (!storyIds.includes(id) || !Array.isArray(picks) || picks.length > 5 || !picks.every(n => n === 0 || n === 1)) delete p.picks[id];
    }
    p.storyVersions = normalizeStoryVersions(p, value.contentVersion);
    normalizeReadingHistory(p);
    if (!isVoiceSlot(p.voiceSlot)) delete p.voiceSlot;
    p.calm = !!p.calm; p.largeText = !!p.largeText;
  }
  if (!ids.has(value.activeId)) value.activeId = value.profiles[0].id;
  // A started story keeps its immutable bundled release across app updates.
  const contentChanged = value.profiles.some(p => [...Object.values(p.storyVersions || {}), ...Object.values(p.lastCompletedStoryVersions || {})].some(version => !availableVersions.includes(version)));
  return { store: value, contentChanged };
}
export function persistStore(value: Store): Promise<void> {
  return queue.persist(value);
}
export function removeStore(): Promise<void> { return queue.remove(); }
