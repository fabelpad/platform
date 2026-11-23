import { narrationHash } from './compiler.ts';

/** Only documented orthographic changes are ignored; substitutions and missing words require review. */
export function normalizeNarrationTranscript(text: string): string {
  const numbers = ['nul', 'een', 'twee', 'drie', 'vier', 'vijf', 'zes', 'zeven', 'acht', 'negen', 'tien', 'elf', 'twaalf', 'dertien', 'veertien', 'vijftien', 'zestien', 'zeventien', 'achttien', 'negentien', 'twintig'];
  return text.normalize('NFC').toLocaleLowerCase('nl-NL').replace(/[’‘]/gu, "'").replace(/\b(?:[0-9]|1[0-9]|20)\b/gu, n => numbers[Number(n)]).replace(/[.,!?;:…“”"()]/gu, ' ').replace(/\s+/gu, ' ').trim();
}
export function checkNarrationTranscript(expected: string, transcript: string) {
  const normalizedExpected = normalizeNarrationTranscript(expected), normalizedActual = normalizeNarrationTranscript(transcript);
  return { matches: Boolean(normalizedExpected) && normalizedExpected === normalizedActual, expected: normalizedExpected, actual: normalizedActual };
}
export interface EncodedNarrationAudio {
  bytes: Uint8Array; sha256: string; byteLength: number; durationMs: number; mimeType: 'audio/wav';
  quality: 'pass' | 'review'; reasons: string[]; transcript: string;
}
/** PCM16 LE mono24k -> deterministic WAV. No external encoder or executable in the Edge runtime. */
export async function encodeNarrationAudio(pcm: Uint8Array, transcript: string, expectedText: string): Promise<EncodedNarrationAudio> {
  if (pcm.byteLength < 4800 || pcm.byteLength > 24000 * 2 * 120 || pcm.byteLength % 2) throw new Error('narration_invalid_pcm');
  const source = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength), length = pcm.byteLength / 2;
  let square = 0, peak = 0, clipped = 0;
  for (let index = 0; index < length; index++) {
    const sample = source.getInt16(index * 2, true) / 32768;
    square += sample * sample; peak = Math.max(peak, Math.abs(sample)); if (Math.abs(sample) > 0.998) clipped++;
  }
  const rms = Math.sqrt(square / length);
  if (peak < 0.0005 || rms < 0.0001) throw new Error('narration_silent_audio');
  const reasons: string[] = [];
  if (clipped / length > 0.005) reasons.push('clipped_signal');
  if (!checkNarrationTranscript(expectedText, transcript).matches) reasons.push('transcript_mismatch');
  // A short response for long text is never a complete candidate, even if a transcript claims otherwise.
  const minimumSeconds = Math.max(0.1, expectedText.trim().split(/\s+/u).length / 8);
  if (length / 24000 < minimumSeconds) reasons.push('implausible_duration');
  // Fixed80ms lead/tail, 5ms edge fade and RMS target -20dBFS with -1dB peak ceiling.
  const padding = 1920, outputSamples = length + padding * 2, bytes = new Uint8Array(44 + outputSamples * 2), view = new DataView(bytes.buffer);
  const ascii = (offset: number, value: string) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
  ascii(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); ascii(8, 'WAVE'); ascii(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, 24000, true); view.setUint32(28, 48000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); ascii(36, 'data'); view.setUint32(40, outputSamples * 2, true);
  const gain = Math.min(0.1 / rms, 0.891 / peak, 8);
  for (let i = 0; i < length; i++) {
    const fade = Math.min(1, i / 120, (length - i - 1) / 120);
    view.setInt16(44 + (i + padding) * 2, Math.round(source.getInt16(i * 2, true) * gain * fade), true);
  }
  return { bytes, sha256: await narrationHash(bytes), byteLength: bytes.length, durationMs: Math.round(outputSamples / 24), mimeType: 'audio/wav', quality: reasons.length ? 'review' : 'pass', reasons, transcript };
}
