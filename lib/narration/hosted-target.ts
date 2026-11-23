/** The first rollout is confined to staging, independently of editable settings. */
export function narrationHostedTarget(environment: Record<string, string | undefined>): boolean {
  return environment.SUPABASE_URL === 'https://tlwfpivafcokcjyjwgmq.supabase.co'
    && (!environment.FABELPAD_APP_ORIGIN || environment.FABELPAD_APP_ORIGIN === 'https://staging.fabelpad.nl')
    && (!environment.FABELPAD_ENVIRONMENT || environment.FABELPAD_ENVIRONMENT === 'staging');
}
