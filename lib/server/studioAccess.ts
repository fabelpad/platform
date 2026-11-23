import { getBackendStatus } from '../supabase/config';
import { createSupabasePageClient, getVerifiedParent, isContentAdmin } from '../supabase/server';
import { getParentAccountStatus } from './parent';

export type StudioPageAccess = { allowed: true } | { allowed: false; reason: 'login' | 'account' | 'role' | 'unavailable' };

/** Run on every Studio page, including direct links and client navigation.
 * The APIs independently repeat authorization for every read and mutation. */
export async function getStudioPageAccess(): Promise<StudioPageAccess> {
  try {
    // The explicit local mode has no hosted data. It retains the existing local
    // unavailable UI and isolated browser fixtures; invalid cloud config throws.
    if (!getBackendStatus().configured) return { allowed: true };
    const client = await createSupabasePageClient();
    const parent = await getVerifiedParent(client);
    if (!parent) return { allowed: false, reason: 'login' };
    const account = await getParentAccountStatus(client);
    if (account.state !== 'active' || account.acceptedTermsVersion !== account.termsVersion) return { allowed: false, reason: 'account' };
    if (!await isContentAdmin(client, parent.id)) return { allowed: false, reason: 'role' };
    return { allowed: true };
  } catch {
    return { allowed: false, reason: 'unavailable' };
  }
}
