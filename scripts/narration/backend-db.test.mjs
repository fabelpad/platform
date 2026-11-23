import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { installBillingFixture } from '../billing/database-fixture.mjs';
import { currentLegalVersions } from '../legal-fixture.mjs';
import { canonicalContentJson } from '../../lib/contentHash.ts';
import { compileNarrationSource, compileNarrationLibrary } from '../../lib/narration/compiler.ts';
import { DEFAULT_NAME_CATALOGUE, DEFAULT_NAME_CUES } from '../../lib/narration/contracts.ts';

// PGlite cannot load pg-safeupdate's native parse hook. Check the effective
// installed function bodies structurally instead: literals/comments and nested
// subquery WHERE clauses must never satisfy a top-level DML predicate guard.
function unboundedNarrationDml(source) {
  const sql=source.replace(/'(?:''|[^'])*'|\$([a-z_][a-z0-9_]*)?\$[\s\S]*?\$\1\$|--[^\n]*|\/\*[\s\S]*?\*\//giu,match=>' '.repeat(match.length));
  const issues=[];
  for(const match of sql.matchAll(/\b(?:update|delete\s+from)\s+((?:private|public)\.[a-z_][a-z0-9_]*)\b/giu)) {
    const end=sql.indexOf(';',match.index),statement=sql.slice(match.index,end<0?undefined:end);let depth=0,predicate;
    for(let index=0;index<statement.length;index++) {
      if(statement[index]==='(')depth++;else if(statement[index]===')')depth--;
      else if(depth===0&&/\bwhere\b/iu.test(statement.slice(index,index+6))&&/^where\b/iu.test(statement.slice(index))) {predicate=statement.slice(index+5).trim();break;}
    }
    if(!predicate||/^(?:true\b|1\s*=\s*1\b)/iu.test(predicate))issues.push(match[1]);
  }
  return issues;
}
test('runtime DML guard rejects absent, nested-only, quoted and tautological WHERE clauses',()=>{
  for(const sql of ["update private.narration_control set revision=1", "update private.narration_control set revision=(select revision from private.narration_control where singleton)","update private.narration_control set settings='where singleton' -- where singleton","update private.narration_control set revision=1 where true","delete from private.narration_jobs /* where id=1 */"])assert.equal(unboundedNarrationDml(sql).length,1);
  assert.deepEqual(unboundedNarrationDml('update private.narration_control set revision=revision+1 where singleton;delete from private.narration_jobs where id=p_job_id;'),[]);
});

test('real audio SQL: upgrade, outbox, capability grants, budget, review, exact publication and preview isolation', async t => {
  const db = new PGlite({ extensions: { pgcrypto } });
  const admin = randomUUID(), parentA = randomUUID(), parentB = randomUUID();
  const owner = () => db.exec('reset role');
  const rpc = async (name, args = []) => { let result = (await db.query(`select public.${name}(${args.map((_, n) => `$${n + 1}`).join(',')}) result`, args)).rows[0].result; if (['claim_narration_job','claim_narration_item'].includes(name)) { assert.deepEqual(Object.keys(result),['claim']); result=result.claim; } if (result && typeof result === 'object' && Number.isSafeInteger(result.revision)) currentRevision = result.revision; return result; };
  const privateRpc = async (name, args = []) => (await db.query(`select private.${name}(${args.map((_, n) => `$${n + 1}`).join(',')}) result`, args)).rows[0].result;
  const denied = async (promise, code = '42501') => assert.rejects(promise, e => e.code === code);
  async function identity(actor, age = 0) {
    await owner(); await db.query('insert into auth.sessions(id,user_id) values($1,$1) on conflict do nothing', [actor]);
    await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: actor, session_id: actor, amr: [{ method: 'otp', timestamp: Date.now() / 1000 - age }] })]);
    await db.exec('set role authenticated');
  }
  async function role(value) { await owner(); await db.query("select set_config('request.jwt.claims','{}',false)"); await db.exec(`set role ${value}`); }
  const payload = { metadata: { title: 'De fictieve brug', description: 'Synthetische redactionele testinhoud.', image: '/art/station.webp' }, parts: 1, nameToken: '__FABELPAD_CHILD__', scenes: { '': { title: 'De brug', text: 'Kom mee, {{naam}}. De vos wacht.', choices: [{ label: 'Naar links', hint: 'Volg het licht.', icon: 'heart' }, { label: 'Naar rechts', hint: 'Volg de brug.', icon: 'leaf' }] } }, endings: { '0': { title: 'Links', text: 'Hier stopt het pad.', keepsake: 'Een lichtje' }, '1': { title: 'Rechts', text: 'Hier staat een huis.', keepsake: 'Een steentje' } } };
  const version = createHash('sha256').update(canonicalContentJson(payload)).digest('hex').slice(0, 16);
  let oldSnapshot, oldCount, settings, job, plan, libJob, libPlan, currentRevision;
  try {
    await installBillingFixture(db, { beforeBilling: async () => {
      await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'legacy@example.test',clock_timestamp())", [parentA]);
      oldSnapshot = { schemaVersion: 1, family: { version: 1, children: [{ id: 'legacy-child', name: 'Testkind', avatar: 0 }], activeId: 'legacy-child' }, data: { 'legacy-child': { prefs: { muted: false, calm: true }, 'story-station': { picks: [0], updatedAt: 1, contentVersion: version } } } };
      await db.query('insert into public.family_documents(parent_id,snapshot,revision) values($1,$2,7)', [parentA, JSON.stringify(oldSnapshot)]);
      await db.query('insert into public.content_releases(story_id,content_version,payload) values($1,$2,$3)', ['station', version, JSON.stringify(payload)]);
      oldCount = 1;
    } });
    await t.test('additive migration retains old family bytes, revision, text release and four billing gates', async () => {
      assert.deepEqual((await db.query('select snapshot,revision from public.family_documents where parent_id=$1', [parentA])).rows[0], { snapshot: oldSnapshot, revision: 7 });
      assert.equal((await db.query('select count(*)::integer n from public.content_releases')).rows[0].n, oldCount);
      assert.deepEqual((await db.query('select payment_required,founders_enabled,mollie_enabled,play_enabled from private.billing_control')).rows[0], { payment_required: false, founders_enabled: false, mollie_enabled: false, play_enabled: false });
    });
    await t.test('all effective narration runtime DML has a bounded top-level predicate and singleton revisions remain atomic',async()=>{
      const functions=(await db.query("select n.nspname,p.proname,p.prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('private','public') and p.proname like '%narration%'")).rows;
      assert.ok(functions.length>40);
      for(const fn of functions)assert.deepEqual(unboundedNarrationDml(fn.prosrc),[],fn.nspname+'.'+fn.proname+' must preserve the hosted pg-safeupdate guard');
      for(const name of ['narration_bump','claim_narration_job','claim_narration_item'])assert.match(functions.find(fn=>fn.nspname==='private'&&fn.proname===name).prosrc,/update private\.narration_control[\s\S]*?where singleton/iu);
      const before=(await db.query('select revision from private.narration_control')).rows[0].revision;
      await db.exec('begin');
      try{await db.query('select private.narration_bump()');const rows=(await db.query('select revision from private.narration_control')).rows;assert.equal(rows.length,1);assert.equal(rows[0].revision,before+1);}finally{await db.exec('rollback');}
      assert.equal((await db.query('select revision from private.narration_control')).rows[0].revision,before);
    });
    const legal = await currentLegalVersions(db);
    for (const actor of [admin, parentB]) await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,clock_timestamp())', [actor, `${actor}@example.test`]);
    for (const actor of [admin, parentA, parentB]) { await identity(actor); await rpc('complete_parent_onboarding', [legal.terms, legal.privacy, true, true]); }
    await owner(); await db.query('insert into public.content_admins(user_id) values($1)', [admin]);
    await t.test('anonymous, ordinary parents and stale authentication cannot administer or claim jobs', async () => {
      await role('anon'); await denied(rpc('get_narration_admin_status')); await denied(rpc('claim_narration_job'));
      const voices = await rpc('get_narration_voices'); assert.equal(voices.voices.length, 5); assert.equal(voices.active, false); assert.equal(voices.available, false);
      assert.equal(JSON.stringify(voices).includes('instructions'), false); assert.equal(JSON.stringify(voices).includes('gpt-'), false);
      await identity(parentB); await denied(rpc('get_narration_admin_status'));
      await identity(admin); settings = (await rpc('get_narration_admin_status')).settings;
      await identity(admin, 301); await denied(rpc('save_narration_settings', [0, JSON.stringify(settings)]), '28000');
      await role('service_role'); await denied(db.query('select * from private.narration_control')); await denied(rpc('save_narration_settings', [0, JSON.stringify(settings)]));
    });
    await t.test('empty zero-argument claims retain private JSON null and use a stable public transport envelope', async () => {
      await role('service_role');
      for (const name of ['claim_narration_job','claim_narration_item']) {
        const row=(await db.query(`with result as materialized(select private.${name}() value) select value,value is null as sql_null,jsonb_typeof(value) as json_type from result`)).rows[0];
        assert.equal(row.value,null);assert.equal(row.sql_null,false);assert.equal(row.json_type,'null');
        assert.equal(await Response.json(row.value).text(),'null');
        // The real PostgREST scalar-response shape must remain JSON null too.
        const wrapped=(await db.query(`with pgrst_source as(select pgrst_call.pgrst_scalar from(select public.${name}() pgrst_scalar)pgrst_call) select coalesce(json_agg(_postgrest_t.pgrst_scalar)->0,'null') as body from(select pgrst_source.* from pgrst_source)_postgrest_t`)).rows[0];
        assert.deepEqual(wrapped.body,{claim:null});assert.equal(await Response.json(wrapped.body).text(),'{"claim":null}');
      }
      await owner();
      assert.equal((await db.query('select last_tick_at is not null as healthy from private.narration_control')).rows[0].healthy,true);
      assert.equal((await db.query('select count(*)::integer as total from private.narration_jobs')).rows[0].total,0);
      assert.equal((await db.query('select count(*)::integer as total from private.narration_budget')).rows[0].total,0);
    });
    await t.test('only stable voice slots are additive cloud preferences; names, recordings and invalid slots are refused', async () => {
      await owner();
      for (const voiceSlot of ['stem-1', 'stem-2', 'stem-3', 'stem-4', 'stem-5']) {
        const snapshot = structuredClone(oldSnapshot); snapshot.data['legacy-child'].prefs.voiceSlot = voiceSlot;
        assert.equal(await privateRpc('valid_family_snapshot', [JSON.stringify(snapshot)]), true);
      }
      for (const extra of [{ voiceSlot: 'marin' }, { voiceSlot: 'stem-6' }, { voiceSlot: null }, { nameMode: 'name' }, { recording: 'private.wav' }, { selectedName: 'PrivateTestName' }]) {
        const snapshot = structuredClone(oldSnapshot); Object.assign(snapshot.data['legacy-child'].prefs, extra);
        assert.equal(await privateRpc('valid_family_snapshot', [JSON.stringify(snapshot)]), false);
      }
      const snapshot = structuredClone(oldSnapshot); snapshot.family.children[0].birthDate = '2020-02-29'; snapshot.family.children[0].readingLevelOverride = '9plus'; snapshot.data['legacy-child'].prefs.voiceSlot = 'stem-3';
      assert.equal(await privateRpc('valid_family_snapshot', [JSON.stringify(snapshot)]), true);
      snapshot.family.children[0].birthDate = '2020-02-30'; assert.equal(await privateRpc('valid_family_snapshot', [JSON.stringify(snapshot)]), false);
      const synced = structuredClone(oldSnapshot); synced.data['legacy-child'].prefs.voiceSlot = 'stem-4';
      await identity(parentA); await rpc('consent_child_profile', ['legacy-child', true, true]); const saved = await rpc('save_family_snapshot', [7, JSON.stringify(synced)]); assert.equal(saved.saved, true); assert.equal(saved.snapshot.data['legacy-child'].prefs.voiceSlot, 'stem-4');
    });
    await t.test('normal save has an atomic, deduplicated audio outbox without a provider key', async () => {
      await identity(admin);
      const draft = { metadata: payload.metadata, chapters: {}, updatedAt: '' };
      const saved = await rpc('save_narration_content_draft', ['station', 0, JSON.stringify(draft), JSON.stringify(payload)]);
      assert.equal(saved.saved, true); assert.equal(saved.audio.reason, 'key_required');
      const conflict = await rpc('save_narration_content_draft', ['station', 0, JSON.stringify(draft), JSON.stringify(payload)]); assert.equal(conflict.saved, false);
      await owner(); assert.equal((await db.query("select count(*)::integer n from private.narration_jobs where story_id='station' and content_version=$1", [version])).rows[0].n, 1);
      await role('service_role'); assert.equal(await rpc('claim_narration_item'), null);
      job = await rpc('claim_narration_job'); assert.equal(job.storyId, 'station');
      plan = await compileNarrationSource({ ...payload, storyId: 'station', contentVersion: version }, settings.slots, settings);
      assert.equal(await rpc('install_narration_plan', [job.id, randomUUID(), JSON.stringify(plan)]), false);
      assert.equal(await rpc('install_narration_plan', [job.id, job.leaseId, JSON.stringify(plan)]), true);
      assert.equal(await rpc('claim_narration_item'), null);
    });
    await t.test('key storage is write-only, revisions guard rotation, and a successful test is separate from fixture state', async () => {
      settings.generationEnabled = true; settings.playbackEnabled = true;
      settings.cueCatalogue = DEFAULT_NAME_CATALOGUE; settings.nameCues = DEFAULT_NAME_CUES;
      await identity(admin); const saved = await rpc('save_narration_settings', [0, JSON.stringify(settings), 'sk-synthetic_test_credential_only']);
      assert.equal(saved.saved, true); assert.equal(saved.keyConfigured, true); assert.equal(saved.lastTestResult, 'not_tested'); assert.equal(JSON.stringify(saved).includes('sk-synthetic'), false); currentRevision = saved.revision;
      assert.equal((await rpc('save_narration_settings', [0, JSON.stringify(settings), 'sk-never_written_stale_fixture'])).saved, false);
      const ticket = await rpc('reserve_narration_test', [currentRevision]);
      await denied(rpc('get_narration_test_context', [ticket]));
      await role('service_role'); const context = await rpc('get_narration_test_context', [ticket]); assert.equal(context.apiKey, 'sk-synthetic_test_credential_only');
      assert.equal(await rpc('complete_narration_test', [ticket, true, JSON.stringify({ synthetic: true }), 1]), true);
      assert.equal(await rpc('complete_narration_test', [ticket, true]), false);
      // The unit fixture explicitly simulates provider confirmation in SQL;
      // it does not make a real provider request or certify audible quality.
      await owner();
      await db.query('update private.narration_jobs set settings=$1,configuration_revision=$2 where id=$3', [JSON.stringify(settings), currentRevision, job.id]);
    });
    let item, firstAsset;
    await t.test('dispatch reserves budget and a lease before provider access; late or fixture results are rejected', async () => {
      await role('service_role'); item = await rpc('claim_narration_item'); assert.ok(item.apiKey); assert.ok(item.reservedCents > 0);
      assert.equal(await rpc('claim_narration_item'), null);
      const asset = { objectPath: `assets/${item.item.fingerprint}/${randomUUID()}.wav`, sha256: 'a'.repeat(64), byteLength: 10000, durationMs: 1000, quality: 'pass', transcript: item.item.text, providerConfirmed: true };
      assert.equal(await rpc('complete_narration_item', [job.id, item.itemId, randomUUID(), JSON.stringify(asset), '{}', 1]), false);
      await denied(rpc('complete_narration_item', [job.id, item.itemId, item.leaseId, JSON.stringify({ ...asset, providerConfirmed: false }), '{}', 1]), '22023');
      assert.equal(await rpc('complete_narration_item', [job.id, item.itemId, item.leaseId, JSON.stringify(asset), '{"audioOutputTokens":10}', 1]), true);
      await owner(); const row = (await db.query('select state,asset_id from private.narration_items where job_id=$1 and id=$2', [job.id, item.itemId])).rows[0]; assert.equal(row.state, 'review'); firstAsset = row.asset_id;
      const budget = (await db.query('select actual_cents,unknown from private.narration_budget where job_id=$1 and item_id=$2', [job.id, item.itemId])).rows[0]; assert.deepEqual(budget, { actual_cents: 1, unknown: false });
    });
    await t.test('generated but unlistened audio cannot be reused or published', async () => {
      await identity(admin); await denied(rpc('publish_narration_job', [currentRevision, job.id]), '55000');
      await denied(rpc('review_narration_item', [currentRevision, job.id, item.itemId, 'approve', false, true]), '22023');
      await owner(); const duplicate = await privateRpc('enqueue_narration_source', ['toy', version, JSON.stringify(payload), 'catalogue']);
      await role('service_role'); const claim = await rpc('claim_narration_job'); assert.equal(claim.id, duplicate);
      const duplicatePlan = await compileNarrationSource({ ...payload, storyId: 'toy', contentVersion: version }, settings.slots, settings);
      await rpc('install_narration_plan', [claim.id, claim.leaseId, JSON.stringify(duplicatePlan)]);
      await owner(); assert.equal((await db.query('select state from private.narration_items where job_id=$1 and fingerprint=$2 limit 1', [duplicate, item.item.fingerprint])).rows[0].state, 'review');
      await identity(admin); await rpc('review_narration_item', [currentRevision, job.id, item.itemId, 'approve', true, true]);
      await owner(); assert.equal((await db.query('select reviewed_by from private.narration_items where job_id=$1 and id=$2', [job.id, item.itemId])).rows[0].reviewed_by, admin);
    });
    await t.test('catalogue selection is frozen, includes historic versions, and enqueues an independent shared library', async () => {
      await identity(admin); const sources = await rpc('get_narration_catalogue_sources'); assert.ok(sources.some(s => s.storyId === 'station' && s.contentVersion === version));
      const selected = [{ storyId: 'station', contentVersion: version }]; const estimate = { expectedItems: 10, uniqueItems: 5, estimatedMinutes: 1, estimatedCents: 5, estimateComplete: false };
      const dry = await rpc('save_narration_catalogue_plan', [currentRevision, JSON.stringify(selected), JSON.stringify(estimate)]);
      await rpc('enqueue_narration_catalogue', [currentRevision, dry.planId]); await rpc('enqueue_narration_catalogue', [currentRevision, dry.planId]);
      await owner(); assert.equal((await db.query("select count(*)::integer n from private.narration_jobs where source_kind='library'")).rows[0].n, 1);
      await role('service_role'); libJob = await rpc('claim_narration_job'); assert.equal(libJob.sourceKind, 'library');
      libPlan = await compileNarrationLibrary(settings.slots, settings.cueCatalogue, settings.nameCues, 1);
      await rpc('install_narration_plan', [libJob.id, libJob.leaseId, JSON.stringify(libPlan)]);
    });
    await t.test('budget limits pause safely and unknown provider spend is retained with bounded retries', async () => {
      await owner(); await db.query("update private.narration_control set settings=jsonb_set(settings,'{budgetCents}','1')");
      await role('service_role'); assert.equal(await rpc('claim_narration_item'), null);
      await owner(); await db.query("update private.narration_control set settings=jsonb_set(settings,'{budgetCents}','2500')");
      await role('service_role'); const claim = await rpc('claim_narration_item'); assert.ok(claim);
      assert.equal(await rpc('fail_narration_item', [claim.jobId, claim.itemId, claim.leaseId, 'provider_timeout', true, true]), true);
      await owner(); const ledger = (await db.query('select actual_cents,unknown,reserved_cents from private.narration_budget where job_id=$1 and item_id=$2 order by attempt desc limit 1', [claim.jobId, claim.itemId])).rows[0]; assert.equal(ledger.actual_cents, null); assert.equal(ledger.unknown, true); assert.ok(ledger.reserved_cents > 0);
      await db.query("update private.narration_items set attempt=3,uncertain_attempts=2,state='failed' where job_id=$1 and id=$2", [claim.jobId, claim.itemId]);
      await identity(admin); await rpc('retry_narration_job', [currentRevision, claim.jobId, claim.itemId]);
      await owner(); assert.equal((await db.query('select state from private.narration_items where job_id=$1 and id=$2', [claim.jobId, claim.itemId])).rows[0].state, 'failed');
      const assetsBefore = (await db.query('select count(*)::integer n from private.narration_assets')).rows[0].n;
      await role('service_role'); assert.equal(await rpc('complete_narration_item', [claim.jobId, claim.itemId, claim.leaseId, '{}', '{"textInputTokens":123,"audioOutputTokens":45,"textOutputTokens":6}', 1]), false);
      await owner(); const reconciled = (await db.query('select actual_cents,unknown from private.narration_budget where lease_id=$1', [claim.leaseId])).rows[0]; assert.deepEqual(reconciled, { actual_cents: 1, unknown: false }); assert.equal((await db.query('select count(*)::integer n from private.narration_assets')).rows[0].n, assetsBefore);
      await identity(admin); const status = await rpc('get_narration_admin_status'); assert.ok(status.usage.textInputTokens >= 123); assert.ok(status.usage.audioOutputTokens >= 45); assert.ok(status.usage.textOutputTokens >= 6);
    });
    async function seedReviewedAssets(jobId) {
      // Synthetic database-only fixtures exercise transaction/release gates.
      // Their bytes are never uploaded and are not real audio acceptance.
      await owner(); const rows = (await db.query('select id,fingerprint,specification from private.narration_items where job_id=$1', [jobId])).rows;
      for (const row of rows) {
        const assetId = randomUUID(); await db.query("insert into private.narration_assets(id,fingerprint,object_path,sha256,byte_length,duration_ms,mime_type,quality,provider_confirmed,transcript) values($1,$2,$3,$4,10000,1000,'audio/wav','pass',true,$5)", [assetId, row.fingerprint, `assets/${row.fingerprint}/${randomUUID()}.wav`, 'b'.repeat(64), row.specification.text]);
        await db.query("update private.narration_items set state='approved',asset_id=$1,reviewed_by=$2,reviewed_at=clock_timestamp() where job_id=$3 and id=$4", [assetId, admin, jobId, row.id]);
      }
    }
    await t.test('shared name library is required and exact pack identities bind all 15 published manifests atomically', async () => {
      await seedReviewedAssets(job.id); await identity(admin); await denied(rpc('publish_narration_job', [currentRevision, job.id]), '55000');
      await seedReviewedAssets(libJob.id); await identity(admin); await rpc('publish_narration_job', [currentRevision, libJob.id]);
      await rpc('publish_narration_job', [currentRevision, job.id]); await rpc('publish_narration_job', [currentRevision, job.id]);
      await owner(); assert.equal((await db.query('select count(*)::integer n from private.narration_active_manifests where story_id=$1', ['station'])).rows[0].n, 15);
      await role('anon'); const full = await rpc('get_narration_manifest', ['station', version, '6to8', 'stem-1']); assert.equal(full.manifest.access.scope, 'full'); assert.deepEqual(Object.keys(full.manifest.endings).sort(), ['0', '1']);
      const pack = await rpc('get_narration_name_pack', ['stem-1', 1, 1, full.manifest.cuePack.packId]); assert.equal(pack.packId, full.manifest.cuePack.packId); assert.equal(await rpc('get_narration_name_pack', ['stem-1', 1, 2, full.manifest.cuePack.packId]), null);
    });
    await t.test('two families, preview boundaries and asset references cannot disclose endings or another slot', async () => {
      await owner(); await db.exec('update private.billing_control set payment_required=true');
      await db.query('insert into private.billing_free_selection(parent_id,full_story_id,preview_ids) values($1,$2,$3)', [parentA, 'snow', ['station']]);
      await db.query('insert into private.billing_free_selection(parent_id,full_story_id,preview_ids) values($1,$2,$3)', [parentB, 'snow', ['toy', 'dream']]);
      await identity(parentA); const preview = (await rpc('get_narration_manifest', ['station', version, '6to8', 'stem-1'])).manifest;
      assert.equal(preview.access.scope, 'preview'); assert.deepEqual(Object.keys(preview.scenes), ['']); assert.deepEqual(preview.endings, {});
      await owner(); const full = (await db.query("select manifest from private.narration_manifests where story_id='station' and reading_level='6to8' and voice_slot='stem-1' order by audio_revision desc limit 1")).rows[0].manifest;
      const endingRef = full.endings['0'].segments[0].asset; const endingAsset = full.assets[endingRef].id;
      const firstRef = preview.scenes[''].segments.find(s => s.kind === 'asset').asset; const first = preview.assets[firstRef].id;
      await identity(parentA); assert.equal(await rpc('authorize_narration_asset', ['station', version, '6to8', 'stem-1', first]), true); assert.equal(await rpc('authorize_narration_asset', ['station', version, '6to8', 'stem-1', endingAsset]), false);
      await identity(parentB); await denied(rpc('get_narration_manifest', ['station', version, '6to8', 'stem-1']));
      await role('anon'); await denied(rpc('get_narration_manifest', ['station', version, '6to8', 'stem-1'])); await denied(rpc('get_narration_asset_context', [first]));
    });
    await t.test('rejecting published bytes immediately stops their delivery while another approved voice remains available', async () => {
      await owner(); await db.exec('update private.billing_control set payment_required=false');
      const manifest = (await db.query("select manifest from private.narration_manifests where story_id='station' and reading_level='6to8' and voice_slot='stem-1' order by audio_revision desc limit 1")).rows[0].manifest;
      const reference = manifest.endings['0'].segments[0].asset, assetId = manifest.assets[reference].id;
      await identity(admin); await rpc('review_narration_item', [currentRevision, job.id, reference, 'reject', true, true, 'Synthetische controlebeslissing.']);
      await role('anon'); const refused = await rpc('get_narration_manifest', ['station', version, '6to8', 'stem-1']); assert.equal(refused.manifest, null); assert.equal(refused.reason, 'audio_review_rejected'); assert.equal(await rpc('authorize_narration_asset', ['station', version, '6to8', 'stem-1', assetId]), false); assert.ok((await rpc('get_narration_manifest', ['station', version, '6to8', 'stem-2'])).manifest);
      await identity(admin); await rpc('review_narration_item', [currentRevision, job.id, reference, 'approve', true, true]);
      await role('anon'); assert.ok((await rpc('get_narration_manifest', ['station', version, '6to8', 'stem-1'])).manifest);
      await identity(admin); const sampleRef = libPlan.samples['stem-1']; await rpc('review_narration_item', [currentRevision, libJob.id, sampleRef, 'reject', true, true]);
      await role('anon'); assert.equal(await rpc('get_narration_sample', ['stem-1', 1]), null); assert.equal((await rpc('get_narration_voices')).voices.find(v => v.slotId === 'stem-1').available, false);
    });
    await t.test('staging scheduler is separately pinned and HMAC proofs expire and cannot be replayed', async () => {
      await owner(); await db.exec('create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[])'); await privateRpc('configure_lifecycle_worker', ['tlwfpivafcokcjyjwgmq']);
      await denied(privateRpc('configure_narration_worker', ['aptprpkosqctwrzeetgs']), '22023'); await privateRpc('configure_narration_worker', ['tlwfpivafcokcjyjwgmq']);
      assert.deepEqual((await db.query("select public,allowed_mime_types from storage.buckets where id='fabelpad-narration'")).rows[0], { public: false, allowed_mime_types: ['audio/wav'] });
      const key = (await db.query("select secret from vault.secrets where name='fabelpad_narration_worker_hmac'")).rows[0].secret;
      const nonce = randomUUID(), issued = Math.floor(Date.now() / 1000);
      const signature = createHmac('sha256', Buffer.from(key, 'hex')).update(`fabelpad-narration-worker-v1\ntlwfpivafcokcjyjwgmq\n${nonce}\n${issued}`).digest('hex');
      await role('service_role'); assert.equal(await rpc('verify_narration_worker_request', [nonce, issued, signature]), true); assert.equal(await rpc('verify_narration_worker_request', [nonce, issued, signature]), false); assert.equal(await rpc('verify_narration_worker_request', [randomUUID(), issued - 91, signature]), false);
      await role('authenticated'); await denied(rpc('verify_narration_worker_request', [randomUUID(), issued, signature]));
    });
  } finally { await db.close(); }
});
