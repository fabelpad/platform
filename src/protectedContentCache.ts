import type { ContentRelease } from '../lib/server/contentRelease';
import { currentContentOwner } from './profileStorage';
const DATABASE='fabelpad-private-content-v1';
type Stored={id:string;owner:string;storyId:string;version:string;until:number;epoch:string;iv:Uint8Array;cipher:ArrayBuffer};
export type ProtectedContentContext={owner:string|null;generation:number;epoch:string|null};
const generations=new Map<string,number>(),purging=new Map<string,number>(),failedPurges=new Set<string>();
const epochKey=(owner:string)=>`generation:${owner}`;
const epochValue=(value:unknown):string=>value===undefined?'initial':typeof value==='string'?value:'';
function locallyCurrent(context:ProtectedContentContext):boolean {
 return currentContentOwner()===context.owner&&(!context.owner||context.generation===(generations.get(context.owner)??0)&&!purging.get(context.owner));
}
function open():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const request=indexedDB.open(DATABASE,1);request.onupgradeneeded=()=>{request.result.createObjectStore('keys');request.result.createObjectStore('releases',{keyPath:'id'});};request.onerror=()=>reject(new Error('cache_unavailable'));request.onsuccess=()=>resolve(request.result);});}
function result<T>(request:IDBRequest<T>):Promise<T>{return new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(new Error('cache_unavailable'));});}
/** Capture before HTTP. The persistent epoch also observes another tab's purge.
 * An unavailable cache disables offline storage without blocking online reads. */
export async function protectedContentContext():Promise<ProtectedContentContext>{
 const owner=currentContentOwner(),context:ProtectedContentContext={owner,generation:owner?generations.get(owner)??0:0,epoch:null};let db:IDBDatabase|undefined;
 if(!owner||failedPurges.has(owner))return context;
 try{db=await open();context.epoch=epochValue(await result(db.transaction('keys').objectStore('keys').get(epochKey(owner))));}catch{/* Online responses do not require IndexedDB. */}finally{db?.close();}
 return context;
}
export async function protectedContentContextIsCurrent(context:ProtectedContentContext):Promise<boolean>{
 if(!locallyCurrent(context))return false;if(!context.owner||context.epoch===null)return true;
 let db:IDBDatabase|undefined;try{db=await open();const epoch=epochValue(await result(db.transaction('keys').objectStore('keys').get(epochKey(context.owner))));return locallyCurrent(context)&&epoch===context.epoch;}catch{return false;}finally{db?.close();}
}
async function keyFor(db:IDBDatabase,context:ProtectedContentContext,create:boolean):Promise<CryptoKey|null>{
 const owner=context.owner!;
 const existing=await result(db.transaction('keys').objectStore('keys').get(owner)) as CryptoKey|undefined;
 if(!locallyCurrent(context))return null;if(existing)return existing;if(!create)return null;
 const generated=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
 if(!locallyCurrent(context))return null;
 // Key creation and revocation take the same transaction locks. Concurrent
 // downloads share one committed key; a completed purge cannot be undone.
 return new Promise((resolve,reject)=>{
  const transaction=db.transaction(['keys','releases'],'readwrite'),store=transaction.objectStore('keys'),epoch=store.get(epochKey(owner));let chosen:CryptoKey|null=null;
  epoch.onsuccess=()=>{if(!locallyCurrent(context)||epochValue(epoch.result)!==context.epoch)return;const request=store.get(owner);request.onsuccess=()=>{if(!locallyCurrent(context))return;chosen=request.result??generated;if(!request.result)store.put(generated,owner);};};
  transaction.oncomplete=()=>resolve(chosen);transaction.onerror=transaction.onabort=()=>reject(new Error('cache_unavailable'));
 });
}
export async function saveProtectedContent(release:ContentRelease,captured?:ProtectedContentContext):Promise<boolean>{
 let db:IDBDatabase|undefined;
 try{const context=captured??await protectedContentContext(),owner=context.owner,until=Date.parse(release.offlineUntil??'');if(!owner||context.epoch===null||failedPurges.has(owner)||!locallyCurrent(context)||owner!==release.cacheOwnerId||!Number.isFinite(until)||until<=Date.now()||until>Date.now()+24*60*60*1000+60_000)return false;
 db=await open();const key=await keyFor(db,context,true);if(!key)return false;const iv=crypto.getRandomValues(new Uint8Array(12)),id=`${owner}:${release.storyId}:${release.contentVersion}`;const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(id)},key,new TextEncoder().encode(JSON.stringify(release)));
 if(!locallyCurrent(context))return false;
 return await new Promise<boolean>((resolve,reject)=>{
  const transaction=db!.transaction(['keys','releases'],'readwrite'),keys=transaction.objectStore('keys'),epoch=keys.get(epochKey(owner));let saved=false;
  epoch.onsuccess=()=>{if(!locallyCurrent(context)||epochValue(epoch.result)!==context.epoch)return;const storedKey=keys.get(owner);storedKey.onsuccess=()=>{if(!locallyCurrent(context)||!storedKey.result)return;transaction.objectStore('releases').put({id,owner,storyId:release.storyId,version:release.contentVersion,until,epoch:context.epoch!,iv,cipher} satisfies Stored);saved=true;};};
  transaction.oncomplete=()=>resolve(saved&&locallyCurrent(context));transaction.onerror=transaction.onabort=()=>reject(new Error('cache_unavailable'));
 });
 }catch{return false;}finally{db?.close();}
}
export async function readProtectedContent(storyId:string,version?:string):Promise<ContentRelease|null>{
 let db:IDBDatabase|undefined;try{const context=await protectedContentContext(),owner=context.owner;if(!owner||context.epoch===null||!locallyCurrent(context))return null;db=await open();const key=await keyFor(db,context,false);if(!key)return null;const rows=await result(db.transaction('releases').objectStore('releases').getAll()) as Stored[];
 const row=rows.filter(r=>r.owner===owner&&r.epoch===context.epoch&&r.storyId===storyId&&(!version||r.version===version)&&r.until>Date.now()&&r.until<=Date.now()+24*60*60*1000+60_000).sort((a,b)=>b.until-a.until)[0];if(!row||!locallyCurrent(context))return null;
 const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:row.iv as Uint8Array<ArrayBuffer>,additionalData:new TextEncoder().encode(row.id)},key,row.cipher);const release=JSON.parse(new TextDecoder().decode(plain)) as ContentRelease;
 return await protectedContentContextIsCurrent(context)&&row.until>Date.now()&&release.cacheOwnerId===owner&&release.storyId===storyId&&release.contentVersion===row.version&&Date.parse(release.offlineUntil??'')===row.until?release:null;
 }catch{return null;}finally{db?.close();}
}
export async function clearProtectedContent(owner:string):Promise<void>{
 // Invalidate old fetches and encryption synchronously, including logout then
 // login to the same family before an earlier response arrives.
 generations.set(owner,(generations.get(owner)??0)+1);purging.set(owner,(purging.get(owner)??0)+1);
 let db:IDBDatabase|undefined;try{db=await open();await new Promise<void>((resolve,reject)=>{
  const transaction=db!.transaction(['keys','releases'],'readwrite'),keys=transaction.objectStore('keys');keys.put(crypto.randomUUID(),epochKey(owner));keys.delete(owner);
  const cursor=transaction.objectStore('releases').openCursor();cursor.onsuccess=()=>{const row=cursor.result;if(row){if(row.value.owner===owner)row.delete();row.continue();}};
  transaction.oncomplete=()=>resolve();transaction.onerror=transaction.onabort=()=>reject(new Error('cache_unavailable'));
 });failedPurges.delete(owner);}catch{failedPurges.add(owner);}finally{db?.close();const remaining=(purging.get(owner)??1)-1;if(remaining)purging.set(owner,remaining);else purging.delete(owner);}
}
if(typeof window!=='undefined')window.addEventListener('fabelpad-parent-data-cleared',event=>{const owner=(event as CustomEvent<{parentId?:string}>).detail?.parentId;if(owner)void clearProtectedContent(owner);});
