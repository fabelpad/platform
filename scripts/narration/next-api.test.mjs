import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileSource } from '../source-test-loader.mjs';
const directory = await mkdtemp(join(tmpdir(), 'fabelpad-narration-next-'));
const beforeEnvironment = { ...process.env }, beforeFetch = globalThis.fetch;
const symbol = Symbol.for('fabelpad.narration.next.test');
for (const name of Object.keys(process.env)) if (/^(NEXT_PUBLIC_|FABELPAD_|APP_URL$)/u.test(name)) delete process.env[name];
Object.assign(process.env, { FABELPAD_DATA_MODE: 'supabase', FABELPAD_APP_ORIGIN: 'https://staging.fabelpad.nl', NEXT_PUBLIC_SUPABASE_URL: 'https://tlwfpivafcokcjyjwgmq.supabase.co', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_narration_fixture', FABELPAD_DEPLOY_ENV: 'staging' });
const routes = {};
for (const [key, path] of Object.entries({ admin: 'admin/voorlezen', test: 'admin/voorlezen/test', manifest: 'voorlezen/manifest', asset: 'voorlezen/assets/[assetId]', voices: 'voorlezen/voices', namePack: 'voorlezen/name-pack' })) routes[key] = await compileSource(new URL(`../../app/api/${path}/route.ts`, import.meta.url), directory);
const server = await compileSource(new URL('../../lib/supabase/server.ts', import.meta.url), directory);
await writeFile(new URL(server), `const s=()=>globalThis[Symbol.for('fabelpad.narration.next.test')];export async function createSupabaseRequestClient(){return s().client;}export async function createSupabaseServerClient(){return s().client;}export async function getVerifiedParent(){return s().parent;}export async function isContentAdmin(){return s().admin;}`);
const content = await compileSource(new URL('../../lib/server/content.ts', import.meta.url), directory);
await writeFile(new URL(content), `export async function getContent(request,storyId){const s=globalThis[Symbol.for('fabelpad.narration.next.test')];s.contentReads.push({url:request.url,storyId,authorization:request.headers.get('authorization')});return Response.json(s.content,{status:s.contentStatus});}`);
for (const key of Object.keys(routes)) routes[key] = await import(routes[key]);
const actor = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222', version = 'a'.repeat(16), assetId = '33333333-3333-4333-8333-333333333333';
let state;
function reset() {
  state = { parent: { id: actor }, admin: true, active: true, edge: { revision: 1, keyConfigured: false }, edgeStatus: 200, edgeHeaders: {}, forwards: [], contentReads: [], contentStatus: 200,
    content: { release: { storyId: 'station', contentVersion: version, access: 'full', offlineUntil: new Date(Date.now() + 3600000).toISOString(), cacheOwnerId: actor } },
    client: { rpc: async () => ({ data: { state: state.active ? 'active' : 'deletion_pending', termsVersion: 'fixture', acceptedTermsVersion: 'fixture', consents: [] }, error: null }), auth: { getSession: async () => ({ data: { session: { access_token: 'synthetic_session_transport_token' } }, error: null }) } } };
  globalThis[symbol] = state;
  globalThis.fetch = async (input, init) => { const request = new Request(input, init); assert.equal(request.url, 'https://tlwfpivafcokcjyjwgmq.supabase.co/functions/v1/voorlezen-admin'); state.forwards.push({ body: await request.json(), authorization: request.headers.get('authorization') }); return state.edge instanceof Uint8Array ? new Response(state.edge, { status: state.edgeStatus, headers: state.edgeHeaders }) : Response.json(state.edge, { status: state.edgeStatus }); };
}
const request = (path, body, who = actor) => new Request(`https://staging.fabelpad.nl/api/${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { ...(who ? { 'X-Fabelpad-Parent': who } : {}), ...(body === undefined ? {} : { Origin: 'https://staging.fabelpad.nl', 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
test.after(async () => { globalThis.fetch = beforeFetch; delete globalThis[symbol]; for (const key of Object.keys(process.env)) if (!(key in beforeEnvironment)) delete process.env[key]; Object.assign(process.env, beforeEnvironment); await rm(directory, { recursive: true, force: true }); });

test('actual admin route binds actor, active account and role before forwarding', async () => {
  reset(); assert.equal((await routes.admin.GET(request('admin/voorlezen'))).status, 200); assert.equal(state.forwards.length, 1);
  reset(); state.parent = { id: other }; assert.equal((await routes.test.POST(request('admin/voorlezen/test', { baseRevision: 1 }))).status, 401); assert.equal(state.forwards.length, 0);
  reset(); state.active = false; assert.equal((await routes.admin.GET(request('admin/voorlezen'))).status, 403); assert.equal(state.forwards.length, 0);
  reset(); state.admin = false; assert.equal((await routes.admin.GET(request('admin/voorlezen'))).status, 403); assert.equal(state.forwards.length, 0);
  reset(); state.parent = null; assert.equal((await routes.admin.GET(request('admin/voorlezen'))).status, 401); assert.equal(state.forwards.length, 0);
});
test('actual manifest route requires the exact text authority and injects its bounded family lease', async () => {
  reset(); state.edge = { manifest: { storyId: 'station', contentVersion: version, access: { scope: 'full', offlineUntil: null }, assets: { first: { id: assetId } } } };
  const response = await routes.manifest.GET(request(`voorlezen/manifest?storyId=station&version=${version}&readingLevel=6to8&voiceSlot=stem-1`));
  assert.equal(response.status, 200); const value = await response.json(); assert.equal(value.manifest.access.offlineUntil, state.content.release.offlineUntil); assert.equal(value.manifest.access.cacheOwnerId, actor);
  assert.equal(state.contentReads.length, 1); assert.equal(new URL(state.contentReads[0].url).search, `?version=${version}`); assert.equal(value.manifest.assets.first.url, `/api/voorlezen/assets/${assetId}?storyId=station&version=${version}&readingLevel=6to8&voiceSlot=stem-1`);
  assert.match(response.headers.get('cache-control'), /no-store/u);
});
test('locked text, changed version and unknown private query fields cannot reach the audio service', async () => {
  reset(); state.contentStatus = 403; state.content = { error: 'content_locked' }; assert.equal((await routes.manifest.GET(request(`voorlezen/manifest?storyId=station&version=${version}&readingLevel=6to8&voiceSlot=stem-1`))).status, 403); assert.equal(state.forwards.length, 0);
  reset(); state.content.release.contentVersion = 'b'.repeat(16); assert.equal((await routes.manifest.GET(request(`voorlezen/manifest?storyId=station&version=${version}&readingLevel=6to8&voiceSlot=stem-1`))).status, 403); assert.equal(state.forwards.length, 0);
  reset(); assert.equal((await routes.namePack.GET(request('voorlezen/name-pack?voiceSlot=stem-1&presetVersion=1&selectedName=PrivateTestName'))).status, 422); assert.equal(state.forwards.length, 0);
});
test('native asset transport preserves verified bearer and repeats exact content authorization', async () => {
  reset(); state.edge = new Uint8Array(64).fill(17); state.edgeHeaders = { 'Content-Type': 'audio/wav' };
  const native = new Request(`https://staging.fabelpad.nl/api/voorlezen/assets/${assetId}?storyId=station&version=${version}&readingLevel=9plus&voiceSlot=stem-2`, { headers: { Authorization: 'Bearer synthetic_native_authenticated_token' } });
  const response = await routes.asset.GET(native, { params: Promise.resolve({ assetId }) }); assert.equal(response.status, 200); assert.equal((await response.arrayBuffer()).byteLength, 64); assert.equal(state.contentReads[0].authorization, 'Bearer synthetic_native_authenticated_token'); assert.equal(state.forwards[0].authorization, 'Bearer synthetic_native_authenticated_token'); assert.equal(state.forwards[0].body.assetId, assetId); assert.match(response.headers.get('vary'), /Authorization/u);
});
test('actual route never reflects credentials and rejects production targets before network activity', async () => {
  reset(); state.edge = { nested: { apiKey: 'sk-synthetic_secret_must_not_escape' } }; const response = await routes.admin.GET(request('admin/voorlezen')); assert.equal(response.status, 503); assert.equal((await response.text()).includes('sk-'), false);
  reset(); process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://aptprpkosqctwrzeetgs.supabase.co'; try { assert.equal((await routes.voices.GET(request('voorlezen/voices', undefined, null))).status, 503); assert.equal(state.forwards.length, 0); } finally { process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://tlwfpivafcokcjyjwgmq.supabase.co'; }
});
