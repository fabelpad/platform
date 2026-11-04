const variant = process.env.FABELPAD_VARIANT || 'demo';
if (variant !== 'demo' && variant !== 'production') throw new Error('FABELPAD_VARIANT moet demo of production zijn.');
const production = variant === 'production';
const packageId = production ? process.env.FABELPAD_ANDROID_PACKAGE : 'nl.dgwebservices.fabelpad.demo';
if (!packageId || !/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){2,}$/.test(packageId)) {
  throw new Error('Stel FABELPAD_ANDROID_PACKAGE expliciet in op de definitief vastgelegde productie-package-ID.');
}
const versionCode = Number(process.env.FABELPAD_ANDROID_VERSION_CODE || '1');
if (!Number.isSafeInteger(versionCode) || versionCode < 1) throw new Error('FABELPAD_ANDROID_VERSION_CODE moet een positief geheel getal zijn.');
export default {
  expo: {
    name: production ? 'Fabelpad' : 'Fabelpad Demo',
    slug: 'fabelpad-native-prototype',
    version: '0.1.0',
    orientation: 'default',
    userInterfaceStyle: 'light',
    scheme: production ? 'fabelpad' : 'fabelpaddemo',
    android: { package: packageId, versionCode },
    ios: { bundleIdentifier: packageId, supportsTablet: true },
    plugins: ['expo-secure-store'],
    extra: { prototype: true, variant: production ? 'production' : 'demo', backendConnected: false },
  },
};
