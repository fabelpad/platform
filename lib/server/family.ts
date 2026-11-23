import { MAX_FAMILY_BYTES, validPutBody, validateFamilyProfileChanges, validateFamilySnapshot } from '../familyValidation';
import { createSupabaseRequestClient, getVerifiedParent } from '../supabase/server';
import { checkMutationOrigin, handleApiError, privateJson, readJson, RequestError } from './http';
import { parentRpcError, requireActiveParentAccount } from './parent';

export async function handleSupabaseFamilyRequest(request: Request): Promise<Response> {
  try {
    const client = await createSupabaseRequestClient(request);
    const parent = await getVerifiedParent(client);
    if (!parent) throw new RequestError(401, 'not_authenticated', 'Log opnieuw in om jouw gezin op te halen.');
    await requireActiveParentAccount(client);
    if (!['GET', 'PUT'].includes(request.method)) return privateJson({ error: 'method_not_allowed' }, 405, { Allow: 'GET, PUT' });
    const expected = request.headers.get('x-fabelpad-parent');
    if ((request.method === 'PUT' && !expected) || (expected && expected !== parent.id)) throw new RequestError(401, 'account_changed', 'Het ouderaccount is gewijzigd. Log opnieuw in voordat je verdergaat.');
    if (request.method === 'GET') {
      const { data, error } = await client.from('family_documents').select('snapshot,revision').eq('parent_id', parent.id).maybeSingle();
      if (error) throw error;
      if (!data) return privateJson({ parent, revision: 0, snapshot: null });
      const checked = validateFamilySnapshot(data.snapshot);
      if (!checked.ok || !Number.isSafeInteger(data.revision) || data.revision < 1) throw new Error('Invalid stored family');
      return privateJson({ parent, revision: data.revision, snapshot: checked.snapshot });
    }
    checkMutationOrigin(request);
    const body = await readJson(request, MAX_FAMILY_BYTES);
    if (!validPutBody(body)) throw new RequestError(422, 'invalid_request', 'Het opslagverzoek is ongeldig.');
    const checked = validateFamilySnapshot(body.snapshot);
    if (!checked.ok) throw new RequestError(422, 'invalid_snapshot', checked.reason);
    // Only this authenticated parent's stored IDs establish legacy status.
    // The RPC repeats the comparison while holding the existing write lock.
    const { data: stored, error: storedError } = await client.from('family_documents').select('snapshot,revision').eq('parent_id', parent.id).maybeSingle();
    if (storedError) throw storedError;
    const previous = stored ? validateFamilySnapshot(stored.snapshot) : null;
    if (previous && !previous.ok) throw new Error('Invalid stored family');
    const changes = validateFamilyProfileChanges(checked.snapshot, previous?.ok ? previous.snapshot : null);
    if (!changes.ok) throw new RequestError(422, 'invalid_snapshot', changes.reason);
    const { data, error } = await client.rpc('save_family_snapshot', { p_base_revision: body.baseRevision, p_snapshot: checked.snapshot });
    if (error) parentRpcError(error);
    if (!data) throw new Error('Missing save outcome');
    if (!data.saved) return privateJson({ error: 'revision_conflict', revision: data.revision, snapshot: data.snapshot }, 409);
    return privateJson({ parent, revision: data.revision, snapshot: data.snapshot });
  } catch (error) { return handleApiError(error); }
}
