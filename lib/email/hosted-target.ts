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

/** Supabase supplies its own project URL to each Edge runtime. Known projects
 * can derive public target metadata without new secrets or GitHub variables.
 * Explicit metadata is never silently corrected when it addresses another site. */
export function resolveHostedEmailTarget(environment: Record<string, string | undefined>): Record<string, string | undefined> | null {
  const match = Object.entries(HOSTED_EMAIL_TARGETS).find(([, target]) => target.project === environment.SUPABASE_URL);
  if (!match) return null;
  const [stage, target] = match;
  const result = { ...environment, FABELPAD_ENVIRONMENT: environment.FABELPAD_ENVIRONMENT ?? stage, FABELPAD_APP_ORIGIN: environment.FABELPAD_APP_ORIGIN ?? target.origin };
  return validateHostedEmailTarget(result) ? result : null;
}
