import { BackendConfigurationError, getBackendStatus } from '../../../lib/supabase/config';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET() {
  const revision = process.env.FABELPAD_RELEASE_SHA;
  const environment = process.env.FABELPAD_DEPLOY_ENV || 'local';
  const metadata = {
    service: 'fabelpad',
    runtime: 'nextjs-node',
    environment: ['local', 'staging', 'production'].includes(environment) ? environment : 'unknown',
    revision: revision && /^[a-f0-9]{40}$/.test(revision) ? revision : null,
    scope: 'process-liveness-only',
  };
  try {
    const configured = getBackendStatus().configured;
    return Response.json({
      ok: true, ...metadata,
      backend: configured ? 'configured-unverified' : 'not-configured',
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (!(error instanceof BackendConfigurationError)) throw error;
    return Response.json({
      ok: false, ...metadata,
      backend: 'configuration-invalid',
      error: 'backend_not_configured',
    }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
