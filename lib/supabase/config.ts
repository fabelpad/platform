import { validateProjectConfiguration } from '../projectConfiguration';

export type SupabaseConfiguration = { url: string; publishableKey: string; appUrl: string; emailEnabled: boolean; googleEnabled: boolean };
export class BackendConfigurationError extends Error {
  constructor() { super('De gezinsomgeving is niet beschikbaar: de backendconfiguratie is niet ingericht of ongeldig.'); }
}

/** Null means an intentional local setup; invalid cloud configuration never falls back. */
export function getSupabaseConfig(): SupabaseConfiguration | null {
  const validated = validateProjectConfiguration({
    ...process.env,
    // Keep direct reads: Next.js freezes public values at build time. They must
    // stay paired with the candidate's build configuration after activation.
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  if (!validated.ok) throw new BackendConfigurationError();
  const configuration = validated.configuration;
  if (configuration.dataMode === 'local') return null;
  return {
    ...configuration.supabase!, appUrl: configuration.appOrigin!,
    emailEnabled: configuration.auth.email, googleEnabled: configuration.auth.google,
  };
}

export function getBackendStatus() {
  const config = getSupabaseConfig();
  return { configured: !!config, providers: { email: config?.emailEnabled ?? false, google: config?.googleEnabled ?? false }, ...(!config ? { message: new BackendConfigurationError().message } : {}) };
}
