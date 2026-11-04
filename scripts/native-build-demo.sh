#!/usr/bin/env bash
set -euo pipefail
task_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
task_lock_id="$(printf '%s' "${task_root}" | sha256sum | cut -c1-20)"
task_lock="${FABELPAD_BUILD_LOCK:-${TMPDIR:-/tmp}/fabelpad-${task_lock_id}.build.lock}"
exec 9>"${task_lock}"
flock -n 9 || { echo 'Er loopt al een build onder het gekozen build-lock.' >&2; exit 75; }
: "${JAVA_HOME:?Stel JAVA_HOME in op de gecontroleerde JDK.}"
: "${ANDROID_HOME:?Stel ANDROID_HOME in op de gecontroleerde Android SDK.}"
export PATH="${JAVA_HOME}/bin:${ANDROID_HOME}/platform-tools:${PATH}"
export FABELPAD_VARIANT=demo CI=1 CMAKE_BUILD_PARALLEL_LEVEL=1
node "${task_root}/scripts/native-android-preflight.mjs"
cd "${task_root}/mobile"
npm run check
npm run test:runtime
npx expo install --check
npx expo prebuild --platform android --no-install
cd android
# Standalone demo APK with bundled JS; the generated demo debug key is intentional.
# This script must never be used to sign a production candidate.
./gradlew app:assembleRelease --no-daemon --max-workers=1 \
  '-Dorg.gradle.jvmargs=-Xmx1024m -XX:MaxMetaspaceSize=512m' \
  -Pkotlin.compiler.execution.strategy=in-process \
  -PreactNativeArchitectures=arm64-v8a -Pandroid.enableMinifyInReleaseBuilds=false
mkdir -p "${task_root}/artifacts/native"
cp app/build/outputs/apk/release/app-release.apk "${task_root}/artifacts/native/fabelpad-demo-arm64.apk"
sha256sum "${task_root}/artifacts/native/fabelpad-demo-arm64.apk"
node "${task_root}/scripts/native-build-manifest.mjs"
echo 'Demo-APK gebouwd; installatie, toestelgedrag en prestaties moeten afzonderlijk worden getest.'
