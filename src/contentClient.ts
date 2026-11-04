import { canonicalContentJson } from '../lib/contentHash';
import { getScene, getEnding } from './storyData';
import { worlds } from './worlds';
import { getEditorialPublication } from './editorialStore';
import type { ContentRelease } from '../lib/server/content';

const memoryReleases = new Map<string, ContentRelease>();
const key = (id: string, version: string) => `fabelpad-content-v1:${id}:${version}`;
export function cacheRelease(release: ContentRelease): boolean {
  memoryReleases.set(key(release.storyId, release.contentVersion), release);
  try { localStorage.setItem(key(release.storyId, release.contentVersion), JSON.stringify(release)); return true; } catch { return false; }
}
function cached(id: string, version: string): ContentRelease | null {
  const memory = memoryReleases.get(key(id, version)); if (memory) return memory;
  try {
    const value = JSON.parse(localStorage.getItem(key(id, version)) || 'null') as ContentRelease | null;
    return value?.storyId === id && value.contentVersion === version && value.parts === 5 && Object.keys(value.scenes).length === 31 && Object.keys(value.endings).length === 32 ? value : null;
  } catch { return null; }
}
export async function localRelease(id: string, editorial = false): Promise<ContentRelease> {
  const world = worlds.find(w => w.id === id)!;
  const publication = editorial ? getEditorialPublication(id) : undefined;
  const metadata = publication?.metadata ?? { title: world.title, description: world.description, image: world.image };
  const scenes: ContentRelease['scenes'] = {}, endings: ContentRelease['endings'] = {};
  for (let part = 0; part < 5; part++) for (let route = 0; route < 2 ** part; route++) {
    const picks = Array.from({ length: part }, (_, bit) => (route >> (part - bit - 1)) & 1);
    const original = getScene(id, part, picks, '__FABELPAD_CHILD__');
    const override = publication?.chapters[String(part)];
    scenes[picks.join('')] = { ...original, title: (override?.title ?? original.title).replaceAll('{{naam}}', '__FABELPAD_CHILD__'), text: (override?.text ?? original.text).replaceAll('{{naam}}', '__FABELPAD_CHILD__') };
  }
  for (let route = 0; route < 32; route++) {
    const picks = Array.from({ length: 5 }, (_, bit) => (route >> (4 - bit)) & 1);
    endings[picks.join('')] = getEnding(id, picks, '__FABELPAD_CHILD__');
  }
  const payload = { metadata, parts: 5 as const, nameToken: '__FABELPAD_CHILD__' as const, scenes, endings };
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalContentJson(payload)));
  const contentVersion = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('').slice(0,16);
  return { storyId: id, contentVersion, publishedAt: publication?.publishedAt ?? null, bundled: true, ...payload };
}
export async function loadContentRelease(id: string, version: string | undefined, cloud: boolean): Promise<ContentRelease> {
  if (version) { const stored = cached(id, version); if (stored) return stored; }
  const bundled = await localRelease(id);
  if (version === bundled.contentVersion) { cacheRelease(bundled); return bundled; }
  if (!cloud) {
    const editorial = await localRelease(id, true);
    if (!version || version === editorial.contentVersion) { cacheRelease(editorial); return editorial; }
  }
  try {
    const response = await fetch(`/api/content/${encodeURIComponent(id)}${version ? `?version=${encodeURIComponent(version)}` : ''}`, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Deze verhaalversie kan niet worden geopend. Je keuzes blijven bewaard.');
    const release = data.release as ContentRelease;
    if (release.storyId !== id || (version && release.contentVersion !== version)) throw new Error('De verhaalversie komt niet overeen. Je avontuur is niet veranderd.');
    cacheRelease(release); return release;
  } catch (error) {
    if (version === bundled.contentVersion || !version) { cacheRelease(bundled); return bundled; }
    throw error;
  }
}
export function personalText(text: string, name: string) { return text.replaceAll('__FABELPAD_CHILD__', name.trim() || 'Avonturier'); }
