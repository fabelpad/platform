import type { Profile, ReadingContent, ReadingLevel, Story } from './types';
import { amsterdamDate, effectiveReadingLevel, isValidBirthDate } from '../../src/profileReading';

export { amsterdamDate, automaticReadingLevel, effectiveReadingLevel, isValidBirthDate } from '../../src/profileReading';

export const DEFAULT_READING_LEVEL: ReadingLevel = '6to8';
export const readingLevels: { id: ReadingLevel; label: string }[] = [
  { id: 'under6', label: '5 jaar en jonger' },
  { id: '6to8', label: '6 t/m 8 jaar' },
  { id: '9plus', label: '9+ jaar' },
];
export function normalizeReadingLevel(value: unknown): ReadingLevel {
  return readingLevels.some(level => level.id === value) ? value as ReadingLevel : DEFAULT_READING_LEVEL;
}
/** Old immutable releases retain their original text, never a newer route's text. */
export function readingContent(story: Story, level: ReadingLevel): ReadingContent {
  return story.readingLevels?.[level] || story;
}
/** Add presentation-only rewrites to an unchanged legacy story without changing its pin. */
export function withCompatibleReading(story: Story, current?: Story): Story {
  if (story.readingLevels || !current?.readingLevels) return story;
  if (JSON.stringify(story.scenes) !== JSON.stringify(current.scenes) || JSON.stringify(story.endings) !== JSON.stringify(current.endings)) return story;
  return { ...story, readingLevels: current.readingLevels, playImage: current.playImage, playImageAlt: current.playImageAlt };
}
export function completedRoute(profile: Profile, storyId: string): number[] | undefined {
  return profile.lastCompletedPicks?.[storyId] || (profile.picks[storyId]?.length === 5 ? profile.picks[storyId] : undefined);
}
export function completedVersion(profile: Profile, storyId: string): string | undefined {
  return profile.lastCompletedStoryVersions?.[storyId] || profile.storyVersions?.[storyId];
}
export function completedCount(profile: Profile): number {
  return new Set([...Object.keys(profile.picks), ...Object.keys(profile.lastCompletedPicks || {})].filter(id => completedRoute(profile, id))).size;
}
/** Normalize only the new fields; a malformed preference never discards saved routes. */
export function normalizeReadingHistory(profile: Profile): void {
  profile.readingLevel = normalizeReadingLevel(profile.readingLevel);
  // Older reader choices are fallback text variants, never explicit parent overrides.
  if (!isValidBirthDate(profile.birthDate)) delete profile.birthDate;
  if (!readingLevels.some(level => level.id === profile.readingLevelOverride)) delete profile.readingLevelOverride;
  const previous = profile.lastCompletedPicks && typeof profile.lastCompletedPicks === 'object' && !Array.isArray(profile.lastCompletedPicks) ? profile.lastCompletedPicks : {};
  const versions = profile.lastCompletedStoryVersions && typeof profile.lastCompletedStoryVersions === 'object' && !Array.isArray(profile.lastCompletedStoryVersions) ? profile.lastCompletedStoryVersions : {};
  profile.lastCompletedPicks = Object.fromEntries(Object.entries(previous).filter(([id, route]) => !!id && Array.isArray(route) && route.length === 5 && route.every(choice => choice === 0 || choice === 1)).map(([id, route]) => [id, [...route]]));
  profile.lastCompletedStoryVersions = {};
  for (const [id, route] of Object.entries(profile.picks)) {
    if (route.length === 5 && !profile.lastCompletedPicks[id]) profile.lastCompletedPicks[id] = [...route];
  }
  for (const id of Object.keys(profile.lastCompletedPicks)) {
    const version = typeof versions[id] === 'string' ? versions[id] : profile.storyVersions?.[id];
    if (version) profile.lastCompletedStoryVersions[id] = version;
  }
}

/** Profile editing preserves all reading routes. Only new personal profiles require a date. */
export function profileWithReadingSettings(profile: Profile, birthDate: string, override: ReadingLevel | undefined, creating: boolean, today = amsterdamDate()): Profile {
  if ((creating || birthDate !== '' || profile.birthDate !== undefined) && !isValidBirthDate(birthDate, today)) {
    throw new Error('Vul een geldige geboortedatum in die niet in de toekomst ligt.');
  }
  if (override !== undefined && !readingLevels.some(level => level.id === override)) throw new Error('Kies een geldig leesniveau.');
  const next = { ...profile, ...(birthDate ? { birthDate } : {}), readingLevelOverride: override };
  if (!birthDate) delete next.birthDate;
  return next;
}

export function profileReadingLevel(profile: Profile, today = amsterdamDate()): ReadingLevel {
  return effectiveReadingLevel(profile, profile.readingLevel, today);
}

/** Schedule the next Dutch calendar day, including 23/25-hour DST days. */
export function nextAmsterdamDayDelay(now = new Date()): number {
  const start = now.getTime(), currentDate = amsterdamDate(now);
  let before = start, after = start + 27 * 60 * 60 * 1000;
  while (after - before > 1) {
    const middle = Math.floor((before + after) / 2);
    if (amsterdamDate(new Date(middle)) === currentDate) before = middle;
    else after = middle;
  }
  return Math.max(1, after - start + 20);
}
