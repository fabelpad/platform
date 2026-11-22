import { worlds } from './worlds';
import { getScene, getEnding } from './storyData';
import { bundledReadingLevels } from './contentReadingLevels';
import { storyPlayArt } from './storyPlayArt';

const CACHE = 'fabelpad-downloads-v1';
const KEY = 'fabelpad-prototype-downloads-v1';
const EVENT = 'fabelpad-downloads-changed';
const busy = new Map<string, Promise<void>>();
export function getDownloads(): string[] {
  try { const data: unknown = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(data) ? data.filter((id): id is string => typeof id === 'string' && worlds.some(w => w.id === id)) : []; } catch { return []; }
}
function announce() { window.dispatchEvent(new Event(EVENT)); }
export function subscribeDownloads(listener: () => void): () => void {
  window.addEventListener(EVENT, listener);
  const storage = (event: StorageEvent) => { if (event.key === KEY) listener(); };
  window.addEventListener('storage', storage);
  return () => { window.removeEventListener(EVENT, listener); window.removeEventListener('storage', storage); };
}
function contentPath(id: string) { return `/art/download-${id}.json`; }
function assetsFor(id: string) {
  const world = worlds.find(w => w.id === id);
  if (!world) throw new Error('Dit verhaal bestaat niet.');
  return [...new Set([world.image, ...(storyPlayArt[id] ? [storyPlayArt[id]!.image] : []), ...(id === 'station' ? ['/art/play/station-platform.webp', '/art/play/dibbel.webp', '/art/play/train.webp'] : [])])];
}
/** Stores real public illustration bytes and every story route; never account HTML. */
export function downloadStory(id: string): Promise<void> {
  const pending = busy.get(id); if (pending) return pending;
  const task = (async () => {
    if (!('caches' in window)) throw new Error('Deze browser ondersteunt geen verhaalopslag.');
    const paths = assetsFor(id);
    const cache = await caches.open(CACHE);
    try {
      const transfers = await Promise.allSettled(paths.map(async path => {
        const response = await fetch(path, { credentials: 'omit', cache: 'reload' });
        if (!response.ok || response.redirected || !response.headers.get('content-type')?.startsWith('image/')) throw new Error('Een illustratie kon niet worden bewaard. Probeer het opnieuw.');
        await cache.put(path, response);
      }));
      const failed = transfers.find(result => result.status === 'rejected');
      if (failed?.status === 'rejected') throw failed.reason;
      const scenes: Record<string, unknown> = {}, endings: Record<string, unknown> = {};
      for (let step = 0; step < 5; step++) for (let route = 0; route < 2 ** step; route++) {
        const picks = Array.from({ length: step }, (_, index) => (route >> (step - index - 1)) & 1);
        scenes[picks.join('')] = getScene(id, step, picks, '{{naam}}');
      }
      for (let route = 0; route < 32; route++) {
        const picks = Array.from({ length: 5 }, (_, index) => (route >> (4 - index)) & 1);
        endings[picks.join('')] = getEnding(id, picks, '{{naam}}');
      }
      const readingLevels = JSON.parse(JSON.stringify(bundledReadingLevels(id)).replaceAll('__FABELPAD_CHILD__', '{{naam}}'));
      await cache.put(contentPath(id), new Response(JSON.stringify({ version: 1, id, scenes, endings, readingLevels }), { headers: { 'Content-Type': 'application/json' } }));
      for (const path of [...paths, contentPath(id)]) if (!(await cache.match(path))) throw new Error('De browser kon niet alle bestanden bewaren.');
      localStorage.setItem(KEY, JSON.stringify([...new Set([...getDownloads(), id])]));
      announce();
    } catch (error) {
      await Promise.all([...paths, contentPath(id)].map(path => cache.delete(path)));
      localStorage.setItem(KEY, JSON.stringify(getDownloads().filter(item => item !== id)));
      announce();
      throw error;
    }
  })().finally(() => busy.delete(id));
  busy.set(id, task); return task;
}
export async function removeDownload(id: string): Promise<void> {
  if (busy.has(id)) throw new Error('Wacht tot het bewaren klaar is.');
  if ('caches' in window) {
    const cache = await caches.open(CACHE);
    await Promise.all([...assetsFor(id), contentPath(id)].map(path => cache.delete(path)));
  }
  localStorage.setItem(KEY, JSON.stringify(getDownloads().filter(item => item !== id)));
  announce();
}
