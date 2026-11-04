import * as SecureStore from 'expo-secure-store';

// Ready for a future native Auth client. No client or remote session is created here.
// Scope by the real project reference so staging and production never reuse a session.
export function createSecureSessionStorage(projectRef: string) {
  if (!/^[a-z0-9-]{6,80}$/.test(projectRef)) throw new Error('Een geldige, expliciete projectreferentie is verplicht.');
  const key = (name: string) => {
    if (!/^[a-zA-Z0-9._-]{1,100}$/.test(name)) throw new Error('Ongeldige sessiesleutel.');
    return `fabelpad.auth.${projectRef}.${name}`;
  };
  const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
  return {
    getItem: (name: string) => SecureStore.getItemAsync(key(name), options),
    setItem: (name: string, value: string) => SecureStore.setItemAsync(key(name), value, options),
    removeItem: (name: string) => SecureStore.deleteItemAsync(key(name), options),
  };
}
