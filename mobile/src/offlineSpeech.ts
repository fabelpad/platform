import { requireOptionalNativeModule } from 'expo';

type OfflineSpeechModule = {
  variant: 'demo' | 'production' | 'connected';
  privacyUrl: string;
  supportUrl: string;
  speak(text: string): Promise<'done' | 'stopped'>;
  stop(): Promise<void>;
  pickBirthDate(initialDate: string, latestDate: string): Promise<string | null>;
  closeBirthDatePicker(): Promise<void>;
};
const native = requireOptionalNativeModule<OfflineSpeechModule>('FabelpadOfflineSpeech');
export const runtimeConfig = {
  production: native?.variant === 'production' || native?.variant === 'connected',
  connected: native?.variant === 'connected',
  privacyUrl: native?.privacyUrl || '',
  supportUrl: native?.supportUrl || '',
};

export function stopSpeech(): Promise<void> { return native?.stop() || Promise.resolve(); }
export function pickBirthDate(initialDate: string, latestDate: string): Promise<string | null> {
  if (!native?.pickBirthDate) return Promise.reject(new Error('De datumkiezer vraagt een actuele Android-build.'));
  return native.pickBirthDate(initialDate, latestDate);
}
export function closeBirthDatePicker(): Promise<void> { return native?.closeBirthDatePicker?.() || Promise.resolve(); }
export function speakOffline(text: string): Promise<'done' | 'stopped'> {
  if (!native) return Promise.reject(new Error('Voorlezen vraagt een eigen Android-build en een Nederlandse offline apparaatstem.'));
  return native.speak(text);
}
