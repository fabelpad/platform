export interface NarrationBackend {
  authenticate(token: string): Promise<{ id: string } | null>;
  rpc<T = unknown>(name: string, parameters?: Record<string, unknown>, token?: string): Promise<T>;
  publicRpc<T = unknown>(name: string, parameters?: Record<string, unknown>, token?: string): Promise<T>;
  uploadAudio(path: string, bytes: Uint8Array): Promise<void>;
  readAudio(path: string): Promise<Uint8Array>;
}
export class NarrationBackendError extends Error {
  constructor(readonly code: string, readonly status = 503, readonly databaseCode?: string) { super(code); }
}
export const narrationObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export const narrationUuid = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu.test(value);
export async function narrationResponseBytes(response: Response, limit: number, signal?: AbortSignal): Promise<Uint8Array> {
  const reader = response.body?.getReader(); if (!reader) throw new NarrationBackendError('narration_unavailable');
  const abort = () => { void reader.cancel().catch(() => {}); }; signal?.addEventListener('abort', abort, { once: true });
  let size = 0; const chunks: Uint8Array[] = [];
  try { while (true) { const chunk = await reader.read(); if (signal?.aborted) throw new NarrationBackendError('narration_request_timeout', 408); if (chunk.done) break; size += chunk.value.byteLength; if (size > limit) throw new NarrationBackendError('narration_response_too_large', 413); chunks.push(chunk.value); } }
  finally { signal?.removeEventListener('abort', abort); await reader.cancel().catch(() => {}); }
  const result = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; } return result;
}
export async function narrationRequestBody(request: Request, limit = 96 * 1024): Promise<Record<string, unknown>> {
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json' || request.headers.has('content-encoding')) throw new NarrationBackendError('narration_invalid_request', 415);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const controller = new AbortController();
  try {
    const bytes = await Promise.race([narrationResponseBytes(new Response(request.body), limit, controller.signal), new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new NarrationBackendError('narration_request_timeout', 408)); }, 1500); })]);
    const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!narrationObject(value)) throw new Error(); return value;
  } catch (error) { if (error instanceof NarrationBackendError) throw error; throw new NarrationBackendError('narration_invalid_request', 422); }
  finally { if (timer) clearTimeout(timer); }
}
