import { createSupabaseServerClient, getVerifiedParent, isContentAdmin } from '../supabase/server';
import { BackendConfigurationError, getBackendStatus, getSupabaseConfig } from '../supabase/config';
import { checkMutationOrigin, handleApiError, object, privateJson, readJson, RequestError, safeNext } from './http';
import { getParentAccountStatus, parentRpcError } from './parent';
import { TERMS_VERSION, PRIVACY_VERSION } from '../legal/documents';
import type { SupabaseClient } from '@supabase/supabase-js';
import { beginParentRegistration, clearParentRegistration, completeParentRegistration, parentRegistrationChannel, storeParentRegistration, type RegistrationChannel } from './registration';

export async function finishParentAuthentication(client: SupabaseClient, requestedNext: unknown, channel?: RegistrationChannel) {
  const parent = await getVerifiedParent(client);
  if (!parent) throw new RequestError(401, 'not_authenticated');
  let lifecycle = await getParentAccountStatus(client);
  const next = safeNext(requestedNext);
  if (lifecycle.state === 'deletion_pending' || lifecycle.state === 'deleting') { await clearParentRegistration(); return { parent, lifecycle, next: '/profiel/account' }; }
  if (lifecycle.state !== 'active' || lifecycle.acceptedTermsVersion !== lifecycle.termsVersion) {
    // Only the DB can turn the pre-auth declarations into an acceptance for
    // this freshly verified identity. A cookie never grants family access.
    try { if (await completeParentRegistration(client, channel)) lifecycle = await getParentAccountStatus(client); }
    catch { return { parent, lifecycle, next: `/onboarding?next=${encodeURIComponent(next)}`, registrationRetryRequired: true }; }
  } else await clearParentRegistration();
  if (lifecycle.state !== 'active' || lifecycle.acceptedTermsVersion !== lifecycle.termsVersion) return { parent, lifecycle, next: `/onboarding?next=${encodeURIComponent(next)}` };
  // This is an explicit completed login, never a passive session refresh.
  const { error } = await client.rpc('record_family_activity', { p_event_id: crypto.randomUUID(), p_kind: 'parent_login', p_child_id: null, p_occurred_at: null });
  if (error) parentRpcError(error);
  return { parent, lifecycle, next };
}
function registrationIntent(body: Record<string, unknown>): boolean {
  if (body.intent !== undefined && body.intent !== 'login' && body.intent !== 'register') throw new RequestError(422, 'invalid_intent');
  if (body.intent !== 'register') return false;
  if (body.termsVersion !== TERMS_VERSION || body.privacyVersion !== PRIVACY_VERSION) throw new RequestError(409, 'terms_changed', 'De documenten zijn gewijzigd. Lees de actuele versie en bevestig opnieuw.');
  if (body.parentDeclaration !== true || body.acceptTerms !== true) throw new RequestError(422, 'declarations_required', 'Bevestig de ouderverklaring en de algemene voorwaarden afzonderlijk.');
  return true;
}

export async function authSession() {
  try {
    const status = getBackendStatus();
    if (!status.configured) return privateJson({ ...status, parent: null, admin: false });
    const client = await createSupabaseServerClient();
    const parent = await getVerifiedParent(client);
    const lifecycle = parent ? await getParentAccountStatus(client) : null;
    const registrationChannel = await parentRegistrationChannel();
    return privateJson({ ...status, parent, lifecycle, registration: registrationChannel ? { channel: registrationChannel } : null, admin: parent && lifecycle?.state === 'active' && lifecycle.acceptedTermsVersion === lifecycle.termsVersion ? await isContentAdmin(client, parent.id) : false });
  } catch (error) { return handleApiError(error); }
}
export async function authMutation(request: Request, action: 'otp' | 'verify' | 'confirm' | 'google' | 'signout' | 'registration') {
  try {
    checkMutationOrigin(request);
    const config = getSupabaseConfig(); if (!config) throw new BackendConfigurationError();
    const client = await createSupabaseServerClient();
    if (action === 'signout') {
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error && error.name !== 'AuthSessionMissingError') throw error;
      await clearParentRegistration();
      return privateJson({ ok: true, next: '/inloggen' });
    }
    const body = await readJson(request);
    if (!object(body)) throw new RequestError(422, 'invalid_request');
    if (action === 'registration') {
      if (Object.keys(body).length) throw new RequestError(422, 'invalid_request');
      const parent = await getVerifiedParent(client);
      if (!parent) throw new RequestError(401, 'not_authenticated');
      if (request.headers.get('x-fabelpad-parent') !== parent.id) throw new RequestError(401, 'account_changed');
      let lifecycle = await getParentAccountStatus(client);
      let completed = lifecycle.state === 'active' && lifecycle.acceptedTermsVersion === lifecycle.termsVersion;
      if (completed || ['deletion_pending', 'deleting'].includes(lifecycle.state)) await clearParentRegistration();
      else if (await completeParentRegistration(client)) { lifecycle = await getParentAccountStatus(client); completed = lifecycle.state === 'active'; }
      return privateJson({ completed, lifecycle });
    }
    if (action === 'google') {
      const resuming = body.intent === 'resume_registration';
      if (resuming && await parentRegistrationChannel() !== 'google') throw new RequestError(422, 'registration_missing', 'Je eerdere registratie is verlopen. Start opnieuw en bevestig je keuzes.');
      const registering = resuming ? false : registrationIntent(body);
      if (!config.googleEnabled) throw new RequestError(503, 'provider_not_configured', 'Google-inloggen is niet beschikbaar. Gebruik een andere beschikbare inlogmethode.');
      const proof = registering ? await beginParentRegistration(client, 'google') : null;
      const callback = new URL('/auth/callback', config.appUrl);
      callback.searchParams.set('next', safeNext(body.next));
      const { data, error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callback.href, skipBrowserRedirect: true } });
      if (error || !data.url) throw new RequestError(503, 'auth_unavailable', 'Google-inloggen is nu niet beschikbaar.');
      if (proof) await storeParentRegistration(proof);
      else if (!resuming) await clearParentRegistration();
      return privateJson({ url: data.url });
    }
    if (!config.emailEnabled) throw new RequestError(503, 'provider_not_configured', 'Inloggen per e-mail is nog niet beschikbaar. Probeer het later opnieuw.');
    if (action === 'confirm') {
      const type = body.type;
      if (!['email', 'invite', 'recovery', 'email_change'].includes(type as string)
        || typeof body.tokenHash !== 'string' || !/^[A-Za-z0-9_-]{16,512}$/u.test(body.tokenHash)) {
        throw new RequestError(422, 'invalid_confirmation', 'Deze bevestigingslink is niet geldig.');
      }
      const { data, error } = await client.auth.verifyOtp({ token_hash: body.tokenHash, type: type as 'email' | 'invite' | 'recovery' | 'email_change' });
      if (error) throw new RequestError(error.status === 429 ? 429 : 401, 'invalid_confirmation', 'Deze bevestigingslink is verlopen of al gebruikt. Vraag zo nodig een nieuwe inlogcode aan.');
      // Secure email changes may need both the old and new address confirmed.
      // Their first confirmation can succeed without issuing a session.
      if (type === 'email_change' && !data.session) return privateJson({ ok: true, next: '/inloggen', message: 'Dit e-mailadres is bevestigd. Als je ook een bevestiging op je andere e-mailadres hebt ontvangen, bevestig die dan ook. Log daarna opnieuw in.' });
      return privateJson({ ok: true, ...await finishParentAuthentication(client, body.next, 'otp') });
    }
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) throw new RequestError(422, 'invalid_email', 'Vul een geldig e-mailadres in.');
    if (action === 'otp') {
      const resuming = body.intent === 'resume_registration';
      if (resuming && await parentRegistrationChannel() !== 'otp') throw new RequestError(422, 'registration_missing', 'Je eerdere registratie is verlopen. Start opnieuw en bevestig je keuzes.');
      const shouldCreateUser = resuming ? false : registrationIntent(body);
      const proof = shouldCreateUser ? await beginParentRegistration(client, 'otp', email) : null;
      const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser, emailRedirectTo: new URL('/inloggen', config.appUrl).href } });
      if (error) throw new RequestError(error.status === 429 ? 429 : 503, error.status === 429 ? 'too_many_requests' : 'mail_unavailable', error.status === 429 ? 'Wacht even voordat je een nieuwe code aanvraagt.' : 'Er kon nog geen code worden verzonden. Probeer het later opnieuw.');
      if (proof) await storeParentRegistration(proof);
      else if (!resuming) await clearParentRegistration();
      return privateJson({ ok: true, message: 'Als dit adres is toegestaan, ontvang je een Fabelpad-inlogcode. Vul de code uit je e-mail in.' });
    }
    if (typeof body.token !== 'string' || !/^\d{6}$/u.test(body.token.trim())) throw new RequestError(422, 'invalid_code', 'Vul de zescijferige code uit je e-mail in.');
    const { error } = await client.auth.verifyOtp({ email, token: body.token.trim(), type: 'email' });
    if (error) throw new RequestError(error.status === 429 ? 429 : 401, 'invalid_code', 'Deze code klopt niet meer. Vraag zo nodig een nieuwe code aan.');
    return privateJson({ ok: true, ...await finishParentAuthentication(client, body.next, 'otp') });
  } catch (error) { return handleApiError(error); }
}
