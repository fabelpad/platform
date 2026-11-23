export const READING_LEVELS = [
  { id: 'under6', label: '5 jaar en jonger' },
  { id: '6to8', label: '6 t/m 8 jaar' },
  { id: '9plus', label: '9+ jaar' },
] as const;

export type ReadingLevel = typeof READING_LEVELS[number]['id'];
export type ReadingPrefs = { muted: boolean; calm: boolean; textSize?: 'normal' | 'large'; readingLevel?: ReadingLevel; voiceSlot?: import('../lib/narration/contracts').VoiceSlot };
export const DEFAULT_READING_LEVEL: ReadingLevel = '6to8';

export function isReadingLevel(value: unknown): value is ReadingLevel {
  return READING_LEVELS.some(level => level.id === value);
}
