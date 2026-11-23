import { createLifecycleWorker } from '../../../lib/lifecycle/worker.ts';
import { createLifecycleSupabaseBackend } from '../../../lib/lifecycle/supabase-backend.ts';
import { resolveHostedEmailTarget } from '../../../lib/email/hosted-target.ts';
import { createBillingBackend } from '../../../lib/billing/backend.ts';
import { createBillingCoordinator } from '../../../lib/billing/coordinator.ts';
declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Promise<Response>): void };
const names = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY', 'FABELPAD_APP_ORIGIN', 'FABELPAD_ENVIRONMENT', 'RESEND_API_KEY', 'FABELPAD_EMAIL_FROM', 'FABELPAD_EMAIL_REPLY_TO'];
const environment = resolveHostedEmailTarget(Object.fromEntries(names.map(name => [name, Deno.env.get(name)])));
let handler: (request: Request) => Promise<Response>;
try {
  if (!environment) throw new Error();
  let tick: () => Promise<unknown>;
  try { tick = createBillingCoordinator(environment, { backend: createBillingBackend(environment) }); }
  catch { tick = async () => { throw new Error('Billing configuration unavailable.'); }; }
  handler = createLifecycleWorker(environment, { backend: createLifecycleSupabaseBackend(environment), afterAuthorized: tick });
} catch { handler = async () => Response.json({ error: 'maintenance_unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
Deno.serve(handler);
