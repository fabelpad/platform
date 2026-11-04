import { createSupabaseServerClient, getVerifiedParent } from '../../../lib/supabase/server';
import { getSupabaseConfig } from '../../../lib/supabase/config';
import { safeNext } from '../../../lib/server/http';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  const config = getSupabaseConfig();
  // Never derive an external callback target from an untrusted Host header.
  if (!config) return Response.json({ error: 'backend_not_configured', message: 'Inloggen is nog niet ingericht.' }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } });
  const url = new URL(request.url), code = url.searchParams.get('code');
  let target = '/inloggen?error=auth_failed';
  if (code && code.length <= 4096) {
    try {
      const client = await createSupabaseServerClient();
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (!error && await getVerifiedParent(client)) target = safeNext(url.searchParams.get('next'));
    } catch { /* A failed or expired PKCE exchange grants no session rights. */ }
  }
  return new Response(null, { status: 303, headers: { Location: new URL(target, config.appUrl).href, 'Cache-Control': 'private, no-store', Vary: 'Cookie' } });
}
