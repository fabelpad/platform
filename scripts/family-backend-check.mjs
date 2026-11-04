import { compileSource } from './source-test-loader.mjs';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = new URL('../', import.meta.url);
const temporary = await mkdtemp(join(tmpdir(), 'fabelpad-family-tests-'));
const sqlite = new DatabaseSync(':memory:');
try {
  const { handleFamilyRequest } = await import(await compileSource(new URL('lib/familyRepository.ts', root), temporary));
  const { validateFamilySnapshot, MAX_FAMILY_BYTES } = await import(await compileSource(new URL('lib/familyValidation.ts', root), temporary));
  const migrationDirectory = new URL('drizzle/', root);
  const migrationFiles = (await readdir(migrationDirectory)).filter(name => name.endsWith('.sql')).sort();
  assert.ok(migrationFiles.length, 'Generate the D1 migration before running the backend checks.');
  sqlite.exec('PRAGMA foreign_keys=ON;');
  for (const name of migrationFiles) sqlite.exec(await readFile(new URL(name, migrationDirectory), 'utf8'));

  const database = { prepare(sql) { const query = sqlite.prepare(sql); let params = []; return {
    bind(...values) { params = values; return this; },
    async first() { return query.get(...params) ?? null; },
    async run() { const result = query.run(...params); return { success: true, meta: { changes: Number(result.changes) } }; },
  }; } };
  const parentA = { id: 'parent-a', email: 'a@example.test', displayName: 'Ouder A' };
  const parentB = { id: 'parent-b', email: 'b@example.test', displayName: 'Ouder B' };
  const fixture = name => ({ schemaVersion: 1, family: { version: 1, children: [{ id: 'child-one', name, avatar: 0 }], activeId: 'child-one' }, data: { 'child-one': { favorites: ['station'], started: ['station'], completed: {}, prefs: { muted: false, calm: true }, 'story-station': { picks: [0], updatedAt: 1790000000000 }, memory: { version: 1, encounters: [], items: [], openThreads: [], events: [] } } } });
  const dependencies = parent => ({ getParent: async () => parent, getDatabase: () => database, now: () => '2026-10-27T00:00:00.000Z' });
  const request = (method = 'GET', body, headers = {}) => new Request('https://fabelpad.example/api/family', { method, headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers }, ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }) });
  const call = (parent, method, body, headers) => handleFamilyRequest(request(method, body, { ...(parent ? { 'x-fabelpad-parent': parent.id } : {}), ...headers }), dependencies(parent));
  const body = async response => {
    assert.match(response.headers.get('cache-control'), /private/);
    assert.match(response.headers.get('cache-control'), /no-store/);
    assert.match(response.headers.get('vary'), /Cookie/);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
    return response.json();
  };

  let databaseTouched = false;
  const unauthenticated = await handleFamilyRequest(request(), { getParent: async () => null, getDatabase() { databaseTouched = true; throw new Error('Must not touch D1.'); } });
  assert.equal(unauthenticated.status, 401); await body(unauthenticated); assert.equal(databaseTouched, false);
  let response = await call(parentA, 'GET'); assert.equal(response.status, 200);
  assert.deepEqual(await body(response), { parent: parentA, revision: 0, snapshot: null });
  assert.equal(sqlite.prepare('SELECT count(*) count FROM parent_accounts').get().count, 0, 'GET should be read-only.');

  response = await call(parentA, 'PUT', { baseRevision: 0, snapshot: fixture('Mila') }); assert.equal(response.status, 200);
  assert.equal((await body(response)).revision, 1);
  response = await call(parentB, 'PUT', { baseRevision: 0, snapshot: fixture('Bo') }); assert.equal(response.status, 200); await body(response);
  const scoped = await handleFamilyRequest(new Request('https://fabelpad.example/api/family?parentId=parent-b'), dependencies(parentA));
  assert.equal((await body(scoped)).snapshot.family.children[0].name, 'Mila', 'Query parameters must not change parent ownership.');
  response = await call(parentA, 'PUT', { parentId: parentB.id, baseRevision: 1, snapshot: fixture('Wrong parent') }); assert.equal(response.status, 422); await body(response);
  assert.equal((await body(await call(parentB, 'GET'))).snapshot.family.children[0].name, 'Bo');
  const changedAccountGet = await handleFamilyRequest(request('GET', undefined, { 'x-fabelpad-parent': parentA.id }), dependencies(parentB));
  assert.equal(changedAccountGet.status, 401); assert.equal((await body(changedAccountGet)).error, 'account_changed');
  const changedAccountPut = await handleFamilyRequest(request('PUT', { baseRevision: 1, snapshot: fixture('Wrong browser account') }, { 'x-fabelpad-parent': parentA.id }), dependencies(parentB));
  assert.equal(changedAccountPut.status, 401); assert.equal((await body(changedAccountPut)).error, 'account_changed');
  const missingAccountPut = await handleFamilyRequest(request('PUT', { baseRevision: 1, snapshot: fixture('Missing expected account') }), dependencies(parentB));
  assert.equal(missingAccountPut.status, 401); await body(missingAccountPut);
  assert.equal((await body(await call(parentB, 'GET'))).snapshot.family.children[0].name, 'Bo');

  const competing = await Promise.all([
    call(parentA, 'PUT', { baseRevision: 1, snapshot: fixture('Mila 1') }),
    call(parentA, 'PUT', { baseRevision: 1, snapshot: fixture('Mila 2') }),
  ]);
  assert.deepEqual(competing.map(item => item.status).sort(), [200, 409]);
  const currentA = await body(await call(parentA, 'GET')); assert.equal(currentA.revision, 2);
  const conflictA = await body(competing.find(item => item.status === 409));
  assert.equal(conflictA.revision, 2); assert.equal(conflictA.snapshot.family.children[0].name, currentA.snapshot.family.children[0].name);
  assert.notEqual(conflictA.snapshot.family.children[0].name, 'Bo');
  response = await call(parentA, 'PUT', { baseRevision: 1, snapshot: fixture('Lost response retry') }); assert.equal(response.status, 409); await body(response);
  assert.equal((await body(await call(parentA, 'GET'))).revision, 2, 'Retry must not reapply a committed stale save.');

  const parentC = { id: 'parent-c', email: 'c@example.test', displayName: 'Ouder C' };
  const firstWriters = await Promise.all([
    call(parentC, 'PUT', { baseRevision: 0, snapshot: fixture('First A') }),
    call(parentC, 'PUT', { baseRevision: 0, snapshot: fixture('First B') }),
  ]);
  assert.deepEqual(firstWriters.map(item => item.status).sort(), [200, 409]);
  assert.equal((await body(await call(parentC, 'GET'))).revision, 1);
  for (const item of firstWriters) await body(item);

  const invalidSnapshots = [];
  let bad = fixture('Mila'); bad.family.children.push({ ...bad.family.children[0] }); invalidSnapshots.push(bad);
  bad = fixture('Mila'); bad.family.activeId = 'someone-else'; invalidSnapshots.push(bad);
  bad = fixture('Mila'); bad.data['child-foreign'] = {}; invalidSnapshots.push(bad);
  bad = fixture('Mila'); bad.data['child-one'].unknown = true; invalidSnapshots.push(bad);
  bad = fixture('Mila'); bad.data['child-one']['story-station'].picks = [0, 1, 2]; invalidSnapshots.push(bad);
  bad = fixture('Mila'); bad.data['child-one'].prefs.muted = 'false'; invalidSnapshots.push(bad);
  bad = fixture('Mila'); bad.family.children[0].id = 'constructor'; bad.family.activeId = 'constructor'; bad.data = {}; invalidSnapshots.push(bad);
  bad = fixture('Mila'); bad.family.children = Array.from({ length: 6 }, (_, i) => ({ id: `child-${i}`, name: 'Kind', avatar: 0 })); bad.family.activeId = 'child-0'; bad.data = {}; invalidSnapshots.push(bad);
  bad = fixture('Mila'); bad.data['child-one'].memory.events = Array.from({ length: 101 }, (_, i) => ({ id: `event-${i}` })); invalidSnapshots.push(bad);
  bad = fixture('Mila'); bad.data['child-one'].memory.events.push(JSON.parse('{"id":"pollution","__proto__":{"admin":true}}')); invalidSnapshots.push(bad);
  for (const snapshot of invalidSnapshots) {
    assert.equal(validateFamilySnapshot(snapshot).ok, false);
    response = await call(parentA, 'PUT', { baseRevision: 2, snapshot }); assert.equal(response.status, 422); await body(response);
  }
  assert.equal((await body(await call(parentA, 'GET'))).revision, 2, 'Invalid requests must not change saved data.');
  response = await call(parentA, 'PUT', { baseRevision: -1, snapshot: fixture('Mila') }); assert.equal(response.status, 422); await body(response);
  response = await call(parentA, 'PUT', { baseRevision: 2.5, snapshot: fixture('Mila') }); assert.equal(response.status, 422); await body(response);
  response = await call(parentA, 'PUT', { baseRevision: 2, snapshot: fixture('Mila') }, { origin: 'https://other.example' }); assert.equal(response.status, 403); await body(response);
  response = await call(parentA, 'PUT', { baseRevision: 2, snapshot: fixture('Mila') }, { 'sec-fetch-site': 'cross-site' }); assert.equal(response.status, 403); await body(response);
  response = await call(parentA, 'PUT', '{}', { 'content-type': 'text/plain' }); assert.equal(response.status, 415); await body(response);
  response = await call(parentA, 'PUT', '{'); assert.equal(response.status, 400); await body(response);
  response = await call(parentA, 'PUT', ' '.repeat(MAX_FAMILY_BYTES + 1), { 'content-length': '1' }); assert.equal(response.status, 413); await body(response);
  response = await call(parentA, 'POST', {}); assert.equal(response.status, 405); assert.equal(response.headers.get('allow'), 'GET, PUT'); await body(response);
  const unavailable = await handleFamilyRequest(request(), { getParent: async () => parentA, getDatabase() { throw new Error('Private details must not escape.'); } });
  assert.equal(unavailable.status, 503); assert.equal(JSON.stringify(await body(unavailable)).includes('Private details'), false);
  assert.equal(sqlite.prepare('SELECT count(*) count FROM parent_accounts').get().count, 3);
  console.log('Family backend checks passed: real SQLite migrations, parent isolation, two CAS races, replay protection, bounded schema/body, auth/origin/cache boundaries.');
} finally {
  sqlite.close();
  await rm(temporary, { recursive: true, force: true });
}
