import { createHash } from 'node:crypto';
import { canonicalContentJson } from '../contentHash';
import { createSupabaseRequestClient,getVerifiedParent,isContentAdmin } from '../supabase/server';
import { checkMutationOrigin,handleApiError,object,privateJson,readJson,RequestError } from './http';
import { getSupabaseConfig } from '../supabase/config';
import { narrationHostedTarget } from '../narration/hosted-target';
const plain=(value:unknown,max:number)=>typeof value==='string'&&value.trim().length>0&&value.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value);
function exact(value:Record<string,unknown>,fields:string[]){return Object.keys(value).every(k=>fields.includes(k))&&fields.every(k=>Object.hasOwn(value,k));}
function chapters(value:unknown,endings:unknown):boolean{
 if(!object(value)||!object(endings)||Object.keys(value).length!==31||Object.keys(endings).length!==32)return false;
 for(let part=0;part<5;part++)for(let n=0;n<2**part;n++){const path=part?n.toString(2).padStart(part,'0'):'';const scene=value[path];if(!object(scene)||!exact(scene,['title','text','choices'])||!plain(scene.title,200)||!plain(scene.text,20000)||!Array.isArray(scene.choices)||scene.choices.length!==2||scene.choices.some(choice=>!object(choice)||!exact(choice,['label','hint','icon'])||!plain(choice.label,300)||(typeof choice.hint!=='string'||choice.hint.length>1000)||!['heart','sparkles','music','moon','leaf','compass'].includes(String(choice.icon))))return false;}
 for(let n=0;n<32;n++){const ending=endings[n.toString(2).padStart(5,'0')];if(!object(ending)||!exact(ending,['title','text','keepsake'])||!plain(ending.title,200)||!plain(ending.text,20000)||!plain(ending.keepsake,300))return false;}
 return true;
}
export function validatePremiumPayload(value:unknown):value is Record<string,unknown>{
 if(!object(value)||Object.keys(value).some(k=>!['metadata','parts','nameToken','scenes','endings','readingLevels'].includes(k))||value.parts!==5||value.nameToken!=='__FABELPAD_CHILD__'||!object(value.metadata)||!exact(value.metadata,['title','description','image'])||!plain(value.metadata.title,200)||!plain(value.metadata.description,1000)||typeof value.metadata.image!=='string'||!/^\/(?:art|brand)\/[a-zA-Z0-9_./-]+\.(?:webp|png|jpg|svg)$/u.test(value.metadata.image)||value.metadata.image.includes('..')||!chapters(value.scenes,value.endings))return false;
 if(value.readingLevels!==undefined){if(!object(value.readingLevels)||!exact(value.readingLevels,['under6','6to8','9plus'])||Object.values(value.readingLevels).some(level=>!object(level)||!exact(level,['scenes','endings'])||!chapters(level.scenes,level.endings)))return false;}
 return true;
}
export async function publishPremiumContent(request:Request):Promise<Response>{try{
 checkMutationOrigin(request);const client=await createSupabaseRequestClient(request),parent=await getVerifiedParent(client);if(!parent)throw new RequestError(401,'not_authenticated');if(request.headers.get('x-fabelpad-parent')!==parent.id)throw new RequestError(401,'account_changed','Het beheeraccount is gewijzigd. Laad de publicatiepagina opnieuw.');if(!await isContentAdmin(client,parent.id))throw new RequestError(403,'admin_required');
 const body=await readJson(request,4*1024*1024);if(!object(body)||Object.keys(body).some(k=>!['storyId','payload','confirmPrivate'].includes(k))||body.confirmPrivate!==true||typeof body.storyId!=='string'||!/^[a-z][a-z0-9_-]{1,79}$/u.test(body.storyId)||!validatePremiumPayload(body.payload))throw new RequestError(422,'invalid_content','Controleer het verhaalbestand: vijf delen met alle keuzepaden en eindes zijn verplicht.');
 const hash=createHash('sha256').update(canonicalContentJson(body.payload)).digest('hex').slice(0,16);
 const {data,error}=await client.rpc('publish_billing_premium_content',{p_story_id:body.storyId,p_content_version:hash,p_metadata:body.payload.metadata,p_payload:body.payload});
 if(error){if(error.message==='fresh_auth_required'||error.code==='28000')throw new RequestError(428,'fresh_auth_required','Log opnieuw in voordat je het verhaal publiceert.');throw error;}
 const configuration=getSupabaseConfig();let audio:unknown;
 if(configuration&&narrationHostedTarget({SUPABASE_URL:configuration.url,FABELPAD_APP_ORIGIN:configuration.appUrl})){
 const status=await client.rpc('get_narration_source_status',{p_story_id:body.storyId,p_content_version:hash});audio=status.error?{state:'unknown',reason:'status_unavailable'}:status.data;
 }
 return privateJson({...data,...(audio?{audio}:{})});
 }catch(error){return handleApiError(error);}}
