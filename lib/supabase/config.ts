export type SupabaseConfiguration = { url: string; publishableKey: string; appUrl: string; emailEnabled: boolean; googleEnabled: boolean };
export class BackendConfigurationError extends Error {
  constructor() { super('De gezinsomgeving is nog niet ingericht. Je kunt de lokale demo al gebruiken.'); }
}

/** Only a public project key belongs here; privileged keys are never accepted. */
export function getSupabaseConfig(): SupabaseConfiguration | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const appUrl = process.env.APP_URL;
  if (!url || !publishableKey || !appUrl || !publishableKey.startsWith('sb_publishable_')) return null;
  try {
    const backend = new URL(url), application = new URL(appUrl);
    const local = (value: URL) => ['localhost', '127.0.0.1', '[::1]'].includes(value.hostname);
    if (backend.username || backend.password || application.username || application.password || backend.search || backend.hash || application.search || application.hash) return null;
    if ((backend.protocol !== 'https:' && !(backend.protocol === 'http:' && local(backend))) || (application.protocol !== 'https:' && !(application.protocol === 'http:' && local(application)))) return null;
    if (backend.pathname !== '/' || application.pathname !== '/') return null;
    return { url: backend.origin, publishableKey, appUrl: application.origin, emailEnabled: process.env.FABELPAD_AUTH_EMAIL_ENABLED === 'true', googleEnabled: process.env.FABELPAD_AUTH_GOOGLE_ENABLED === 'true' };
  } catch { return null; }
}

export function getBackendStatus() {
  const config = getSupabaseConfig();
  return { configured: !!config, providers: { email: config?.emailEnabled ?? false, google: config?.googleEnabled ?? false }, ...(!config ? { message: new BackendConfigurationError().message } : {}) };
}
