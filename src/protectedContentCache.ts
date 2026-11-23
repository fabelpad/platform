import type { ContentRelease } from '../lib/server/contentRelease';
import { currentContentOwner } from './profileStorage';
const DATABASE='fabelpad-private-content-v1';
type Stored={id:string;owner:string;storyId:string;version:string;until:number;iv:Uint8Array;cipher:ArrayBuffer};
function open():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const request=indexedDB.open(DATABASE,1);request.onupgradeneeded=()=>{request.result.createObjectStore('keys');request.result.createObjectStore('releases',{keyPath:'id'});};request.onerror=()=>reject(new Error('cache_unavailable'));request.onsuccess=()=>resolve(request.result);});}
function result<T>(request:IDBRequest<T>):Promise<T>{return new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(new Error('cache_unavailable'));});}
async function keyFor(db:IDBDatabase,owner:string,create:boolean):Promise<CryptoKey|null>{const existing=await result(db.transaction('keys').objectStore('keys').get(owner)) as CryptoKey|undefined;if(existing)return existing;if(!create)return null;const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);await result(db.transaction('keys','readwrite').objectStore('keys').put(key,owner));return key;}
export async function saveProtectedContent(release:ContentRelease):Promise<boolean>{
 let db:IDBDatabase|undefined;
 try{const owner=currentContentOwner(),until=Date.parse(release.offlineUntil??'');if(!owner||owner!==release.cacheOwnerId||!Number.isFinite(until)||until<=Date.now()||until>Date.now()+24*60*60*1000+60_000)return false;
 db=await open();const key=await keyFor(db,owner,true);if(!key)return false;const iv=crypto.getRandomValues(new Uint8Array(12)),id=`${owner}:${release.storyId}:${release.contentVersion}`;const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(id)},key,new TextEncoder().encode(JSON.stringify(release)));
 if(currentContentOwner()!==owner)return false;
 await result(db.transaction('releases','readwrite').objectStore('releases').put({id,owner,storyId:release.storyId,version:release.contentVersion,until,iv,cipher} satisfies Stored));return true;
 }catch{return false;}finally{db?.close();}
}
export async function readProtectedContent(storyId:string,version?:string):Promise<ContentRelease|null>{
 let db:IDBDatabase|undefined;try{const owner=currentContentOwner();if(!owner)return null;db=await open();const key=await keyFor(db,owner,false);if(!key)return null;const rows=await result(db.transaction('releases').objectStore('releases').getAll()) as Stored[];
 const row=rows.filter(r=>r.owner===owner&&r.storyId===storyId&&(!version||r.version===version)&&r.until>Date.now()&&r.until<=Date.now()+24*60*60*1000+60_000).sort((a,b)=>b.until-a.until)[0];if(!row)return null;
 const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:row.iv as Uint8Array<ArrayBuffer>,additionalData:new TextEncoder().encode(row.id)},key,row.cipher);const release=JSON.parse(new TextDecoder().decode(plain)) as ContentRelease;
 return currentContentOwner()===owner&&release.cacheOwnerId===owner&&release.storyId===storyId&&release.contentVersion===row.version&&Date.parse(release.offlineUntil??'')===row.until?release:null;
 }catch{return null;}finally{db?.close();}
}
export async function clearProtectedContent(owner:string):Promise<void>{let db:IDBDatabase|undefined;try{db=await open();const rows=await result(db.transaction('releases').objectStore('releases').getAll()) as Stored[];const transaction=db.transaction(['keys','releases'],'readwrite');transaction.objectStore('keys').delete(owner);for(const row of rows)if(row.owner===owner)transaction.objectStore('releases').delete(row.id);await new Promise<void>((resolve,reject)=>{transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(new Error('cache_unavailable'));});}catch{/* Revoked data is never read without an unexpired matching owner lease. */}finally{db?.close();}}
if(typeof window!=='undefined')window.addEventListener('fabelpad-parent-data-cleared',event=>{const owner=(event as CustomEvent<{parentId?:string}>).detail?.parentId;if(owner)void clearProtectedContent(owner);});
