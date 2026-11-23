import archiveOne from '../../mobile/src/releases/247d7d1c63cc4fa3.json' with { type: 'json' };
import archiveTwo from '../../mobile/src/releases/4e48e9296a01fff5.json' with { type: 'json' };
import type { NarrationSource } from './contracts.ts';
import { canonicalNarrationJSON } from './compiler.ts';

interface NarrationArchive {
  contentVersion: string;
  stories: { id: string; title: string; description: string; image: string;
    scenes: NarrationSource['scenes']; endings: NarrationSource['endings'];
    readingLevels?: NarrationSource['readingLevels']; }[];
}
type BundledNarrationSource = { storyId: string; contentVersion: string; payload: Omit<NarrationSource, 'storyId' | 'contentVersion'> & Record<string, unknown> };

/** The Edge upload may omit a 9plus layer only after proving that it is an
 * exact duplicate of the base layer. Reconstruct it here so every source hash,
 * pinned version and generated item sees the original complete snapshot.
 * Older archives without any reading layers retain their original shape. */
export function narrationSourcesFromArchives(archives: NarrationArchive[]): BundledNarrationSource[] {
  return archives.flatMap(archive => archive.stories.map(story => {
    const readingLevels = story.readingLevels && !Object.hasOwn(story.readingLevels, '9plus')
      ? { ...story.readingLevels, '9plus': { scenes: story.scenes, endings: story.endings } }
      : story.readingLevels;
    return { storyId: story.id, contentVersion: archive.contentVersion,
      payload: { metadata: { title: story.title, description: story.description, image: story.image }, parts: 5, nameToken: '__FABELPAD_CHILD__',
        scenes: story.scenes, endings: story.endings, ...('readingLevels' in story ? { readingLevels } : {}) } };
  }));
}

/** The same immutable native archives served by getContent. No profile data or latest-text substitution. */
export function bundledNarrationSources(): BundledNarrationSource[] {
  return narrationSourcesFromArchives([archiveOne, archiveTwo]);
}

let compatibleReading: Map<string, { base: string; readingLevels: NarrationSource['readingLevels'] }> | undefined;
/** Resolve the same supplied age views as the readers, without changing a
 * pinned source. Every base scene, choice and ending must match the immutable
 * native reference; an edited historical source keeps its own authored text. */
export function withCompatibleNarrationReading<T extends NarrationSource>(source: T): T {
  if (source.readingLevels) return source;
  compatibleReading ??= new Map(narrationSourcesFromArchives([archiveOne]).map(({ storyId, payload }) => [storyId, {
    base: canonicalNarrationJSON({ scenes: payload.scenes, endings: payload.endings }), readingLevels: payload.readingLevels,
  }]));
  const reference = compatibleReading.get(source.storyId);
  if (!reference?.readingLevels || reference.base !== canonicalNarrationJSON({ scenes: source.scenes, endings: source.endings })) return source;
  return { ...source, readingLevels: reference.readingLevels };
}
