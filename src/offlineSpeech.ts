/** A Dutch voice must explicitly report local processing; unknown is not local. */
export function selectLocalDutchVoice<T extends { lang: string; localService: boolean }>(voices: readonly T[]): T | null {
  return voices.find(voice => /^nl(?:-|$)/i.test(voice.lang) && voice.localService === true) ?? null;
}

/** Never send a chosen profile name to the device's speech provider. */
export function privateSpeechText(text: string, profileName: string): string {
  const name = profileName.trim();
  if (!name) return text;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(escaped, 'giu'), 'Avonturier');
}
