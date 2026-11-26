/** Safe public error fields never include upstream bodies, tokens or storage paths. */
export class BlogRuntimeError extends Error {
  readonly code: string; readonly status: number; readonly retryAfter?: number;
  constructor(code: string, status = 422, retryAfter?: number) { super(code); this.code = code; this.status = status; this.retryAfter = retryAfter; }
}
export const blogObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
export function blogOnly(value: unknown, fields: readonly string[]): asserts value is Record<string, unknown> {
  if (!blogObject(value) || Object.keys(value).some(key => !fields.includes(key))) throw new BlogRuntimeError('INVALID_REQUEST');
}
export function blogUuid(value: unknown): value is string { return typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu.test(value); }
export function blogIdentifier(value: unknown): value is string { return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/u.test(value); }
export async function blogHash(bytes: Uint8Array | string): Promise<string> {
  const input = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : new Uint8Array(bytes);
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', input))].map(value => value.toString(16).padStart(2, '0')).join('');
}
