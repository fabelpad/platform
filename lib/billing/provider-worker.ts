import type { BillingJob } from './types.ts';
import { MollieError } from './mollie.ts';
import { executeMollieBillingJob, type MollieServiceDependencies } from './mollie-service.ts';

/** Worker authentication belongs to the Edge entrypoint's one-use signed proof.
 * This function has no HTTP/public entrypoint and accepts only service RPCs.
 * Other providers can share the claim loop by supplying their own executor. */
export async function runBillingProviderJobs(deps: MollieServiceDependencies & {
  executeOther?: (job: BillingJob) => Promise<Record<string, unknown>>;
}, options: { limit?: number } = {}) {
  const limit = Math.max(1, Math.min(20, options.limit ?? 5));
  await deps.backend.rpc('prepare_billing_jobs');
  const jobs = await deps.backend.rpc<BillingJob[]>('claim_billing_jobs', { p_limit: limit });
  if (!Array.isArray(jobs) || jobs.length > limit) throw new Error('billing_worker_unavailable');
  let completed = 0, deferred = 0;
  for (const job of jobs) {
    try {
      const result = job.provider === 'mollie' ? await executeMollieBillingJob(job, deps) : deps.executeOther ? await deps.executeOther(job) : null;
      if (!result) { await deps.backend.rpc('fail_billing_job', { p_job_id: job.id, p_lease_token: job.leaseToken, p_error_code: 'provider_worker_unavailable', p_uncertain: false }); deferred++; continue; }
      const completion = await deps.backend.rpc<{ completed: boolean }>('complete_billing_job', { p_job_id: job.id, p_lease_token: job.leaseToken, p_result: result });
      if (!completion.completed) throw new MollieError('provider_unavailable', null, true);
      completed++;
    } catch (error) {
      // Never persist upstream text, URLs, secrets, personal details or bodies.
      const safeCode = error instanceof MollieError ? error.code : 'provider_unavailable';
      const uncertain = error instanceof MollieError ? error.uncertain || error.code === 'reconciliation_incomplete' : true;
      await deps.backend.rpc('fail_billing_job', { p_job_id: job.id, p_lease_token: job.leaseToken, p_error_code: safeCode, p_uncertain: uncertain });
      deferred++;
    }
  }
  return { completed, deferred };
}
export const runMollieBillingJobs = runBillingProviderJobs;
