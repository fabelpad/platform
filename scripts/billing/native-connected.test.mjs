import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { mkdtemp, rm, readFile, readdir, writeFile } from 'node:fs/promises';
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileSource } from '../source-test-loader.mjs';
const temporary = await mkdtemp(join(tmpdir(), 'fabelpad-connected-native-'));
after(() => rm(temporary, { recursive: true, force: true }));
const { nativeFamilyImport } = await import(await compileSource(new URL('../../mobile/src/connected-contract.ts', import.meta.url), temporary));
const { validateFamilySnapshot } = await import(await compileSource(new URL('../../lib/familyValidation.ts', import.meta.url), temporary));
const { mergeConnectedProgress } = await import(await compileSource(new URL('../../mobile/src/connected-progress.ts', import.meta.url), temporary));
const connectedURL=await compileSource(new URL('../../mobile/src/connected.ts',import.meta.url),temporary);
const expoStub=join(temporary,'fixture-expo.mjs'),storageStub=join(temporary,'fixture-storage.mjs'),secureStub=join(temporary,'fixture-secure.mjs');
await writeFile(expoStub,'export function requireOptionalNativeModule(){return globalThis.__fabelpadConnectedFixture.native;}');
await writeFile(storageStub,'export default {getItem:async k=>globalThis.__fabelpadConnectedFixture.storage.get(k)??null,setItem:async(k,v)=>{globalThis.__fabelpadConnectedFixture.storage.set(k,v);},removeItem:async k=>{globalThis.__fabelpadConnectedFixture.storage.delete(k);},getAllKeys:async()=>[...globalThis.__fabelpadConnectedFixture.storage.keys()],multiRemove:async keys=>{for(const k of keys)globalThis.__fabelpadConnectedFixture.storage.delete(k);}};');
await writeFile(secureStub,'export const WHEN_UNLOCKED_THIS_DEVICE_ONLY=1;export const getItemAsync=async k=>globalThis.__fabelpadConnectedFixture.secure.get(k)??null;export const setItemAsync=async(k,v)=>{globalThis.__fabelpadConnectedFixture.secure.set(k,v);};export const deleteItemAsync=async k=>{globalThis.__fabelpadConnectedFixture.secure.delete(k);};');
for(const name of await readdir(temporary))if(name.endsWith('.mjs')){const file=join(temporary,name);let code=await readFile(file,'utf8');for(const [specifier,target]of [['expo',expoStub],['expo-secure-store',secureStub],['@react-native-async-storage/async-storage',storageStub]])code=code.replaceAll(`'${specifier}'`,JSON.stringify(pathToFileURL(target).href)).replaceAll(`"${specifier}"`,JSON.stringify(pathToFileURL(target).href));await writeFile(file,code);}
const originalFetch=globalThis.fetch;after(()=>{globalThis.fetch=originalFetch;delete globalThis.__fabelpadConnectedFixture;});
let instance=0;
const store = () => ({ schemaVersion: 1, contentVersion: '4e48e9296a01fff5', activeId: 'first-child', profiles: [{ id: 'first-child', name: 'Synthetisch', avatar: 0, birthDate: '2018-06-01', picks: { station: [0, 1] }, storyVersions: { station: '247d7d1c63cc4fa3' }, lastCompletedPicks: { station: [1, 1, 0, 0, 1] }, lastCompletedStoryVersions: { station: '247d7d1c63cc4fa3' }, readingLevel: '6to8', favorites: ['station'], calm: true, largeText: true }] });
test('explicit profile import preserves exact local routes and immutable story versions without changing local store', () => {
  const local = store(), before = structuredClone(local), snapshot = nativeFamilyImport(local, null, ['first-child']);
  assert.deepEqual(local, before); assert.equal(validateFamilySnapshot(snapshot).ok, true);
  assert.deepEqual(snapshot.data['first-child']['story-station'].picks, [0,1]);
  assert.equal(snapshot.data['first-child']['story-station'].contentVersion, '247d7d1c63cc4fa3');
  assert.deepEqual(snapshot.data['first-child']['story-station'].lastCompletedPicks, [1,1,0,0,1]);
  assert.equal(snapshot.family.children[0].birthDate, '2018-06-01');
  assert.equal(snapshot.data['first-child'].prefs.textSize, 'large');
});
test('import never silently invents birth dates, overwrites existing cloud children or exceeds five profiles', () => {
  const local = store(), missing = store(); delete missing.profiles[0].birthDate;
  assert.throws(() => nativeFamilyImport(missing,null,['first-child']), /geboortedatum/u);
  const existing = nativeFamilyImport(local,null,['first-child']);
  assert.throws(() => nativeFamilyImport(local,existing,['first-child']), /al gekoppeld/u);
  const full = { schemaVersion: 1, family: { version: 1, activeId: 'other0', children: Array.from({length:5},(_,i)=>({id:`other${i}`,name:`other${i}`,avatar:0,birthDate:'2018-01-01'})) }, data:{} };
  assert.throws(() => nativeFamilyImport(local,full,['first-child']), /maximaal vijf/u);
});

const draft = () => { const base = nativeFamilyImport(store(), null, ['first-child']), snapshot = structuredClone(base); snapshot.data['first-child']['story-station'].picks = [0,1,1]; return { schemaVersion:1, parentId:'8701f0d6-0fa7-4cd0-8980-a183daab8713', environment:'staging', baseRevision:1, baseSnapshot:base, snapshot, updatedAt:Date.now() }; };
test('three-way offline progress merge preserves cloud profile edits and refuses same-route conflicts or deleted children', () => {
  const pending=draft(),cloud=structuredClone(pending.baseSnapshot);cloud.family.children[0].name='Online naam';cloud.data['first-child'].prefs.calm=false;
  let result=mergeConnectedProgress(pending,cloud);assert.deepEqual(result.conflicts,[]);assert.equal(result.snapshot.family.children[0].name,'Online naam');assert.equal(result.snapshot.data['first-child'].prefs.calm,false);assert.deepEqual(result.snapshot.data['first-child']['story-station'].picks,[0,1,1]);
  cloud.data['first-child']['story-station'].picks=[1,0];result=mergeConnectedProgress(pending,cloud);assert.equal(result.conflicts.length,1);assert.deepEqual(result.snapshot.data['first-child']['story-station'].picks,[1,0]);
  assert.deepEqual(mergeConnectedProgress(pending,cloud,true).snapshot.data['first-child']['story-station'].picks,[0,1,1]);
  cloud.family.children=[];cloud.data={};result=mergeConnectedProgress(pending,cloud,true);assert.equal(result.snapshot.family.children.length,0);assert(result.conflicts[0].endsWith(':removed'));
});


async function connectedFixture(){
 const pending=draft(),key=randomBytes(32),storage=new Map(),secure=new Map(),ref='tlwfpivafcokcjyjwgmq';
 const seal=async text=>{const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);return Buffer.concat([iv,cipher.update(text,'utf8'),cipher.final(),cipher.getAuthTag()]).toString('base64');};
 const open=async text=>{const raw=Buffer.from(text,'base64'),decipher=createDecipheriv('aes-256-gcm',key,raw.subarray(0,12));decipher.setAuthTag(raw.subarray(-16));return Buffer.concat([decipher.update(raw.subarray(12,-16)),decipher.final()]).toString('utf8');};
 const fixture={storage,secure,online:false,revision:1,snapshot:pending.baseSnapshot,puts:0,native:{connected:true,backendOrigin:'https://staging.fabelpad.nl',environment:'staging',supabaseUrl:`https://${ref}.supabase.co`,supabaseKey:'sb_publishable_synthetic_fixture',sealProgress:seal,openProgress:open,clearProgressKey:async()=>{},clearContentKey:async()=>{}}};
 for(const [name,value]of Object.entries({access:'synthetic-access',refresh:'synthetic-refresh',identity:JSON.stringify({parentId:pending.parentId,email:'synthetic-parent@example.test',expiresAt:Date.now()+3600000})}))secure.set(`fabelpad.auth.${ref}.${name}`,value);
 globalThis.__fabelpadConnectedFixture=fixture;
 globalThis.fetch=async(url,init)=>{assert.equal(String(url),'https://staging.fabelpad.nl/api/family');if(!fixture.online)throw new Error('synthetic offline');if(init.method==='PUT'){assert(storage.size>0,'Encrypted draft must exist before a network mutation');const body=JSON.parse(init.body);if(body.baseRevision!==fixture.revision)return Response.json({error:'revision_conflict'},{status:409});fixture.snapshot=body.snapshot;fixture.revision++;fixture.puts++;}return Response.json({snapshot:fixture.snapshot,revision:fixture.revision});};
 const restart=()=>import(`${connectedURL}?native-instance=${++instance}`);
 return {fixture,pending,restart,api:await restart()};
}
test('encrypted progress survives a new app instance and premium cache expiry, then synchronizes with CAS without losing online profile edits',async()=>{
 const {fixture,pending,restart,api}=await connectedFixture();
 const saved=await api.saveConnectedProgress(1,pending.baseSnapshot,pending.snapshot);assert.equal(saved.pending,true);
 assert.equal(fixture.storage.size,1);assert(![...fixture.storage.values()][0].includes('Synthetisch'),'No readable family data in AsyncStorage');
 const restarted=await restart();await restarted.clearProtectedContent();assert.deepEqual((await restarted.readConnectedProgress()).snapshot,pending.snapshot);
 fixture.online=true;fixture.snapshot=structuredClone(pending.baseSnapshot);fixture.snapshot.family.children[0].name='Online aangepast';fixture.revision=2;
 const synced=await restarted.flushConnectedProgress();assert.equal(synced.pending,false);assert.equal(fixture.puts,1);assert.equal(synced.snapshot.family.children[0].name,'Online aangepast');assert.deepEqual(synced.snapshot.data['first-child']['story-station'].picks,[0,1,1]);assert.equal(fixture.storage.size,0);
});
test('same-story CAS conflict keeps the durable draft through restart until an explicit route choice',async()=>{
 const {fixture,pending,restart,api}=await connectedFixture();await api.saveConnectedProgress(1,pending.baseSnapshot,pending.snapshot);
 fixture.online=true;fixture.snapshot=structuredClone(pending.baseSnapshot);fixture.snapshot.data['first-child']['story-station'].picks=[1,1];fixture.revision=2;
 const restarted=await restart(),conflict=await restarted.flushConnectedProgress();assert.equal(conflict.conflict,true);assert.equal(fixture.puts,0);assert.equal(fixture.storage.size,1);
 await restarted.resolveConnectedProgress(true);assert.deepEqual(fixture.snapshot.data['first-child']['story-station'].picks,[0,1,1]);assert.equal(fixture.storage.size,0);
});
