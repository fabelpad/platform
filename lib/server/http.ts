import { BackendConfigurationError, getSupabaseConfig } from '../supabase/config';
import { AccountDeletedError } from '../supabase/errors';
export { safeNext } from '../authNavigation';

export function privateJson(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization', 'X-Content-Type-Options': 'nosniff', ...extra } });
}
export class RequestError extends Error {
  constructor(readonly status: number, readonly code: string, message = code) { super(message); }
}
export function checkMutationOrigin(request: Request): void {
  const config = getSupabaseConfig();
  if (!config) throw new BackendConfigurationError();
  const origin = request.headers.get('origin');
  if ((origin && origin !== config.appUrl) || request.headers.get('sec-fetch-site') === 'cross-site') throw new RequestError(403, 'invalid_origin', 'Dit verzoek komt niet van de eigen website.');
}
export async function readJson(request: Request, limit = 8 * 1024): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new RequestError(415, 'unsupported_media_type');
  if (Number(request.headers.get('content-length')) > limit) throw new RequestError(413, 'payload_too_large');
  if (!request.body) throw new RequestError(400, 'invalid_json');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.length; if (size > limit) { await reader.cancel(); throw new RequestError(413, 'payload_too_large'); } chunks.push(chunk.value); }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { throw new RequestError(400, 'invalid_json'); }
  } finally { reader.releaseLock(); }
}
export function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
export function handleApiError(error: unknown): Response {
  if (error instanceof AccountDeletedError) return privateJson({ error: 'account_deleted', message: error.message, ...(error.cleanupParentId ? { cleanupParentId: error.cleanupParentId } : {}) }, 410);
  if (error instanceof BackendConfigurationError) return privateJson({ error: 'backend_not_configured', message: error.message }, 503);
  if (error instanceof RequestError) return privateJson({ error: error.code, message: error.message }, error.status);
  return privateJson({ error: 'backend_unavailable', message: 'De gezinsomgeving is tijdelijk niet bereikbaar. Lokale wijzigingen blijven op dit apparaat.' }, 503);
}
