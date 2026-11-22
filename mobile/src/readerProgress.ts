import type { Store } from './types';

/** Compare the whole route and active profile before accepting a rendered scene action. */
export function appendChoice(store: Store, profileId: string, storyId: string, expectedRoute: number[], choice: number, parts: number): Store {
  if (store.activeId !== profileId || (choice !== 0 && choice !== 1)) return store;
  const profile = store.profiles.find(item => item.id === profileId);
  const current = profile?.picks[storyId];
  if (!profile || !current || current.length >= parts || current.length !== expectedRoute.length || current.some((value, index) => value !== expectedRoute[index])) return store;
  const route = [...current, choice];
  return { ...store, profiles: store.profiles.map(item => item.id === profileId ? {
    ...item, picks: { ...item.picks, [storyId]: route },
    ...(route.length === parts ? {
      lastCompletedPicks: { ...item.lastCompletedPicks, [storyId]: [...route] },
      lastCompletedStoryVersions: { ...item.lastCompletedStoryVersions, [storyId]: item.storyVersions?.[storyId] || store.contentVersion },
    } : {}),
  } : item) };
}
