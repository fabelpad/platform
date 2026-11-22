import { createEmailAdminHandler } from '../../../lib/email/admin-handler.ts';
import { createSupabaseEmailBackend } from '../../../lib/email/supabase-backend.ts';
import { resolveHostedEmailTarget } from '../../../lib/email/hosted-target.ts';

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};
const publicNames = ['SUPABASE_URL', 'FABELPAD_APP_ORIGIN', 'FABELPAD_ENVIRONMENT'];
const identity = resolveHostedEmailTarget(Object.fromEntries(publicNames.map(name => [name, Deno.env.get(name)])));
// verify_jwt=false only disables the legacy gateway JWT check. Mandatory
// getUser + current database admin-role verification is inside every request.
let handler: (request: Request) => Promise<Response>;
try {
  if (!identity) throw new Error('Email target unavailable.');
  const privateNames = ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY', 'RESEND_API_KEY', 'FABELPAD_EMAIL_FROM', 'FABELPAD_EMAIL_REPLY_TO'];
  const environment = { ...identity, ...Object.fromEntries(privateNames.map(name => [name, Deno.env.get(name)])) };
  handler = createEmailAdminHandler(environment, { backend: createSupabaseEmailBackend(environment) });
}
catch { handler = async () => Response.json({ error: 'email_settings_unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
Deno.serve(handler);
