import { DEFAULT_READING_LEVEL, isReadingLevel } from './readingLevel';
import type { ReadingLevel } from './readingLevel';

/** Calendar dates are never parsed as UTC instants. All runtimes use Dutch days. */
export function amsterdamDate(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find(value => value.type === type)?.value ?? '';
  return `${part('year').padStart(4, '0')}-${part('month')}-${part('day')}`;
}

function calendarParts(value: unknown): [number, number, number] | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return null;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1] ? [year, month, day] : null;
}

export function isValidBirthDate(value: unknown, today = amsterdamDate()): value is string {
  return calendarParts(value) !== null && calendarParts(today) !== null && (value as string) <= today;
}

/** A February 29 birthday advances on March 1 in a non-leap year. */
export function ageOnDate(birthDate: unknown, today = amsterdamDate()): number | null {
  if (!isValidBirthDate(birthDate, today)) return null;
  const [year, month, day] = calendarParts(birthDate)!;
  const [currentYear, currentMonth, currentDay] = calendarParts(today)!;
  return currentYear - year - (currentMonth < month || (currentMonth === month && currentDay < day) ? 1 : 0);
}

export function automaticReadingLevel(birthDate: unknown, today = amsterdamDate()): ReadingLevel | undefined {
  const age = ageOnDate(birthDate, today);
  return age === null ? undefined : age < 6 ? 'under6' : age < 9 ? '6to8' : '9plus';
}

export type ProfileReading = { birthDate?: string; readingLevelOverride?: ReadingLevel };

export function effectiveReadingLevel(profile: ProfileReading | null | undefined, legacyLevel?: unknown, today = amsterdamDate()): ReadingLevel {
  if (isReadingLevel(profile?.readingLevelOverride)) return profile.readingLevelOverride;
  return automaticReadingLevel(profile?.birthDate, today) ?? (isReadingLevel(legacyLevel) ? legacyLevel : DEFAULT_READING_LEVEL);
}
