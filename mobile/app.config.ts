const variant = process.env.FABELPAD_VARIANT || 'demo';
if (variant !== 'demo' && variant !== 'production') throw new Error('FABELPAD_VARIANT moet demo of production zijn.');
const production = variant === 'production';
const packageId = production ? process.env.FABELPAD_ANDROID_PACKAGE || 'nl.fabelpad.app' : 'nl.dgwebservices.fabelpad.demo';
if (!packageId || !/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){2,}$/.test(packageId)) {
  throw new Error('Stel FABELPAD_ANDROID_PACKAGE expliciet in op de definitief vastgelegde productie-package-ID.');
}
if (production && packageId !== 'nl.fabelpad.app') throw new Error('De vastgelegde productie-package-ID is nl.fabelpad.app.');
const versionCode = Number(process.env.FABELPAD_ANDROID_VERSION_CODE || '1');
if (!Number.isSafeInteger(versionCode) || versionCode < 1 || versionCode > 2_100_000_000) throw new Error('FABELPAD_ANDROID_VERSION_CODE moet een geheel getal van 1 tot en met 2100000000 zijn.');
const versionName = production ? process.env.FABELPAD_ANDROID_VERSION_NAME || '1.0.0' : '0.1.0';
if (!/^\d+\.\d+\.\d+$/.test(versionName)) throw new Error('FABELPAD_ANDROID_VERSION_NAME moet major.minor.patch zijn.');
if (production && !process.env.FABELPAD_ANDROID_VERSION_CODE) throw new Error('Leg FABELPAD_ANDROID_VERSION_CODE expliciet vast voor iedere productiebuild.');
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
      package: packageId, versionCode,
      ...(production ? { allowBackup: false, blockedPermissions: [
        'android.permission.INTERNET', 'android.permission.SYSTEM_ALERT_WINDOW',
        'android.permission.READ_EXTERNAL_STORAGE', 'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.USE_BIOMETRIC', 'android.permission.USE_FINGERPRINT',
        'com.google.android.gms.permission.AD_ID',
      ] } : {}),
    },
    ios: { bundleIdentifier: packageId, supportsTablet: true },
    plugins: ['expo-secure-store', './plugins/withFabelpadProduction.cjs'],
    extra: { prototype: !production, variant: production ? 'production' : 'demo', backendConnected: false, privacyUrl, supportUrl },
  },
};
