// Bundle/deploy this entry point with the canonical lib/email modules. No
// duplicate template source lives in the Edge Function.
import { createAuthEmailHandler } from '../../../lib/email/auth-hook.ts';
import { createSupabaseEmailBackend } from '../../../lib/email/supabase-backend.ts';
import { validateHostedEmailTarget } from '../../../lib/email/hosted-target.ts';

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};
const publicNames = ['SUPABASE_URL', 'FABELPAD_APP_ORIGIN', 'FABELPAD_ENVIRONMENT'];
const identity = Object.fromEntries(publicNames.map(name => [name, Deno.env.get(name)]));
let handler: (request: Request) => Promise<Response>;
try {
  if (!validateHostedEmailTarget(identity)) throw new Error('Email target unavailable.');
  const privateNames = ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY', 'RESEND_API_KEY', 'SEND_EMAIL_HOOK_SECRET', 'FABELPAD_EMAIL_FROM', 'FABELPAD_EMAIL_REPLY_TO'];
  const environment = { ...identity, ...Object.fromEntries(privateNames.map(name => [name, Deno.env.get(name)])) };
  const backend = createSupabaseEmailBackend(environment);
  handler = createAuthEmailHandler(environment, { loadDeliveryConfiguration: signal => backend.rpc('get_email_delivery_config', {}, undefined, signal) });
} catch {
  handler = async () => Response.json({ error: { http_code: 503, message: 'Email delivery could not be completed.' } }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
}
Deno.serve(handler);
