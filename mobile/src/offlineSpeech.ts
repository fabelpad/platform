import { requireOptionalNativeModule } from 'expo';

type OfflineSpeechModule = {
  variant: 'demo' | 'production';
  privacyUrl: string;
  supportUrl: string;
  speak(text: string): Promise<'done' | 'stopped'>;
  stop(): Promise<void>;
};
const native = requireOptionalNativeModule<OfflineSpeechModule>('FabelpadOfflineSpeech');
export const runtimeConfig = {
  production: native?.variant === 'production',
  privacyUrl: native?.privacyUrl || '',
  supportUrl: native?.supportUrl || '',
};

export function stopSpeech(): Promise<void> { return native?.stop() || Promise.resolve(); }
export function speakOffline(text: string): Promise<'done' | 'stopped'> {
  if (!native) return Promise.reject(new Error('Voorlezen vraagt een eigen Android-build en een Nederlandse offline apparaatstem.'));
  return native.speak(text);
}
