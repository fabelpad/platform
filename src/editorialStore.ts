import { getScene } from './storyData';
import { isStoryId, STORY_PARTS } from './storyCatalog';
import { worlds } from './worlds';

export type SceneOverride = { title?: string; text?: string };
export type EditorialMetadata = { title: string; description: string; image: string };
export type EditorialDraft = {
  metadata: EditorialMetadata;
  chapters: Record<string, SceneOverride>;
  updatedAt: string;
};
export type EditorialPublication = EditorialDraft & { version: number; publishedAt: string };
type EditorialDocument = {
  schemaVersion: 1;
  drafts: Record<string, EditorialDraft>;
  published: Record<string, EditorialPublication>;
};

const KEY = 'fabelpad-prototype-editorial-v1';
const EVENT = 'fabelpad-editorial-change';
let volatileDocument: EditorialDocument | null = null;
function empty(): EditorialDocument { return { schemaVersion: 1, drafts: {}, published: {} }; }
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function validDraft(value: unknown): value is EditorialDraft {
  if (!object(value) || !object(value.metadata) || !object(value.chapters) || typeof value.updatedAt !== 'string') return false;
  if (typeof value.metadata.title !== 'string' || typeof value.metadata.description !== 'string' || typeof value.metadata.image !== 'string') return false;
  return Object.entries(value.chapters).every(([index, entry]) => /^[0-4]$/.test(index) && object(entry) && Object.entries(entry).every(([field, text]) => ['title', 'text'].includes(field) && typeof text === 'string'));
}
function readDocument(): EditorialDocument {
  if (typeof window === 'undefined') return empty();
  if (volatileDocument) return volatileDocument;
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!object(value) || value.schemaVersion !== 1 || !object(value.drafts) || !object(value.published)) return empty();
    const next = empty();
    for (const [id, draft] of Object.entries(value.drafts)) if (isStoryId(id) && validDraft(draft)) next.drafts[id] = draft;
    for (const [id, published] of Object.entries(value.published)) if (isStoryId(id) && object(published) && typeof published.version === 'number' && Number.isInteger(published.version) && published.version > 0 && typeof published.publishedAt === 'string' && validDraft(published)) next.published[id] = published as EditorialPublication;
    return next;
  } catch { return empty(); }
}
function writeDocument(document: EditorialDocument): boolean {
  if (typeof window === 'undefined') return false;
  let persisted = false;
  try { localStorage.setItem(KEY, JSON.stringify(document)); volatileDocument = null; persisted = true; }
  catch { volatileDocument = document; }
  window.dispatchEvent(new Event(EVENT));
  return persisted;
}
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
export function getEditorialPublication(id: string): EditorialPublication | undefined {
  const published = readDocument().published[id];
  return published ? clone(published) : undefined;
}
export function getEditorialDraft(id: string): EditorialDraft {
  const document = readDocument();
  if (document.drafts[id]) return clone(document.drafts[id]);
  if (document.published[id]) { const { metadata, chapters, updatedAt } = document.published[id]; return clone({ metadata, chapters, updatedAt }); }
  const world = worlds.find(item => item.id === id) || worlds[0];
  return { metadata: { title: world.title, description: world.description, image: world.image }, chapters: {}, updatedAt: '' };
}
export function saveEditorialDraft(id: string, draft: EditorialDraft): boolean {
  if (!isStoryId(id) || !validDraft(draft)) return false;
  const document = readDocument();
  document.drafts[id] = clone({ ...draft, updatedAt: new Date().toISOString() });
  return writeDocument(document);
}
export function resetEditorialDraft(id: string): boolean {
  const document = readDocument();
  delete document.drafts[id];
  return writeDocument(document);
}
export function validateEditorialDraft(id: string, draft: EditorialDraft): string[] {
  const errors: string[] = [];
  if (!isStoryId(id)) return ['Dit verhaal is niet bekend in de catalogus.'];
  if (!draft.metadata.title.trim()) errors.push('Geef het verhaal een titel.');
  if (!draft.metadata.description.trim()) errors.push('Schrijf een korte beschrijving voor de bibliotheek.');
  if (!worlds.some(world => world.image === draft.metadata.image)) errors.push('Kies een bestaande omslagafbeelding.');
  if (draft.metadata.title.length > 120) errors.push('De verhaaltitel mag maximaal 120 tekens bevatten.');
  if (draft.metadata.description.length > 600) errors.push('De beschrijving mag maximaal 600 tekens bevatten.');
  // Every route prefix is checked; later choices never change the scene being validated.
  for (let step = 0; step < STORY_PARTS; step += 1) {
    const override = draft.chapters[String(step)] || {};
    let invalidTitle = false, invalidText = false, invalidChoices = false;
    for (let route = 0; route < 2 ** step; route += 1) {
      const picks = Array.from({ length: step }, (_, bit) => (route >> bit) & 1);
      const scene = getScene(id, step, picks, '{{naam}}');
      if (!(override.title ?? scene.title).trim()) invalidTitle = true;
      if (!(override.text ?? scene.text).trim()) invalidText = true;
      if (scene.choices.length !== 2 || scene.choices.some(choice => !choice.label.trim() || !choice.hint.trim())) invalidChoices = true;
    }
    if (invalidTitle) errors.push(`Deel ${step + 1}: vul een hoofdstuktitel in.`);
    if (invalidText) errors.push(`Deel ${step + 1}: voeg verhaaltekst toe.`);
    if (invalidChoices) errors.push(`Deel ${step + 1}: beide bestaande keuzes moeten compleet zijn.`);
    if ((override.text?.length || 0) > 20000) errors.push(`Deel ${step + 1}: de tekst mag maximaal 20.000 tekens bevatten.`);
  }
  return errors;
}
export function publishEditorialDraft(id: string, draft: EditorialDraft): { errors: string[]; publication?: EditorialPublication; persisted: boolean } {
  const errors = validateEditorialDraft(id, draft);
  if (errors.length) return { errors, persisted: false };
  const document = readDocument();
  const now = new Date().toISOString();
  const publication: EditorialPublication = { ...clone(draft), updatedAt: now, publishedAt: now, version: (document.published[id]?.version || 0) + 1 };
  document.published[id] = publication;
  document.drafts[id] = { metadata: clone(publication.metadata), chapters: clone(publication.chapters), updatedAt: now };
  return { errors: [], publication, persisted: writeDocument(document) };
}
export function getPublishedMetadata(id: string): Partial<EditorialMetadata> | undefined {
  return getEditorialPublication(id)?.metadata;
}
export function getPublishedScene(id: string, step: number): SceneOverride | undefined {
  return getEditorialPublication(id)?.chapters[String(step)];
}
export function subscribeEditorial(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (event: StorageEvent) => { if (event.key === KEY || event.key === null) { volatileDocument = null; listener(); } };
  window.addEventListener(EVENT, listener);
  window.addEventListener('storage', onStorage);
  return () => { window.removeEventListener(EVENT, listener); window.removeEventListener('storage', onStorage); };
}
