import type { ContentRelease, Profile, Story } from './types';

/** Resolve every started story from its original bundled release, including treasures. */
export function storiesForProfile(current: Story[], releases: Record<string, ContentRelease>, profile?: Profile): Story[] {
  if (!profile) return current;
  const ids = [...new Set([...current.map(story => story.id), ...Object.keys(profile.picks)])];
  return ids.flatMap(id => {
    const version = profile.storyVersions?.[id];
    const story = version ? releases[version]?.stories.find(item => item.id === id) : current.find(item => item.id === id);
    return story ? [story] : [];
  });
}

export function normalizeStoryVersions(profile: Profile, legacyVersion: string): Record<string, string> {
  const versions = profile.storyVersions && typeof profile.storyVersions === 'object' && !Array.isArray(profile.storyVersions) ? profile.storyVersions : {};
  return Object.fromEntries(Object.keys(profile.picks).map(id => [id, typeof versions[id] === 'string' ? versions[id] : legacyVersion]));
}
