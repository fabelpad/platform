#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const repository = 'fabelpad/platform';
export const integrationBranch = 'main';
const workflowPath = '.github/workflows/verify.yml';
const requiredJob = 'verify';
const requiredSteps = [
  'Controleer toolchain, bytes en inodes',
  'Installeer webdependencies uit lockfile',
  'Webtypen, domeincontracten en Next.js-productiebuild',
  'Installeer native dependencies uit lockfile',
  'Native TypeScript en Metro-export',
];

function insist(condition, message) {
  if (!condition) throw new Error(message);
}

function positiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

export function validateReleaseSha(sha) {
  insist(typeof sha === 'string' && /^[0-9a-f]{40}$/.test(sha), 'Een volledige commit-SHA met 40 kleine hextekens is verplicht.');
  return sha;
}

export function validateWorkflowContext(env) {
  if (env.GITHUB_ACTIONS !== 'true') return;
  insist(env.GITHUB_REPOSITORY === repository, 'Deze releaseroute hoort uitsluitend bij fabelpad/platform.');
  insist(env.GITHUB_EVENT_NAME === 'workflow_dispatch' && env.GITHUB_REF === 'refs/heads/main', 'Alleen een handmatige releaseroute vanaf main is toegestaan.');
  const allowed = [
    `${repository}/.github/workflows/fabelpad-dg-nxttrack-01-staging-candidate.yml@refs/heads/main`,
    `${repository}/.github/workflows/fabelpad-dg-nxttrack-01-staging-activate.yml@refs/heads/main`,
  ];
  insist(allowed.includes(env.GITHUB_WORKFLOW_REF), 'De releaseroute moet het vastgelegde workflowbestand vanaf main gebruiken.');
}

export function gitRead(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000 }).trim();
  } catch {
    throw new Error('Git-verificatie geweigerd; controleer de repository, opgehaalde origin/main en SHA-afstamming.');
  }
}

export function githubApi(token, fetchRequest = fetch) {
  insist(typeof token === 'string' && token.trim().length > 0, 'GH_TOKEN met uitsluitend contents:read en actions:read is verplicht.');
  return async path => {
    insist(path.startsWith(`/repos/${repository}/`) && !path.includes('/..') && !/[\\%\x00-\x20]/.test(path), 'Onverwacht GitHub-API-pad.');
    const response = await fetchRequest(`https://api.github.com${path}`, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2026-03-10',
      },
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
    });
    insist(response.ok, `GitHub-verificatie geweigerd (HTTP ${response.status}).`);
    return response.json();
  };
}

async function collection(api, path, key) {
  const rows = [];
  let count;
  for (let page = 1; page <= 10; page++) {
    const data = await api(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
    insist(Number.isInteger(data.total_count) && data.total_count >= 0 && data.total_count <= 1000 && Array.isArray(data[key]), 'Onvolledige of te grote CI-respons; vrijgave geweigerd.');
    if (count === undefined) count = data.total_count;
    insist(data.total_count === count, 'CI veranderde tijdens verificatie; probeer opnieuw met een verse controle.');
    rows.push(...data[key]);
    insist(rows.length <= count, 'Dubbelzinnige CI-paginering.');
    if (rows.length === count) return rows;
    insist(data[key].length === 100, 'Onvolledige CI-paginering.');
  }
  throw new Error('CI-resultaten konden niet volledig worden gecontroleerd.');
}

export async function verifyActivationEnvironment(api) {
  // Referencing a missing environment in a job can create it without protection.
  // This hosted preflight must pass before that job is eligible to be scheduled.
  const path = `/repos/${repository}/environments/fabelpad-nxttrack-staging`;
  const environment = await api(path);
  insist(environment.name === 'fabelpad-nxttrack-staging', 'De afzonderlijke activatie-environment ontbreekt.');
  insist(Array.isArray(environment.protection_rules), 'Environmentbescherming ontbreekt.');
  const reviewers = environment.protection_rules.filter(rule => rule.type === 'required_reviewers');
  insist(reviewers.length === 1 && reviewers[0].prevent_self_review === true
    && Array.isArray(reviewers[0].reviewers) && reviewers[0].reviewers.length > 0,
  'De activatie-environment vereist afzonderlijke goedkeuring zonder zelfgoedkeuring.');
  insist(environment.deployment_branch_policy?.protected_branches === false
    && environment.deployment_branch_policy?.custom_branch_policies === true,
  'De activatie-environment moet alleen de expliciete main-branch toestaan.');
  const policies = await collection(api, `${path}/deployment-branch-policies`, 'branch_policies');
  insist(policies.length === 1 && policies[0].name === 'main' && policies[0].type === 'branch',
    'De activatie-environment mag uitsluitend de exacte branch main toestaan.');
  return { environment: environment.name, reviewersRequired: true, branch: 'main' };
}

function checkRun(run, sha, workflowId) {
  insist(positiveInteger(run.id) && positiveInteger(run.run_number) && positiveInteger(run.run_attempt), 'CI-runidentiteit ontbreekt.');
  insist(run.workflow_id === workflowId && run.path === workflowPath, 'CI hoort niet bij de vereiste verify.yml.');
  insist(run.head_sha === sha && run.head_branch === integrationBranch && run.event === 'push', 'CI moet een push naar main op exact de vrijgegeven SHA controleren.');
  insist(run.repository?.full_name === repository && run.head_repository?.full_name === repository, 'CI-repository komt niet overeen.');
  insist(Array.isArray(run.pull_requests) && run.pull_requests.length === 0, 'Pull-request-CI geldt niet als releasecontrole.');
}

async function latestRun(api, sha, workflowId) {
  // Geen statusfilter: een nieuwere mislukte of lopende run mag nooit achter een
  // oudere groene run verdwijnen. Hetzelfde geldt voor de actuele run_attempt.
  const runs = await collection(api, `/repos/${repository}/actions/workflows/verify.yml/runs?branch=main&event=push&head_sha=${sha}`, 'workflow_runs');
  insist(runs.length > 0, 'De vereiste push-CI op deze SHA ontbreekt.');
  for (const run of runs) checkRun(run, sha, workflowId);
  const numbers = new Set(runs.map(run => run.run_number));
  insist(numbers.size === runs.length, 'Dubbelzinnige CI-runs; vrijgave geweigerd.');
  return runs.sort((a, b) => b.run_number - a.run_number)[0];
}

function completedSuccessfully(value, label) {
  insist(value.status === 'completed' && value.conclusion === 'success', `${label} is niet volledig geslaagd; ontbrekend, overgeslagen, lopend en mislukt tellen niet als groen.`);
}

function sameAttempt(a, b) {
  return a.id === b.id && a.run_attempt === b.run_attempt && a.status === b.status && a.conclusion === b.conclusion;
}

export async function verifyRelease({ sha, api, git = gitRead }) {
  validateReleaseSha(sha);
  const remote = git(['remote', 'get-url', 'origin']);
  insist(['https://github.com/fabelpad/platform.git', 'https://github.com/fabelpad/platform', 'git@github.com:fabelpad/platform.git'].includes(remote), 'origin moet de geverifieerde fabelpad/platform-repository zijn.');
  insist(git(['cat-file', '-t', sha]) === 'commit', 'De vrijgegeven SHA is geen lokaal opgehaalde commit.');
  const localMain = git(['rev-parse', '--verify', 'refs/remotes/origin/main']);
  validateReleaseSha(localMain);
  git(['merge-base', '--is-ancestor', sha, 'refs/remotes/origin/main']);
  return verifyGitHubRelease({ sha, api, expectedMainSha: localMain });
}

// The root-owned host adapter must never run Git in a runner-writable worktree:
// repository Git configuration can execute commands. The comparison endpoint
// provides a separate ancestry proof without touching runner-controlled files.
export async function verifyGitHubRelease({ sha, api, expectedMainSha }) {
  validateReleaseSha(sha);
  const main = await api(`/repos/${repository}/branches/main`);
  insist(main.name === integrationBranch, 'GitHub-main ontbreekt.');
  const mainSha = validateReleaseSha(main.commit?.sha);
  if (expectedMainSha !== undefined) insist(mainSha === expectedMainSha, 'origin/main is niet gelijk aan de actuele GitHub-main; haal de repository opnieuw op.');
  const comparison = await api(`/repos/${repository}/compare/${sha}...${mainSha}`);
  insist(['ahead', 'identical'].includes(comparison.status) && comparison.merge_base_commit?.sha === sha,
    'GitHub bevestigt niet dat de vrijgegeven SHA tot main behoort.');

  const workflow = await api(`/repos/${repository}/actions/workflows/verify.yml`);
  insist(positiveInteger(workflow.id) && workflow.path === workflowPath && workflow.state === 'active', 'De vastgelegde verify.yml-workflow ontbreekt of is uitgeschakeld.');
  const listed = await latestRun(api, sha, workflow.id);
  const run = await api(`/repos/${repository}/actions/runs/${listed.id}`);
  checkRun(run, sha, workflow.id);
  insist(sameAttempt(listed, run), 'De CI-poging veranderde tijdens verificatie.');
  completedSuccessfully(run, 'De nieuwste verify.yml-run');
  const jobs = await collection(api, `/repos/${repository}/actions/runs/${run.id}/attempts/${run.run_attempt}/jobs`, 'jobs');
  insist(jobs.length === 1 && jobs[0].name === requiredJob, 'De vereiste exacte verify-job ontbreekt of de CI-jobset is gewijzigd.');
  const job = jobs[0];
  insist(positiveInteger(job.id) && job.run_id === run.id && job.run_attempt === run.run_attempt && job.head_sha === sha, 'De verify-job hoort niet bij de actuele SHA/runpoging.');
  completedSuccessfully(job, 'De vereiste verify-job');
  insist(Array.isArray(job.steps) && job.steps.length > 0, 'CI-stappen ontbreken.');
  for (const name of requiredSteps) insist(job.steps.filter(step => step.name === name).length === 1, `Vereiste CI-stap ontbreekt of is dubbel: ${name}.`);
  for (const step of job.steps) completedSuccessfully(step, 'Een verify-stap');

  // Een herstart of nieuwere run gedurende de controle maakt oude groene
  // resultaten ongeldig. Voer dezelfde controle opnieuw uit vóór een hostactie.
  const finalRun = await api(`/repos/${repository}/actions/runs/${run.id}`);
  checkRun(finalRun, sha, workflow.id);
  const finalLatest = await latestRun(api, sha, workflow.id);
  insist(sameAttempt(run, finalRun) && sameAttempt(run, finalLatest), 'CI is tijdens verificatie gewijzigd; vrijgave geweigerd.');
  const finalMain = await api(`/repos/${repository}/branches/main`);
  insist(finalMain.commit?.sha === mainSha, 'main is tijdens verificatie gewijzigd; haal opnieuw op en controleer opnieuw.');
  return { repository, branch: integrationBranch, sha, ciWorkflowId: workflow.id, ciRunId: run.id, ciRunAttempt: run.run_attempt, ciJobId: job.id };
}

async function main() {
  const args = process.argv.slice(2);
  insist(args.length === 2 && args[0] === '--sha', 'Gebruik: node scripts/deploy/verify-release-sha.mjs --sha <volledige-SHA>');
  validateWorkflowContext(process.env);
  const result = await verifyRelease({ sha: args[1], api: githubApi(process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN) });
  console.log(JSON.stringify(result));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(`Vrijgave geweigerd: ${error.message}`);
    process.exitCode = 1;
  });
}
