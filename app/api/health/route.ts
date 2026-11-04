import { env } from 'cloudflare:workers';

export const dynamic = 'force-dynamic';
export async function GET() {
  const headers = { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' };
  try {
    if (!env.DB) return new Response(JSON.stringify({ ok: false, database: 'unavailable' }), { status: 503, headers });
    const result = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('parent_accounts','family_documents')").all<{ name: string }>();
    if (result.results?.length !== 2) return new Response(JSON.stringify({ ok: false, database: 'initializing' }), { status: 503, headers });
    return new Response(JSON.stringify({ ok: true, database: 'ready', schemaVersion: 1 }), { headers });
  } catch { return new Response(JSON.stringify({ ok: false, database: 'unavailable' }), { status: 503, headers }); }
}
