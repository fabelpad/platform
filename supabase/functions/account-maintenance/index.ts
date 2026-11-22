import { createLifecycleWorker } from '../../../lib/lifecycle/worker.ts';
import { createLifecycleSupabaseBackend } from '../../../lib/lifecycle/supabase-backend.ts';
import { resolveHostedEmailTarget } from '../../../lib/email/hosted-target.ts';
declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Promise<Response>): void };
const names = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'FABELPAD_APP_ORIGIN', 'FABELPAD_ENVIRONMENT', 'RESEND_API_KEY', 'FABELPAD_EMAIL_FROM', 'FABELPAD_EMAIL_REPLY_TO'];
const environment = resolveHostedEmailTarget(Object.fromEntries(names.map(name => [name, Deno.env.get(name)])));
let handler: (request: Request) => Promise<Response>;
try {
  if (!environment) throw new Error();
  handler = createLifecycleWorker(environment, { backend: createLifecycleSupabaseBackend(environment) });
} catch { handler = async () => Response.json({ error: 'maintenance_unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
Deno.serve(handler);
