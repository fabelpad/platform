import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseConfig } from './config';

/** Persist rotated cookies before the read-only Studio render consumes them.
 * This does not grant access: the page and each API independently verify the
 * identity, current account lifecycle and content_admins membership. */
export async function refreshStudioSession(request: NextRequest): Promise<NextResponse> {
  const writes = new Map<string, { name: string; value: string; options: CookieOptions }>();
  const cacheHeaders = new Headers({
    'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0',
    Expires: '0', Pragma: 'no-cache',
  });
  const response = () => {
    const next = NextResponse.next({ request });
    for (const { name, value, options } of writes.values()) next.cookies.set(name, value, options);
    cacheHeaders.forEach((value, name) => next.headers.set(name, value));
    return next;
  };
  try {
    const configuration = getSupabaseConfig();
    if (!configuration) return response();
    const client = createServerClient(configuration.url, configuration.publishableKey, {
      cookieOptions: { httpOnly: true, sameSite: 'lax', secure: new URL(configuration.appUrl).protocol === 'https:', path: '/' },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(changes, headers) {
          for (const change of changes) {
            writes.set(change.name, change);
            if (!change.value || change.options.maxAge === 0) request.cookies.delete(change.name);
            else request.cookies.set(change.name, change.value);
          }
          for (const [name, value] of Object.entries(headers)) if (['cache-control', 'expires', 'pragma'].includes(name.toLowerCase())) cacheHeaders.set(name, value);
        },
      },
    });
    await client.auth.getUser();
  } catch {
    // Preserve pending removals/refresh writes. The page's independent check
    // fails closed on unavailable configuration or Auth, without exposing it.
  }
  return response();
}
