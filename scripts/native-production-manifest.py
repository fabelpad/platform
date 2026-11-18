#!/usr/bin/env python3
"""Validate the actual AAB, native ELF alignment and signing; emit public provenance."""
import hashlib
import json
import os
from pathlib import Path
import stat
import struct
import subprocess
import sys
import tempfile
import urllib.request
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]
BUNDLETOOL_VERSION = '1.18.3'
BUNDLETOOL_SHA256 = 'a099cfa1543f55593bc2ed16a70a7c67fe54b1747bb7301f37fdfd6d91028e29'
ANDROID = '{http://schemas.android.com/apk/res/android}'


def run(args):
    return subprocess.run([str(arg) for arg in args], cwd=ROOT, check=True, capture_output=True, text=True).stdout.strip()


def bundletool():
    target = Path(os.environ.get('FABELPAD_BUNDLETOOL', str(Path.home() / '.cache/fabelpad-android/bundletool-all-1.18.3.jar')))
    if not target.exists():
        target.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=target.parent, delete=False) as temporary:
            temporary_path = Path(temporary.name)
        try:
            with urllib.request.urlopen(f'https://github.com/google/bundletool/releases/download/{BUNDLETOOL_VERSION}/bundletool-all-{BUNDLETOOL_VERSION}.jar', timeout=120) as source:
                temporary_path.write_bytes(source.read())
            if hashlib.sha256(temporary_path.read_bytes()).hexdigest() != BUNDLETOOL_SHA256:
                raise ValueError('Bundletool-download komt niet overeen met de gepinde SHA-256.')
            temporary_path.replace(target)
        finally:
            temporary_path.unlink(missing_ok=True)
    if hashlib.sha256(target.read_bytes()).hexdigest() != BUNDLETOOL_SHA256:
        raise ValueError('Bundletool komt niet overeen met de gepinde SHA-256.')
    return target


def elf_load_alignments(data):
    if data[:4] != b'\x7fELF' or data[4] != 2 or data[5] != 1:
        raise ValueError('Productie verwacht uitsluitend little-endian 64-bit ELF-bibliotheken.')
    offset = struct.unpack_from('<Q', data, 32)[0]
    size, count = struct.unpack_from('<HH', data, 54)
    return [struct.unpack_from('<Q', data, offset + index * size + 48)[0]
            for index in range(count) if struct.unpack_from('<I', data, offset + index * size)[0] == 1]


def main():
    artifact = Path(sys.argv[1]).resolve()
    unsigned = os.environ.get('FABELPAD_UNSIGNED_CHECK') == 'true'
    source_sha = os.environ.get('FABELPAD_BUILD_SOURCE_SHA')
    source_dirty = os.environ.get('FABELPAD_BUILD_SOURCE_DIRTY') != 'false'
    if source_sha and (run(['git', 'rev-parse', 'HEAD']) != source_sha or
                       (not source_dirty and run(['git', 'status', '--porcelain']))):
        raise ValueError('De broncommit of werkboom is tijdens de build gewijzigd; geen releasebewijs gemaakt.')
    java = Path(os.environ['JAVA_HOME']) / 'bin/java'
    tool = bundletool()
    command = [java, '-jar', tool]
    run(command + ['validate', f'--bundle={artifact}'])
    manifest = ET.fromstring(run(command + ['dump', 'manifest', f'--bundle={artifact}', '--module=base']))
    package = manifest.get('package')
    expected = os.environ.get('FABELPAD_ANDROID_PACKAGE', 'nl.fabelpad.app')
    if package != expected or package != 'nl.fabelpad.app':
        raise ValueError('De productie-AAB heeft niet de vastgelegde pakketnaam.')
    code = int(manifest.get(ANDROID + 'versionCode', '0'))
    name = manifest.get(ANDROID + 'versionName')
    if code != int(os.environ['FABELPAD_ANDROID_VERSION_CODE']) or not 1 <= code <= 2100000000:
        raise ValueError('De productie-versiecode wijkt af.')
    if name != os.environ.get('FABELPAD_ANDROID_VERSION_NAME', '1.0.0'):
        raise ValueError('De productie-versienaam wijkt af.')
    sdk = manifest.find('uses-sdk')
    target_sdk = int(sdk.get(ANDROID + 'targetSdkVersion', '0'))
    if target_sdk < 36:
        raise ValueError('De target-API is lager dan de vereiste API 36.')
    app = manifest.find('application')
    if app.get(ANDROID + 'debuggable', 'false') != 'false' or app.get(ANDROID + 'allowBackup', 'true') != 'false':
        raise ValueError('Production mag geen debug- of backupmodus gebruiken.')
    if app.get(ANDROID + 'usesCleartextTraffic') != 'false':
        raise ValueError('De productie-AAB moet cleartext expliciet blokkeren.')
    permissions = sorted(item.get(ANDROID + 'name') for item in manifest if item.tag.startswith('uses-permission'))
    allowed = {'android.permission.VIBRATE', 'nl.fabelpad.app.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION'}
    if set(permissions) - allowed:
        raise ValueError('De productie-AAB bevat een permissie buiten de vastgelegde lokale scope.')
    metadata = {item.get(ANDROID + 'name'): item.get(ANDROID + 'value') for item in app.findall('meta-data')}
    if (metadata.get('nl.fabelpad.variant') != 'production'
            or metadata.get('nl.fabelpad.privacyUrl') != os.environ.get('FABELPAD_PRIVACY_URL', 'https://fabelpad.nl/privacy')
            or metadata.get('nl.fabelpad.supportUrl') != os.environ.get('FABELPAD_SUPPORT_URL', 'mailto:support@fabelpad.nl')):
        raise ValueError('De productievariant of publieke privacy-/supportconfiguratie wijkt af.')
    blocked = {'android.permission.INTERNET', 'android.permission.READ_EXTERNAL_STORAGE', 'android.permission.WRITE_EXTERNAL_STORAGE', 'android.permission.SYSTEM_ALERT_WINDOW', 'com.google.android.gms.permission.AD_ID', 'android.permission.ACCESS_FINE_LOCATION', 'android.permission.RECORD_AUDIO'}
    if blocked.intersection(permissions):
        raise ValueError('De productie-AAB bevat een ongebruikte of beperkte permissie.')
    with zipfile.ZipFile(artifact) as archive:
        libraries = [name for name in archive.namelist() if name.startswith('base/lib/') and name.endswith('.so')]
        abis = sorted({name.split('/')[2] for name in libraries})
        if abis != ['arm64-v8a', 'x86_64']:
            raise ValueError('De productie-ABI’s wijken af van arm64-v8a en x86_64.')
        for library in libraries:
            alignments = elf_load_alignments(archive.read(library))
            if not alignments or any(alignment < 16384 for alignment in alignments):
                raise ValueError(f'16 KB ELF-uitlijning ontbreekt in {library}.')
        signatures = [name for name in archive.namelist() if name.startswith('META-INF/') and name.endswith(('.RSA', '.DSA', '.EC'))]
        if bool(signatures) == unsigned:
            raise ValueError('De verwachte ondertekeningsstatus van de AAB klopt niet.')
        dex_bytes = sum(item.file_size for item in archive.infolist() if item.filename.startswith('base/dex/') and item.filename.endswith('.dex'))
    certificate_sha = None
    apk_report = None
    if not unsigned:
        verification = run([Path(os.environ['JAVA_HOME']) / 'bin/jarsigner', '-J-Duser.language=en', '-verify', artifact])
        if 'jar verified.' not in verification.splitlines():
            raise ValueError('JAR-signatuurcontrole heeft de AAB niet bevestigd.')
        details = run([Path(os.environ['JAVA_HOME']) / 'bin/keytool', '-printcert', '-rfc', '-jarfile', artifact])
        import base64
        certificate = base64.b64decode(details.split('-----BEGIN CERTIFICATE-----')[1].split('-----END CERTIFICATE-----')[0])
        certificate_sha = hashlib.sha256(certificate).hexdigest()
        expected_der = subprocess.run([str(Path(os.environ['JAVA_HOME']) / 'bin/keytool'), '-exportcert', '-keystore', os.environ['FABELPAD_UPLOAD_KEYSTORE'], '-storetype', 'PKCS12', '-storepass:file', os.environ['FABELPAD_UPLOAD_STORE_PASSWORD_FILE'], '-alias', os.environ['FABELPAD_UPLOAD_KEY_ALIAS']], check=True, capture_output=True).stdout
        if certificate_sha != hashlib.sha256(expected_der).hexdigest():
            raise ValueError('Het AAB-certificaat komt niet overeen met de eigen uploadsleutel.')
        # Reject debug signing independently, even when someone supplies a debug keystore.
        description = run([Path(os.environ['JAVA_HOME']) / 'bin/keytool', '-printcert', '-jarfile', artifact])
        if 'CN=Android Debug' in description:
            raise ValueError('Een Android-debugcertificaat is geen productiesigning.')
        # Exercise Play's bundle-to-APK route and validate the resulting ZIP layout.
        apk_set = artifact.with_suffix('.apks')
        run(command + ['build-apks', f'--bundle={artifact}', f'--output={apk_set}', '--mode=universal', '--overwrite',
            f'--ks={os.environ["FABELPAD_UPLOAD_KEYSTORE"]}', f'--ks-key-alias={os.environ["FABELPAD_UPLOAD_KEY_ALIAS"]}',
            f'--ks-pass=file:{os.environ["FABELPAD_UPLOAD_STORE_PASSWORD_FILE"]}',
            f'--key-pass=file:{os.environ["FABELPAD_UPLOAD_KEY_PASSWORD_FILE"]}'])
        apk = artifact.with_suffix('.apk')
        with zipfile.ZipFile(apk_set) as archive:
            apk.write_bytes(archive.read('universal.apk'))
        # The build-tools version comes from the same locked RN release as Gradle.
        import re
        versions = (ROOT / 'mobile/node_modules/react-native/gradle/libs.versions.toml').read_text()
        tools_version = re.search(r'^buildTools = "([^"]+)"', versions, re.MULTILINE)[1]
        tools = Path(os.environ['ANDROID_HOME']) / 'build-tools' / tools_version
        run([tools / 'zipalign', '-c', '-P', '16', '4', apk])
        run([tools / 'apksigner', 'verify', '--verbose', apk])
        badging = run([tools / 'aapt2', 'dump', 'badging', apk])
        if f"package: name='{package}' versionCode='{code}' versionName='{name}'" not in badging:
            raise ValueError('De uit de AAB gemaakte APK heeft een afwijkende identiteit.')
        if "application-label:'Fabelpad'" not in badging:
            raise ValueError('De productie-app heet niet Fabelpad.')
        apk_report = {'artifact': apk.name, 'sha256': hashlib.sha256(apk.read_bytes()).hexdigest(),
                      'bytes': apk.stat().st_size, 'signatureVerified': True, 'zipAlignment16KiBVerified': True,
                      'signing': 'upload key; Google Play signs its delivered APKs with its own app-signing key'}
    config = run(command + ['dump', 'config', f'--bundle={artifact}'])
    if 'PAGE_ALIGNMENT_16K' not in config:
        raise ValueError('De bundleconfiguratie vraagt geen 16 KB APK-uitlijning.')
    import re
    packages = json.loads((ROOT / 'mobile/package.json').read_text())
    versions = (ROOT / 'mobile/node_modules/react-native/gradle/libs.versions.toml').read_text()
    wrapper = (ROOT / 'mobile/android/gradle/wrapper/gradle-wrapper.properties').read_text()
    report = {
        'schemaVersion': 1, 'variant': 'production', 'packageId': package,
        'versionName': name, 'versionCode': code, 'artifact': artifact.name,
        'sha256': hashlib.sha256(artifact.read_bytes()).hexdigest(), 'bytes': artifact.stat().st_size,
        'signed': not unsigned, 'uploadCertificateSha256': certificate_sha,
        'minSdk': int(sdk.get(ANDROID + 'minSdkVersion')), 'targetSdk': target_sdk,
        'architectures': abis, 'permissions': permissions, 'nativeLibraries': len(libraries),
        'elf16KiBVerified': True, 'bundle16KiBAlignmentRequested': True, 'dexUncompressedBytes': dex_bytes,
        'bundletoolVersion': BUNDLETOOL_VERSION,
        'toolchain': {'node': run(['node', '--version']), 'expo': packages['dependencies']['expo'],
                      'reactNative': packages['dependencies']['react-native'],
                      'gradle': re.search(r'gradle-([0-9.]+)-bin', wrapper)[1],
                      'compileSdk': int(re.search(r'^compileSdk = "([0-9]+)"', versions, re.MULTILINE)[1]),
                      'buildTools': re.search(r'^buildTools = "([^"]+)"', versions, re.MULTILINE)[1],
                      'ndk': re.search(r'^ndkVersion = "([^"]+)"', versions, re.MULTILINE)[1]},
        'source': {'gitSha': source_sha or run(['git', 'rev-parse', 'HEAD']), 'workingTreeDirty': source_dirty,
                   'buildStartIdentityRecorded': source_sha is not None},
        'backendConnected': False, 'deviceInstallationTested': False, 'deviceRuntimeTested': False,
        'playUploaded': False,
        'configuration': {'variant': 'production', 'contentVersion': json.loads((ROOT / 'mobile/src/content.json').read_text())['contentVersion'],
                          'privacyUrl': os.environ.get('FABELPAD_PRIVACY_URL', 'https://fabelpad.nl/privacy'),
                          'supportUrl': os.environ.get('FABELPAD_SUPPORT_URL', 'mailto:support@fabelpad.nl'),
                          'launcherSha256': hashlib.sha256((ROOT / 'mobile' / (os.environ.get('FABELPAD_ANDROID_ICON') or 'assets/brand/launcher.png')).read_bytes()).hexdigest()},
        'universalApk': apk_report,
    }
    mappings = ROOT / 'mobile/android/app/build/outputs/mapping/release/mapping.txt'
    if mappings.is_file():
        import shutil
        mapping_target = artifact.with_name(artifact.stem + '-mapping.txt')
        shutil.copyfile(mappings, mapping_target)
        report['r8Mapping'] = {'artifact': mapping_target.name, 'sha256': hashlib.sha256(mapping_target.read_bytes()).hexdigest()}
    artifact.with_suffix('.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf8')
    print(f"AAB gecontroleerd: {package} {name} ({code}), {artifact.stat().st_size} bytes, SHA-256 {report['sha256']}")


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError) as error:
        print(f'AAB-controle afgebroken: {type(error).__name__}: {error if not isinstance(error, subprocess.CalledProcessError) else "controlecommando mislukt; geen geheime uitvoer gelogd"}', file=sys.stderr)
        sys.exit(1)
