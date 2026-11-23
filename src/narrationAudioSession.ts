/** Reader, voice samples and local recordings share one audible session. */
export function claimNarrationAudio(onLost: () => void): () => void {
  const id = crypto.randomUUID();
  const changed = (event: Event) => { if ((event as CustomEvent<string>).detail !== id) onLost(); };
  window.dispatchEvent(new CustomEvent('fabelpad-audio-session-start', { detail: id }));
  window.addEventListener('fabelpad-audio-session-start', changed);
  return () => window.removeEventListener('fabelpad-audio-session-start', changed);
}
export function stopAllNarrationAudio(): void { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('fabelpad-audio-session-start', { detail: '' })); }
