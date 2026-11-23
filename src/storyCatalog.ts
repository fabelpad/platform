export const STORY_IDS = ['station', 'dream', 'toy', 'weather', 'moonbakery', 'ocean', 'garden', 'clock', 'library', 'balloon', 'forest', 'snow', 'stars'] as const;
export type StoryId = typeof STORY_IDS[number];
export const STORY_PARTS = 5;
export const MEMORY_ENCOUNTERS = 48;
export const MEMORY_ITEMS = 40;
export const MEMORY_THREADS = STORY_IDS.length;
export const MEMORY_EVENTS = 100;
export function isStoryId(value: unknown): value is StoryId { return typeof value === 'string' && (STORY_IDS as readonly string[]).includes(value); }

export function isOnlineStoryId(value:unknown):value is string { return typeof value==='string' && /^[a-z][a-z0-9_-]{1,79}$/u.test(value) && !['constructor','prototype','__proto__'].includes(value); }
