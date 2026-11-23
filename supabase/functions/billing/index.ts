import { createBillingHandler } from '../../../lib/billing/edge-handler.ts';
import { createBillingBackend } from '../../../lib/billing/backend.ts';
import { createBillingCoordinator } from '../../../lib/billing/coordinator.ts';
import { resolveHostedEmailTarget } from '../../../lib/email/hosted-target.ts';
declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Promise<Response>): void };
const names = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY', 'FABELPAD_APP_ORIGIN', 'FABELPAD_ENVIRONMENT'];
const environment = resolveHostedEmailTarget(Object.fromEntries(names.map(name => [name, Deno.env.get(name)])));
let handler: (request: Request) => Promise<Response>;
try {
  if (!environment) throw new Error();
  const backend = createBillingBackend(environment);
  const tick = createBillingCoordinator(environment, { backend });
  handler = createBillingHandler(environment, { backend, tick });
} catch { handler = async () => Response.json({ error: 'billing_unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
Deno.serve(handler);
