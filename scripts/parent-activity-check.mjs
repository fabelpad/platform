import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileSource } from './source-test-loader.mjs';

const temporary = await mkdtemp(join(tmpdir(), 'fabelpad-conscious-activity-'));
try {
  const { ParentActivityQueue } = await import(await compileSource(new URL('../src/parentActivity.ts', import.meta.url), temporary));
  const store = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }; };
  const id = number => `00000000-0000-4000-8000-${number.toString().padStart(12, '0')}`;
  const calls = [];
  let online = false, nextId = 0;
  const storage = store();
  const fetcher = async (_url, init) => {
    if (!online) throw new Error('synthetic offline');
    calls.push({ body: JSON.parse(init.body), headers: init.headers });
    return new Response('{}', { status: 200 });
  };
  const queue = new ParentActivityQueue('parent-a', { store: storage, fetcher, now: () => new Date('2026-11-22T12:00:00Z'), id: () => id(++nextId) });
  await queue.flush(); assert.equal(calls.length, 0, 'Opening or refreshing an account alone is not reading activity');
  queue.record('child-one'); await queue.flush();
  const original = JSON.parse(storage.getItem(queue.key))[0];
  assert.equal(original.occurredAt, '2026-11-22T12:00:00.000Z');
  queue.stop();
  online = true;
  const reloaded = new ParentActivityQueue('parent-a', { store: storage, fetcher, now: () => new Date('2026-12-25T12:00:00Z') });
  await reloaded.flush();
  assert.equal(calls.length, 1); assert.deepEqual(calls[0].body, original, 'An old offline event never acquires a fresh ID or timestamp during retry');
  assert.equal(calls[0].headers['X-Fabelpad-Parent'], 'parent-a');
  await reloaded.flush(); assert.equal(calls.length, 1, 'An acknowledged event is not re-sent');
  reloaded.stop();

  let rejected = 0;
  const ancientStore = store(); const ancientKey = 'fabelpad-parent-activity-parent-b';
  ancientStore.setItem(ancientKey, JSON.stringify([{ ...original, eventId: id(88) }]));
  const ancient = new ParentActivityQueue('parent-b', { store: ancientStore, fetcher: async () => { rejected++; return new Response('{}', { status: 422 }); } });
  await ancient.flush(); await ancient.flush();
  assert.equal(rejected, 1, 'An expired or invalid offline event is dropped without re-dating it');
  assert.equal(ancientStore.getItem(ancientKey), '[]'); ancient.stop();

  const boundedStore = store(); let serial = 0;
  const bounded = new ParentActivityQueue('parent-c', { store: boundedStore, fetcher: async () => { throw new Error('offline'); }, id: () => id(++serial) });
  for (let index = 0; index < 80; index++) bounded.record('child-one');
  await bounded.flush();
  assert.equal(JSON.parse(boundedStore.getItem(bounded.key)).length, 50, 'An offline device cannot grow an unlimited event log');
  bounded.stop();

  let blocked = 0, requests = 0;
  const locked = new ParentActivityQueue('parent-d', { store: store(), id: () => id(99), onBlocked: () => blocked++, fetcher: async () => { requests++; return new Response('{}', { status: 403 }); } });
  locked.record('child-one'); await locked.flush(); locked.record('child-one'); await locked.flush();
  assert.equal(blocked, 1); assert.equal(requests, 1, 'A revoked account cannot resume or retry activity automatically');
  locked.stop();
  console.log('Conscious activity checks passed: no passive events, stable offline IDs/times, owner binding, expired event rejection, bounded storage and revocation.');
} finally { await rm(temporary, { recursive: true, force: true }); }
