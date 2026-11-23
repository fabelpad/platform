import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileSource } from '../source-test-loader.mjs';

const directory = await mkdtemp(join(tmpdir(), 'fabelpad-premium-actor-'));
const beforeEnvironment = { ...process.env };
for (const key of Object.keys(process.env)) if (/^(NEXT_PUBLIC_|FABELPAD_|APP_URL$)/u.test(key)) delete process.env[key];
Object.assign(process.env, { FABELPAD_DATA_MODE: 'supabase', FABELPAD_APP_ORIGIN: 'https://fabelpad.example.test', NEXT_PUBLIC_SUPABASE_URL: 'https://project.example.test', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_premium_actor' });
const context = Symbol.for('fabelpad.premium.actor.test');
const server = await compileSource(new URL('../../lib/supabase/server.ts', import.meta.url), directory);
await writeFile(new URL(server), `const state=()=>globalThis[Symbol.for('fabelpad.premium.actor.test')]; export async function createSupabaseRequestClient(){return state().client;} export async function getVerifiedParent(){return state().parent;} export async function isContentAdmin(_client,id){state().roleChecks.push(id);return state().admins.has(id);}`);
const { publishPremiumContent, validatePremiumPayload } = await import(await compileSource(new URL('../../lib/server/premiumContent.ts', import.meta.url), directory));
const { buildStoryRelease } = await import(await compileSource(new URL('../../lib/server/contentRelease.ts', import.meta.url), directory));
const { metadata, parts, nameToken, scenes, endings, readingLevels } = buildStoryRelease('station');
const payload = { metadata, parts, nameToken, scenes, endings, ...(readingLevels ? { readingLevels } : {}) };
assert.equal(validatePremiumPayload(payload), true);
after(async () => { delete globalThis[context]; for (const key of Object.keys(process.env)) if (!(key in beforeEnvironment)) delete process.env[key]; Object.assign(process.env, beforeEnvironment); await rm(directory, { recursive: true, force: true }); });
const a = { id: '00000000-0000-4000-8000-000000000801' }, b = { id: '00000000-0000-4000-8000-000000000802' };
function fixture(parent = a) {
  const state = { parent, admins: new Set([a.id, b.id]), roleChecks: [], calls: [], rpcError: null, client: { async rpc(name, parameters) { state.calls.push({ name, parameters }); return state.rpcError ? { data: null, error: state.rpcError } : { data: { contentVersion: parameters.p_content_version }, error: null }; } } };
  globalThis[context] = state; return state;
}
const request = (actor, origin = 'https://fabelpad.example.test') => new Request('https://fabelpad.example.test/api/admin/content/premium', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...(actor ? { 'X-Fabelpad-Parent': actor } : {}) }, body: JSON.stringify({ storyId: 'synthetic-premium-story', payload, confirmPrivate: true }) });

test('a current verified actor publishes through the existing premium RPC with the complete versioned source', async () => {
  const state = fixture(); const response = await publishPremiumContent(request(a.id));
  assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /private, no-store/u);
  assert.deepEqual(state.roleChecks, [a.id]); assert.equal(state.calls.length, 1);
  assert.equal(state.calls[0].name, 'publish_billing_premium_content'); assert.equal(state.calls[0].parameters.p_story_id, 'synthetic-premium-story');
  assert.deepEqual(state.calls[0].parameters.p_payload, payload); assert.match(state.calls[0].parameters.p_content_version, /^[a-f0-9]{16}$/u);
});
test('missing and stale actor headers stop before role checks, publication and audio outbox writes', async () => {
  for (const [parent, actor] of [[a, undefined], [b, a.id], [a, b.id]]) {
    const state = fixture(parent); const response = await publishPremiumContent(request(actor));
    assert.equal(response.status, 401); assert.equal((await response.json()).error, 'account_changed'); assert.deepEqual(state.roleChecks, []); assert.deepEqual(state.calls, []);
  }
});
test('role, origin and fresh authentication checks still protect the actor-bound publication', async () => {
  let state = fixture(); state.admins.clear(); assert.equal((await publishPremiumContent(request(a.id))).status, 403); assert.deepEqual(state.calls, []);
  state = fixture(); assert.equal((await publishPremiumContent(request(a.id, 'https://outside.example.test'))).status, 403); assert.deepEqual(state.roleChecks, []); assert.deepEqual(state.calls, []);
  state = fixture(); state.rpcError = { code: '28000', message: 'fresh_auth_required' }; const response = await publishPremiumContent(request(a.id)); assert.equal(response.status, 428); assert.equal((await response.json()).error, 'fresh_auth_required'); assert.equal(state.calls.length, 1);
});
