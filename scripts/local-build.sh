#!/usr/bin/env bash
set -euo pipefail

task_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${task_root}"
command -v flock >/dev/null || { echo 'Linux flock is vereist.' >&2; exit 69; }
# Een bestaand hostbreed build-lockpad kan via deze niet-geheime variabele worden
# meegegeven. Het lokale standaardlock serialiseert alleen deze checkout.
task_lock_id="$(printf '%s' "${task_root}" | sha256sum | cut -c1-20)"
task_lock="${FABELPAD_BUILD_LOCK:-${TMPDIR:-/tmp}/fabelpad-${task_lock_id}.build.lock}"
exec 9>"${task_lock}"
flock -n 9 || { echo 'Er loopt al een build onder het gekozen build-lock.' >&2; exit 75; }
node scripts/local-preflight.mjs
pnpm check:config
pnpm typecheck
pnpm check:content
pnpm check:backend
pnpm check:deploy
pnpm check:native
pnpm build
