import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { blogDatabaseFixture } from './database-fixture.mjs';
import { STAGING, createProbeState, validateProbeState, fixtureSetupSql, policyOffSql, reconnectSql, cleanupSql, verifyPublicHtml } from './staging-probe.mjs';
const key = 'sb_publishable_synthetic_local_fixture_1234567890';
const hash = value => createHash('sha256').update(value).digest('hex');

test('staging fixture SQL uses hashes only and real narrow RPCs preserve opt-out, replacement and pre-existing data', async () => {
  const f = await blogDatabaseFixture();
  try {
    await f.owner(); await f.db.exec('delete from private.blog_installation where singleton');
    await f.db.query('select private.configure_blog_installation($1,$2,$3,$4,$5)', ['staging', STAGING.origin, STAGING.project, 'https://socialhero-staging.dgwebservices.nl', STAGING.canonical]);
    const state = createProbeState(key), sql = [fixtureSetupSql(state), policyOffSql(state), reconnectSql(state), cleanupSql(state)];
    for (const source of sql) for (const secret of [state.credential.token, state.replacement.token, key]) assert.equal(source.includes(secret), false);
    assert.ok(sql[0].includes(hash(state.credential.token))); assert.ok(sql[2].includes(hash(state.replacement.token)));
    const before = (await f.db.query('select parent_id,revision,snapshot from public.family_documents order by parent_id')).rows;
    const usersBefore = (await f.db.query('select id,email from auth.users order by id')).rows;
    const machine = (token, action = 'capabilities') => f.db.query('select public.blog_connector($1,$2,$3) result', [hash(token), action, {}]).then(result => result.rows[0].result);
    await f.db.exec(sql[0]); assert.deepEqual((await machine(state.credential.token)).scopes, ['read', 'draft', 'publish']);
    await assert.rejects(f.db.exec(sql[0]), /existing connection preserved/); await f.db.exec('rollback');
    const conflicting = createProbeState(key); await assert.rejects(f.db.exec(fixtureSetupSql(conflicting)), /existing connection preserved/); await f.db.exec('rollback');
    await assert.rejects(f.db.exec(sql[2]), /withdrawal before reconnect/); await f.db.exec('rollback');
    await f.db.exec(sql[1]); assert.deepEqual((await machine(state.credential.token)).scopes, ['read', 'draft']);
    await f.db.exec(sql[2]); await assert.rejects(machine(state.credential.token), /INVALID_CREDENTIAL/);
    assert.deepEqual((await machine(state.replacement.token)).scopes, ['read', 'draft']);
    await f.db.exec(sql[3]); await assert.rejects(machine(state.replacement.token), /INVALID_CREDENTIAL/);
    assert.deepEqual((await f.db.query('select parent_id,revision,snapshot from public.family_documents order by parent_id')).rows, before);
    assert.deepEqual((await f.db.query('select id,email from auth.users order by id')).rows, usersBefore);
    assert.deepEqual((await f.db.query('select active_connection_id,current_attempt_id from private.blog_installation where singleton')).rows[0], { active_connection_id: null, current_attempt_id: null });
  } finally { await f.db.close(); }
});

test('local state refuses production identities and secret/service-role keys', () => {
  const state = createProbeState(key);
  for (const changed of [{ origin: 'https://fabelpad.nl' }, { project: 'aptprpkosqctwrzeetgs' }, { canonical: 'https://evil.example' }, { actorId: "';select 1;--" }]) assert.throws(() => validateProbeState({ ...state, ...changed }));
  for (const secret of ['sb_secret_do_not_use_1234567890123456789', `e30.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.synthetic`]) assert.throws(() => createProbeState(secret), /PUBLISHABLE_KEY_REQUIRED/);
});

test('CLI creates mode-600 local artifacts, prints no bearer/key and rejects insecure state before HTTP', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fabelpad-staging-probe-test-')), stateFile = join(dir, 'state.json'), keyFile = join(dir, 'publishable.txt');
  const execute = promisify(execFile), script = new URL('./staging-probe.mjs', import.meta.url).pathname;
  try {
    const { writeFile } = await import('node:fs/promises'); await writeFile(keyFile, key, { mode: 0o600 });
    const result = await execute(process.execPath, [script, 'init', '--state', stateFile, '--publishable-key-file', keyFile]);
    const state = JSON.parse(await readFile(stateFile, 'utf8'));
    for (const secret of [state.credential.token, state.replacement.token, key]) assert.equal((result.stdout + result.stderr).includes(secret), false);
    for (const name of ['state.json', 'fixture-setup.sql', 'policy-off.sql', 'fixture-reconnect.sql', 'fixture-cleanup.sql']) assert.equal((await stat(join(dir, name))).mode & 0o077, 0);
    await chmod(stateFile, 0o644);
    await assert.rejects(execute(process.execPath, [script, 'run', '--state', stateFile]), error => error.stderr.includes('LOCAL_STATE_REQUIRES_MODE_600') && !error.stderr.includes(state.credential.token));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('public acceptance requires active exact HTML proof, one H1, SEO, production canonical and staging noindex', () => {
  const article = { postId: 'synthetic', revision: 3, document: { title: 'Synthetic', slug: 'synthetic', seo: { title: 'SEO', description: 'Description' } } }, proof = 'a'.repeat(64);
  const html = `<html><head><title>SEO — Fabelpad</title><link rel="canonical" href="https://fabelpad.nl/blog/synthetic"/><meta name="robots" content="noindex, nofollow"/><meta name="description" content="Description"/><script type="application/ld+json">${JSON.stringify({ '@type': 'BlogPosting', headline: 'Synthetic', url: 'https://fabelpad.nl/blog/synthetic' })}</script></head><body><article data-blog-revision="synthetic:3" data-blog-proof="${proof}"><h1>Synthetic</h1></article></body></html>`;
  verifyPublicHtml(html, article, proof);
  for (const invalid of [html.replace('synthetic:3', 'synthetic:2'), html.replace('<article ', '<!-- <article ').replace('</article>', '</article> -->'), html.replace('noindex, nofollow', 'index, follow'), html.replace('<h1>Synthetic</h1>', '<h1>Synthetic</h1><h1>Duplicate</h1>'), html.replace('href="https://fabelpad.nl/blog/synthetic"', 'href="https://staging.fabelpad.nl/blog/synthetic"')]) assert.throws(() => verifyPublicHtml(invalid, article, proof));
});
