import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileSource } from './source-test-loader.mjs';
const temporary = await mkdtemp(join(tmpdir(), 'fabelpad-admin-actor-'));
const environment = { ...process.env };
for (const key of Object.keys(process.env)) if (/^(NEXT_PUBLIC_|FABELPAD_|APP_URL$)/u.test(key)) delete process.env[key];
Object.assign(process.env, { FABELPAD_DATA_MODE: 'supabase', FABELPAD_APP_ORIGIN: 'https://fabelpad.example.test', NEXT_PUBLIC_SUPABASE_URL: 'https://project.example.test', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_test' });
const context = Symbol.for('fabelpad.admin.actor.test');
const server = await compileSource(new URL('../lib/supabase/server.ts', import.meta.url), temporary);
await writeFile(new URL(server), `const state=()=>globalThis[Symbol.for('fabelpad.admin.actor.test')];export async function createSupabaseServerClient(){return state().client;}export async function createSupabaseRequestClient(){return state().client;}export async function getVerifiedParent(){return state().parent;}export async function isContentAdmin(_client,id){return state().admins.has(id);}`);
const { contentDraft, publishContent } = await import(await compileSource(new URL('../lib/server/content.ts', import.meta.url), temporary));
const { initialDraft } = await import(await compileSource(new URL('../lib/server/contentRelease.ts', import.meta.url), temporary));
after(async () => { delete globalThis[context]; for (const key of Object.keys(process.env)) if (!(key in environment)) delete process.env[key]; Object.assign(process.env, environment); await rm(temporary, { recursive: true, force: true }); });

test('content reads and direct mutations bind the editor actor across two authorized admin sessions', async () => {
  const a = { id: '00000000-0000-4000-8000-000000000101', email: 'a@example.test' }, b = { id: '00000000-0000-4000-8000-000000000102', email: 'b@example.test' };
  const calls = [];
  const state = { parent: a, admins: new Set([a.id, b.id]), client: {
    from(table) { calls.push(table); return { select() { return { eq() { return { maybeSingle: async () => ({ data: { revision: 3, draft: initialDraft('station') }, error: null }) }; } }; } }; },
    async rpc(name, parameters) { calls.push(name); return { data: { saved: true, revision: parameters.p_base_revision + 1 }, error: null }; },
  } };
  globalThis[context] = state;
  const request = (method = 'GET', actor, body = { baseRevision: 3, draft: initialDraft('station') }) => new Request('https://fabelpad.example.test/api/content/drafts/station', { method, headers: { Origin: 'https://fabelpad.example.test', ...(actor ? { 'X-Fabelpad-Parent': actor } : {}), ...(method !== 'GET' ? { 'Content-Type': 'application/json' } : {}) }, ...(method !== 'GET' ? { body: JSON.stringify(body) } : {}) });
  assert.equal((await contentDraft(request('GET', a.id), 'station')).status, 200);
  assert.equal((await contentDraft(request('PUT', a.id), 'station')).status, 200);
  state.parent = b;
  assert.equal((await contentDraft(request('GET', b.id), 'station')).status, 200, 'B also has current server-authorized admin access');
  for (const [method, handler] of [['GET', contentDraft], ['PUT', contentDraft], ['POST', publishContent]]) {
    calls.length = 0;
    const refused = await handler(request(method, a.id), 'station');
    assert.equal(refused.status, 401); assert.equal((await refused.json()).error, 'account_changed');
    assert.deepEqual(calls, [], 'A stale editor cannot read or mutate as the new administrator');
  }
  calls.length = 0; assert.equal((await contentDraft(request('PUT'), 'station')).status, 401); assert.deepEqual(calls, []);
  assert.equal((await contentDraft(request('PUT', b.id), 'station')).status, 200);
  state.admins.delete(b.id); calls.length = 0; assert.equal((await contentDraft(request('PUT', b.id), 'station')).status, 403); assert.deepEqual(calls, []);
});
