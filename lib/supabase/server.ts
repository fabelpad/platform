import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { ParentIdentity } from '../parentIdentity';
import { BackendConfigurationError, getSupabaseConfig } from './config';

/** Per-request clients keep one family's cookie session out of another request. */
export async function createSupabaseServerClient() {
  const config = getSupabaseConfig();
  if (!config) throw new BackendConfigurationError();
  const store = await cookies();
  return createServerClient(config.url, config.publishableKey, {
    cookieOptions: { httpOnly: true, sameSite: 'lax', secure: new URL(config.appUrl).protocol === 'https:', path: '/' },
    cookies: {
      getAll() { return store.getAll(); },
      setAll(changes) {
        // This helper is used in route handlers, where cookie refreshes are writable.
        for (const { name, value, options } of changes) store.set(name, value, options);
      },
    },
  });
}

export async function getVerifiedParent(client?: SupabaseClient): Promise<ParentIdentity | null> {
  const supabase = client ?? await createSupabaseServerClient();
  // getUser contacts Auth and verifies the cookie. getSession alone is not authorization.
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    if (error.status && (error.status >= 500 || error.status === 429)) throw new Error('Authentication unavailable');
    if (!error.status && error.name !== 'AuthSessionMissingError') throw new Error('Authentication unavailable');
    return null;
  }
  if (!user || user.is_anonymous || !user.email) return null;
  // Names may be displayed, but user_metadata never supplies authorization.
  return { id: user.id, email: user.email, displayName: typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name.slice(0, 100) : user.email.split('@')[0] };
}

export async function isContentAdmin(client: SupabaseClient, parentId: string): Promise<boolean> {
  const { data, error } = await client.from('content_admins').select('user_id').eq('user_id', parentId).maybeSingle();
  if (error) throw new Error('Beheerrechten konden niet worden gecontroleerd.');
  return !!data;
}
