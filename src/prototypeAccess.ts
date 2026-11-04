import { STORY_IDS } from './storyCatalog';
export type PrototypeAccess = { freeStory: string; plan: 'free' | 'family'; founderInterest: boolean; testAccess: boolean };
export function getPrototypeAccess(): PrototypeAccess {
  const fallback: PrototypeAccess = { freeStory: 'station', plan: 'free', founderInterest: false, testAccess: false };
  try {
    const value = JSON.parse(localStorage.getItem('fabelpad-prototype-access-v1') || '{}');
    return { freeStory: (STORY_IDS as readonly string[]).includes(value.freeStory) ? value.freeStory : fallback.freeStory, plan: value.plan === 'family' ? 'family' : 'free', founderInterest: value.founderInterest === true, testAccess: value.testAccess === true };
  } catch { return fallback; }
}
/** A visual test model only: production access must be checked on the server. */
export function getPrototypePreviewIds(freeStory: string): string[] {
  return [...new Set(['dream', 'toy', ...STORY_IDS])].filter(id => id !== freeStory).slice(0, 2);
}
export function getStoryPreviewLimit(id: string): number | undefined {
  const access = getPrototypeAccess();
  if (!access.testAccess || access.plan === 'family' || id === access.freeStory) return undefined;
  return getPrototypePreviewIds(access.freeStory).includes(id) ? 1 : 0;
}
