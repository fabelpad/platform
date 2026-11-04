const production = process.env.FABELPAD_VARIANT === 'production';
export default {
  expo: {
    name: production ? 'Fabelpad' : 'Fabelpad Demo',
    slug: 'fabelpad-native-prototype',
    version: '0.1.0',
    orientation: 'default',
    userInterfaceStyle: 'light',
    scheme: production ? 'fabelpad' : 'fabelpaddemo',
    android: { package: production ? 'nl.dgwebservices.fabelpad' : 'nl.dgwebservices.fabelpad.demo', versionCode: 1 },
    ios: { bundleIdentifier: production ? 'nl.dgwebservices.fabelpad' : 'nl.dgwebservices.fabelpad.demo', supportsTablet: true },
    extra: { prototype: true, variant: production ? 'production' : 'demo', backendConnected: false },
  },
};
