#!/usr/bin/env python3
"""Create the app's private upload key outside Git; export only its public certificate."""
import hashlib
import os
from pathlib import Path
import secrets
import shutil
import stat
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
KEY_DIR = Path.home() / '.local/share/fabelpad-signing'
SECRET_DIR = Path.home() / '.config/dg-webservices/fabelpad-signing'
KEY = KEY_DIR / 'fabelpad-upload.p12'
PASSWORD = SECRET_DIR / 'upload-store-password'
ALIAS = 'fabelpad-upload'


def private_directory(directory):
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    if directory.is_symlink() or directory.stat().st_uid != os.getuid():
        raise RuntimeError('Signingmap heeft een onveilige eigenaar of symlink.')
    directory.chmod(0o700)


def main():
    os.umask(0o077)
    keytool = Path(os.environ['JAVA_HOME']) / 'bin/keytool' if os.environ.get('JAVA_HOME') else shutil.which('keytool')
    if not keytool:
        raise RuntimeError('Stel JAVA_HOME in op de gecontroleerde JDK.')
    private_directory(KEY_DIR)
    private_directory(SECRET_DIR)
    for filename in (KEY, PASSWORD):
        if filename.exists() and (filename.is_symlink() or filename.stat().st_uid != os.getuid() or stat.S_IMODE(filename.stat().st_mode) & 0o077):
            raise RuntimeError('Bestaande signingbron heeft onveilige toegang; niets gewijzigd.')
    if KEY.exists() and not PASSWORD.exists():
        raise RuntimeError('Keystore bestaat zonder wachtwoordbron; herstel deze buiten Git.')
    if not PASSWORD.exists():
        with PASSWORD.open('x', encoding='utf8') as target:
            target.write(secrets.token_urlsafe(48) + '\n')
    base = [str(keytool), '-keystore', str(KEY), '-storetype', 'PKCS12', '-storepass:file', str(PASSWORD)]
    if not KEY.exists():
        subprocess.run(base + ['-genkeypair', '-alias', ALIAS, '-keyalg', 'RSA', '-keysize', '3072', '-validity', '10000', '-dname', 'CN=Fabelpad Upload', '-noprompt'], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        KEY.chmod(0o600)
    # Verify the protected source and derive public metadata without printing private data.
    certificate = subprocess.run(base + ['-exportcert', '-alias', ALIAS], check=True, capture_output=True).stdout
    public = ROOT / 'artifacts/native/fabelpad-upload-certificate.pem'
    public.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(base + ['-exportcert', '-rfc', '-alias', ALIAS, '-file', str(public)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    public.chmod(0o644)
    print(f'Uploadkeystore gereed buiten Git: {KEY}')
    print(f'Afzonderlijke afgeschermde wachtwoordbron: {PASSWORD}')
    print(f'Openbaar uploadcertificaat: {public}')
    print(f'Uploadcertificaat SHA-256: {hashlib.sha256(certificate).hexdigest()}')
    print('Bewaar keystore en wachtwoord afzonderlijk in gecontroleerde herstelopslag. Upload alleen de gesigneerde AAB naar de nieuwe Play-release.')


if __name__ == '__main__':
    try:
        main()
    except (OSError, RuntimeError, subprocess.CalledProcessError) as error:
        print(f'Signinginitialisatie afgebroken: {type(error).__name__}. Geen geheime waarden gelogd.', file=sys.stderr)
        sys.exit(1)
