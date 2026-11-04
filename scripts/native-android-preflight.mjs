import { access, readFile, statfs } from 'node:fs/promises';
import { constants } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const failures = [];
const disk = await statfs(root);
if (disk.bavail * disk.bsize < 6 * 1024 ** 3) failures.push('Minder dan 6 GiB vrije schijfruimte voor de Android-build.');
if (disk.ffree < 100_000) failures.push('Minder dan 100.000 vrije inodes.');
const versions = await readFile(new URL('../mobile/node_modules/react-native/gradle/libs.versions.toml', import.meta.url), 'utf8');
const version = name => versions.match(new RegExp(`^${name} = "([^"]+)"`, 'm'))?.[1];
const sdk = process.env.ANDROID_HOME, jdk = process.env.JAVA_HOME;
if (!sdk) failures.push('ANDROID_HOME ontbreekt.');
if (!jdk) failures.push('JAVA_HOME ontbreekt.');
const exists = async item => { try { await access(item, constants.R_OK); return true; } catch { return false; } };
if (sdk) {
  const api = version('compileSdk');
  const found = await exists(path.join(sdk, 'platforms', `android-${api}`, 'android.jar')) || await exists(path.join(sdk, 'platforms', `android-${api}.0`, 'android.jar'));
  if (!found) failures.push(`Android platform API ${api} ontbreekt in ANDROID_HOME.`);
  if (!await exists(path.join(sdk, 'build-tools', version('buildTools'), 'aapt2'))) failures.push(`Android Build-Tools ${version('buildTools')} ontbreken.`);
  if (!await exists(path.join(sdk, 'ndk', version('ndkVersion'), 'source.properties'))) failures.push(`NDK ${version('ndkVersion')} ontbreekt.`);
}
if (jdk) {
  const java = spawnSync(path.join(jdk, 'bin/java'), ['-version'], { encoding: 'utf8' });
  const major = Number(java.stderr?.match(/version "(\d+)/)?.[1]);
  if (java.status !== 0 || major < 17) failures.push('De Android Gradle-plugin vereist een werkende JDK 17 of hoger.');
  else console.log(`JDK ${major}; compile API ${version('compileSdk')}; target API ${version('targetSdk')}; Build-Tools ${version('buildTools')}; NDK ${version('ndkVersion')}.`);
}
console.log(`${Math.floor(disk.bavail * disk.bsize / 1024 ** 3)} GiB vrij, ${disk.ffree} vrije inodes.`);
if (failures.length) { for (const failure of failures) console.error(failure); process.exit(1); }
