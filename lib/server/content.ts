import { worlds } from '../../src/worlds';
import { isStoryId } from '../../src/storyCatalog';
import { createSupabaseRequestClient, createSupabaseServerClient, getVerifiedParent, isContentAdmin } from '../supabase/server';
import { getBackendStatus } from '../supabase/config';
import { checkMutationOrigin, handleApiError, object, privateJson, readJson, RequestError } from './http';
import { buildStoryRelease, initialDraft, validateServerDraft } from './contentRelease';
import type { ContentRelease } from './contentRelease';
import type { BillingEntitlement } from '../billing/types';
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
/** Historical native catalog identities stay pinned after explicit profile import. */
function archived(storyId:string,version:string):ContentRelease|null {
 const archive=version==='247d7d1c63cc4fa3'?archiveOne:version==='4e48e9296a01fff5'?archiveTwo:null;
 const story=archive?.stories.find(s=>s.id===storyId);if(!archive||!story)return null;
 return {storyId,contentVersion:version,publishedAt:null,bundled:true,metadata:{title:story.title,description:story.description,image:story.image},parts:5,nameToken:'__FABELPAD_CHILD__',scenes:story.scenes,endings:story.endings,...('readingLevels' in story?{readingLevels:story.readingLevels}:{})} as ContentRelease;
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
   return privateJson(storyId?{configured:false,release}:{configured:false,stories:worlds.map(w=>summary(bundled(w.id)))});
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
  let release:ContentRelease|null=row?.payload?releaseFromRow(row):null;
  if(!release&&isStoryId(storyId)){
   if(version)release=archived(storyId,version)??(version===bundled(storyId).contentVersion?bundled(storyId):null);
   else release=bundled(storyId);
   if(!release&&version){const legacy=buildStoryRelease(storyId,undefined,false);if(version===legacy.contentVersion)release=legacy;}
  }
  if(!release)throw new RequestError(404,version?'content_version_not_found':'story_not_found','Deze verhaalversie bestaat niet. Je avontuur is niet gewijzigd.');
  release=projected(release,row?.access==='preview'?'preview':access(storyId)as'full'|'preview');
  return privateJson({configured:true,release:{...release,offlineUntil:leaseEnd,...(parent?{cacheOwnerId:parent.id}:{})}});
 }catch(error){return handleApiError(error);}
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
    const { metadata, parts, nameToken, scenes, endings, readingLevels } = materialized;
    const { data, error } = await client.rpc('publish_content_release', { p_story_id: storyId, p_base_revision: body.baseRevision, p_payload: { metadata, parts, nameToken, scenes, endings, ...(readingLevels ? { readingLevels } : {}) } });
    if (error || !data) throw error ?? new Error('Missing publication outcome');
    if (!data.saved) return privateJson({ error: 'revision_conflict', revision: data.revision }, 409);
    return privateJson({ release: releaseFromRow(data.release as ReleaseRow) });
  } catch (error) { return handleApiError(error); }
}
