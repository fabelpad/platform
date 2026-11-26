import { createBlogRuntimeHandler } from '../../../lib/blog/runtime.ts';
import { createBlogSupabaseDependencies } from '../../../lib/socialhero/supabase.ts';
declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Promise<Response>): void };
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };
const names = ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_ANON_KEY','SUPABASE_PUBLISHABLE_KEY','SB_SECRET_KEY','FABELPAD_APP_ORIGIN','FABELPAD_ENVIRONMENT'];
let handler: (request: Request) => Promise<Response>;
try {
  const dependencies = createBlogSupabaseDependencies(Object.fromEntries(names.map(name => [name, Deno.env.get(name)])));
  handler = createBlogRuntimeHandler({ ...dependencies, background: task => EdgeRuntime.waitUntil(task), log: entry => console.info(JSON.stringify({ event: 'blog_request', ...entry })) });
} catch { handler = async () => Response.json({ code: 'CONFIGURATION_REQUIRED', message: 'De blogconfiguratie is niet beschikbaar.', requestId: crypto.randomUUID() }, { status: 503, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } }); }
Deno.serve(handler);
