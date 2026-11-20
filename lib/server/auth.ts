import { createSupabaseServerClient, getVerifiedParent, isContentAdmin } from '../supabase/server';
import { BackendConfigurationError, getBackendStatus, getSupabaseConfig } from '../supabase/config';
import { checkMutationOrigin, handleApiError, object, privateJson, readJson, RequestError, safeNext } from './http';

export async function authSession() {
  try {
    const status = getBackendStatus();
    if (!status.configured) return privateJson({ ...status, parent: null, admin: false });
    const client = await createSupabaseServerClient();
    const parent = await getVerifiedParent(client);
    return privateJson({ ...status, parent, admin: parent ? await isContentAdmin(client, parent.id) : false });
  } catch (error) { return handleApiError(error); }
}
export async function authMutation(request: Request, action: 'otp' | 'verify' | 'google' | 'signout') {
  try {
    checkMutationOrigin(request);
    const config = getSupabaseConfig(); if (!config) throw new BackendConfigurationError();
    const client = await createSupabaseServerClient();
    if (action === 'signout') {
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error && error.name !== 'AuthSessionMissingError') throw error;
      return privateJson({ ok: true, next: '/inloggen' });
    }
    const body = await readJson(request);
    if (!object(body)) throw new RequestError(422, 'invalid_request');
    if (action === 'google') {
      if (!config.googleEnabled) throw new RequestError(503, 'provider_not_configured', 'Google-inloggen wordt nog ingericht. De demo is al beschikbaar.');
      const callback = new URL('/auth/callback', config.appUrl);
      callback.searchParams.set('next', safeNext(body.next));
      const { data, error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callback.href, skipBrowserRedirect: true } });
      if (error || !data.url) throw new RequestError(503, 'auth_unavailable', 'Google-inloggen is nu niet beschikbaar.');
      return privateJson({ url: data.url });
    }
    if (!config.emailEnabled) throw new RequestError(503, 'provider_not_configured', 'Inloggen per e-mail wordt nog ingericht via de mailgateway. De demo is al beschikbaar.');
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) throw new RequestError(422, 'invalid_email', 'Vul een geldig e-mailadres in.');
    if (action === 'otp') {
      const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
      if (error) throw new RequestError(error.status === 429 ? 429 : 503, error.status === 429 ? 'too_many_requests' : 'mail_unavailable', error.status === 429 ? 'Wacht even voordat je een nieuwe code aanvraagt.' : 'Er kon nog geen code worden verzonden. Probeer het later opnieuw.');
      return privateJson({ ok: true, message: 'Als dit adres is toegestaan, ontvang je een inlogcode van Supabase.' });
    }
    if (typeof body.token !== 'string' || !/^\d{6,10}$/u.test(body.token.trim())) throw new RequestError(422, 'invalid_code', 'Vul de code uit je e-mail in.');
    const { error } = await client.auth.verifyOtp({ email, token: body.token.trim(), type: 'email' });
    if (error) throw new RequestError(error.status === 429 ? 429 : 401, 'invalid_code', 'Deze code klopt niet meer. Vraag zo nodig een nieuwe code aan.');
    const parent = await getVerifiedParent(client);
    if (!parent) throw new RequestError(401, 'not_authenticated');
    return privateJson({ ok: true, parent, next: safeNext(body.next) });
  } catch (error) { return handleApiError(error); }
}
