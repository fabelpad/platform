#!/usr/bin/env python3
"""Explicit owner-operated transfer from protected key files to app-scoped GitHub secrets."""
import base64
from pathlib import Path
import subprocess
import sys


def main():
    if sys.argv[1:] != ['--apply']:
        print('Voer uit met --apply nadat het GitHub-environment fabelpad-play-internal is ingericht. Er worden vier signingsecrets geplaatst; geen Play-upload.')
        return 0
    key = Path.home() / '.local/share/fabelpad-signing/fabelpad-upload.p12'
    password = Path.home() / '.config/dg-webservices/fabelpad-signing/upload-store-password'
    for source in (key, password):
        if source.is_symlink() or source.stat().st_mode & 0o077:
            raise ValueError('Signingbron is niet uitsluitend voor de eigenaar leesbaar.')
    values = {
        'ANDROID_UPLOAD_KEYSTORE_BASE64': base64.b64encode(key.read_bytes()),
        'ANDROID_UPLOAD_STORE_PASSWORD': password.read_bytes().rstrip(b'\r\n'),
        'ANDROID_UPLOAD_KEY_PASSWORD': password.read_bytes().rstrip(b'\r\n'),
        'ANDROID_UPLOAD_KEY_ALIAS': b'fabelpad-upload',
    }
    subprocess.run(['gh', 'api', 'repos/fabelpad/platform/environments/fabelpad-play-internal'], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for name, value in values.items():
        subprocess.run(['gh', 'secret', 'set', name, '--repo', 'fabelpad/platform', '--env', 'fabelpad-play-internal'], input=value, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print('Vier signingsecrets geplaatst in fabelpad/platform → fabelpad-play-internal. Geen geheime waarden getoond.')
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (OSError, ValueError, subprocess.CalledProcessError):
        print('Signingoverdracht gestopt; controleer bestanden, GitHub-toegang en het bestaande environment. Er kunnen al enkele secrets geplaatst zijn; herhalen is veilig.', file=sys.stderr)
        sys.exit(1)
