import { PRIVACY_EXTENSION_REASONS, PRIVACY_REQUEST_KINDS } from '../privacyAdmin';
import { createSupabaseServerClient, getVerifiedParent, isContentAdmin } from '../supabase/server';
import { checkMutationOrigin, handleApiError, object, privateJson, readJson, RequestError } from './http';
import { parentRpcError, requireActiveParentAccount } from './parent';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const profile = (value: unknown) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,80}$/u.test(value);
function invalid(): never { throw new RequestError(422, 'invalid_request', 'Controleer de zaakgegevens en bevestigingen. Gebruik geen namen, mailadressen of berichtinhoud.'); }

/** Operator-only case metadata. Subject IDs select a case, never its authority:
 * the verified JWT and the database admin/session checks decide every action. */
export async function privacyAdminRequest(request: Request, id?: string): Promise<Response> {
  try {
    if (request.method !== 'GET') checkMutationOrigin(request);
    const client = await createSupabaseServerClient();
    const parent = await getVerifiedParent(client);
    if (!parent) throw new RequestError(401, 'not_authenticated', 'Log in om privacyverzoeken te beheren.');
    await requireActiveParentAccount(client);
    if (!await isContentAdmin(client, parent.id)) throw new RequestError(403, 'admin_required', 'Alleen een bevoegde beheerder kan privacyverzoeken behandelen.');
    let name: string; let parameters: Record<string, unknown>;
    if (request.method === 'GET') {
      const value = new URL(request.url).searchParams.get('offset') ?? '0';
      if (!/^(0|[1-9][0-9]{0,5})$/u.test(value) || Number(value) > 100000) invalid();
      name = 'list_privacy_requests'; parameters = { p_limit: 100, p_offset: Number(value) };
    } else {
      if (request.headers.get('x-fabelpad-parent') !== parent.id) throw new RequestError(401, 'account_changed', 'Het beheeraccount is gewijzigd. Laad het overzicht opnieuw.');
      const input = await readJson(request);
      if (!object(input)) invalid();
      const only = (fields: string[]) => { if (Object.keys(input).some(key => !fields.includes(key))) invalid(); };
      if (request.method === 'POST' && id === undefined) {
        only(['reference', 'kind', 'scope', 'parentId', 'profileId', 'receivedAt']);
        if (typeof input.reference !== 'string' || !/^[A-Za-z0-9_-]{6,80}$/u.test(input.reference) || typeof input.kind !== 'string' || !Object.hasOwn(PRIVACY_REQUEST_KINDS, input.kind) || !['parent', 'child'].includes(String(input.scope))) invalid();
        if (input.parentId != null && (typeof input.parentId !== 'string' || !UUID.test(input.parentId))) invalid();
        if (input.profileId != null && (!profile(input.profileId) || input.scope !== 'child')) invalid();
        if (input.receivedAt != null && (typeof input.receivedAt !== 'string' || input.receivedAt.length > 40 || !Number.isFinite(Date.parse(input.receivedAt)))) invalid();
        name = 'register_privacy_request'; parameters = { p_reference: input.reference, p_kind: input.kind, p_scope: input.scope, p_parent_id: input.parentId ?? null, p_child_id: input.profileId ?? null, p_received_at: input.receivedAt ?? null };
      } else if (request.method === 'PUT' && id && UUID.test(id)) {
        if (!['bind_subject', 'verify', 'extend', 'execute_erasure', 'complete', 'decline'].includes(String(input.action))) invalid();
        const action = String(input.action);
        only(['action', ...(action === 'verify' ? ['verificationMethod'] : action === 'extend' ? ['extensionReason', 'notificationConfirmed'] : action === 'bind_subject' ? ['parentId', 'profileId'] : [])]);
        parameters = { p_request_id: id, p_action: action };
        if (action === 'verify') {
          if (!['verified_parent', 'proportionate_support'].includes(String(input.verificationMethod))) invalid();
          parameters.p_verification_method = input.verificationMethod;
        }
        if (action === 'extend') {
          if (input.notificationConfirmed !== true || typeof input.extensionReason !== 'string' || !Object.values(PRIVACY_EXTENSION_REASONS).includes(input.extensionReason as typeof PRIVACY_EXTENSION_REASONS[keyof typeof PRIVACY_EXTENSION_REASONS])) invalid();
          parameters.p_extension_reason = input.extensionReason;
        }
        if (action === 'bind_subject') {
          if (typeof input.parentId !== 'string' || !UUID.test(input.parentId) || input.profileId != null && !profile(input.profileId)) invalid();
          parameters.p_parent_id = input.parentId; parameters.p_child_id = input.profileId ?? null;
        }
        name = 'manage_privacy_request';
      } else invalid();
    }
    const { data, error } = await client.rpc(name, parameters);
    if (error) parentRpcError(error);
    if (!object(data)) throw new Error('Invalid privacy case response');
    return privateJson(data);
  } catch (error) { return handleApiError(error); }
}
