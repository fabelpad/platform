import { SUPPORTED_NARRATION_MODELS, type NarrationPreset } from './contracts.ts';

export interface NarrationUsage { inputTokens: number; outputTokens: number; textInputTokens: number; audioOutputTokens: number; textOutputTokens: number; known: boolean; }
export interface NarrationProviderResult { pcm: Uint8Array; sampleRate: 24000; transcript: string; usage: NarrationUsage; complete: true; responseId: string; fixture?: boolean; }
export interface NarrationGenerateInput { text: string; preset: NarrationPreset; requestId: string; maxOutputTokens: number; }
export interface NarrationProvider { generate(input: NarrationGenerateInput, signal?: AbortSignal): Promise<NarrationProviderResult>; }
export interface NarrationSocket {
  readyState: number; send(data: string): void; close(code?: number): void;
  addEventListener(type: string, listener: (event: { data?: unknown }) => void): void;
  removeEventListener(type: string, listener: (event: { data?: unknown }) => void): void;
}
export class NarrationProviderError extends Error {
  constructor(public category: string, public retryable = false, public uncertain = false) { super(category); this.name = 'NarrationProviderError'; }
}
export type NarrationConnect = (url: string, options: { headers: Record<string, string> }) => NarrationSocket;
const providerConnect: NarrationConnect = (url, options) => {
  // Headers are a Deno server WebSocket extension, never a browser credential transport.
  if (!(globalThis as { Deno?: unknown }).Deno) throw new NarrationProviderError('server_runtime_required');
  const ServerWebSocket = globalThis.WebSocket as unknown as new (url: string, options: { headers: Record<string, string> }) => NarrationSocket;
  return new ServerWebSocket(url, options);
};
function object(value: unknown): Record<string, unknown> { return value && typeof value === 'object' ? value as Record<string, unknown> : {}; }
function token(value: unknown) { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null; }
export function readNarrationUsage(value: unknown): NarrationUsage {
  const usage = object(value), input = object(usage.input_token_details), output = object(usage.output_token_details);
  const inputTokens = token(usage.input_tokens), outputTokens = token(usage.output_tokens), textInputTokens = token(input.text_tokens), audioOutputTokens = token(output.audio_tokens), textOutputTokens = token(output.text_tokens);
  return { inputTokens: inputTokens ?? 0, outputTokens: outputTokens ?? 0, textInputTokens: textInputTokens ?? 0, audioOutputTokens: audioOutputTokens ?? 0, textOutputTokens: textOutputTokens ?? 0,
    known: [inputTokens, outputTokens, textInputTokens, audioOutputTokens, textOutputTokens].every(n => n !== null)
      && inputTokens === textInputTokens && outputTokens === (audioOutputTokens ?? 0) + (textOutputTokens ?? 0) };
}
export function narrationUsageCents(usage: NarrationUsage, model: string): number | null {
  if (!usage.known || !SUPPORTED_NARRATION_MODELS.includes(model as NarrationPreset['model'])) return null;
  const full = model === 'gpt-realtime-2.1';
  return Math.ceil((usage.textInputTokens * (full ? 4 : 0.6) + usage.audioOutputTokens * (full ? 64 : 20) + usage.textOutputTokens * (full ? 24 : 2.4)) / 10000);
}
function decodeDelta(value: unknown): Uint8Array {
  if (typeof value !== 'string' || !value.length || value.length > 2_000_000 || !/^[A-Za-z0-9+/]*={0,2}$/u.test(value) || value.length % 4) throw new NarrationProviderError('invalid_audio', false, true);
  const binary = atob(value); return Uint8Array.from(binary, char => char.charCodeAt(0));
}
export function createRealtimeNarrationProvider(options: { apiKey: string; connect?: NarrationConnect; timeoutMs?: number }): NarrationProvider {
  return { generate(input, signal) {
    const { text, preset, requestId, maxOutputTokens } = input;
    if (!options.apiKey || /[\r\n]/u.test(options.apiKey)) return Promise.reject(new NarrationProviderError('key_required'));
    if (!SUPPORTED_NARRATION_MODELS.includes(preset.model) || !['marin', 'cedar', 'sage', 'ballad', 'shimmer'].includes(preset.providerVoice) || !text.trim() || text.length > 700 || !/^[a-zA-Z0-9_-]{1,128}$/u.test(requestId) || !Number.isInteger(maxOutputTokens) || maxOutputTokens < 256 || maxOutputTokens > 8192) return Promise.reject(new NarrationProviderError('invalid_input'));
    if (signal?.aborted) return Promise.reject(new NarrationProviderError('cancelled'));
    return new Promise<NarrationProviderResult>((resolve, reject) => {
      let socket: NarrationSocket, settled = false, requested = false, configured = false, responseId = '', itemId = '', transcript = '', audioDone = false, transcriptDone = false, receivedBytes = 0;
      const chunks: Uint8Array[] = [];
      const timeout = setTimeout(() => fail(new NarrationProviderError('timeout', true, requested)), Math.min(120000, Math.max(10, options.timeoutMs ?? 90000)));
      const clean = () => { clearTimeout(timeout); signal?.removeEventListener('abort', abort); if (socket) { socket.removeEventListener('message', message); socket.removeEventListener('error', error); socket.removeEventListener('close', close); try { socket.close(1000); } catch { /* no provider content in errors */ } } };
      const fail = (cause: NarrationProviderError) => { if (!settled) { settled = true; clean(); reject(cause); } };
      const abort = () => fail(new NarrationProviderError('cancelled', false, requested));
      const error = () => fail(new NarrationProviderError('connection_failed', true, requested));
      const close = () => fail(new NarrationProviderError('incomplete_audio', true, requested));
      const send = (event: unknown) => socket.send(JSON.stringify(event));
      const correlation = (event: Record<string, unknown>) => {
        if (!responseId || event.response_id !== responseId || event.output_index !== 0 || event.content_index !== 0 || typeof event.item_id !== 'string') throw new NarrationProviderError('unexpected_output', false, true);
        if (!itemId) itemId = event.item_id;
        if (itemId !== event.item_id) throw new NarrationProviderError('unexpected_output', false, true);
      };
      const message = (raw: { data?: unknown }) => {
        if (settled) return;
        try {
          if (typeof raw.data !== 'string' || raw.data.length > 3_000_000) throw new NarrationProviderError('invalid_event', false, requested);
          const event = object(JSON.parse(raw.data));
          if (event.type === 'error') {
            const code = String(object(event.error).code ?? '');
            throw new NarrationProviderError(/rate_limit/u.test(code) ? 'rate_limit' : /invalid_api_key|authentication/u.test(code) ? 'authentication_failed' : 'provider_rejected', /rate_limit/u.test(code), requested);
          }
          if (event.type === 'session.created') {
            send({ type: 'session.update', session: { type: 'realtime', model: preset.model, instructions: preset.instructions,
              output_modalities: ['audio'], audio: { input: { turn_detection: null }, output: { format: { type: 'audio/pcm', rate: 24000 }, voice: preset.providerVoice } }, tools: [], tool_choice: 'none' } });
          } else if (event.type === 'session.updated' && !configured) {
            configured = true;
            const session = object(event.session), output = object(object(session.audio).output), format = object(output.format);
            if (session.model !== preset.model || session.instructions !== preset.instructions || JSON.stringify(session.output_modalities) !== '["audio"]' || output.voice !== preset.providerVoice || format.type !== 'audio/pcm' || format.rate !== 24000) throw new NarrationProviderError('configuration_mismatch');
            send({ type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] } });
            requested = true;
            send({ type: 'response.create', response: { output_modalities: ['audio'], max_output_tokens: maxOutputTokens, metadata: { narration_request: requestId } } });
          } else if (event.type === 'response.created') {
            const response = object(event.response);
            if (!requested || responseId || typeof response.id !== 'string') throw new NarrationProviderError('unexpected_response', false, true);
            responseId = response.id;
          } else if (event.type === 'response.output_audio.delta') {
            correlation(event); if (audioDone) throw new NarrationProviderError('unexpected_output', false, true);
            const chunk = decodeDelta(event.delta); receivedBytes += chunk.length;
            if (receivedBytes > 24000 * 2 * 120) throw new NarrationProviderError('audio_limit', false, true);
            chunks.push(chunk);
          } else if (event.type === 'response.output_audio.done') { correlation(event); audioDone = true;
          } else if (event.type === 'response.output_audio_transcript.done') {
            correlation(event); if (transcriptDone || typeof event.transcript !== 'string' || event.transcript.length > 10000) throw new NarrationProviderError('invalid_transcript', false, true);
            transcript = event.transcript; transcriptDone = true;
          } else if (event.type === 'response.refusal.done' || event.type === 'response.refusal.delta') throw new NarrationProviderError('refused', false, true);
          else if (event.type === 'response.done') {
            const response = object(event.response), output = Array.isArray(response.output) ? response.output : [], item = object(output[0]), content = Array.isArray(item.content) ? item.content : [], part = object(content[0]);
            if (response.id !== responseId || response.status !== 'completed' || !audioDone || !transcriptDone || !transcript.trim() || !receivedBytes || receivedBytes % 2 || output.length !== 1 || item.id !== itemId || item.type !== 'message' || content.length !== 1 || part.type !== 'output_audio' || part.transcript !== transcript) throw new NarrationProviderError('incomplete_audio', true, requested);
            const pcm = new Uint8Array(receivedBytes); let offset = 0;
            for (const chunk of chunks) { pcm.set(chunk, offset); offset += chunk.length; }
            settled = true; clean(); resolve({ pcm, sampleRate: 24000, transcript, complete: true, responseId, usage: readNarrationUsage(response.usage) });
          }
        } catch (cause) { fail(cause instanceof NarrationProviderError ? cause : new NarrationProviderError('invalid_event', false, requested)); }
      };
      signal?.addEventListener('abort', abort, { once: true });
      try {
        socket = (options.connect ?? providerConnect)(`wss://api.openai.com/v1/realtime?model=${preset.model}`, { headers: { Authorization: `Bearer ${options.apiKey}`, 'OpenAI-Safety-Identifier': 'fabelpad-editorial-narration-v1' } });
        socket.addEventListener('message', message); socket.addEventListener('error', error); socket.addEventListener('close', close);
      } catch { fail(new NarrationProviderError('connection_failed', true, false)); }
    });
  } };
}
