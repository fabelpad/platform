import { createNarrationAdminHandler } from '../../../lib/narration/admin-handler.ts';
import { createNarrationSupabaseBackend } from '../../../lib/narration/supabase-backend.ts';
declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Promise<Response>): void };
const names = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY', 'FABELPAD_APP_ORIGIN', 'FABELPAD_ENVIRONMENT'];
const environment = Object.fromEntries(names.map(name => [name, Deno.env.get(name)]));
let handler: (request: Request) => Promise<Response>;
try { handler = createNarrationAdminHandler(environment, { backend: createNarrationSupabaseBackend(environment) }); }
catch { handler = async () => Response.json({ error: 'narration_unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
Deno.serve(handler);
