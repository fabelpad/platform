const { withAndroidManifest, withAppBuildGradle } = require('expo/config-plugins');

const SIGNING_START = '// BEGIN FABELPAD PRODUCTION SIGNING';
const SIGNING_END = '// END FABELPAD PRODUCTION SIGNING';

module.exports = function withFabelpadProduction(config) {
  const production = ['production', 'connected'].includes(config.extra?.variant);
  config = withAndroidManifest(config, value => {
    const application = value.modResults.manifest.application[0];
    if (production) {
      application.$['android:allowBackup'] = 'false';
      application.$['android:usesCleartextTraffic'] = 'false';
    }
    const metadata = application['meta-data'] ||= [];
    for (const [name, entry] of Object.entries({
      'nl.fabelpad.variant': config.extra.variant,
      'nl.fabelpad.privacyUrl': config.extra.privacyUrl || '',
      'nl.fabelpad.supportUrl': config.extra.supportUrl || '',
      'nl.fabelpad.backendOrigin': config.extra.backendOrigin || '',
      'nl.fabelpad.environment': config.extra.environment || '',
      'nl.fabelpad.deleteAccountUrl': config.extra.deleteAccountUrl || '',
      'nl.fabelpad.supabaseUrl': config.extra.supabaseUrl || '',
      'nl.fabelpad.supabaseKey': config.extra.supabaseKey || '',
      'nl.fabelpad.audioEnvironment': config.extra.audioEnvironment || '',
      'nl.fabelpad.audioOrigin': config.extra.audioOrigin || '',
      'nl.fabelpad.localRecording': config.extra.localRecording === 'enabled' ? 'enabled' : '',
      'nl.fabelpad.audioFixtureEnabled': config.extra.narrationFixture === true ? 'enabled' : '',
    })) {
      const existing = metadata.find(item => item.$['android:name'] === name);
      if (existing) existing.$['android:value'] = entry;
      else metadata.push({ $: { 'android:name': name, 'android:value': entry } });
    }
    return value;
  });
  if (!production) return config;
  return withAppBuildGradle(config, value => {
    if (value.modResults.language !== 'groovy') throw new Error('Fabelpad production signing expects the generated Groovy Gradle template.');
    let source = value.modResults.contents;
    if (source.includes(SIGNING_START)) return value;
    const releaseSigning = /(release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/;
    if (!releaseSigning.test(source) || !source.includes('signingConfigs {')) throw new Error('Generated Android signing template changed; inspect before building production.');
    const guard = `${SIGNING_START}
// Secret values are read from protected files only when Gradle runs.
def fabelpadUnsignedCheck = System.getenv('FABELPAD_UNSIGNED_CHECK') == 'true'
def fabelpadSecretFile = { String name ->
    def location = System.getenv(name)
    if (!location || !new File(location).isFile()) throw new GradleException('Missing protected signing file: ' + name)
    return new File(location).getText('UTF-8').replaceFirst(/\\r?\\n\\z/, '')
}
def fabelpadKeystore = System.getenv('FABELPAD_UPLOAD_KEYSTORE')
def fabelpadAlias = System.getenv('FABELPAD_UPLOAD_KEY_ALIAS')
if (!fabelpadUnsignedCheck && (!fabelpadKeystore || !new File(fabelpadKeystore).isFile() || !fabelpadAlias)) {
    throw new GradleException('Production requires Fabelpad upload signing; debug signing is forbidden.')
}
${SIGNING_END}
`;
    source = guard + source.replace('signingConfigs {', `signingConfigs {
        if (!fabelpadUnsignedCheck) {
            fabelpadUpload {
                storeFile new File(fabelpadKeystore)
                storePassword fabelpadSecretFile('FABELPAD_UPLOAD_STORE_PASSWORD_FILE')
                keyAlias fabelpadAlias
                keyPassword fabelpadSecretFile('FABELPAD_UPLOAD_KEY_PASSWORD_FILE')
            }
        }`).replace(releaseSigning, '$1signingConfig fabelpadUnsignedCheck ? null : signingConfigs.fabelpadUpload');
    value.modResults.contents = source;
    return value;
  });
};
