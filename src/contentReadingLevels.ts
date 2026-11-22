import { canonicalContentJson } from '../lib/contentHash';
import { getReadingEnding, getReadingScene } from './storyReadingLevels';
import { READING_LEVELS } from './readingLevel';
import type { ReadingLevel } from './readingLevel';
import type { StoryEnding, StoryScene } from './storyTypes';

export type ReadingContent = { scenes: Record<string, StoryScene>; endings: Record<string, StoryEnding> };
export type ReadingVariants = Record<ReadingLevel, ReadingContent>;
const snapshots = new Map<string, ReadingVariants>();
const compatible = new WeakMap<object, ReadingVariants | undefined>();

/** Materialize the supplied prose, never transform an editorial or saved text. */
export function bundledReadingLevels(storyId: string): ReadingVariants {
  const existing = snapshots.get(storyId);
  if (existing) return existing;
  const variants = {} as ReadingVariants;
  for (const { id } of READING_LEVELS) {
    const scenes: ReadingContent['scenes'] = {}, endings: ReadingContent['endings'] = {};
    for (let part = 0; part < 5; part++) for (let route = 0; route < 2 ** part; route++) {
      const picks = Array.from({ length: part }, (_, bit) => (route >> (part - bit - 1)) & 1);
      scenes[picks.join('')] = getReadingScene(storyId, part, picks, '__FABELPAD_CHILD__', id);
    }
    for (let route = 0; route < 32; route++) {
      const picks = Array.from({ length: 5 }, (_, bit) => (route >> (4 - bit)) & 1);
      endings[picks.join('')] = getReadingEnding(storyId, picks, '__FABELPAD_CHILD__', id);
    }
    variants[id] = { scenes, endings };
  }
  snapshots.set(storyId, variants);
  return variants;
}

/**
 * An old release keeps its bytes, identity and progress pin. It may use the new
 * reading views only when every original chapter, choice and ending matches.
 * Edited historical releases fall back to their own authored text.
 */
export function readingLevelsForRelease(release: { storyId: string; scenes: ReadingContent['scenes']; endings: ReadingContent['endings']; readingLevels?: ReadingVariants }): ReadingVariants | undefined {
  if (release.readingLevels) return release.readingLevels;
  if (compatible.has(release)) return compatible.get(release);
  const variants = bundledReadingLevels(release.storyId);
  const same = canonicalContentJson({ scenes: release.scenes, endings: release.endings }) === canonicalContentJson(variants['9plus']);
  const result = same ? variants : undefined;
  compatible.set(release, result);
  return result;
}
