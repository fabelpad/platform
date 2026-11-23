import {test,expect} from '@playwright/test';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {compileSource} from '../../scripts/source-test-loader.mjs';
let temporary:string,profilePath:string,cachePath:string,clientPath:string;
const modules=new Map<string,string>();
test.beforeAll(async()=>{temporary=await mkdtemp(join(tmpdir(),'fabelpad-offline-browser-'));profilePath=basename(fileURLToPath(await compileSource(new URL('../../src/profileStorage.ts',import.meta.url),temporary)));cachePath=basename(fileURLToPath(await compileSource(new URL('../../src/protectedContentCache.ts',import.meta.url),temporary)));clientPath=basename(fileURLToPath(await compileSource(new URL('../../src/contentClient.ts',import.meta.url),temporary)));for(const filename of await readdir(temporary)){const source=await readFile(join(temporary,filename),'utf8');modules.set(filename,source.replace(/file:\/\/[^"']+\/([^/"']+\.mjs)/gu,'/__billing-cache-test/$1'));}});
test.afterAll(async()=>{await rm(temporary,{recursive:true,force:true});});
test('a purge in another tab invalidates delayed key creation and HTTP responses before either can recreate private content',async({page,context})=>{
 await context.route('**/__billing-cache-test/*',route=>{const code=modules.get(new URL(route.request().url()).pathname.split('/').at(-1)!);return route.fulfill({status:code?200:404,contentType:'text/javascript',body:code??''});});
 const other=await context.newPage(),owner='00000000-0000-4000-8000-000000000072';
 const release={storyId:'private-cross-tab',contentVersion:'1234567890abcdef',publishedAt:null,bundled:false,metadata:{title:'Privé',description:'Test',image:'/art/station.webp'},parts:5,nameToken:'__FABELPAD_CHILD__',scenes:{'':{title:'Geheim',text:'CROSS_TAB_PRIVATE_TEXT',choices:[]}},endings:{},access:'full',cacheOwnerId:owner,offlineUntil:new Date(Date.now()+60_000).toISOString()};
 try{
  for(const tab of [page,other]){await tab.goto('/support');await tab.evaluate(async({profilePath,cachePath,clientPath,owner})=>{const state=window as any;state.cache=await import('/__billing-cache-test/'+cachePath);state.client=await import('/__billing-cache-test/'+clientPath);state.profiles=await import('/__billing-cache-test/'+profilePath);state.profiles.setStorageScope('parent:'+owner);},{profilePath,cachePath,clientPath,owner});}
  await other.evaluate(async release=>{
   const state=window as any,original=crypto.subtle.generateKey.bind(crypto.subtle);let entered!:()=>void,proceed!:()=>void;
   const started=new Promise<void>(resolve=>{entered=resolve;}),paused=new Promise<void>(resolve=>{proceed=resolve;});
   state.restore=()=>Object.defineProperty(crypto.subtle,'generateKey',{configurable:true,value:original});state.proceed=proceed;
   Object.defineProperty(crypto.subtle,'generateKey',{configurable:true,value:async(...args:any[])=>{entered();await paused;return (original as any)(...args);}});
   state.pending=state.cache.saveProtectedContent(release);await started;
  },release);
  await page.evaluate(owner=>(window as any).cache.clearProtectedContent(owner),owner);
  const delayed=await other.evaluate(async release=>{const state=window as any;state.proceed();try{return{saved:await state.pending,read:await state.cache.readProtectedContent(release.storyId,release.contentVersion)};}finally{state.restore();}},release);
  expect(delayed).toEqual({saved:false,read:null});

  // The key may already exist when revocation wins. The final write itself
  // must compare the epoch while holding the same lock as the purge.
  await other.evaluate(async release=>{
   const state=window as any,original=crypto.subtle.encrypt.bind(crypto.subtle);let entered!:()=>void,proceed!:()=>void;
   const started=new Promise<void>(resolve=>{entered=resolve;}),paused=new Promise<void>(resolve=>{proceed=resolve;});state.proceed=proceed;state.restore=()=>Object.defineProperty(crypto.subtle,'encrypt',{configurable:true,value:original});
   Object.defineProperty(crypto.subtle,'encrypt',{configurable:true,value:async(...args:any[])=>{entered();await paused;return(original as any)(...args);}});
   state.pending=state.cache.saveProtectedContent(release);await started;
  },release);
  await page.evaluate(owner=>(window as any).cache.clearProtectedContent(owner),owner);
  const encrypted=await other.evaluate(async release=>{const state=window as any;state.proceed();try{return{saved:await state.pending,read:await state.cache.readProtectedContent(release.storyId,release.contentVersion)};}finally{state.restore();}},release);
  expect(encrypted).toEqual({saved:false,read:null});

  // Capturing the persistent epoch must happen before fetch, not merely before
  // encrypting a returned body. This response belongs to the old browser login.
  let incoming!:import('@playwright/test').Route,received!:()=>void;
  const started=new Promise<void>(resolve=>{received=resolve;});
  await context.route('**/api/content/private-cross-tab',route=>{incoming=route;received();});
  const pending=other.evaluate(async()=>{try{await(window as any).client.loadContentRelease('private-cross-tab',undefined,true);return true;}catch{return false;}});
  await started;await page.evaluate(owner=>(window as any).cache.clearProtectedContent(owner),owner);
  await incoming.fulfill({contentType:'application/json',body:JSON.stringify({configured:true,release})});expect(await pending).toBe(false);
  expect(await other.evaluate(async release=>(window as any).cache.readProtectedContent(release.storyId,release.contentVersion),release)).toBeNull();

  // New downloads after the purge are valid and share one key across tabs.
  const second={...release,storyId:'private-cross-tab-second'};
  expect(await Promise.all([page.evaluate(release=>(window as any).cache.saveProtectedContent(release),release),other.evaluate(release=>(window as any).cache.saveProtectedContent(release),second)])).toEqual([true,true]);
  const readable=await Promise.all([page.evaluate(async release=>(await(window as any).cache.readProtectedContent(release.storyId,release.contentVersion))?.scenes[''].text,release),other.evaluate(async release=>(await(window as any).cache.readProtectedContent(release.storyId,release.contentVersion))?.scenes[''].text,second)]);
  expect(readable).toEqual(['CROSS_TAB_PRIVATE_TEXT','CROSS_TAB_PRIVATE_TEXT']);
  await page.evaluate(owner=>(window as any).cache.clearProtectedContent(owner),owner);
 }finally{await other.close();}
});
test('unavailable IndexedDB disables offline storage while an authorized online story remains readable',async({page})=>{
 await page.route('**/__billing-cache-test/*',route=>{const code=modules.get(new URL(route.request().url()).pathname.split('/').at(-1)!);return route.fulfill({status:code?200:404,contentType:'text/javascript',body:code??''});});
 const owner='00000000-0000-4000-8000-000000000073',release={storyId:'private-no-cache',contentVersion:'1234567890abcdef',access:'full',cacheOwnerId:owner,offlineUntil:new Date(Date.now()+60_000).toISOString(),scenes:{'':{text:'AUTHORIZED_ONLINE_TEXT'}}};
 await page.route('**/api/content/private-no-cache',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({configured:true,release})}));await page.goto('/support');
 const result=await page.evaluate(async({profilePath,cachePath,clientPath,owner})=>{
  const profiles=await import('/__billing-cache-test/'+profilePath),cache=await import('/__billing-cache-test/'+cachePath),client=await import('/__billing-cache-test/'+clientPath);profiles.setStorageScope('parent:'+owner);
  const descriptor=Object.getOwnPropertyDescriptor(window,'indexedDB');Object.defineProperty(window,'indexedDB',{configurable:true,get(){throw new DOMException('Storage unavailable','SecurityError');}});
  try{const opened=await client.loadContentRelease('private-no-cache',undefined,true);return{text:opened.scenes[''].text,saved:await cache.saveProtectedContent(opened),offline:await cache.readProtectedContent('private-no-cache')};}finally{if(descriptor)Object.defineProperty(window,'indexedDB',descriptor);}
 },{profilePath,cachePath,clientPath,owner});
 expect(result).toEqual({text:'AUTHORIZED_ONLINE_TEXT',saved:false,offline:null});
});
test('revocation cancels a delayed encrypted write and concurrent downloads retain the same family key',async({page})=>{
 await page.route('**/__billing-cache-test/*',route=>{const code=modules.get(new URL(route.request().url()).pathname.split('/').at(-1)!);return route.fulfill({status:code?200:404,contentType:'text/javascript',body:code??''});});
 await page.goto('/support');
 const result=await page.evaluate(async({profilePath,cachePath})=>{
  const profiles=await import('/__billing-cache-test/'+profilePath),cache=await import('/__billing-cache-test/'+cachePath);
  const owner='00000000-0000-4000-8000-000000000061';profiles.setStorageScope('parent:'+owner);
  const release={storyId:'private-delayed',contentVersion:'1234567890abcdef',publishedAt:null,bundled:false,metadata:{title:'Privé',description:'Test',image:'/art/station.webp'},parts:5,nameToken:'__FABELPAD_CHILD__',scenes:{'':{title:'Geheim',text:'DELAYED_PRIVATE_TEXT',choices:[]}},endings:{},access:'full',cacheOwnerId:owner,offlineUntil:new Date(Date.now()+60_000).toISOString()};
  const original=crypto.subtle.encrypt.bind(crypto.subtle);let entered!:()=>void,proceed!:()=>void;
  const started=new Promise<void>(resolve=>{entered=resolve;}),paused=new Promise<void>(resolve=>{proceed=resolve;});
  Object.defineProperty(crypto.subtle,'encrypt',{configurable:true,writable:true,value:async(...args:Parameters<SubtleCrypto['encrypt']>)=>{entered();await paused;return original(...args);}});
  const before=await cache.protectedContentContext();let delayed;
  try{const pending=cache.saveProtectedContent(release,before);await started;await cache.clearProtectedContent(owner);proceed();delayed=await pending;}
  finally{Object.defineProperty(crypto.subtle,'encrypt',{configurable:true,writable:true,value:original});}
  const after=await cache.readProtectedContent(release.storyId,release.contentVersion);
  const lateResponse=await cache.saveProtectedContent(release,before);
  const db:IDBDatabase=await new Promise((resolve,reject)=>{const request=indexedDB.open('fabelpad-private-content-v1');request.onsuccess=()=>resolve(request.result);request.onerror=reject;});
  const keyAfter:unknown=await new Promise((resolve,reject)=>{const request=db.transaction('keys').objectStore('keys').get(owner);request.onsuccess=()=>resolve(request.result);request.onerror=reject;});db.close();
  const second={...release,storyId:'private-simultaneous'};
  const saves=await Promise.all([cache.saveProtectedContent(release),cache.saveProtectedContent(second)]);
  const reads=await Promise.all([cache.readProtectedContent(release.storyId,release.contentVersion),cache.readProtectedContent(second.storyId,second.contentVersion)]);
  await cache.clearProtectedContent(owner);
  return{delayed,after,lateResponse,keyDeleted:keyAfter===undefined,saves,readable:reads.map(value=>value?.scenes[''].text)};
 },{profilePath,cachePath});
 expect(result).toEqual({delayed:false,after:null,lateResponse:false,keyDeleted:true,saves:[true,true],readable:['DELAYED_PRIVATE_TEXT','DELAYED_PRIVATE_TEXT']});
});
test('protected web downloads encrypt content, enforce family and expiry, and delete on revocation',async({page})=>{await page.route('**/__billing-cache-test/*',route=>{const code=modules.get(new URL(route.request().url()).pathname.split('/').at(-1)!);return route.fulfill({status:code?200:404,contentType:'text/javascript',body:code??''});});await page.goto('/support');const result=await page.evaluate(async({profilePath,cachePath})=>{const profiles=await import('/__billing-cache-test/'+profilePath),cache=await import('/__billing-cache-test/'+cachePath);const owner='00000000-0000-4000-8000-000000000051';profiles.setStorageScope('parent:'+owner);const release={storyId:'private-new-story',contentVersion:'1234567890abcdef',publishedAt:null,bundled:false,metadata:{title:'Privé',description:'Test',image:'/art/station.webp'},parts:5,nameToken:'__FABELPAD_CHILD__',scenes:{'':{title:'Geheim',text:'PROTECTED_STORY_PROSE',choices:[]}},endings:{},access:'full',cacheOwnerId:owner,offlineUntil:new Date(Date.now()+60_000).toISOString()};const saved=await cache.saveProtectedContent(release);const own=(await cache.readProtectedContent(release.storyId,release.contentVersion))?.scenes[''].text;const storage=JSON.stringify({...localStorage});const db:IDBDatabase=await new Promise((resolve,reject)=>{const r=indexedDB.open('fabelpad-private-content-v1');r.onsuccess=()=>resolve(r.result);r.onerror=reject;});const rows:unknown[]=await new Promise((resolve,reject)=>{const r=db.transaction('releases').objectStore('releases').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=reject;});const persistent=JSON.stringify(rows);profiles.setStorageScope('parent:00000000-0000-4000-8000-000000000052');const other=await cache.readProtectedContent(release.storyId,release.contentVersion);profiles.setStorageScope('parent:'+owner);const expiredSave=await cache.saveProtectedContent({...release,offlineUntil:new Date(Date.now()-1).toISOString()});const unboundedSave=await cache.saveProtectedContent({...release,offlineUntil:new Date(Date.now()+48*3600000).toISOString()});await cache.clearProtectedContent(owner);const revoked=await cache.readProtectedContent(release.storyId,release.contentVersion);db.close();return{saved,own,storage,persistent,other,expiredSave,unboundedSave,revoked};},{profilePath,cachePath});expect(result.saved).toBe(true);expect(result.own).toBe('PROTECTED_STORY_PROSE');expect(result.storage).not.toContain('PROTECTED_STORY_PROSE');expect(result.persistent).not.toContain('PROTECTED_STORY_PROSE');expect(result.other).toBeNull();expect(result.expiredSave).toBe(false);expect(result.unboundedSave).toBe(false);expect(result.revoked).toBeNull();});
