import { worlds } from '../../src/worlds';
import { isStoryId } from '../../src/storyCatalog';
import { createSupabaseServerClient, getVerifiedParent, isContentAdmin } from '../supabase/server';
import { getBackendStatus } from '../supabase/config';
import { checkMutationOrigin, handleApiError, object, privateJson, readJson, RequestError } from './http';
import { buildStoryRelease, initialDraft, validateServerDraft } from './contentRelease';
import type { ContentRelease } from './contentRelease';
export type { ContentRelease } from './contentRelease';

const bundledReleases = new Map<string, ContentRelease>();
function bundled(storyId: string) {
  if (!bundledReleases.has(storyId)) bundledReleases.set(storyId, buildStoryRelease(storyId));
  return bundledReleases.get(storyId)!;
}
type ReleaseRow = { story_id: string; content_version: string; published_at: string; payload: Omit<ContentRelease, 'storyId' | 'contentVersion' | 'publishedAt' | 'bundled'> };
type CatalogRow = { story_id: string; content_version: string; published_at: string; metadata: ContentRelease['metadata'] };
function releaseFromRow(row: ReleaseRow): ContentRelease { return { ...row.payload, storyId: row.story_id, contentVersion: row.content_version, publishedAt: row.published_at, bundled: false }; }
function summary(release: ContentRelease) { return { storyId: release.storyId, contentVersion: release.contentVersion, publishedAt: release.publishedAt, metadata: release.metadata, bundled: release.bundled }; }
export async function getContent(request: Request, storyId?: string) {
  try {
    if (storyId && !isStoryId(storyId)) throw new RequestError(404, 'story_not_found');
    const version = new URL(request.url).searchParams.get('version');
    if (version !== null && !/^[a-f0-9]{16,64}$/u.test(version)) throw new RequestError(422, 'invalid_version');
    const status = getBackendStatus();
    if (storyId && version === bundled(storyId).contentVersion) return privateJson({ configured: status.configured, release: bundled(storyId) });
    if (!status.configured) {
      if (storyId && version && version !== bundled(storyId).contentVersion) throw new RequestError(404, 'content_version_not_found', 'Deze verhaalversie is niet op dit apparaat beschikbaar.');
      return privateJson(storyId ? { configured: false, release: bundled(storyId) } : { configured: false, stories: worlds.map(world => summary(bundled(world.id))) });
    }
    const client = await createSupabaseServerClient();
    if (!storyId) {
      // The database chooses one release per story before the Data API row limit.
      // Catalog reads transfer metadata instead of all retained story payloads.
      const { data, error } = await client.rpc('get_content_catalog');
      if (error) throw error;
      const latest = new Map(((data ?? []) as CatalogRow[]).map(row => [row.story_id, { storyId: row.story_id, contentVersion: row.content_version, publishedAt: row.published_at, metadata: row.metadata, bundled: false }]));
      return privateJson({ configured: true, stories: worlds.map(world => latest.get(world.id) ?? summary(bundled(world.id))) });
    }
    let query = client.from('content_releases').select('story_id,content_version,published_at,payload').order('published_at', { ascending: false });
    query = query.eq('story_id', storyId).order('content_version', { ascending: false }).limit(1);
    if (version) query = query.eq('content_version', version);
    const { data, error } = await query;
    if (error) throw error;
    if (!data?.length && version) throw new RequestError(404, 'content_version_not_found', 'Deze verhaalversie bestaat niet. Het avontuur is niet gewijzigd.');
    return privateJson({ configured: true, release: data?.length ? releaseFromRow(data[0] as ReleaseRow) : bundled(storyId) });
  } catch (error) { return handleApiError(error); }
}
async function adminClient() {
  const client = await createSupabaseServerClient();
  const parent = await getVerifiedParent(client);
  if (!parent) throw new RequestError(401, 'not_authenticated', 'Log als beheerder in.');
  if (!await isContentAdmin(client, parent.id)) throw new RequestError(403, 'admin_required', 'Dit account heeft geen rechten voor de verhalenstudio.');
  return client;
}
export async function contentDraft(request: Request, storyId: string) {
  try {
    if (!isStoryId(storyId)) throw new RequestError(404, 'story_not_found');
    const client = await adminClient();
    if (request.method === 'GET') {
      const { data, error } = await client.from('content_drafts').select('revision,draft').eq('story_id', storyId).maybeSingle();
      if (error) throw error;
      return privateJson({ storyId, revision: data?.revision ?? 0, draft: data?.draft ?? initialDraft(storyId) });
    }
    checkMutationOrigin(request);
    const body = await readJson(request, 128 * 1024);
    if (!object(body) || !Number.isSafeInteger(body.baseRevision) || (body.baseRevision as number) < 0) throw new RequestError(422, 'invalid_request');
    const checked = validateServerDraft(storyId, body.draft);
    if (!checked.draft || checked.errors.length) return privateJson({ error: 'invalid_content', errors: checked.errors }, 422);
    const { data, error } = await client.rpc('save_content_draft', { p_story_id: storyId, p_base_revision: body.baseRevision, p_draft: checked.draft });
    if (error || !data) throw error ?? new Error('Missing save outcome');
    return privateJson({ storyId, ...data, ...(!data.saved ? { error: 'revision_conflict' } : {}) }, data.saved ? 200 : 409);
  } catch (error) { return handleApiError(error); }
}
export async function publishContent(request: Request, storyId: string) {
  try {
    if (!isStoryId(storyId)) throw new RequestError(404, 'story_not_found');
    const client = await adminClient();
    checkMutationOrigin(request);
    const body = await readJson(request);
    if (!object(body) || !Number.isSafeInteger(body.baseRevision) || (body.baseRevision as number) < 1) throw new RequestError(422, 'invalid_request');
    const { data: stored, error: loadError } = await client.from('content_drafts').select('revision,draft').eq('story_id', storyId).maybeSingle();
    if (loadError) throw loadError;
    if (!stored || stored.revision !== body.baseRevision) return privateJson({ error: 'revision_conflict', revision: stored?.revision ?? 0 }, 409);
    const materialized = buildStoryRelease(storyId, stored.draft);
    const { metadata, parts, nameToken, scenes, endings } = materialized;
    const { data, error } = await client.rpc('publish_content_release', { p_story_id: storyId, p_base_revision: body.baseRevision, p_payload: { metadata, parts, nameToken, scenes, endings } });
    if (error || !data) throw error ?? new Error('Missing publication outcome');
    if (!data.saved) return privateJson({ error: 'revision_conflict', revision: data.revision }, 409);
    return privateJson({ release: releaseFromRow(data.release as ReleaseRow) });
  } catch (error) { return handleApiError(error); }
}
