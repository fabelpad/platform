import { isStoryId } from './storyCatalog';
import { currentContentOwner } from './profileStorage';
import { saveProtectedContent,readProtectedContent,clearProtectedContent } from './protectedContentCache';
import { canonicalContentJson } from '../lib/contentHash';
import { getScene, getEnding } from './storyData';
import { worlds } from './worlds';
import { getEditorialPublication } from './editorialStore';
import type { ContentRelease } from '../lib/server/content';
import { bundledReadingLevels } from './contentReadingLevels';
import { personalizeStoryText } from './storyPersonalization';

const memoryReleases = new Map<string, ContentRelease>();
const key = (id: string, version: string) => `fabelpad-content-v1:${id}:${version}`;
export function cacheRelease(release: ContentRelease): boolean {
  if(release.access){void saveProtectedContent(release);return false;}
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
export async function localRelease(id: string, editorial = false, includeReadingLevels = true): Promise<ContentRelease> {
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
  const readingLevels = includeReadingLevels && (!publication || Object.keys(publication.chapters).length === 0) ? bundledReadingLevels(id) : undefined;
  const payload = { metadata, parts: 5 as const, nameToken: '__FABELPAD_CHILD__' as const, scenes, endings, ...(readingLevels ? { readingLevels } : {}) };
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalContentJson(payload)));
  const contentVersion = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('').slice(0,16);
  return { storyId: id, contentVersion, publishedAt: publication?.publishedAt ?? null, bundled: true, ...payload };
}
export async function loadContentRelease(id: string, version: string | undefined, cloud: boolean): Promise<ContentRelease> {
 if(cloud){
  let response:Response;
  try{response=await fetch(`/api/content/${encodeURIComponent(id)}${version?`?version=${encodeURIComponent(version)}`:''}`,{cache:'no-store',signal:AbortSignal.timeout(15_000)});}catch{
   const stored=await readProtectedContent(id,version);if(stored)return stored;
   throw new Error('Maak verbinding om jullie toegang en deze verhaalversie te controleren. Je voortgang blijft bewaard.');
  }
  const data=await response.json();
  if(!response.ok){if([401,403,410].includes(response.status)){const owner=currentContentOwner();if(owner)await clearProtectedContent(owner);}throw new Error(data.message||'Deze verhaalversie kan niet worden geopend. Je keuzes blijven bewaard.');}
  const release=data.release as ContentRelease;
  if(release?.storyId!==id||(version&&release.contentVersion!==version)||!['full','preview'].includes(release.access??''))throw new Error('De verhaalversie komt niet overeen. Je avontuur is niet veranderd.');
  await saveProtectedContent(release);return release;
 }
 if(!isStoryId(id))throw new Error('Dit online verhaal is niet meegeleverd op dit apparaat.');
 if(version){const stored=cached(id,version);if(stored&&!stored.access)return stored;}
 const bundled=await localRelease(id);
 if(version===bundled.contentVersion){cacheRelease(bundled);return bundled;}
 if(version){const legacy=await localRelease(id,false,false);if(version===legacy.contentVersion){cacheRelease(legacy);return legacy;}}
 const editorial=await localRelease(id,true);if(!version||version===editorial.contentVersion){cacheRelease(editorial);return editorial;}
 throw new Error('Deze verhaalversie is niet op dit apparaat beschikbaar. Je keuzes blijven bewaard.');
}
export const personalText = personalizeStoryText;
