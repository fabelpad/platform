#!/usr/bin/bash
set -euo pipefail
# Installed only by the reviewed host installer; never source repository code
# with root privileges. The Node dispatcher drops privileges before any build.
exec /opt/dg-toolchains/fabelpad-vps08-staging/node-v24.18.0-linux-x64/bin/node /usr/local/libexec/fabelpad-vps08-staging/candidate-build.mjs "$@"
