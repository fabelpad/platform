import { getEnding, getScene } from './storyData';
import type { StoryEnding, StoryScene } from './storyTypes';
import type { ReadingLevel } from './readingLevel';
import { storyLevelsOriginal } from './storyLevelsOriginal';
import { storyLevelsWeather } from './storyLevelsWeather';
import { storyLevelsMiddle } from './storyLevelsMiddle';
import { storyLevelsFinal } from './storyLevelsFinal';
import { storyLevelsOceanLibrary } from './storyLevelsOceanLibrary';
import { storyLevelsSnowStars } from './storyLevelsSnowStars';
import { storyLevelsToy } from './storyLevelsToy';
import { youngChapterLabels } from './youngChapterLabels';

export type { ReadingLevel } from './readingLevel';

type AgeRewrite = (picks: number[], hero: string, band: Exclude<ReadingLevel, '9plus'>, step?: number) => string;

const levels: Record<string, AgeRewrite> = {
  ...storyLevelsOriginal,
  ...storyLevelsWeather,
  ...storyLevelsMiddle,
  ...storyLevelsFinal,
  ...storyLevelsOceanLibrary,
  ...storyLevelsSnowStars,
  ...storyLevelsToy,
};

export function getReadingScene(world: string, step: number, picks: number[], name: string, band: ReadingLevel): StoryScene {
  const scene = getScene(world, step, picks, name);
  if (band === '9plus' || !Object.hasOwn(levels, world)) return scene;
  const text = levels[world](picks, name.trim() || 'Avonturier', band, step);
  const young = band === 'under6' ? youngChapterLabels[world]?.[step] : undefined;
  if (!young) return { ...scene, text };
  const labels = typeof young.choices === 'function' ? young.choices(picks) : young.choices;
  return {
    title: young.title,
    text,
    choices: scene.choices.map((choice, i) => ({ ...choice, label: labels[i], hint: '' })),
  };
}

export function getReadingEnding(world: string, picks: number[], name: string, band: ReadingLevel): StoryEnding {
  const ending = getEnding(world, picks, name);
  if (band === '9plus' || !Object.hasOwn(levels, world)) return ending;
  return { ...ending, text: levels[world](picks, name.trim() || 'Avonturier', band) };
}
