import { storiesA } from './storyCollectionA';
import { storiesB } from './storyCollectionB';
import type { WrittenStory } from './storyTypes';
export const newStories: Record<string, WrittenStory> = { ...storiesA, ...storiesB };
