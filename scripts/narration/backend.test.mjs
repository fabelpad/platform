import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {compileSource} from '../source-test-loader.mjs';
const directory=await mkdtemp(join(tmpdir(),'fabelpad-narration-backend-'));
const module=async name=>import(await compileSource(new URL('../../lib/narration/'+name+'.ts',import.meta.url),directory));
const {createNarrationAdminHandler}=await module('admin-handler');
const {createNarrationWorkerHandler}=await module('worker-handler');
const {createNarrationSupabaseBackend}=await module('supabase-backend');
const {NarrationBackendError}=await module('backend-types');
const {DEFAULT_NARRATION_PRESETS,DEFAULT_NAME_CATALOGUE,DEFAULT_NAME_CUES,NARRATION_TEST_TEXT}=await module('contracts');
const {NarrationProviderError}=await module('provider');
const {narrationHash}=await module('compiler');
test.after(()=>rm(directory,{recursive:true,force:true}));
import { fixturePCM } from './fixtures.mjs';
const environment = { SUPABASE_URL: 'https://tlwfpivafcokcjyjwgmq.supabase.co', FABELPAD_APP_ORIGIN: 'https://staging.fabelpad.nl', FABELPAD_ENVIRONMENT: 'staging' };
const token = 'synthetic_authenticated_user_token';
const settings = () => ({ generationEnabled: false, playbackEnabled: false, defaultVoiceSlot: 'stem-1', model: 'gpt-realtime-2.1-mini', styleVersion: 1, budgetCents: 2500, maxParallel: 1, slots: structuredClone(DEFAULT_NARRATION_PRESETS), cueCatalogue: structuredClone(DEFAULT_NAME_CATALOGUE), nameCues: structuredClone(DEFAULT_NAME_CUES), namePackVersion: 1 });
const request = (body, authenticated = true) => new Request('https://edge.example.test', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
function fakeBackend(overrides = {}) {
  const calls = [];
  return { calls, authenticate: async () => ({ id: '11111111-1111-4111-8111-111111111111' }), rpc: async (name, parameters, accessToken) => { calls.push({ name, parameters, accessToken }); throw new Error('Unexpected fixture RPC'); }, publicRpc: async (name, parameters) => { calls.push({ name, parameters }); throw new Error('Unexpected fixture public RPC'); }, uploadAudio: async () => { throw new Error('Unexpected fixture upload'); }, readAudio: async () => { throw new Error('Unexpected fixture download'); }, ...overrides };
}

test('admin missing-key state remains usable; test does not invoke provider without a reservation', async () => {
  let providerCalls = 0;
  const backend = fakeBackend({ rpc: async name => { if (name === 'get_narration_admin_status') return { revision: 0, keyConfigured: false, settings: settings(), queue: [{ state: 'waiting', reason: 'key_required' }] }; if (name === 'reserve_narration_test') throw new NarrationBackendError('narration_key_required', 409); throw new Error(); } });
  const handler = createNarrationAdminHandler(environment, { backend, provider: () => { providerCalls++; throw new Error(); } });
  assert.equal((await handler(request({ action: 'get' }))).status, 200);
  assert.equal((await handler(request({ action: 'test', baseRevision: 0 }))).status, 409); assert.equal(providerCalls, 0);
  assert.equal((await handler(request({ action: 'get' }, false))).status, 401);
  assert.equal((await createNarrationAdminHandler({ ...environment, SUPABASE_URL: 'https://aptprpkosqctwrzeetgs.supabase.co' }, { backend })(request({ action: 'get' }))).status, 503);
});
test('admin settings validation rejects unknown provider hosts, private name fields and malformed slots with 422', async () => {
  const backend = fakeBackend(); const handler = createNarrationAdminHandler(environment, { backend });
  for (const value of [{ ...settings(), selectedName: 'PrivateTestName' }, { ...settings(), slots: settings().slots.map((p, i) => i ? p : { ...p, providerHost: 'https://untrusted.example.test' }) }, { ...settings(), slots: [] }]) assert.equal((await handler(request({ action: 'save', baseRevision: 0, settings: value }))).status, 422);
  assert.deepEqual(backend.calls, []);
});
test('deterministic provider fixture cannot confirm the real provider connection', async () => {
  const completions = [];
  const backend = fakeBackend({ rpc: async (name, parameters) => name === 'reserve_narration_test' ? '11111111-1111-4111-8111-111111111111' : name === 'get_narration_test_context' ? { apiKey: 'sk-synthetic_fixture_only', settings: settings() } : name === 'complete_narration_test' ? (completions.push(parameters), true) : Promise.reject(new Error()) });
  const handler = createNarrationAdminHandler(environment, { backend, provider: () => ({ generate: async input => ({ pcm: fixturePCM(3), sampleRate: 24000, transcript: input.text, complete: true, responseId: 'fixture', fixture: true, usage: { known: true, textInputTokens: 10, audioOutputTokens: 20, textOutputTokens: 0, inputTokens: 10, outputTokens: 20 } }) }) });
  const response = await handler(request({ action: 'test', baseRevision: 1 })); const value = await response.json();
  assert.equal(response.status, 200); assert.equal(value.fixture, true); assert.equal(value.passed, false); assert.equal(value.providerConfirmed, false); assert.equal(completions[0].p_passed, false); assert.equal(completions[0].p_actual_cents, 0); assert.equal(JSON.stringify(value).includes('sk-synthetic'), false); assert.ok(value.audio.base64);
});
test('unpublished and foreign audio assets cannot use the service storage capability', async () => {
  let reads = 0;
  const backend = fakeBackend({ publicRpc: async () => false, readAudio: async () => { reads++; return new Uint8Array(64); } });
  const handler = createNarrationAdminHandler(environment, { backend });
  const response = await handler(request({ action: 'asset', storyId: 'station', version: 'a'.repeat(16), readingLevel: '6to8', voiceSlot: 'stem-1', assetId: randomUUID() }, false));
  assert.equal(response.status, 404); assert.equal(reads, 0); assert.deepEqual(backend.calls, []);
});
test('shared name response includes all variants; a selected name is never accepted in the request', async () => {
  const bytes = new Uint8Array(64).fill(17), hash = await narrationHash(bytes), ids = [randomUUID(), randomUUID()]; let reads = 0;
  const backend = fakeBackend({ publicRpc: async (name, parameters) => { assert.equal(name, 'get_narration_name_pack'); assert.equal(parameters.p_pack_version, 1); return { packId: 'pack-' + 'a'.repeat(40), packVersion: 1, voiceSlot: 'stem-1', presetVersion: 1, catalogue: DEFAULT_NAME_CATALOGUE, variants: { test: { avonturier: { nl: 'generic' }, 'n-noor': { nl: 'public-name' } } }, assets: { generic: { id: ids[0] }, 'public-name': { id: ids[1] } } }; }, rpc: async (name, parameters) => { assert.equal(name, 'get_narration_asset_context'); return { id: parameters.p_asset_id, objectPath: `assets/${hash}/${parameters.p_asset_id}.wav`, sha256: hash, byteLength: 64, durationMs: 1 }; }, readAudio: async () => { reads++; return bytes; } });
  const handler = createNarrationAdminHandler(environment, { backend });
  const response = await handler(request({ action: 'namePack', voiceSlot: 'stem-1', presetVersion: 1, packVersion: 1, packId: 'pack-' + 'a'.repeat(40) }, false));
  assert.equal(response.status, 200); const value = await response.json(); assert.equal(Object.keys(value.assets).length, 2); assert.equal(reads, 2); assert.ok(value.assets.generic.base64); assert.ok(value.assets['public-name'].base64);
  assert.equal((await handler(request({ action: 'namePack', voiceSlot: 'stem-1', presetVersion: 1, selectedName: 'PrivateTestName' }, false))).status, 422);
});
test('secret-bearing upstream admin result is rejected instead of reflected', async () => {
  const backend = fakeBackend({ rpc: async () => ({ revision: 0, nested: { apiKey: 'sk-should_never_leave_runtime' } }) });
  const response = await createNarrationAdminHandler(environment, { backend })(request({ action: 'get' }));
  assert.equal(response.status, 503); assert.equal((await response.text()).includes('sk-'), false);
});
test('worker rejects bearer, forged and unauthenticated wakeups before claiming any work', async () => {
  let claims = 0;
  const backend = fakeBackend({ rpc: async name => { if (name === 'verify_narration_worker_request') return false; claims++; return null; } });
  const handler = createNarrationWorkerHandler(environment, { backend });
  assert.equal((await handler(request({ nonce: randomUUID(), issuedAt: 1, signature: 'a'.repeat(64) }))).status, 401);
  assert.equal((await handler(request({ nonce: randomUUID(), issuedAt: 1, signature: 'a'.repeat(64) }, false))).status, 401);
  assert.equal(claims, 0);
});
test('authenticated worker compiles a frozen plan without a key or any provider attempt', async () => {
  let installed, providers = 0;
  const planning = { id: randomUUID(), leaseId: randomUUID(), storyId: 'fixture-story', contentVersion: 'a'.repeat(16), sourceKind: 'release', settings: settings(), source: { scenes: { '': { text: 'De vos wacht.', choices: [{ label: 'Ga mee' }] } }, endings: { 0: { text: 'Hier is het einde.' } } } };
  const backend = fakeBackend({ rpc: async (name, parameters) => { if (name === 'verify_narration_worker_request') return true; if (name === 'claim_narration_job') return planning; if (name === 'install_narration_plan') { installed = parameters; return true; } if (name === 'claim_narration_item') return null; throw new Error(); } });
  const handler = createNarrationWorkerHandler(environment, { backend, provider: () => { providers++; throw new Error(); } });
  const response = await handler(request({ nonce: randomUUID(), issuedAt: 1, signature: 'a'.repeat(64) }, false));
  assert.equal(response.status, 200); assert.equal((await response.json()).planned, 1); assert.equal(installed.p_job_id, planning.id); assert.equal(installed.p_plan.manifests.length, 15); assert.equal(providers, 0);
});
test('worker fixture bytes never reach storage or a publishable completion', async () => {
  const failures = []; let uploads = 0, completed = 0;
  const claim = { jobId: randomUUID(), itemId: 'fixture-item', leaseId: randomUUID(), apiKey: 'sk-synthetic_fixture_only', maxOutputTokens: 256, item: { id: 'fixture-item', fingerprint: 'a'.repeat(64), text: 'De vos wacht.', preset: DEFAULT_NARRATION_PRESETS[0] } };
  const backend = fakeBackend({ rpc: async (name, parameters) => { if (name === 'verify_narration_worker_request') return true; if (name === 'claim_narration_job') return null; if (name === 'claim_narration_item') return claim; if (name === 'fail_narration_item') { failures.push(parameters); return true; } if (name === 'complete_narration_item') completed++; throw new Error(); }, uploadAudio: async () => { uploads++; } });
  const handler = createNarrationWorkerHandler(environment, { backend, provider: () => ({ generate: async () => ({ fixture: true, complete: true, sampleRate: 24000 }) }) });
  const response = await handler(request({ nonce: randomUUID(), issuedAt: 1, signature: 'a'.repeat(64) }, false)); assert.equal(response.status, 200); assert.equal((await response.json()).deferred, 1); assert.equal(uploads, 0); assert.equal(completed, 0); assert.equal(failures[0].p_uncertain, true);
});
test('uncertain provider timeout is categorized without raw errors or secret exposure', async () => {
  let failure;
  const backend = fakeBackend({ rpc: async (name, parameters) => name === 'verify_narration_worker_request' ? true : name === 'claim_narration_job' ? null : name === 'claim_narration_item' ? { jobId: randomUUID(), itemId: 'fixture-item', leaseId: randomUUID(), apiKey: 'sk-synthetic_fixture_only', maxOutputTokens: 256, item: { id: 'fixture-item', text: 'De vos wacht.', preset: DEFAULT_NARRATION_PRESETS[0] } } : name === 'fail_narration_item' ? (failure = parameters, true) : Promise.reject(new Error()) });
  const response = await createNarrationWorkerHandler(environment, { backend, provider: () => ({ generate: async () => { throw new NarrationProviderError('timeout', true, true); } }) })(request({ nonce: randomUUID(), issuedAt: 1, signature: 'a'.repeat(64) }, false));
  assert.equal(response.status, 200); assert.equal(failure.p_error, 'provider_timeout'); assert.equal(failure.p_uncertain, true); assert.equal(failure.p_retryable, true); assert.equal((await response.text()).includes('sk-'), false);
});
test('Supabase adapter pins staging, exposes narrow RPC capabilities and immutable audio paths', async () => {
  const env = { ...environment, SUPABASE_SERVICE_ROLE_KEY: 'synthetic_service_credential', SUPABASE_ANON_KEY: 'synthetic_public_credential' }; let fetches = 0;
  const backend = createNarrationSupabaseBackend(env, async () => { fetches++; return Response.json(null); });
  await assert.rejects(backend.rpc('get_narration_test_context', {}, token)); await assert.rejects(backend.rpc('get_narration_admin_status')); await assert.rejects(backend.publicRpc('get_narration_test_context')); await assert.rejects(backend.uploadAudio('../other-bucket/private.wav', new Uint8Array(64))); assert.equal(fetches, 0);
  assert.throws(() => createNarrationSupabaseBackend({ ...env, SUPABASE_URL: 'https://aptprpkosqctwrzeetgs.supabase.co' }));
});
for (const failedPhase of ['upload', 'completion']) test(`known provider usage survives ${failedPhase} failure without publishing an asset`, async () => {
  let failed, uploaded = 0;
  const claim = { jobId: randomUUID(), itemId: 'fixture-item', leaseId: randomUUID(), apiKey: 'sk-synthetic_fixture_only', maxOutputTokens: 256, item: { id: 'fixture-item', fingerprint: 'a'.repeat(64), text: 'De vos wacht.', preset: DEFAULT_NARRATION_PRESETS[0] } };
  const usage = { known: true, inputTokens: 20, outputTokens: 30, textInputTokens: 20, audioOutputTokens: 25, textOutputTokens: 5 };
  const backend = fakeBackend({ rpc: async (name, parameters) => { if (name === 'verify_narration_worker_request') return true; if (name === 'claim_narration_job') return null; if (name === 'claim_narration_item') return claim; if (name === 'renew_narration_lease') return true; if (name === 'complete_narration_item') throw new Error('synthetic completion outage'); if (name === 'fail_narration_item') { failed = parameters; return true; } throw new Error(); }, uploadAudio: async () => { uploaded++; if (failedPhase === 'upload') throw new Error('synthetic storage outage'); } });
  // This DI result represents the completed provider boundary, without any
  // network request. It does not certify actual provider/audio acceptance.
  const provider = () => ({ generate: async () => ({ pcm: fixturePCM(1), transcript: claim.item.text, complete: true, sampleRate: 24000, usage, responseId: 'synthetic_boundary_result' }) });
  const response = await createNarrationWorkerHandler(environment, { backend, provider })(request({ nonce: randomUUID(), issuedAt: 1, signature: 'a'.repeat(64) }, false));
  assert.equal(response.status, 200); assert.equal(uploaded, 1); assert.deepEqual(failed.p_usage, usage); assert.equal(failed.p_actual_cents, 1); assert.equal(failed.p_lease_id, claim.leaseId);
});
test('background RPC failure logs only a fixed event and validated database code', async () => {
  const originalError = console.error;
  const rawMessage = 'sk-synthetic_secret_never_log PrivateTestName hidden narration text';
  try {
    for (const [code, expectedCode] of [['PGRST202','PGRST202'],['22P02','22P02'],[rawMessage,'unknown']]) {
      const logs = []; let task;
      console.error = (...values) => { logs.push(values); };
      const env = { ...environment, SUPABASE_SERVICE_ROLE_KEY: 'synthetic_service_credential', SUPABASE_ANON_KEY: 'synthetic_public_credential' };
      const backend = createNarrationSupabaseBackend(env, async input => new URL(input).pathname.endsWith('/verify_narration_worker_request') ? Response.json(true) : Response.json({ code, message: rawMessage, details: rawMessage, hint: rawMessage }, { status: 400 }));
      const handler = createNarrationWorkerHandler(environment, { backend, background: value => { task = value; } });
      const response = await handler(request({ nonce: randomUUID(), issuedAt: 1, signature: 'a'.repeat(64) }, false));
      assert.equal(response.status, 200); assert.deepEqual(await response.json(), { accepted: true }); await task;
      assert.deepEqual(logs, [[JSON.stringify({ event: 'narration_worker_background_failed', narrationRPCCode: expectedCode })]]);
      assert.equal(JSON.stringify(logs).includes(rawMessage), false); assert.equal(JSON.stringify(logs).includes('synthetic_service_credential'), false);
    }
  } finally { console.error = originalError; }
});
test('service claim envelopes unwrap null or a job object and reject every other transport shape', async () => {
  const env={...environment,SUPABASE_SERVICE_ROLE_KEY:'synthetic_service_credential',SUPABASE_ANON_KEY:'synthetic_public_credential'};
  for(const name of ['claim_narration_job','claim_narration_item']) {
    for(const claim of [null,{id:randomUUID(),leaseId:randomUUID()}]) {
      const backend=createNarrationSupabaseBackend(env,async(url,init)=>{assert.equal(new URL(url).pathname,'/rest/v1/rpc/'+name);assert.equal(init.method,'POST');assert.equal(init.body,'{}');return Response.json({claim});});
      assert.deepEqual(await backend.rpc(name),claim);
    }
    for(const value of [null,{},[],{claim:[]},{claim:'invalid'},{claim:null,secret:'sk-synthetic_fixture_only'}]) {
      const backend=createNarrationSupabaseBackend(env,async()=>Response.json(value));
      await assert.rejects(backend.rpc(name),error=>error instanceof NarrationBackendError&&error.code==='narration_unavailable'&&!error.message.includes('sk-'));
    }
  }
  const backend=createNarrationSupabaseBackend(env,async()=>Response.json({claim:null}));
  assert.deepEqual(await backend.rpc('fail_narration_job'),{claim:null});
});
