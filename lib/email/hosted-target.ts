/** Hosting identity is pinned independently of editable email settings. A
 * staging secret/configuration can never address the production project/site.
 * Keep provider work behind this guard in both deployed Edge entrypoints.
 */
const HOSTED_EMAIL_TARGETS = {
  staging: { origin: 'https://staging.fabelpad.nl', project: 'https://tlwfpivafcokcjyjwgmq.supabase.co' },
  production: { origin: 'https://fabelpad.nl', project: 'https://aptprpkosqctwrzeetgs.supabase.co' },
} as const;
export function validateHostedEmailTarget(environment: Record<string, string | undefined>): boolean {
  const stage = environment.FABELPAD_ENVIRONMENT;
  if (stage !== 'staging' && stage !== 'production') return false;
  const expected = HOSTED_EMAIL_TARGETS[stage];
  return environment.FABELPAD_APP_ORIGIN === expected.origin && environment.SUPABASE_URL === expected.project;
}
