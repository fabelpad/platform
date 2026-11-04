import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileSource } from './source-test-loader.mjs';
const temp = await mkdtemp(join(tmpdir(), 'fabelpad-version-check-'));
const values = new Map();
let blockContent = false;
globalThis.window = new EventTarget();
globalThis.localStorage = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => { if (blockContent && key.startsWith('fabelpad-content-')) throw new Error('quota'); values.set(key, value); },
};
globalThis.fetch = async () => { throw new TypeError('offline'); };
try {
  const content = await import(await compileSource(new URL('../src/contentClient.ts', import.meta.url), temp));
  const editorial = await import(await compileSource(new URL('../src/editorialStore.ts', import.meta.url), temp));
  const profiles = await import(await compileSource(new URL('../src/profileStorage.ts', import.meta.url), temp));
  const original = await content.localRelease('dream');
  const draft = editorial.getEditorialDraft('dream');
  draft.chapters['1'] = {text:'Een nieuwe editie voor {{naam}}.'};
  assert.equal(editorial.publishEditorialDraft('dream',draft).errors.length,0);
  const current = await content.localRelease('dream',true);
  assert.notEqual(original.contentVersion,current.contentVersion);
  blockContent = true;
  const oldOffline = await content.loadContentRelease('dream',original.contentVersion,false);
  assert.equal(oldOffline.contentVersion,original.contentVersion,'An uncached older bundled edition survives a newer local publication while offline.');
  const fresh = await content.loadContentRelease('dream',undefined,false);
  assert.equal(fresh.contentVersion,current.contentVersion,'New demo adventures choose the current local publication.');
  assert.equal((await content.loadContentRelease('dream',current.contentVersion,false)).contentVersion,current.contentVersion,'Blocked cache keeps a usable same-session content copy.');
  await assert.rejects(content.loadContentRelease('dream','0000000000000000',false),'Unknown old editions are never silently replaced.');
  const cloud = await content.loadContentRelease('dream',original.contentVersion,true);
  assert.equal(cloud.scenes['0'].text,original.scenes['0'].text,'Cloud fallback never uses a local demo publication.');
  profiles.setStorageScope('prototype-demo');
  const family = profiles.loadFamily();
  profiles.saveFamily({...family,children:family.children.map(child=>({...child,name:'Demokind'}))});
  profiles.setStorageScope('parent:account-one');
  const imported = profiles.legacySnapshotForParent('account-one',true);
  assert.equal(imported.family.children[0].name,'Demokind','Public demo profiles are offered for explicit import.');
  profiles.markLegacyImported('account-one');
  assert.equal(profiles.legacySnapshotForParent('account-two',true),null,'An imported device family is never offered to another parent.');
  console.log('Content version checks passed: offline immutable editions, failed-cache session recovery, unknown-version refusal, cloud/demo separation and explicit import ownership.');
} finally { await rm(temp,{recursive:true,force:true}); }
