import { MAX_FAMILY_BYTES, validPutBody, validateFamilySnapshot } from '../../lib/familyValidation';
import type { FamilySnapshot } from '../../lib/familyValidation';

export type ParentIdentity = { id: string; email: string; displayName: string };
type FamilyRow = { document: string; revision: number };
export type StoredFamily = { revision: number; snapshot: FamilySnapshot | null };
type Statement = {
  bind(...values: unknown[]): Statement;
  first<T>(): Promise<T | null>;
  run(): Promise<{ success: boolean; meta?: { changes?: number } }>;
};
export type FamilyDatabase = { prepare(query: string): Statement };

export async function readFamily(database: FamilyDatabase, parentId: string): Promise<StoredFamily> {
  const row = await database.prepare('SELECT document, revision FROM family_documents WHERE parent_id = ?').bind(parentId).first<FamilyRow>();
  if (!row) return { revision: 0, snapshot: null };
  const checked = validateFamilySnapshot(JSON.parse(row.document));
  if (!checked.ok || !Number.isSafeInteger(row.revision) || row.revision < 1) throw new Error('Stored family document is invalid.');
  return { revision: row.revision, snapshot: checked.snapshot };
}

export async function saveFamilyDocument(database: FamilyDatabase, parent: ParentIdentity, baseRevision: number, snapshot: FamilySnapshot, now = new Date().toISOString()): Promise<{ saved: boolean } & StoredFamily> {
  await database.prepare('INSERT INTO parent_accounts (id, email, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET email = excluded.email, display_name = excluded.display_name, updated_at = excluded.updated_at')
    .bind(parent.id, parent.email, parent.displayName, now, now).run();
  const document = JSON.stringify(snapshot);
  const result = baseRevision === 0
    ? await database.prepare('INSERT INTO family_documents (parent_id, document, revision, updated_at) VALUES (?, ?, 1, ?) ON CONFLICT(parent_id) DO NOTHING').bind(parent.id, document, now).run()
    : await database.prepare('UPDATE family_documents SET document = ?, revision = revision + 1, updated_at = ? WHERE parent_id = ? AND revision = ?').bind(document, now, parent.id, baseRevision).run();
  if (!result.success) throw new Error('Database rejected family save.');
  if (result.meta?.changes === 1) return { saved: true, revision: baseRevision + 1, snapshot };
  return { saved: false, ...await readFamily(database, parent.id) };
}

const RESPONSE_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'private, no-store',
  'Vary': 'Cookie, OAI-Authenticated-User-Id',
  'X-Content-Type-Options': 'nosniff',
};
function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...RESPONSE_HEADERS, ...extraHeaders } });
}
class BodyError extends Error { constructor(readonly status: number, readonly code: string) { super(code); } }
async function boundedBody(request: Request): Promise<string> {
  const length = request.headers.get('content-length');
  if (length !== null && Number(length) > MAX_FAMILY_BYTES) throw new BodyError(413, 'payload_too_large');
  if (!request.body) throw new BodyError(400, 'invalid_json');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_FAMILY_BYTES) { await reader.cancel(); throw new BodyError(413, 'payload_too_large'); }
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw new BodyError(400, 'invalid_json'); }
  } finally { reader.releaseLock(); }
}

export type FamilyRequestDependencies = {
  getParent: () => Promise<ParentIdentity | null>;
  getDatabase: () => FamilyDatabase;
  now?: () => string;
};

/** Pure request boundary; production supplies trusted dispatch identity and its D1 binding. */
export async function handleFamilyRequest(request: Request, dependencies: FamilyRequestDependencies): Promise<Response> {
  try {
    const parent = await dependencies.getParent();
    if (!parent) return json({ error: 'not_authenticated', message: 'Log opnieuw in om jouw gezin op te halen.' }, 401);
    if (request.method !== 'GET' && request.method !== 'PUT') return json({ error: 'method_not_allowed' }, 405, { Allow: 'GET, PUT' });
    const expectedParent = request.headers.get('x-fabelpad-parent');
    if ((request.method === 'PUT' && !expectedParent) || (expectedParent && expectedParent !== parent.id)) {
      return json({ error: 'account_changed', message: 'Het ouderaccount is gewijzigd. Log opnieuw in voordat je verdergaat.' }, 401);
    }
    if (request.method === 'GET') return json({ parent, ...await readFamily(dependencies.getDatabase(), parent.id) });

    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return json({ error: 'invalid_origin' }, 403);
    if (request.headers.get('sec-fetch-site') === 'cross-site') return json({ error: 'invalid_origin' }, 403);
    const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
    if (contentType !== 'application/json') return json({ error: 'unsupported_media_type' }, 415);
    let body: unknown;
    try { body = JSON.parse(await boundedBody(request)); }
    catch (error) { return error instanceof BodyError ? json({ error: error.code }, error.status) : json({ error: 'invalid_json' }, 400); }
    if (!validPutBody(body)) return json({ error: 'invalid_request', message: 'Het opslagverzoek is ongeldig.' }, 422);
    const checked = validateFamilySnapshot(body.snapshot);
    if (!checked.ok) return json({ error: 'invalid_snapshot', message: checked.reason }, 422);
    const outcome = await saveFamilyDocument(dependencies.getDatabase(), parent, body.baseRevision, checked.snapshot, dependencies.now?.());
    if (!outcome.saved) return json({ error: 'revision_conflict', revision: outcome.revision, snapshot: outcome.snapshot }, 409);
    return json({ parent, revision: outcome.revision, snapshot: outcome.snapshot });
  } catch {
    return json({ error: 'storage_unavailable', message: 'Opslaan is tijdelijk niet mogelijk. Jouw wijzigingen blijven op dit apparaat bewaard.' }, 503);
  }
}
