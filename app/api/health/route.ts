import { getBackendStatus } from '../../../lib/supabase/config';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET() {
  const revision = process.env.FABELPAD_RELEASE_SHA;
  const configured = getBackendStatus().configured;
  return Response.json({
    ok: true,
    service: 'fabelpad',
    runtime: 'nextjs-node',
    environment: process.env.FABELPAD_DEPLOY_ENV || 'local',
    revision: revision && /^[a-f0-9]{40}$/.test(revision) ? revision : null,
    backend: configured ? 'configured-unverified' : 'not-configured',
    scope: 'process-liveness-only',
  }, { headers: { 'Cache-Control': 'no-store' } });
}
