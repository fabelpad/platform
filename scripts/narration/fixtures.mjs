/** Test-only audible tone. This is never a speech provider or a hosted publishable voice. */
export function fixturePCM(seconds = 1.5, frequency = 440) {
  const pcm = new Uint8Array(Math.round(seconds * 24000) * 2), view = new DataView(pcm.buffer);
  for (let i = 0; i < pcm.length / 2; i++) view.setInt16(i * 2, Math.round(Math.sin(i * frequency * 2 * Math.PI / 24000) * 4000), true);
  return pcm;
}
export class FixtureSocket {
  readyState = 1; listeners = new Map(); sent = []; closed = false;
  constructor({ mode = 'complete', transcript = 'Kom mee, Avonturier.', pcm = fixturePCM() } = {}) { this.mode = mode; this.transcript = transcript; this.pcm = pcm; queueMicrotask(() => this.emit({ type: 'session.created' })); }
  addEventListener(type, listener) { const set = this.listeners.get(type) ?? new Set(); set.add(listener); this.listeners.set(type, set); }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  close() { this.closed = true; }
  emit(event) { if (!this.closed) for (const listener of this.listeners.get('message') ?? []) listener({ data: JSON.stringify(event) }); }
  send(data) {
    const event = JSON.parse(data); this.sent.push(event);
    if (event.type === 'session.update') queueMicrotask(() => this.emit({ type: 'session.updated', session: event.session }));
    if (event.type !== 'response.create' || this.mode === 'timeout') return;
    queueMicrotask(() => {
      if (this.mode === '401' || this.mode === '429') return this.emit({ type: 'error', error: { code: this.mode === '401' ? 'invalid_api_key' : 'rate_limit_exceeded', message: 'SENSITIVE_PROVIDER_DETAIL' } });
      this.emit({ type: 'response.created', response: { id: 'response_1' } });
      const ref = { response_id: 'response_1', item_id: this.mode === 'mixed' ? 'wrong_item' : 'item_1', output_index: 0, content_index: 0 };
      this.emit({ type: 'response.output_audio.delta', ...ref, delta: Buffer.from(this.pcm).toString('base64') });
      if (this.mode !== 'partial') this.emit({ type: 'response.output_audio.done', ...ref });
      this.emit({ type: 'response.output_audio_transcript.done', ...ref, transcript: this.transcript });
      this.emit({ type: 'response.done', response: { id: 'response_1', status: this.mode === 'truncated' ? 'incomplete' : 'completed', output: [{ id: 'item_1', type: 'message', content: [{ type: 'output_audio', transcript: this.transcript }] }], usage: { input_tokens: 30, output_tokens: 40, input_token_details: { text_tokens: 30, audio_tokens: 0 }, output_token_details: { audio_tokens: 35, text_tokens: 5 } } } });
    });
  }
}
