import { createHash } from 'node:crypto';
import { getScene, getEnding } from '../../src/storyData';
import { worlds } from '../../src/worlds';
import { isStoryId } from '../../src/storyCatalog';
import type { EditorialDraft } from '../../src/editorialStore';
import type { StoryScene, StoryEnding } from '../../src/storyTypes';
import { validateEditorialDraft } from '../../src/editorialStore';
import { canonicalContentJson } from '../contentHash';
import { object, RequestError } from './http';
import { bundledReadingLevels } from '../../src/contentReadingLevels';
import type { ReadingVariants } from '../../src/contentReadingLevels';

export type ContentRelease = {
  storyId: string; contentVersion: string; publishedAt: string | null; bundled: boolean;
  metadata: { title: string; description: string; image: string };
  access?: 'full' | 'preview'; offlineUntil?: string; cacheOwnerId?: string;
  parts: 5 | 1; nameToken: '__FABELPAD_CHILD__'; scenes: Record<string, StoryScene>; endings: Record<string, StoryEnding>;
  readingLevels?: ReadingVariants;
};
export function initialDraft(storyId: string): EditorialDraft {
  const world = worlds.find(item => item.id === storyId)!;
  return { metadata: { title: world.title, description: world.description, image: world.image }, chapters: {}, updatedAt: '' };
}
export function validateServerDraft(storyId: string, value: unknown): { draft?: EditorialDraft; errors: string[] } {
  if (!isStoryId(storyId)) return { errors: ['Dit verhaal bestaat niet.'] };
  if (!object(value) || Object.keys(value).some(key => !['metadata', 'chapters', 'updatedAt'].includes(key)) || !object(value.metadata) || !object(value.chapters)) return { errors: ['Het conceptformaat is ongeldig.'] };
  const metadata = value.metadata;
  if (Object.keys(metadata).some(key => !['title', 'description', 'image'].includes(key)) || typeof metadata.title !== 'string' || typeof metadata.description !== 'string' || typeof metadata.image !== 'string') return { errors: ['De metadata zijn ongeldig.'] };
  for (const [chapter, override] of Object.entries(value.chapters)) {
    if (!/^[0-4]$/u.test(chapter) || !object(override) || Object.entries(override).some(([key, field]) => !['title', 'text'].includes(key) || typeof field !== 'string' || field.length > (key === 'title' ? 200 : 20000))) return { errors: ['De hoofdstukken zijn ongeldig.'] };
  }
  const draft = { metadata, chapters: value.chapters, updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt.slice(0, 40) : '' } as EditorialDraft;
  const errors = validateEditorialDraft(storyId, draft);
  return { draft, errors };
}
/** Materialize all prefixes and endings; releases remain readable after source edits. */
export function buildStoryRelease(storyId: string, draft = initialDraft(storyId), includeReadingLevels = true): ContentRelease {
  if (!isStoryId(storyId)) throw new RequestError(404, 'story_not_found');
  const checked = validateServerDraft(storyId, draft);
  if (checked.errors.length) throw new RequestError(422, 'invalid_content', checked.errors.join(' '));
  const scenes: Record<string, StoryScene> = {}, endings: Record<string, StoryEnding> = {};
  for (let part = 0; part < 5; part++) for (let route = 0; route < 2 ** part; route++) {
    const picks = Array.from({ length: part }, (_, bit) => (route >> (part - bit - 1)) & 1);
    const original = getScene(storyId, part, picks, '__FABELPAD_CHILD__');
    const override = draft.chapters[String(part)];
    const personalize = (text: string) => text.replaceAll('{{naam}}', '__FABELPAD_CHILD__');
    scenes[picks.join('')] = { ...original, title: personalize(override?.title ?? original.title), text: personalize(override?.text ?? original.text) };
  }
  for (let route = 0; route < 32; route++) {
    const picks = Array.from({ length: 5 }, (_, bit) => (route >> (4 - bit)) & 1);
    endings[picks.join('')] = getEnding(storyId, picks, '__FABELPAD_CHILD__');
  }
  // An edited chapter has no supplied age rewrite. Never silently replace an
  // editor's prose with the unrelated bundled variant.
  const readingLevels = includeReadingLevels && Object.keys(draft.chapters).length === 0 ? bundledReadingLevels(storyId) : undefined;
  const payload = { metadata: draft.metadata, parts: 5 as const, nameToken: '__FABELPAD_CHILD__' as const, scenes, endings, ...(readingLevels ? { readingLevels } : {}) };
  const contentVersion = createHash('sha256').update(canonicalContentJson(payload)).digest('hex').slice(0, 16);
  return { storyId, contentVersion, publishedAt: null, bundled: true, ...payload };
}
