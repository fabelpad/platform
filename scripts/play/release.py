#!/usr/bin/env python3
"""Upload een Fabelpad-AAB of promoveer exact een intern geteste Play-bundel."""

import argparse
import hashlib
import http.client
import json
import math
import os
import re
import sys
from pathlib import Path
from urllib.parse import quote, urlencode

HOST = "androidpublisher.googleapis.com"
INTERNAL_TRACKS = {"internal", "qa"}
PRODUCTION_TRACKS = {"production"}
RELEASE_STATUSES = {"draft", "inProgress", "halted", "completed"}


class ReleaseError(Exception):
    """Gecontroleerde stop die in GitHub Actions als fout verschijnt."""


class PlayHttpError(ReleaseError):
    def __init__(self, status, payload):
        self.status = status
        error = payload.get("error", {})
        details = error.get("details", [])
        legacy_errors = error.get("errors", [])
        reasons = {
            entry.get("reason")
            for entry in [*details, *legacy_errors]
            if isinstance(entry, dict)
        }
        if "CHANGES_ALREADY_IN_REVIEW" in reasons:
            message = "Google beoordeelt al wijzigingen. Wacht op afronding en voer de job opnieuw uit."
        elif status == 409:
            message = "Gelijktijdige wijziging in Play. Controleer de track voordat je de job herhaalt."
        elif status in (401, 403):
            message = "Controleer OAuth-scope, Play-apprechten en het gebruikte serviceaccount."
        elif status == 404:
            message = "Controleer package-ID, eerste upload, track-ID en de geldigheid van de edit."
        else:
            reason = error.get("status", "")
            safe_reason = reason if isinstance(reason, str) and re.fullmatch(r"[A-Z_]+", reason) else ""
            message = f"Open de Play Console en controleer app-, track- en reviewstatus. {safe_reason}".strip()
        super().__init__(f"Google Play HTTP {status}. {message}")


class PlayTransportError(ReleaseError):
    """De server kan een request hebben ontvangen zonder geldig antwoord terug te geven."""


class Publisher:
    def __init__(self, package, access_token):
        self.path = f"/androidpublisher/v3/applications/{quote(package, safe='')}/edits"
        self.access_token = access_token

    def request(self, method, path, *, payload=None, upload=None):
        headers = {"Authorization": f"Bearer {self.access_token}", "Accept": "application/json"}
        body = None
        if payload is not None:
            body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
            headers["Content-Type"] = "application/json; charset=utf-8"
        if upload is not None:
            body = upload
            headers["Content-Type"] = "application/octet-stream"
            headers["Content-Length"] = str(os.fstat(upload.fileno()).st_size)
        connection = http.client.HTTPSConnection(HOST, timeout=180 if upload is not None else 60)
        try:
            connection.request(method, path, body=body, headers=headers)
            response = connection.getresponse()
            raw = response.read()
        except (OSError, http.client.HTTPException) as error:
            raise PlayTransportError(
                f"Verbinding met Google Play onderbroken tijdens {method} ({type(error).__name__})."
            ) from error
        finally:
            connection.close()
        try:
            decoded = json.loads(raw) if raw else {}
        except (UnicodeDecodeError, json.JSONDecodeError):
            decoded = None
        if not 200 <= response.status < 300:
            raise PlayHttpError(response.status, decoded if isinstance(decoded, dict) else {})
        if not isinstance(decoded, dict):
            raise PlayTransportError("Google Play gaf een onleesbaar succesantwoord.")
        return decoded

    def create_edit(self):
        edit_id = self.request("POST", self.path, payload={}).get("id")
        if not isinstance(edit_id, str) or not edit_id:
            raise PlayTransportError("Google Play gaf geen edit-ID terug.")
        return Edit(self, f"{self.path}/{quote(edit_id, safe='')}")


class Edit:
    def __init__(self, publisher, path):
        self.publisher = publisher
        self.path = path
        self.should_discard = True

    def __enter__(self):
        return self

    def __exit__(self, exception_type, exception, traceback):
        if self.should_discard:
            try:
                self.publisher.request("DELETE", self.path)
            except ReleaseError as cleanup_error:
                print(f"Play-edit kon niet worden opgeruimd. {cleanup_error}", file=sys.stderr)

    def list_tracks(self):
        result = self.publisher.request("GET", f"{self.path}/tracks")
        return {track["track"]: track for track in result.get("tracks", [])}

    def get_bundle(self, version_code):
        result = self.publisher.request("GET", f"{self.path}/bundles")
        matches = [bundle for bundle in result.get("bundles", []) if bundle.get("versionCode") == version_code]
        if len(matches) > 1:
            raise ReleaseError(f"Google Play meldde meerdere bundels voor versionCode {version_code}.")
        return matches[0] if matches else None

    def upload_bundle(self, file):
        with file.open("rb") as stream:
            return self.publisher.request(
                "POST", f"/upload{self.path}/bundles?uploadType=media", upload=stream
            )

    def update_track(self, name, release):
        track_path = f"{self.path}/tracks/{quote(name, safe='')}"
        self.publisher.request("PUT", track_path, payload={"track": name, "releases": [release]})

    def commit(self, *, validate_only):
        self.publisher.request("POST", f"{self.path}:validate")
        if validate_only:
            return
        query = urlencode({"changesInReviewBehavior": "ERROR_IF_IN_REVIEW"})
        try:
            self.publisher.request("POST", f"{self.path}:commit?{query}")
        except PlayTransportError as error:
            self.should_discard = False
            raise ReleaseError(
                "Uitkomst van de commit is onzeker. Controleer de tracks in Play Console voor een nieuwe poging."
            ) from error
        except PlayHttpError as error:
            if error.status >= 500 or error.status == 408:
                self.should_discard = False
                raise ReleaseError(
                    f"Uitkomst van de commit is onzeker (HTTP {error.status}). "
                    "Controleer de tracks in Play Console voor een nieuwe poging."
                ) from error
            raise
        self.should_discard = False


def read_tracks(edit, names):
    available = edit.list_tracks()
    missing = set(names) - available.keys()
    if missing:
        raise ReleaseError(
            f"Onbekende track(s): {', '.join(sorted(missing))}. Voer list-tracks uit voor de exacte ID’s."
        )
    return {name: available[name].get("releases", []) for name in names}


def codes(release):
    return [int(code) for code in release.get("versionCodes", [])]


def check_simple_track(name, releases):
    if any(
        release.get("status") not in RELEASE_STATUSES
        or len(codes(release)) != 1
        or "countryTargeting" in release
        for release in releases
    ):
        raise ReleaseError(
            f"Track {name} heeft een afwijkende releaseconfiguratie. "
            "Controleer targeting en te behouden versionCodes in de Play Console."
        )
    if sum(release["status"] == "completed" for release in releases) > 1:
        raise ReleaseError(f"Track {name} heeft meerdere volledige releases. Controleer targeting in Play.")
    if len({codes(release)[0] for release in releases}) != len(releases):
        raise ReleaseError(f"Track {name} heeft conflicterende versionCodes.")


def plan_internal(tracks, version_code, release_name, release_notes=None):
    changes = {}
    for name, releases in tracks.items():
        check_simple_track(name, releases)
        if any(release["status"] != "completed" for release in releases):
            raise ReleaseError(f"Track {name} heeft een andere wijziging open. Controleer de Play Console.")
        if any(codes(release)[0] > version_code for release in releases):
            raise ReleaseError(f"Track {name} bevat al een hoger versionCode.")
        if not any(codes(release) == [version_code] for release in releases):
            changes[name] = {"name": release_name, "versionCodes": [str(version_code)], "status": "completed"}
            if release_notes:
                changes[name]["releaseNotes"] = release_notes
    return changes


def plan_production(tracks, version_code, action, fraction, sources):
    changes = {}
    for name, releases in tracks.items():
        check_simple_track(name, releases)
        if not any(release["status"] == "completed" for release in releases):
            raise ReleaseError(f"Publiceer de eerste release voor {name} in de Play Console.")
        if any(codes(release)[0] > version_code for release in releases):
            raise ReleaseError(f"Track {name} bevat al een hoger versionCode.")
        existing = next((release for release in releases if codes(release) == [version_code]), None)
        blocking = [
            release
            for release in releases
            if release is not existing and release["status"] not in {"completed", "halted"}
        ]
        if blocking:
            raise ReleaseError(f"Track {name} heeft een andere draft of rollout. Controleer de Play Console.")
        if sum(release["status"] == "halted" for release in releases) > 1:
            raise ReleaseError(f"Track {name} heeft meerdere gestopte releases. Controleer de Play Console.")

        if action == "start":
            if existing and existing["status"] == "completed":
                continue
            if existing and existing["status"] == "inProgress":
                if existing.get("userFraction", 0) >= fraction:
                    continue
                raise ReleaseError(f"Track {name} heeft al een lopende rollout met een lager percentage.")
            if existing:
                raise ReleaseError(f"Track {name} heeft voor deze versie status {existing['status']}.")
            source = sources[name]
            # Google Play houdt de oude volledige release beschikbaar tijdens een rollout.
            changes[name] = {
                key: source[key] for key in ("name", "versionCodes", "releaseNotes") if key in source
            }
            if fraction == 1:
                changes[name]["status"] = "completed"
            else:
                changes[name].update(status="inProgress", userFraction=fraction)
            continue

        new_status = {"complete": "completed", "halt": "halted"}[action]
        if existing and existing["status"] == new_status:
            continue
        if not existing or existing["status"] != "inProgress":
            raise ReleaseError(f"Track {name} heeft geen lopende rollout voor versionCode {version_code}.")
        changes[name] = {
            key: existing[key] for key in ("name", "versionCodes", "releaseNotes", "inAppUpdatePriority")
            if key in existing
        }
        changes[name]["status"] = new_status
    return changes


def source_releases(edit, production_names, source_names, version_code):
    sources = read_tracks(edit, source_names)
    result = {}
    for target, source in zip(production_names, source_names):
        check_simple_track(source, sources[source])
        match = next(
            (
                release for release in sources[source]
                if release["status"] == "completed" and codes(release) == [version_code]
            ),
            None,
        )
        if match is None:
            raise ReleaseError(f"VersionCode {version_code} staat niet volledig op testtrack {source}.")
        result[target] = match
    return result


def verify_bundle(bundle, version_code, expected_hash):
    if not bundle or bundle.get("versionCode") != version_code:
        raise ReleaseError(f"De gevraagde AAB voor versionCode {version_code} is niet bevestigd door Play.")
    actual_hash = bundle.get("sha256", "")
    if expected_hash and actual_hash.lower() != expected_hash.lower():
        raise ReleaseError(f"De SHA-256 voor versionCode {version_code} wijkt af van de verwachte bundel.")


def track_ids(value):
    names = [name.strip() for name in value.split(",")]
    if not all(re.fullmatch(r"[A-Za-z0-9_.:-]+", name) for name in names) or len(set(names)) != len(names):
        raise argparse.ArgumentTypeError("Gebruik unieke, door komma's gescheiden track-ID's.")
    return names


def positive_version(value):
    try:
        result = int(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError("Gebruik een numerieke Android versionCode.") from error
    if not 1 <= result <= 2_100_000_000:
        raise argparse.ArgumentTypeError("De versionCode moet tussen 1 en 2100000000 liggen.")
    return result


def valid_fraction(value):
    try:
        result = float(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError("Gebruik een decimaal percentage, bijvoorbeeld 0.1.") from error
    if not math.isfinite(result) or not 0 < result <= 1:
        raise argparse.ArgumentTypeError("Gebruik een fractie groter dan 0 en maximaal 1.")
    return result


def load_release_notes(path):
    """Read public release copy; reject malformed, duplicate and oversized locales."""
    try:
        notes = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise ReleaseError("Releaseopmerkingen moeten een leesbaar UTF-8 JSON-bestand zijn.") from error
    if not isinstance(notes, list) or not notes:
        raise ReleaseError("Geef minstens één taal voor de releaseopmerkingen op.")
    locales = set()
    for note in notes:
        if not isinstance(note, dict) or set(note) != {"language", "text"}:
            raise ReleaseError("Elke releaseopmerking moet uitsluitend language en text bevatten.")
        language, value = note["language"], note["text"]
        if not isinstance(language, str) or not re.fullmatch(r"[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*", language):
            raise ReleaseError("Ongeldige taalcode in releaseopmerkingen.")
        if language in locales:
            raise ReleaseError("Dubbele taalcode in releaseopmerkingen.")
        if not isinstance(value, str) or not value.strip() or len(value) > 500:
            raise ReleaseError("Releaseopmerkingen moeten 1 tot en met 500 Unicode-tekens per taal bevatten.")
        locales.add(language)
    return notes


def make_parser():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    discover = commands.add_parser("list-tracks", help="Toon de door Play gevonden track-ID's en statussen.")
    internal = commands.add_parser("upload-internal", help="Publiceer één gesigneerde AAB op interne testtracks.")
    production = commands.add_parser("promote", help="Publiceer een productie-update of beheer een gefaseerde rollout.")
    for command in (discover, internal, production):
        command.add_argument("--package", required=True)
    for command in (internal, production):
        command.add_argument("--version-code", required=True, type=positive_version)
        command.add_argument("--tracks", required=True, type=track_ids)
        command.add_argument("--validate-only", action="store_true", help="Valideer de edit zonder commit.")
    internal.add_argument("--bundle", required=True, type=Path)
    internal.add_argument("--release-name")
    internal.add_argument("--release-notes", required=True, type=Path, help="UTF-8 JSON met language/text per taal (maximaal 500 tekens).")
    production.add_argument("--source-tracks", required=True, type=track_ids)
    production.add_argument("--action", required=True, choices=("start", "complete", "halt"))
    production.add_argument(
        "--fraction", default=1.0, type=valid_fraction,
        help="Publiceer naar 100%% met 1 (standaard), of gefaseerd met bijvoorbeeld 0.1.",
    )
    production.add_argument("--sha256", help="Verwachte SHA-256 van de AAB uit de interne build.")
    return parser


def validate_args(args):
    if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+", args.package):
        raise ReleaseError("Ongeldige Android package-ID.")
    if args.command == "upload-internal":
        if not set(args.tracks) <= INTERNAL_TRACKS:
            raise ReleaseError("Gebruik voor upload alleen bestaande interne telefoon/tablettracks: internal of qa.")
        if args.bundle.suffix.lower() != ".aab" or not args.bundle.is_file():
            raise ReleaseError("Geef een bestaande .aab op.")
    if args.command == "promote":
        if not set(args.tracks) <= PRODUCTION_TRACKS or not set(args.source_tracks) <= INTERNAL_TRACKS:
            raise ReleaseError("Kies interne brontracks en de bijbehorende productietracks.")
        if len(args.tracks) != len(args.source_tracks):
            raise ReleaseError("Geef voor elke productietrack de interne brontrack in dezelfde volgorde.")
        if args.sha256 and not re.fullmatch(r"[a-fA-F0-9]{64}", args.sha256):
            raise ReleaseError("De verwachte SHA-256 moet 64 hexadecimale tekens bevatten.")


def execute(args, edit):
    if args.command == "list-tracks":
        report = {
            name: [
                {key: release[key] for key in ("versionCodes", "status", "userFraction") if key in release}
                for release in track.get("releases", [])
            ]
            for name, track in edit.list_tracks().items()
        }
        print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
        return

    tracks = read_tracks(edit, args.tracks)
    if args.command == "upload-internal":
        with args.bundle.open("rb") as file:
            digest = hashlib.file_digest(file, "sha256").hexdigest()
        notes = load_release_notes(args.release_notes)
        changes = plan_internal(tracks, args.version_code, args.release_name or f"Fabelpad {args.version_code}", notes)
        bundle = edit.get_bundle(args.version_code)
        if bundle is None and changes:
            bundle = edit.upload_bundle(args.bundle)
        verify_bundle(bundle, args.version_code, digest)
    else:
        verify_bundle(edit.get_bundle(args.version_code), args.version_code, args.sha256)
        sources = {}
        if args.action == "start":
            pending_targets = [
                (target, source)
                for target, source in zip(args.tracks, args.source_tracks)
                if not any(codes(release) == [args.version_code] for release in tracks[target])
            ]
            if pending_targets:
                target_names, source_names = zip(*pending_targets)
                sources = source_releases(edit, target_names, source_names, args.version_code)
        changes = plan_production(tracks, args.version_code, args.action, args.fraction, sources)

    if not changes:
        print(f"Play heeft de gevraagde toestand al voor versionCode {args.version_code}.")
        return
    for name, release in changes.items():
        edit.update_track(name, release)
    edit.commit(validate_only=args.validate_only)
    state = "Edit gevalideerd zonder commit" if args.validate_only else "Edit gecommit bij Google Play"
    print(f"{state}. VersionCode {args.version_code}, tracks {', '.join(changes)}.")


def main():
    args = make_parser().parse_args()
    try:
        validate_args(args)
        token = os.environ.get("PLAY_ACCESS_TOKEN", "").strip()
        if not token:
            raise ReleaseError("Stel PLAY_ACCESS_TOKEN in met de OAuth-scope androidpublisher.")
        with Publisher(args.package, token).create_edit() as edit:
            execute(args, edit)
    except (ReleaseError, OSError, KeyError, TypeError, ValueError) as error:
        print(f"Play-release gestopt. {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
