import type { AdminOperation } from '../useAdminIdentity';

export class BlogRequestError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string, readonly fields?: Record<string, string>) { super(message); }
}

/** Credentials stay in HttpOnly cookies; every request also names its captured actor. */
export async function blogAdminRequest<T>(operation: AdminOperation, url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('X-Fabelpad-Parent', operation.parentId);
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const response = await fetch(url, { ...options, headers, cache: 'no-store' });
  const value = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const message = response.status === 409 ? value?.message || 'Een andere beheerder heeft dit artikel gewijzigd. Je eigen wijzigingen blijven hier staan. Haal de opgeslagen versie op om verder te gaan.' : value?.message || 'Deze handeling kon niet worden uitgevoerd. Probeer het opnieuw.';
    const fields = { ...(value?.fields || value?.fieldErrors || {}), ...(value?.code === 'SLUG_CONFLICT' ? { slug: 'Dit webadres is al gebruikt. Kies een ander adres.' } : {}) };
    throw new BlogRequestError(message, response.status, value?.code, fields);
  }
  return value as T;
}

export const blogDate = (value: string | null) => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('nl-NL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
