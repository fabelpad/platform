import type { SupabaseClient } from '@supabase/supabase-js';
import type { ParentAccountStatus } from '../parentAccount';
import { createSupabaseServerClient, getVerifiedParent } from '../supabase/server';
import { checkMutationOrigin, handleApiError, object, privateJson, readJson, RequestError } from './http';

const errors: Record<string, { status: number; message: string }> = {
  fresh_auth_required: { status: 428, message: 'Log opnieuw in om deze ouderactie te bevestigen.' },
  deletion_preview_expired: { status: 409, message: 'De getoonde verwijderdatum is verlopen. Controleer de nieuwe datum en bevestig opnieuw.' },
  document_version_changed: { status: 409, message: 'De juridische documenten zijn gewijzigd. Lees de actuele versie en bevestig opnieuw.' },
  account_blocked: { status: 403, message: 'Je account is afgeschermd. Bekijk de status en eventuele herstelmogelijkheid in je accountoverzicht.' },
  profile_consent_required: { status: 403, message: 'Voor dit online kinderprofiel is eerst afzonderlijke toestemming nodig.' },
  profile_consent_revoked: { status: 403, message: 'De toestemming voor dit kinderprofiel is ingetrokken. Oude gegevens worden niet opnieuw geüpload.' },
};
function deadlineMinute(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 40 && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00(?:\.0{1,6})?(?:Z|\+00:00)$/u.test(value) && Number.isFinite(Date.parse(value));
}
export function parentRpcError(error: { code?: string; message?: string }): never {
  const known = error.message && errors[error.message];
  if (known) throw new RequestError(known.status, error.message!, known.message);
  if (error.code === '28000') throw new RequestError(428, 'fresh_auth_required', errors.fresh_auth_required.message);
  if (error.code === '42501') throw new RequestError(403, 'account_inactive', 'Dit account heeft geen toegang tot de gezinsfuncties. Bekijk je accountoverzicht.');
  if (error.code === '22023') throw new RequestError(422, 'invalid_request', 'Controleer de gegevens en bevestigingen voor deze ouderactie.');
  throw new Error('Parent account unavailable');
}

export async function getParentAccountStatus(client: SupabaseClient): Promise<ParentAccountStatus> {
  const { data, error } = await client.rpc('get_account_lifecycle');
  if (error) parentRpcError(error);
  if (!object(data) || !['onboarding', 'active', 'deletion_pending', 'deleting'].includes(String(data.state)) || !Array.isArray(data.consents)) throw new Error('Invalid parent account status');
  return data as ParentAccountStatus;
}
export async function requireActiveParentAccount(client: SupabaseClient): Promise<ParentAccountStatus> {
  const status = await getParentAccountStatus(client);
  if (status.state !== 'active' || status.acceptedTermsVersion !== status.termsVersion) throw new RequestError(403, 'account_inactive', 'Rond je ouderaccount af of bekijk de verwijderstatus voordat je de gezinsfuncties gebruikt.');
  return status;
}

export async function parentRequest(request: Request, operation: 'status' | 'onboarding' | 'consent' | 'deletion' | 'restore' | 'activity'): Promise<Response> {
  try {
    if (request.method !== 'GET') checkMutationOrigin(request);
    const client = await createSupabaseServerClient();
    const parent = await getVerifiedParent(client);
    if (!parent) throw new RequestError(401, 'not_authenticated', 'Log in om je ouderaccount te beheren.');
    if (operation === 'status') return privateJson(await getParentAccountStatus(client));
    if (operation === 'deletion' && request.method === 'GET') {
      const { data, error } = await client.rpc('preview_account_deletion');
      if (error) parentRpcError(error);
      if (!object(data) || !deadlineMinute(data.deletionDeadlineMinute) || data.expiresAt != null && (typeof data.expiresAt !== 'string' || data.expiresAt.length > 40 || !Number.isFinite(Date.parse(data.expiresAt)))) throw new Error('Invalid deletion preview');
      return privateJson({ deletionDeadlineMinute: data.deletionDeadlineMinute, ...(data.expiresAt !== undefined ? { expiresAt: data.expiresAt } : {}) });
    }
    if (request.headers.get('x-fabelpad-parent') !== parent.id) throw new RequestError(401, 'account_changed', 'Het ouderaccount is gewijzigd. Laad je accountoverzicht opnieuw voordat je deze handeling uitvoert.');
    const input = await readJson(request);
    if (!object(input)) throw new RequestError(422, 'invalid_request');
    let name: string; let parameters: Record<string, unknown>;
    const only = (fields: string[]) => { if (Object.keys(input).some(key => !fields.includes(key))) throw new RequestError(422, 'invalid_request'); };
    switch (operation) {
      case 'onboarding':
        only(['termsVersion', 'privacyVersion', 'parentDeclaration', 'acceptTerms']);
        if (input.parentDeclaration !== true || input.acceptTerms !== true || typeof input.termsVersion !== 'string' || typeof input.privacyVersion !== 'string') throw new RequestError(422, 'declarations_required', 'Bevestig de ouderverklaring en de algemene voorwaarden afzonderlijk.');
        name = 'complete_parent_onboarding'; parameters = { p_terms_version: input.termsVersion, p_privacy_version: input.privacyVersion, p_parent_declaration: true, p_accept_terms: true }; break;
      case 'consent': {
        only(['profileId', 'consent', 'guardianDeclaration']);
        if (typeof input.profileId !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/u.test(input.profileId)) throw new RequestError(422, 'invalid_profile');
        const consent = request.method !== 'DELETE';
        if (consent && (input.consent !== true || input.guardianDeclaration !== true)) throw new RequestError(422, 'consent_required', 'Geef afzonderlijk toestemming voor dit online kinderprofiel.');
        name = 'consent_child_profile'; parameters = { p_child_id: input.profileId, p_consent: consent, p_guardian_declaration: consent }; break;
      }
      case 'deletion':
        only(['confirm', 'expectedDeadlineMinute']); if (input.confirm !== true || !deadlineMinute(input.expectedDeadlineMinute)) throw new RequestError(422, 'confirmation_required', 'Controleer eerst de exacte verwijderdatum en bevestig je aanvraag.');
        name = 'request_account_deletion'; parameters = { p_expected_deadline_minute: input.expectedDeadlineMinute }; break;
      case 'restore':
        only(['confirmRestore']); if (input.confirmRestore !== true) throw new RequestError(422, 'confirmation_required');
        name = 'restore_account'; parameters = {}; break;
      case 'activity':
        only(['eventId', 'kind', 'profileId', 'occurredAt']);
        if (typeof input.eventId !== 'string' || !/^[0-9a-f-]{36}$/iu.test(input.eventId) || !['parent_action', 'reading'].includes(String(input.kind))) throw new RequestError(422, 'invalid_activity');
        name = 'record_family_activity'; parameters = { p_event_id: input.eventId, p_kind: input.kind, p_child_id: input.profileId ?? null, p_occurred_at: input.occurredAt ?? null }; break;
    }
    const { data, error } = await client.rpc(name, parameters);
    if (error) parentRpcError(error);
    if (operation === 'deletion') {
      // The DB transaction has already blocked old JWTs and revoked sessions.
      // Clear this browser's cookies without turning a successful request into
      // a failure if Auth has already invalidated its refresh token.
      await client.auth.signOut({ scope: 'local' }).catch(() => {});
    }
    return privateJson(data ?? { ok: true });
  } catch (error) { return handleApiError(error); }
}
