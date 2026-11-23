import { createNarrationWorkerHandler } from '../../../lib/narration/worker-handler.ts';
import { createNarrationSupabaseBackend } from '../../../lib/narration/supabase-backend.ts';
declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Promise<Response>): void };
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };
const names = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY', 'FABELPAD_APP_ORIGIN', 'FABELPAD_ENVIRONMENT'];
const environment = Object.fromEntries(names.map(name => [name, Deno.env.get(name)]));
let handler: (request: Request) => Promise<Response>;
try {
  const worker = createNarrationWorkerHandler(environment, { backend: createNarrationSupabaseBackend(environment), background: task => EdgeRuntime.waitUntil(task) });
  // Keep the HTTP proof response within the scheduler timeout while retaining
  // the bounded task in the Edge runtime. The worker validates the HMAC before
  // any queue claim; errors produce safe state, never logs with provider data.
  handler = request => worker(request);
} catch { handler = async () => Response.json({ error: 'narration_unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
Deno.serve(handler);
