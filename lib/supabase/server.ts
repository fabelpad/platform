import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { ParentIdentity } from '../parentIdentity';
import { BackendConfigurationError, getSupabaseConfig } from './config';
import { AccountDeletedError } from './errors';

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

/** Server Components can read cookies but cannot persist a refreshed session.
 * The account/session route remains responsible for writing refreshed cookies. */
export async function createSupabasePageClient() {
  const config = getSupabaseConfig();
  if (!config) throw new BackendConfigurationError();
  const store = await cookies();
  return createServerClient(config.url, config.publishableKey, {
    cookieOptions: { httpOnly: true, sameSite: 'lax', secure: new URL(config.appUrl).protocol === 'https:', path: '/' },
    cookies: { getAll: () => store.getAll(), setAll() {} },
  });
}

const requestTokens = new WeakMap<SupabaseClient, string>();
/** Native requests carry an Auth token, cookie requests use the existing SSR
 * session. A token is verified through getUser(token) before any family RPC. */
export async function createSupabaseRequestClient(request: Request): Promise<SupabaseClient> {
  const authorization = request.headers.get('authorization');
  if (authorization === null) return createSupabaseServerClient();
  const config = getSupabaseConfig();
  if (!config) throw new BackendConfigurationError();
  if (!/^Bearer [A-Za-z0-9_.-]{20,16384}$/u.test(authorization)) throw new Error('Invalid authentication');
  const token = authorization.slice(7);
  const client = createClient(config.url, config.publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  requestTokens.set(client, token);
  return client;
}

export async function getVerifiedParent(client?: SupabaseClient): Promise<ParentIdentity | null> {
  const supabase = client ?? await createSupabaseServerClient();
  // getUser contacts Auth and verifies the cookie. getSession alone is not authorization.
  const { data: { user }, error } = await supabase.auth.getUser(requestTokens.get(supabase));
  if (error) {
    if (error.code === 'user_not_found') {
      // Auth has definitively rejected the deleted identity. The cookie token's
      // sub is only a hint for deleting that browser's own cached namespace;
      // it never grants rights, supplies a user response or reaches a write RPC.
      let cleanupParentId: string | undefined;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = requestTokens.get(supabase) ?? session?.access_token;
        if (token && token.length <= 8192 && token.split('.').length === 3) {
          const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
          if (typeof claims.sub === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(claims.sub)) cleanupParentId = claims.sub;
        }
      } catch { /* Missing/expired cookies cannot supply a cleanup hint. */ }
      throw new AccountDeletedError(cleanupParentId);
    }
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
