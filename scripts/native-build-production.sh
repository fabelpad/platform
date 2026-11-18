#!/usr/bin/env bash
set -euo pipefail
umask 077
task_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
task_lock_id="$(printf '%s' "${task_root}" | sha256sum | cut -c1-20)"
exec 9>"${FABELPAD_BUILD_LOCK:-${TMPDIR:-/tmp}/fabelpad-${task_lock_id}.build.lock}"
flock -n 9 || { echo 'Er loopt al een build onder het gekozen build-lock.' >&2; exit 75; }
task_unsigned=false
if [[ "${1:-}" == --unsigned-check && $# == 1 ]]; then task_unsigned=true
elif [[ $# != 0 ]]; then echo 'Gebruik: native-build-production.sh [--unsigned-check]' >&2; exit 64; fi
: "${JAVA_HOME:?Stel JAVA_HOME in op JDK 21.}"
: "${ANDROID_HOME:?Stel ANDROID_HOME in op de gecontroleerde Android SDK.}"
: "${FABELPAD_ANDROID_VERSION_CODE:?Kies een nieuwe ongebruikte positieve Play-versiecode.}"
export PATH="${JAVA_HOME}/bin:${ANDROID_HOME}/platform-tools:${PATH}"
export FABELPAD_VARIANT=production FABELPAD_UNSIGNED_CHECK="${task_unsigned}" CI=1 CMAKE_BUILD_PARALLEL_LEVEL=1
export FABELPAD_ANDROID_PACKAGE="${FABELPAD_ANDROID_PACKAGE:-nl.fabelpad.app}"
export FABELPAD_ANDROID_VERSION_NAME="${FABELPAD_ANDROID_VERSION_NAME:-1.0.0}"
export FABELPAD_BUILD_SOURCE_SHA="$(git -C "${task_root}" rev-parse HEAD)"
export FABELPAD_BUILD_SOURCE_DIRTY=false
if [[ -n "$(git -C "${task_root}" status --porcelain)" ]]; then
  export FABELPAD_BUILD_SOURCE_DIRTY=true
  [[ "${FABELPAD_ALLOW_DIRTY_BUILD:-false}" == true ]] || { echo 'Leg wijzigingen eerst vast; een releasebuild vereist een schone broncommit.' >&2; exit 65; }
fi
export FABELPAD_PRIVACY_URL="${FABELPAD_PRIVACY_URL:-https://fabelpad.nl/privacy}"
export FABELPAD_SUPPORT_URL="${FABELPAD_SUPPORT_URL:-mailto:support@fabelpad.nl}"
task_secret_dir="$(mktemp -d "${TMPDIR:-/tmp}/fabelpad-signing.XXXXXXXX")"
trap 'rm -rf -- "${task_secret_dir}"' EXIT
if [[ "${task_unsigned}" == false ]]; then
  export FABELPAD_UPLOAD_KEYSTORE="${ANDROID_UPLOAD_KEYSTORE_PATH:-${FABELPAD_UPLOAD_KEYSTORE:-${HOME}/.local/share/fabelpad-signing/fabelpad-upload.p12}}"
  export FABELPAD_UPLOAD_KEY_ALIAS="${ANDROID_UPLOAD_KEY_ALIAS:-${FABELPAD_UPLOAD_KEY_ALIAS:-fabelpad-upload}}"
  if [[ -n "${ANDROID_UPLOAD_STORE_PASSWORD:-}" ]]; then
    printf '%s' "${ANDROID_UPLOAD_STORE_PASSWORD}" > "${task_secret_dir}/store-password"
    export FABELPAD_UPLOAD_STORE_PASSWORD_FILE="${task_secret_dir}/store-password"
  else
    export FABELPAD_UPLOAD_STORE_PASSWORD_FILE="${FABELPAD_UPLOAD_STORE_PASSWORD_FILE:-${HOME}/.config/dg-webservices/fabelpad-signing/upload-store-password}"
  fi
  if [[ -n "${ANDROID_UPLOAD_KEY_PASSWORD:-}" ]]; then
    printf '%s' "${ANDROID_UPLOAD_KEY_PASSWORD}" > "${task_secret_dir}/key-password"
    export FABELPAD_UPLOAD_KEY_PASSWORD_FILE="${task_secret_dir}/key-password"
  else
    export FABELPAD_UPLOAD_KEY_PASSWORD_FILE="${FABELPAD_UPLOAD_KEY_PASSWORD_FILE:-${FABELPAD_UPLOAD_STORE_PASSWORD_FILE}}"
  fi
  unset ANDROID_UPLOAD_STORE_PASSWORD ANDROID_UPLOAD_KEY_PASSWORD
fi
cd "${task_root}"
node scripts/native-android-preflight.mjs
cd mobile
npm run check
npm run test:runtime
npx --no-install expo install --check
npx --no-install expo prebuild --platform android --no-install --clean
cd android
task_java_args=()
if [[ -n "${JAVA_TOOLCHAIN_17:-}" ]]; then task_java_args+=("-Porg.gradle.java.installations.paths=${JAVA_TOOLCHAIN_17},${JAVA_HOME}"); fi
./gradlew app:lintRelease app:bundleRelease --no-daemon --max-workers=1 \
  '-Dorg.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=768m' \
  -Pkotlin.compiler.execution.strategy=in-process \
  -PreactNativeArchitectures=arm64-v8a,x86_64 \
  -Pandroid.enableMinifyInReleaseBuilds=true -Pandroid.enableShrinkResourcesInReleaseBuilds=true \
  "${task_java_args[@]}"
task_suffix=''
if [[ "${task_unsigned}" == true ]]; then task_suffix='-unsigned'; fi
mkdir -p "${task_root}/artifacts/native"
cp app/build/outputs/bundle/release/app-release.aab "${task_root}/artifacts/native/fabelpad-production${task_suffix}.aab"
cd "${task_root}"
python3 scripts/native-production-manifest.py "artifacts/native/fabelpad-production${task_suffix}.aab"
echo 'Productiebouw gecontroleerd; toestelacceptatie en Play-indiening zijn afzonderlijke stappen.'
