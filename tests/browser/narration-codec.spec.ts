import { test, expect } from '@playwright/test';
import { encodeNarrationAudio } from '../../lib/narration/quality';
import { fixturePCM } from '../../scripts/narration/fixtures.mjs';

test('the actual encoded PCM24k WAV decodes and plays in Chromium without a media mock', async ({ page }, testInfo) => {
  const asset = await encodeNarrationAudio(fixturePCM(1.5), 'Kom mee, Avonturier.', 'Kom mee, Avonturier.');
  await page.goto('/');
  const evidence = await page.evaluate(async base64 => {
    const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0)), context = new AudioContext();
    const start = performance.now(), decoded = await context.decodeAudioData(bytes.buffer.slice(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' })), audio = new Audio(url);
    document.body.append(audio);
    const loaded = new Promise<void>((resolve, reject) => { audio.onloadedmetadata = () => resolve(); audio.onerror = () => reject(new Error('WAV decoding failed')); });
    audio.load(); await loaded;
    const firstMetadataMs = performance.now() - start;
    await audio.play(); audio.pause(); const paused = audio.paused;
    audio.currentTime = 0.4; await audio.play();
    const resumed = !audio.paused, position = audio.currentTime;
    audio.pause(); audio.remove(); URL.revokeObjectURL(url); await context.close();
    return { fixture: true, providerConfirmed: false, channels: decoded.numberOfChannels, sampleRate: decoded.sampleRate, decodedSeconds: decoded.duration, mediaSeconds: audio.duration, firstMetadataMs, paused, resumed, position };
  }, Buffer.from(asset.bytes).toString('base64'));
  expect(evidence.channels).toBe(1); expect(evidence.decodedSeconds).toBeCloseTo(1.66, 2);
  expect(evidence.mediaSeconds).toBeCloseTo(1.66, 2); expect(evidence.paused).toBe(true); expect(evidence.resumed).toBe(true); expect(evidence.position).toBeGreaterThanOrEqual(0.4);
  await testInfo.attach('wav-compatibility.json', { body: JSON.stringify({ ...evidence, bytes: asset.byteLength, sha256: asset.sha256 }), contentType: 'application/json' });
});
