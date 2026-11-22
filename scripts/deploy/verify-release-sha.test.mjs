import test from 'node:test';
import assert from 'node:assert/strict';
import { githubApi, validateReleaseSha, validateWorkflowContext, verifyActivationEnvironment, verifyGitHubRelease, verifyRelease, verifyManualDispatch, verifyUnchangedManualDispatch } from './verify-release-sha.mjs';

const sha = 'a'.repeat(40);
const mainSha = 'b'.repeat(40);
const prefix = '/repos/fabelpad/platform';
const stepNames = [
  'Controleer toolchain, bytes en inodes',
  'Installeer webdependencies uit lockfile',
  'Webtypen, domeincontracten en Next.js-productiebuild',
  'Installeer native dependencies uit lockfile',
  'Native TypeScript en Metro-export',
];
function fixture(change = () => {}) {
  const run = {
    id: 101, run_number: 4, run_attempt: 2, workflow_id: 77,
    path: '.github/workflows/verify.yml', event: 'push', head_sha: sha,
    head_branch: 'main', repository: { full_name: 'fabelpad/platform' },
    head_repository: { full_name: 'fabelpad/platform' }, pull_requests: [],
    status: 'completed', conclusion: 'success',
  };
  const job = {
    id: 201, run_id: run.id, run_attempt: run.run_attempt, head_sha: sha,
    name: 'verify', status: 'completed', conclusion: 'success',
    steps: stepNames.map(name => ({ name, status: 'completed', conclusion: 'success' })),
  };
  const f = {
    run, job, runs: [run], jobs: [job], main: { name: 'main', commit: { sha: mainSha } },
    workflow: { id: 77, path: '.github/workflows/verify.yml', state: 'active' },
    comparison: { status: 'ahead', merge_base_commit: { sha } },
    remote: 'https://github.com/fabelpad/platform.git', objectType: 'commit', ancestor: true,
    calls: [], details: 0,
  };
  const nativeRun = { ...structuredClone(run), id: 301, workflow_id: 88, path: '.github/workflows/fabelpad-android-ci.yml' };
  const nativeJob = { ...structuredClone(job), id: 401, run_id: 301, name: 'Native Android-controles',
    steps: ['Test Play-planning en exacte CI-vrijgave zonder credentials', 'Controleer TypeScript en native gedrag', 'Bouw de native release zonder uploadsleutel'].map(name => ({name, status:'completed', conclusion:'success'})) };
  f.native = { run: nativeRun, job: nativeJob, runs: [nativeRun], jobs: [nativeJob,
    {id:402,name:'Productie-AAB signeren en eventueel intern uploaden',status:'completed',conclusion:'skipped'}],
    workflow: {id:88,path:'.github/workflows/fabelpad-android-ci.yml',state:'active'} };
  change(f);
  f.git = args => {
    if (args[0] === 'remote') return f.remote;
    if (args[0] === 'cat-file') return f.objectType;
    if (args[0] === 'rev-parse') return mainSha;
    if (args[0] === 'merge-base') {
      assert.deepEqual(args, ['merge-base', '--is-ancestor', sha, 'refs/remotes/origin/main']);
      if (!f.ancestor) throw new Error('not ancestor');
      return '';
    }
    throw new Error('Unexpected git command');
  };
  f.api = async path => {
    f.calls.push(path);
    if (path === `${prefix}/branches/main`) return structuredClone(f.main);
    if (path === `${prefix}/compare/${sha}...${mainSha}`) return structuredClone(f.comparison);
    if (path === `${prefix}/actions/workflows/fabelpad-android-ci.yml`) return structuredClone(f.native.workflow);
    if (path.startsWith(`${prefix}/actions/workflows/fabelpad-android-ci.yml/runs?`)) return {total_count:f.native.runs.length,workflow_runs:structuredClone(f.native.runs)};
    if (path === `${prefix}/actions/runs/301`) return structuredClone(f.native.run);
    if (path.startsWith(`${prefix}/actions/runs/301/attempts/2/jobs?`)) return {total_count:f.native.jobs.length,jobs:structuredClone(f.native.jobs)};
    if (path === `${prefix}/actions/workflows/verify.yml`) return structuredClone(f.workflow);
    if (path.startsWith(`${prefix}/actions/workflows/verify.yml/runs?`)) {
      assert.ok(path.includes(`head_sha=${sha}`));
      assert.ok(path.includes('event=push'));
      assert.ok(path.includes('branch=main'));
      assert.ok(!path.includes('status='), 'Failed or pending latest CI must remain visible');
      return { total_count: f.runs.length, workflow_runs: structuredClone(f.runs) };
    }
    if (path === `${prefix}/actions/runs/${f.run.id}`) {
      f.details++;
      return structuredClone(f.detailOverride?.(f.details) ?? f.run);
    }
    if (path.startsWith(`${prefix}/actions/runs/${f.run.id}/attempts/${f.run.run_attempt}/jobs?`)) return { total_count: f.jobs.length, jobs: structuredClone(f.jobs) };
    throw new Error(`Unexpected API path: ${path}`);
  };
  return f;
}
async function verify(f) { return verifyRelease({ sha, api: f.api, git: f.git }); }

test('accepts exact main SHA with latest successful push run and current attempt job', async () => {
  const f = fixture();
  assert.deepEqual(await verify(f), { repository: 'fabelpad/platform', branch: 'main', sha, ciWorkflowId: 77, ciRunId: 101, ciRunAttempt: 2, ciJobId: 201, ciChecks: [{workflow:'verify.yml',workflowId:77,runId:101,runAttempt:2,jobId:201},{workflow:'fabelpad-android-ci.yml',workflowId:88,runId:301,runAttempt:2,jobId:401}] });
  assert.equal(f.calls.filter(path => path.endsWith('/branches/main')).length, 2);
  assert.equal(f.details, 2);
});

test('requires exact lowercase full SHA and validates before git/API', async () => {
  for (const value of [undefined, '', 'abc', 'A'.repeat(40), `${sha}\n`, `${sha};touch /tmp/example`, `refs/heads/main`]) {
    assert.throws(() => validateReleaseSha(value));
    await assert.rejects(() => verifyRelease({ sha: value, api: () => assert.fail('no API'), git: () => assert.fail('no git') }));
  }
});

for (const [name, change] of [
  ['another origin', f => { f.remote = 'https://github.com/example/platform.git'; }],
  ['a tag or blob SHA', f => { f.objectType = 'tag'; }],
  ['commit outside main', f => { f.ancestor = false; }],
  ['stale origin/main', f => { f.main.commit.sha = 'c'.repeat(40); }],
  ['GitHub divergent commit', f => { f.comparison.status = 'diverged'; }],
  ['GitHub commit with another merge base', f => { f.comparison.merge_base_commit.sha = mainSha; }],
  ['missing workflow', f => { f.workflow.state = 'disabled_manually'; }],
  ['missing CI', f => { f.runs = []; }],
  ['pull request CI', f => { f.run.event = 'pull_request'; }],
  ['manual CI instead of push', f => { f.run.event = 'workflow_dispatch'; }],
  ['wrong SHA', f => { f.run.head_sha = 'd'.repeat(40); }],
  ['wrong workflow', f => { f.run.workflow_id = 78; }],
  ['wrong head repository', f => { f.run.head_repository.full_name = 'outsider/platform'; }],
  ['PR-linked run', f => { f.run.pull_requests = [{ number: 8 }]; }],
  ['missing verify job', f => { f.jobs = []; }],
  ['duplicate verify jobs', f => { f.jobs.push(structuredClone(f.job)); }],
  ['wrong job name', f => { f.job.name = 'verify (old)'; }],
  ['previous attempt job', f => { f.job.run_attempt = 1; }],
  ['job on another SHA', f => { f.job.head_sha = mainSha; }],
  ['missing build step', f => { f.job.steps.splice(2, 1); }],
  ['skipped build step', f => { f.job.steps[2].conclusion = 'skipped'; }],
  ['duplicate required step', f => { f.job.steps.push(structuredClone(f.job.steps[2])); }],
]) {
  test(`rejects ${name}`, async () => { await assert.rejects(() => verify(fixture(change))); });
}

for (const conclusion of ['skipped', 'cancelled', 'failure', 'neutral', 'timed_out', 'action_required', null]) {
  test(`rejects run and job conclusion ${conclusion}`, async () => {
    await assert.rejects(() => verify(fixture(f => { f.run.conclusion = conclusion; })));
    await assert.rejects(() => verify(fixture(f => { f.job.conclusion = conclusion; })));
  });
}
for (const status of ['queued', 'in_progress', 'waiting', 'pending', 'requested']) {
  test(`rejects run and job status ${status}`, async () => {
    await assert.rejects(() => verify(fixture(f => { f.run.status = status; })));
    await assert.rejects(() => verify(fixture(f => { f.job.status = status; })));
  });
}

test('older green run cannot mask a newer failed run', async () => {
  const f = fixture(f => {
    f.runs = [structuredClone(f.run), { ...structuredClone(f.run), id: 102, run_number: 5, conclusion: 'failure' }];
    f.run = f.runs[1];
  });
  await assert.rejects(() => verify(f), /niet volledig geslaagd/);
});
test('rejects a rerun that starts while checking the jobs', async () => {
  const f = fixture(f => { f.detailOverride = calls => calls > 1 ? { ...f.run, run_attempt: 3, status: 'in_progress', conclusion: null } : f.run; });
  await assert.rejects(() => verify(f), /gewijzigd/);
});
test('rejects a latest list attempt disagreeing with its detail', async () => {
  const f = fixture(f => { f.runs = [{ ...f.run, run_attempt: 1 }]; });
  await assert.rejects(() => verify(f), /poging veranderde/);
});
test('rejects duplicate run numbers rather than picking an arbitrary green run', async () => {
  await assert.rejects(() => verify(fixture(f => { f.runs.push({ ...f.run, id: 102 }); })), /Dubbelzinnige/);
});

test('workflow context excludes PR, non-main, wrong repo and other workflow files', () => {
  const env = { GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'fabelpad/platform', GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REF: 'refs/heads/main', GITHUB_WORKFLOW_REF: 'fabelpad/platform/.github/workflows/fabelpad-dg-vps-08-staging-candidate.yml@refs/heads/main' };
  assert.doesNotThrow(() => validateWorkflowContext(env));
  for (const patch of [{ GITHUB_REPOSITORY: 'other/repo' }, { GITHUB_EVENT_NAME: 'pull_request' }, { GITHUB_REF: 'refs/pull/2/merge' }, { GITHUB_WORKFLOW_REF: env.GITHUB_WORKFLOW_REF.replace('@refs/heads/main', '@refs/heads/feature') }, { GITHUB_WORKFLOW_REF: env.GITHUB_WORKFLOW_REF.replace('candidate.yml', 'other.yml') }]) assert.throws(() => validateWorkflowContext({ ...env, ...patch }));
});
test('root-owned adapter can verify GitHub ancestry and CI without running Git in runner files', async () => {
  const f = fixture();
  const result = await verifyGitHubRelease({ sha, api: f.api });
  assert.equal(result.ciRunId, 101);
  assert.ok(f.calls.some(path => path === `${prefix}/compare/${sha}...${mainSha}`));
});
test('GitHub API uses GET, bounded timeout, no redirects and never prints response/token', async () => {
  assert.throws(() => githubApi(''));
  let request;
  const api = githubApi('test-token', async (url, options) => { request = { url, options }; return { ok: false, status: 403, json: () => assert.fail('response body must not be printed') }; });
  await assert.rejects(() => api(`${prefix}/branches/main`), error => error.message.includes('403') && !error.message.includes('test-token'));
  assert.equal(request.options.method, 'GET');
  assert.equal(request.options.redirect, 'error');
  await assert.rejects(() => api('/repos/other/repo/branches/main'), /Onverwacht/);
  await assert.rejects(() => api(`${prefix}/../another`), /Onverwacht/);
  await assert.rejects(() => api(`${prefix}/%2e%2e/another`), /Onverwacht/);
  await assert.rejects(() => api(`${prefix}/compare/${sha}...${mainSha}`), /HTTP 403/, 'Comparison separator is a valid API path');
});

test('activation preflight requires an existing protected environment and exact main-only policy', async () => {
  const environment = {
    name: 'staging',
    protection_rules: [{ type: 'required_reviewers', prevent_self_review: true, reviewers: [{ type: 'User', reviewer: { login: 'release-reviewer' } }] }],
    deployment_branch_policy: { protected_branches: false, custom_branch_policies: true },
  };
  const policies = [{ name: 'main', type: 'branch' }];
  const api = async path => path.includes('/deployment-branch-policies?') ? { total_count: policies.length, branch_policies: policies } : environment;
  assert.equal((await verifyActivationEnvironment(api)).environment, environment.name);
  environment.protection_rules = [];
  assert.equal((await verifyActivationEnvironment(api)).environment, environment.name, 'No mandatory extra approval is invented; existing GitHub protection remains effective.');
  for (const policy of [{ name: '*', type: 'branch' }, { name: 'main', type: 'tag' }]) {
    policies[0] = policy;
    await assert.rejects(() => verifyActivationEnvironment(api));
  }
  await assert.rejects(() => verifyActivationEnvironment(async () => { throw new Error('HTTP 404'); }), /404/);
});

for (const [name, change] of [
  ['missing native run', f => { f.native.runs = []; }],
  ['skipped native job', f => { f.native.job.conclusion = 'skipped'; }],
  ['missing native build step', f => { f.native.job.steps.pop(); }],
  ['native workflow failed', f => { f.native.run.conclusion = 'failure'; }],
  ['native PR run', f => { f.native.run.event = 'pull_request'; }],
  ['native duplicate required job', f => { f.native.jobs.push(structuredClone(f.native.job)); }],
]) test(`both main-push gates: rejects ${name}`, async () => { await assert.rejects(() => verify(fixture(change))); });

test('optional signed native job may be skipped while the mandatory native release compile passed', async () => {
  assert.equal((await verify(fixture())).ciChecks.length,2);
});

function manualFixture(change=()=>{}) {
  const workflow={id:9,path:'.github/workflows/fabelpad-dg-vps-08-staging-candidate.yml',state:'active'};
  const run={id:501,run_attempt:2,workflow_id:9,path:workflow.path,event:'workflow_dispatch',head_branch:'main',head_sha:sha,
    repository:{full_name:'fabelpad/platform'},head_repository:{full_name:'fabelpad/platform'},status:'in_progress',conclusion:null};
  const preflight={id:601,run_id:501,run_attempt:2,head_sha:sha,name:'preflight',status:'completed',conclusion:'success',steps:[{status:'completed',conclusion:'success'}]};
  const job={id:602,run_id:501,run_attempt:2,head_sha:sha,name:'candidate',status:'in_progress',conclusion:null,runner_name:'fabelpad-vps08-staging',labels:['self-hosted','Linux','X64','dg-vps-08','fabelpad-vps08-staging']};
  const f={workflow,run,preflight,job,comparison:{status:'ahead',merge_base_commit:{sha}}};change(f);
  f.api=async path=>{
    if(path===`${prefix}/actions/workflows/fabelpad-dg-vps-08-staging-candidate.yml`)return f.workflow;
    if(path===`${prefix}/actions/runs/501`)return f.run;
    if(path===`${prefix}/branches/main`)return {commit:{sha:mainSha}};
    if(path===`${prefix}/compare/${sha}...${mainSha}`)return f.comparison;
    if(path.startsWith(`${prefix}/actions/runs/501/attempts/2/jobs?`))return {total_count:2,jobs:[f.preflight,f.job]};
    throw Error('Unexpected manual API path');
  };
  return f;
}
test('root dispatch binds an active own manual main workflow, current attempt, successful preflight and own live runner job',async()=>{
  const f=manualFixture();assert.deepEqual(await verifyManualDispatch({api:f.api,operation:'build',runId:'501',runAttempt:'2'}),
    {runId:'501',runAttempt:'2',workflowSha:sha,jobId:602,workflow:'fabelpad-dg-vps-08-staging-candidate.yml'});
});
for(const [name,change] of [
  ['PR run',f=>{f.run.event='pull_request';}],['wrong branch',f=>{f.run.head_branch='feature';}],
  ['wrong workflow',f=>{f.run.path='.github/workflows/other.yml';}],['old attempt',f=>{f.run.run_attempt=1;}],
  ['cancelled run',f=>{f.run.status='completed';f.run.conclusion='cancelled';}],
  ['skipped preflight',f=>{f.preflight.conclusion='skipped';}],['preflight wrong source',f=>{f.preflight.head_sha=mainSha;}],
  ['unapproved waiting job',f=>{f.job.status='waiting';}],['other runner',f=>{f.job.runner_name='another';}],
  ['other labels',f=>{f.job.labels=['self-hosted'];}],['wrong job',f=>{f.job.name='another';}],
  ['workflow code outside main',f=>{f.comparison.status='diverged';}],
])test(`root dispatch rejects ${name}`,async()=>{
  const f=manualFixture(change);await assert.rejects(()=>verifyManualDispatch({api:f.api,operation:'build',runId:'501',runAttempt:'2'}));
});

test('a manual run cancelled during lengthy release checks cannot reach a host switch',async()=>{
  const f=manualFixture();const proof=await verifyManualDispatch({api:f.api,operation:'build',runId:'501',runAttempt:'2'});
  f.run.status='completed';f.run.conclusion='cancelled';
  await assert.rejects(()=>verifyUnchangedManualDispatch({api:f.api,operation:'build',proof}));
});
test('an otherwise active replacement job cannot reuse the earlier dispatch proof',async()=>{
  const f=manualFixture();const proof=await verifyManualDispatch({api:f.api,operation:'build',runId:'501',runAttempt:'2'});
  f.job.id=603;
  await assert.rejects(()=>verifyUnchangedManualDispatch({api:f.api,operation:'build',proof}),/veranderde/);
});


test('existing staging and production environments without extra rules are accepted without changing them', async () => {
  for (const name of ['staging','production']) {
    const calls = [];
    const result = await verifyActivationEnvironment(async path => {calls.push(path);return {name,protection_rules:[],deployment_branch_policy:null};},name);
    assert.equal(result.environment,name);
    assert.deepEqual(calls,[`${prefix}/environments/${name}`]);
  }
  await assert.rejects(() => verifyActivationEnvironment(async () => ({}),'other'));
});

test('production dispatch cannot use staging workflow or runner credentials', async () => {
  const f = manualFixture();
  await assert.rejects(() => verifyManualDispatch({api:f.api,operation:'build',runId:'501',runAttempt:'2',environment:'production'}));
  f.workflow.path = f.workflow.path.replace('staging','production');
  f.run.path = f.workflow.path;
  const productionApi = async request => f.api(request.replace('fabelpad-dg-vps-08-production-candidate.yml','fabelpad-dg-vps-08-staging-candidate.yml'));
  await assert.rejects(() => verifyManualDispatch({api:productionApi,operation:'build',runId:'501',runAttempt:'2',environment:'production'}));
  f.job.runner_name = 'fabelpad-vps08-production';
  f.job.labels = f.job.labels.map(label => label.replace('staging','production'));
  assert.equal((await verifyManualDispatch({api:productionApi,operation:'build',runId:'501',runAttempt:'2',environment:'production'})).workflow,'fabelpad-dg-vps-08-production-candidate.yml');
});
