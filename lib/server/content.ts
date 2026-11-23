import { worlds } from '../../src/worlds';
import { createHash } from 'node:crypto';
import { isStoryId } from '../../src/storyCatalog';
import { readingLevelsForRelease } from '../../src/contentReadingLevels';
import { createSupabaseRequestClient, createSupabaseServerClient, getVerifiedParent, isContentAdmin } from '../supabase/server';
import { getBackendStatus } from '../supabase/config';
import { checkMutationOrigin, handleApiError, object, privateJson, readJson, RequestError } from './http';
import { buildStoryRelease, initialDraft, validateServerDraft } from './contentRelease';
import type { ContentRelease } from './contentRelease';
import type { BillingEntitlement } from '../billing/types';
import { getSupabaseConfig } from '../supabase/config';
import { narrationHostedTarget } from '../narration/hosted-target';
import { canonicalContentJson } from '../contentHash';
import archiveOne from '../../mobile/src/releases/247d7d1c63cc4fa3.json';
import archiveTwo from '../../mobile/src/releases/4e48e9296a01fff5.json';
export type { ContentRelease } from './contentRelease';
const bundledReleases = new Map<string, ContentRelease>();
function bundled(storyId: string) {
  if (!bundledReleases.has(storyId)) bundledReleases.set(storyId, buildStoryRelease(storyId));
  return bundledReleases.get(storyId)!;
}
type ReleaseRow = { story_id: string; content_version: string; published_at: string; payload: Omit<ContentRelease, 'storyId' | 'contentVersion' | 'publishedAt' | 'bundled'>;access?:'full'|'preview'|'locked' };
type CatalogRow = { story_id: string; content_version: string; published_at: string; metadata: ContentRelease['metadata'] };
function releaseFromRow(row: ReleaseRow): ContentRelease { return { ...row.payload, storyId: row.story_id, contentVersion: row.content_version, publishedAt: row.published_at, bundled: false,...(row.access==='preview'?{access:'preview' as const}:{access:'full' as const}) }; }
function summary(release: ContentRelease) { return { storyId: release.storyId, contentVersion: release.contentVersion, publishedAt: release.publishedAt, metadata: release.metadata, bundled: release.bundled }; }
function withCompatibleReading(release: ContentRelease): ContentRelease {
 const readingLevels=readingLevelsForRelease(release);
 return readingLevels&&readingLevels!==release.readingLevels?{...release,readingLevels}:release;
}
/** Historical native catalog identities stay pinned after explicit profile import. */
function archived(storyId:string,version:string):ContentRelease|null {
 const archive=version==='247d7d1c63cc4fa3'?archiveOne:version==='4e48e9296a01fff5'?archiveTwo:null;
 const story=archive?.stories.find(s=>s.id===storyId);if(!archive||!story)return null;
 return {storyId,contentVersion:version,publishedAt:null,bundled:true,metadata:{title:story.title,description:story.description,image:story.image},parts:5,nameToken:'__FABELPAD_CHILD__',scenes:story.scenes,endings:story.endings,...('readingLevels' in story?{readingLevels:story.readingLevels}:{})} as ContentRelease;
}
/** The billing RPC has already projected previews. Recover a compatible full
 * source only when its canonical payload proves the exact immutable release
 * identity, including metadata and fields not involved in the reading view.
 * The recovered source is projected back to chapter one before delivery. */
function verifiedPreviewSource(row:ReleaseRow):ReleaseRow {
 if(row.access!=='preview'||row.payload.readingLevels||!isStoryId(row.story_id)||!/^[a-f0-9]{16}$/u.test(row.content_version))return row;
 const reference=archived(row.story_id,'247d7d1c63cc4fa3');
 if(!reference||canonicalContentJson(row.payload.scenes)!==canonicalContentJson({'':reference.scenes['']})||Object.keys(row.payload.endings).length)return row;
 const candidate={...row.payload,parts:5 as const,scenes:reference.scenes,endings:reference.endings};
 const proof=createHash('sha256').update(canonicalContentJson(candidate)).digest('hex').slice(0,16);
 return proof===row.content_version?{...row,payload:candidate}:row;
}
function projected(release:ContentRelease,access:'full'|'preview'):ContentRelease {
 if(access==='full')return {...release,access};
 const first=<T,>(rows:Record<string,T>):Record<string,T>=>Object.hasOwn(rows,'')?{'':rows['']}:{};
 const readingLevels=release.readingLevels?Object.fromEntries(Object.entries(release.readingLevels).map(([level,value])=>[level,{scenes:first(value.scenes),endings:{}}])) as ContentRelease['readingLevels']:undefined;
 return {...release,access,parts:1,scenes:first(release.scenes),endings:{},...(readingLevels?{readingLevels}:{})};
}
export async function getContent(request: Request, storyId?: string) {
 try {
  if(storyId&&!/^[a-z][a-z0-9_-]{1,79}$/u.test(storyId))throw new RequestError(404,'story_not_found');
  const version=new URL(request.url).searchParams.get('version');
  if(version!==null&&!/^[a-f0-9]{16,64}$/u.test(version))throw new RequestError(422,'invalid_version');
  const status=getBackendStatus();
  if(!status.configured){
   if(storyId&&!isStoryId(storyId))throw new RequestError(404,'story_not_found');
   let release=storyId?bundled(storyId):null;
   if(storyId&&version){release=archived(storyId,version)??(version===bundled(storyId).contentVersion?bundled(storyId):null);if(!release){const legacy=buildStoryRelease(storyId,undefined,false);if(version===legacy.contentVersion)release=legacy;}if(!release)throw new RequestError(404,'content_version_not_found');}
   return privateJson(storyId?{configured:false,release:release?withCompatibleReading(release):release}:{configured:false,stories:worlds.map(w=>summary(bundled(w.id)))});
  }
  const client=await createSupabaseRequestClient(request),parent=await getVerifiedParent(client);
  const {data:offer,error:offerError}=await client.rpc('get_billing_public_offer');if(offerError)throw offerError;
  let entitlement:BillingEntitlement|null=null;
  if(parent){const {data,error}=await client.rpc('get_billing_entitlement');if(error){if(error.code==='42501')throw new RequestError(403,'account_inactive','De toegang tot jullie gezin is ingetrokken. Bekijk je accountoverzicht.');throw error;}entitlement=data as BillingEntitlement;}
  const paymentRequired=offer?.paymentRequired!==false;
  const access=(id:string):'full'|'preview'|'locked'=>!paymentRequired||entitlement?.fullLibrary||entitlement?.preview.fullStoryId===id?'full':entitlement?.preview.chapterOneStoryIds.includes(id)?'preview':'locked';
  const leaseEnd=new Date(Math.min(Date.now()+24*60*60*1000,entitlement?.validUntil?Date.parse(entitlement.validUntil):Infinity)).toISOString();
  if(!storyId){
   const {data,error}=await client.rpc('get_content_catalog');if(error)throw error;
   const latest=new Map<string,ReturnType<typeof summary>>(((data??[])as CatalogRow[]).map(row=>[row.story_id,{storyId:row.story_id,contentVersion:row.content_version,publishedAt:row.published_at,metadata:row.metadata,bundled:false}]));
   for(const world of worlds)if(!latest.has(world.id))latest.set(world.id,summary(bundled(world.id)));
   return privateJson({configured:true,stories:[...latest.values()].map(row=>({...row,access:access(row.storyId),offlineUntil:leaseEnd})),entitlement,offlineUntil:leaseEnd});
  }
  const {data,error}=await client.rpc('get_billing_content_release',{p_story_id:storyId,p_content_version:version});if(error)throw error;
  const row=data as ReleaseRow|null;
  if(row?.access==='locked'||access(storyId)==='locked')throw new RequestError(403,'content_locked','Dit verhaal hoort bij Fabelpad Gezin. Je voortgang blijft bewaard.');
  let release:ContentRelease|null=row?.payload?releaseFromRow(verifiedPreviewSource(row)):null;
  if(!release&&isStoryId(storyId)){
   if(version)release=archived(storyId,version)??(version===bundled(storyId).contentVersion?bundled(storyId):null);
   else release=bundled(storyId);
   if(!release&&version){const legacy=buildStoryRelease(storyId,undefined,false);if(version===legacy.contentVersion)release=legacy;}
  }
  if(!release)throw new RequestError(404,version?'content_version_not_found':'story_not_found','Deze verhaalversie bestaat niet. Je avontuur is niet gewijzigd.');
  release=projected(withCompatibleReading(release),row?.access==='preview'?'preview':access(storyId)as'full'|'preview');
  return privateJson({configured:true,release:{...release,offlineUntil:leaseEnd,...(parent?{cacheOwnerId:parent.id}:{})}});
 }catch(error){return handleApiError(error);}
}
async function adminClient(request: Request) {
  const client = await createSupabaseServerClient();
  const parent = await getVerifiedParent(client);
  if (!parent) throw new RequestError(401, 'not_authenticated', 'Log als beheerder in.');
  const expected = request.headers.get('x-fabelpad-parent');
  if ((request.method !== 'GET' || expected !== null) && expected !== parent.id) throw new RequestError(401, 'account_changed', 'Het beheeraccount is gewijzigd. Laad de verhalenstudio opnieuw.');
  if (!await isContentAdmin(client, parent.id)) throw new RequestError(403, 'admin_required', 'Dit account heeft geen rechten voor de verhalenstudio.');
  return client;
}
export async function contentDraft(request: Request, storyId: string) {
  try {
    if (!isStoryId(storyId)) throw new RequestError(404, 'story_not_found');
    const client = await adminClient(request);
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
    const configuration = getSupabaseConfig();
    const narration = !!configuration && narrationHostedTarget({ SUPABASE_URL: configuration.url, FABELPAD_APP_ORIGIN: configuration.appUrl });
    const { metadata, parts, nameToken, scenes, endings, readingLevels } = buildStoryRelease(storyId, checked.draft);
    const { data, error } = await client.rpc(narration ? 'save_narration_content_draft' : 'save_content_draft', { p_story_id: storyId, p_base_revision: body.baseRevision, p_draft: checked.draft,
      ...(narration ? { p_payload: { metadata, parts, nameToken, scenes, endings, ...(readingLevels ? { readingLevels } : {}) } } : {}) });
    if (error || !data) throw error ?? new Error('Missing save outcome');
    return privateJson({ storyId, ...data, ...(!data.saved ? { error: 'revision_conflict' } : {}) }, data.saved ? 200 : 409);
  } catch (error) { return handleApiError(error); }
}
export async function publishContent(request: Request, storyId: string) {
  try {
    if (!isStoryId(storyId)) throw new RequestError(404, 'story_not_found');
    const client = await adminClient(request);
    checkMutationOrigin(request);
    const body = await readJson(request);
    if (!object(body) || !Number.isSafeInteger(body.baseRevision) || (body.baseRevision as number) < 1) throw new RequestError(422, 'invalid_request');
    const { data: stored, error: loadError } = await client.from('content_drafts').select('revision,draft').eq('story_id', storyId).maybeSingle();
    if (loadError) throw loadError;
    if (!stored || stored.revision !== body.baseRevision) return privateJson({ error: 'revision_conflict', revision: stored?.revision ?? 0 }, 409);
    const materialized = buildStoryRelease(storyId, stored.draft);
    const { metadata, parts, nameToken, scenes, endings, readingLevels } = materialized;
    const { data, error } = await client.rpc('publish_content_release', { p_story_id: storyId, p_base_revision: body.baseRevision, p_payload: { metadata, parts, nameToken, scenes, endings, ...(readingLevels ? { readingLevels } : {}) } });
    if (error || !data) throw error ?? new Error('Missing publication outcome');
    if (!data.saved) return privateJson({ error: 'revision_conflict', revision: data.revision }, 409);
    const configuration = getSupabaseConfig(); let audio: unknown;
    if (configuration && narrationHostedTarget({ SUPABASE_URL: configuration.url, FABELPAD_APP_ORIGIN: configuration.appUrl })) {
      const status = await client.rpc('get_narration_source_status', { p_story_id: storyId, p_content_version: (data.release as ReleaseRow).content_version });
      audio = status.error ? { state: 'unknown', reason: 'status_unavailable' } : status.data;
    }
    return privateJson({ release: releaseFromRow(data.release as ReleaseRow), ...(audio ? { audio } : {}) });
  } catch (error) { return handleApiError(error); }
}
