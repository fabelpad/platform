import nativePackage from './package.json';
const variant = process.env.FABELPAD_VARIANT || 'demo';
if (!['demo', 'production', 'connected'].includes(variant)) throw new Error('FABELPAD_VARIANT moet demo, production of connected zijn.');
const connected = variant === 'connected';
const production = variant === 'production' || connected;
// Public story audio is an explicit build capability. A local release without
// these staging pins keeps its existing account-free/offline network boundary.
const audioEnvironment = connected ? process.env.FABELPAD_CONNECTED_ENVIRONMENT || '' : process.env.FABELPAD_AUDIO_ENVIRONMENT || '';
const audioOrigin = connected ? process.env.FABELPAD_CONNECTED_ORIGIN || '' : process.env.FABELPAD_AUDIO_ORIGIN || '';
if (!connected && (audioEnvironment || audioOrigin) && (audioEnvironment !== 'staging' || audioOrigin !== 'https://staging.fabelpad.nl')) throw new Error('Lokale audiopakketten vereisen de expliciete stagingomgeving en vaste HTTPS-origin.');
const publicAudio = !connected && audioEnvironment === 'staging';
const narrationFixture = process.env.FABELPAD_NARRATION_FIXTURE === 'true';
if (narrationFixture && (process.env.FABELPAD_UNSIGNED_CHECK !== 'true' || process.env.CI !== '1')) throw new Error('De audiofixture is uitsluitend toegestaan in de expliciete ongesigneerde CI-build.');
const environment = process.env.FABELPAD_CONNECTED_ENVIRONMENT || '';
const backendOrigin = process.env.FABELPAD_CONNECTED_ORIGIN || '';
const supabaseUrl = process.env.FABELPAD_CONNECTED_SUPABASE_URL || '';
const supabaseKey = process.env.FABELPAD_CONNECTED_SUPABASE_PUBLISHABLE_KEY || '';
if (connected && (!['staging', 'production'].includes(environment) || backendOrigin !== (environment === 'production' ? 'https://fabelpad.nl' : 'https://staging.fabelpad.nl'))) throw new Error('De gekoppelde Android-build vereist een expliciete passende Fabelpad-omgeving en HTTPS-origin.');
if (connected && (!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/u.test(supabaseUrl) || !/^sb_publishable_[A-Za-z0-9_-]{7,}$/u.test(supabaseKey))) throw new Error('De gekoppelde build vereist het expliciete Supabase-project en uitsluitend de openbare publishable key van dezelfde omgeving.');
// Expo loads this config without recursively transpiling imported TypeScript.
// These public project identities also receive runtime validation against the
// shared hosted-target contract in connected.ts before any network request.
const connectedProjects: Record<string, string> = { staging: 'https://tlwfpivafcokcjyjwgmq.supabase.co', production: 'https://aptprpkosqctwrzeetgs.supabase.co' };
if (connected && supabaseUrl !== connectedProjects[environment]) throw new Error('De Android-backendconfiguratie past niet bij het vastgelegde staging- of productieproject.');
const packageId = production ? process.env.FABELPAD_ANDROID_PACKAGE || 'nl.fabelpad.app' : 'nl.dgwebservices.fabelpad.demo';
if (!packageId || !/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){2,}$/.test(packageId)) {
  throw new Error('Stel FABELPAD_ANDROID_PACKAGE expliciet in op de definitief vastgelegde productie-package-ID.');
}
if (production && packageId !== 'nl.fabelpad.app') throw new Error('De vastgelegde productie-package-ID is nl.fabelpad.app.');
const versionCode = Number(process.env.FABELPAD_ANDROID_VERSION_CODE || '1');
if (!Number.isSafeInteger(versionCode) || versionCode < 1 || versionCode > 2_100_000_000) throw new Error('FABELPAD_ANDROID_VERSION_CODE moet een geheel getal van 1 tot en met 2100000000 zijn.');
const versionName = production ? process.env.FABELPAD_ANDROID_VERSION_NAME || nativePackage.version : '0.1.0';
if (!/^\d+\.\d+\.\d+$/.test(versionName)) throw new Error('FABELPAD_ANDROID_VERSION_NAME moet major.minor.patch zijn.');
if (production && !process.env.FABELPAD_ANDROID_VERSION_CODE) throw new Error('Leg FABELPAD_ANDROID_VERSION_CODE expliciet vast voor iedere productiebuild.');
if (connected && versionCode <= 2) throw new Error('De gekoppelde upgrade vereist een versionCode hoger dan de bestaande lokale release (2).');
const privacyUrl = process.env.FABELPAD_PRIVACY_URL || (production ? 'https://fabelpad.nl/privacy' : '');
const supportUrl = process.env.FABELPAD_SUPPORT_URL || (production ? 'mailto:support@fabelpad.nl' : '');
if (privacyUrl && !/^https:\/\/[^\s]+$/.test(privacyUrl)) throw new Error('FABELPAD_PRIVACY_URL moet een openbare HTTPS-URL zijn.');
if (supportUrl && !/^(https:\/\/[^\s]+|mailto:[^\s@]+@[^\s@]+)$/.test(supportUrl)) throw new Error('FABELPAD_SUPPORT_URL moet een HTTPS- of mailto-URL zijn.');
export default {
  expo: {
    name: production ? 'Fabelpad' : 'Fabelpad Demo',
    slug: production ? 'fabelpad' : 'fabelpad-native-prototype',
    version: versionName,
    icon: production ? process.env.FABELPAD_ANDROID_ICON || './assets/brand/launcher.png' : undefined,
    orientation: 'default',
    userInterfaceStyle: 'light',
    scheme: production ? 'fabelpad' : 'fabelpaddemo',
    android: {
      package: packageId, versionCode, softwareKeyboardLayoutMode: 'resize',
      permissions: ['android.permission.RECORD_AUDIO', ...(publicAudio ? ['android.permission.INTERNET'] : [])],
      ...(production ? { allowBackup: false, blockedPermissions: [
        ...(!connected ? [...(!publicAudio ? ['android.permission.INTERNET'] : []), 'com.android.vending.BILLING'] : []), 'android.permission.SYSTEM_ALERT_WINDOW',
        'android.permission.READ_EXTERNAL_STORAGE', 'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.USE_BIOMETRIC', 'android.permission.USE_FINGERPRINT',
        'com.google.android.gms.permission.AD_ID',
      ] } : {}),
    },
    ios: { bundleIdentifier: packageId, supportsTablet: true },
    plugins: ['expo-secure-store', './plugins/withFabelpadProduction.cjs'],
    extra: { prototype: !production, variant, backendConnected: connected, privacyUrl, supportUrl, audioEnvironment, audioOrigin, localRecording: 'enabled', narrationFixture,
      ...(connected ? { environment, backendOrigin, supabaseUrl, supabaseKey, deleteAccountUrl: `${backendOrigin}/account-verwijderen` } : {}) },
  },
};
