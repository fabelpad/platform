export type DeploymentTarget = 'local' | 'staging' | 'production';
export type DataMode = 'local' | 'supabase';
type Environment = Record<string, string | undefined>;
export type ProjectConfiguration = {
  target: DeploymentTarget;
  dataMode: DataMode;
  appOrigin: string | null;
  supabase: { url: string; publishableKey: string } | null;
  auth: { email: boolean; google: boolean };
  releaseSha: string | null;
};
export type ConfigurationValidation =
  | { ok: true; configuration: ProjectConfiguration; errors: [] }
  | { ok: false; errors: string[] };

/** Validate names and structure only. This never contacts Supabase or logs values. */
export function validateProjectConfiguration(
  environment: Environment,
  options: { target?: string; requireReleaseIdentity?: boolean } = {},
): ConfigurationValidation {
  const errors: string[] = [];
  const targetValue = options.target ?? environment.FABELPAD_DEPLOY_ENV ?? 'local';
  if (!['local', 'staging', 'production'].includes(targetValue)) errors.push('FABELPAD_DEPLOY_ENV: ongeldige omgeving');
  const target = targetValue as DeploymentTarget;
  const modeValue = environment.FABELPAD_DATA_MODE?.trim() || (target === 'local' ? 'local' : '');
  if (!['local', 'supabase'].includes(modeValue)) errors.push('FABELPAD_DATA_MODE: verwacht expliciet local of supabase');
  const dataMode = modeValue as DataMode;
  const publicNames = new Set(['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY']);
  for (const name of Object.keys(environment)) {
    if (name.startsWith('NEXT_PUBLIC_') && !publicNames.has(name)) errors.push(`${name}: staat niet op de publieke allowlist`);
    if (name.startsWith('EXPO_PUBLIC_') && /(SECRET|SERVICE_ROLE|PASSWORD|PRIVATE|SIGNING|KEYSTORE)/i.test(name)) {
      errors.push(`${name}: serversecret mag niet publiek zijn`);
    }
  }
  if (environment.APP_URL !== undefined) errors.push('APP_URL: vervallen naam; gebruik FABELPAD_APP_ORIGIN');

  const canonicalOrigin = (name: string, value: string | undefined): string | null => {
    if (!value?.trim()) return null;
    try {
      const parsed = new URL(value.trim());
      const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
      if (!(parsed.protocol === 'https:' || (target === 'local' && loopback && parsed.protocol === 'http:'))
        || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') throw new Error();
      return parsed.origin;
    } catch {
      errors.push(`${name}: verwacht een canonieke HTTPS-origin zonder credentials (HTTP-loopback mag alleen lokaal)`);
      return null;
    }
  };
  const appOrigin = canonicalOrigin('FABELPAD_APP_ORIGIN', environment.FABELPAD_APP_ORIGIN);
  const backendOrigin = canonicalOrigin('NEXT_PUBLIC_SUPABASE_URL', environment.NEXT_PUBLIC_SUPABASE_URL);
  const urlPresent = !!environment.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || '';
  if (publishableKey && (!/^sb_publishable_\S+$/u.test(publishableKey) || publishableKey.length <= 20)) {
    errors.push('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: verwacht sb_publishable_; serverkeys en oude JWT-keys zijn verboden');
  }
  if (dataMode === 'supabase') {
    if (!urlPresent) errors.push('NEXT_PUBLIC_SUPABASE_URL: vereist bij FABELPAD_DATA_MODE=supabase');
    if (!publishableKey) errors.push('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: vereist bij FABELPAD_DATA_MODE=supabase');
    if (!appOrigin && !environment.FABELPAD_APP_ORIGIN?.trim()) errors.push('FABELPAD_APP_ORIGIN: vereist bij FABELPAD_DATA_MODE=supabase');
  } else if (dataMode === 'local' && (urlPresent || publishableKey)) {
    errors.push('FABELPAD_DATA_MODE: local vereist lege Supabase-waarden; kies supabase om de backend expliciet te gebruiken');
  }
  if (target !== 'local' && !appOrigin && !environment.FABELPAD_APP_ORIGIN?.trim()) errors.push('FABELPAD_APP_ORIGIN: ontbreekt');

  const flag = (name: string): boolean => {
    const value = environment[name];
    if (value !== undefined && !['true', 'false'].includes(value)) errors.push(`${name}: verwacht true of false`);
    if (value === 'true' && dataMode !== 'supabase') errors.push(`${name}: vereist FABELPAD_DATA_MODE=supabase`);
    return value === 'true';
  };
  const auth = { email: flag('FABELPAD_AUTH_EMAIL_ENABLED'), google: flag('FABELPAD_AUTH_GOOGLE_ENABLED') };
  const releaseSha = environment.FABELPAD_RELEASE_SHA?.trim() || null;
  if (releaseSha && !/^[0-9a-f]{40}$/.test(releaseSha)) errors.push('FABELPAD_RELEASE_SHA: verwacht een volledige SHA van 40 kleine hextekens');
  if (options.requireReleaseIdentity && target !== 'local' && !releaseSha) errors.push('FABELPAD_RELEASE_SHA: ontbreekt; wordt door de releaseroute bepaald');
  if (errors.length) return { ok: false, errors };
  return { ok: true, errors: [], configuration: {
    target, dataMode, appOrigin, auth, releaseSha,
    supabase: dataMode === 'supabase' ? { url: backendOrigin!, publishableKey } : null,
  } };
}
