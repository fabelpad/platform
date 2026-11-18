#!/usr/bin/env python3
"""Verify restored or fresh signed AAB bytes against their public build receipt."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys


def validate_report(report, *, sha, package, name, code, digest, size):
    if (report.get("packageId") != package or report.get("versionName") != name
            or report.get("versionCode") != code or report.get("sha256") != digest
            or report.get("bytes") != size or report.get("source", {}).get("gitSha") != sha
            or report.get("signed") is not True or report.get("variant") != "production"
            or report.get("source", {}).get("workingTreeDirty") is not False):
        raise ValueError("De AAB komt niet overeen met de exacte bron, versie en bytes van het buildbewijs.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", required=True, type=Path)
    parser.add_argument("--report", required=True, type=Path)
    parser.add_argument("--sha", required=True)
    parser.add_argument("--package", required=True)
    parser.add_argument("--name", required=True)
    parser.add_argument("--code", required=True, type=int)
    args = parser.parse_args()
    try:
        report = json.loads(args.report.read_text(encoding="utf-8"))
        with args.bundle.open("rb") as source:
            digest = hashlib.file_digest(source, "sha256").hexdigest()
        validate_report(report, sha=args.sha, package=args.package, name=args.name, code=args.code,
                        digest=digest, size=args.bundle.stat().st_size)
        java_bin = Path(os.environ["JAVA_HOME"]) / "bin"
        result = subprocess.run([str(java_bin / "jarsigner"), "-J-Duser.language=en", "-J-Duser.country=US",
                                 "-verify", str(args.bundle)], check=True, capture_output=True, text=True)
        if "jar verified." not in result.stdout.splitlines():
            raise ValueError("De AAB-handtekening is niet bevestigd.")
        certificate = subprocess.run([str(java_bin / "keytool"), "-J-Duser.language=en", "-J-Duser.country=US",
                                      "-printcert", "-jarfile", str(args.bundle)],
                                     check=True, capture_output=True, text=True).stdout
        match = re.search(r"SHA256:\s*([A-F0-9:]+)", certificate)
        expected = report.get("uploadCertificateSha256", "").replace(":", "").lower()
        if not match or not expected or match[1].replace(":", "").lower() != expected:
            raise ValueError("Het uploadcertificaat wijkt af van het buildbewijs.")
        if re.search(r"Owner:.*(?:^|[, ])CN=Android Debug(?:,|$)", certificate, re.MULTILINE):
            raise ValueError("Een Android-debugcertificaat mag niet worden gepubliceerd.")
        print(f"Ondertekende AAB bevestigd: {args.package} {args.name} ({args.code}), SHA-256 {digest}.")
        return 0
    except (OSError, ValueError, KeyError, TypeError, subprocess.CalledProcessError):
        print("AAB-vrijgave geweigerd: buildbewijs, exacte identiteit of ondertekening is niet bevestigd.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
