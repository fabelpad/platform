import { readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const artifact = path.join(root, 'artifacts/native/fabelpad-demo-arm64.apk');
const sdk = process.env.ANDROID_HOME;
if (!sdk) throw new Error('ANDROID_HOME is verplicht voor APK-controle.');
const environment = { ...process.env, PATH: [process.env.JAVA_HOME && path.join(process.env.JAVA_HOME, 'bin'), process.env.PATH].filter(Boolean).join(path.delimiter) };
const versions = await readFile(new URL('../mobile/node_modules/react-native/gradle/libs.versions.toml', import.meta.url), 'utf8');
const toolsVersion = versions.match(/^buildTools = "([^"]+)"/m)?.[1];
if (!toolsVersion) throw new Error('Build-Tools-versie ontbreekt.');
const run = (command, args) => execFileSync(command, args, { cwd: root, env: environment, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const tools = path.join(sdk, 'build-tools', toolsVersion);
const badging = run(path.join(tools, 'aapt2'), ['dump', 'badging', artifact]);
const signing = run(path.join(tools, 'apksigner'), ['verify', '--verbose', '--print-certs', artifact]);
run(path.join(tools, 'zipalign'), ['-c', '-P', '16', '4', artifact]);
const packageInfo = badging.match(/^package: name='([^']+)' versionCode='([^']+)' versionName='([^']+)'/m);
if (packageInfo?.[1] !== 'nl.dgwebservices.fabelpad.demo') throw new Error('Alleen de expliciete demo-package mag dit manifest gebruiken.');
const bytes = await readFile(artifact);
const content = JSON.parse(await readFile(new URL('../mobile/src/content.json', import.meta.url), 'utf8'));
const nativePackage = JSON.parse(await readFile(new URL('../mobile/package.json', import.meta.url), 'utf8'));
const wrapper = await readFile(new URL('../mobile/android/gradle/wrapper/gradle-wrapper.properties', import.meta.url), 'utf8');
const manifest = {
  schemaVersion: 1,
  builtAt: (await stat(artifact)).mtime.toISOString(),
  variant: 'demo',
  backendConnected: false,
  artifact: path.basename(artifact),
  bytes: bytes.byteLength,
  sha256: createHash('sha256').update(bytes).digest('hex'),
  packageId: packageInfo[1],
  versionCode: Number(packageInfo[2]),
  versionName: packageInfo[3],
  minSdk: Number(badging.match(/^(?:minSdkVersion|sdkVersion):'(\d+)'/m)?.[1]),
  targetSdk: Number(badging.match(/^targetSdkVersion:'(\d+)'/m)?.[1]),
  architectures: [...(badging.match(/^native-code: (.+)$/m)?.[1] || '').matchAll(/'([^']+)'/g)].map(match => match[1]),
  signatureVerified: true,
  zipAlignment16KiBVerified: true,
  signing: 'generated Android debug key; demo only',
  certificateSha256: signing.match(/^.*certificate SHA-256 digest: ([a-f0-9]{64})$/m)?.[1],
  toolchain: {
    node: process.version,
    expo: nativePackage.dependencies.expo,
    reactNative: nativePackage.dependencies['react-native'],
    gradle: wrapper.match(/gradle-([\d.]+)-bin/)?.[1],
    compileSdk: Number(versions.match(/^compileSdk = "(\d+)"/m)?.[1]),
    buildTools: toolsVersion,
    ndk: versions.match(/^ndkVersion = "([^"]+)"/m)?.[1],
  },
  source: {
    gitSha: run('git', ['rev-parse', 'HEAD']),
    workingTreeDirty: run('git', ['status', '--porcelain']).length > 0,
  },
  content: {
    version: content.contentVersion,
    stories: content.stories.length,
    scenes: content.stories.reduce((sum, story) => sum + Object.keys(story.scenes).length, 0),
    endings: content.stories.reduce((sum, story) => sum + Object.keys(story.endings).length, 0),
  },
  deviceInstallationTested: false,
  deviceRuntimeTested: false,
};
if (manifest.minSdk !== 24 || manifest.targetSdk < 36 || manifest.architectures.join(',') !== 'arm64-v8a') throw new Error('APK-platform of architectuur wijkt af van de demo-buildconfiguratie.');
await writeFile(path.join(root, 'artifacts/native/fabelpad-demo-arm64.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`APK gecontroleerd: ${manifest.packageId}, ${manifest.bytes} bytes, SHA-256 ${manifest.sha256}.`);
