#!/usr/bin/env python3
"""Inspect current Fabelpad Play tracks/bundles through a disposable edit.

This creates and deletes an edit; it never uploads, updates, validates or commits.
An artifact is written only after successful cleanup. The current edit is not a
complete historical inventory of every versionCode ever used in Google Play.

API contracts checked 2026-11-23:
https://developers.google.com/android-publisher/api-ref/rest/v3/edits.tracks/list
https://developers.google.com/android-publisher/api-ref/rest/v3/edits.bundles/list
https://developers.google.com/android-publisher/api-ref/rest/v3/edits/delete
https://developers.google.com/android-publisher/api-ref/rest/v3/applications.tracks.releases/list
"""

import argparse
from datetime import datetime, timezone
import json
import math
import os
from pathlib import Path
import re
import sys
from urllib.parse import quote

from probe_connection import PACKAGE, ProbeError, validate_target
from release import PlayHttpError, Publisher, RELEASE_STATUSES, ReleaseError

LIFECYCLE_STATES = {f"RELEASE_LIFECYCLE_STATE_{state}" for state in (
    "UNSPECIFIED", "DRAFT", "NOT_SENT_FOR_REVIEW", "IN_REVIEW",
    "APPROVED_NOT_PUBLISHED", "NOT_APPROVED", "PUBLISHED")}


class StatusError(Exception):
    """Fixed diagnostics never include arbitrary API content or credentials."""


def version_code(value):
    if (isinstance(value, bool) or not isinstance(value, (int, str))
            or not re.fullmatch(r"[1-9][0-9]{0,9}", str(value))
            or int(value) > 2100000000):
        raise StatusError("Google gaf een ongeldige versionCode terug.")
    return int(value)


def list_field(value, field):
    if not isinstance(value, dict) or not isinstance(value.get(field, []), list):
        raise StatusError("Google gaf een ongeldige statusstructuur terug.")
    return value.get(field, [])


def summarize_tracks(response):
    result = []
    names = set()
    for track in list_field(response, "tracks"):
        name = track.get("track") if isinstance(track, dict) else None
        if (not isinstance(name, str) or not re.fullmatch(r"[A-Za-z0-9_.:-]{1,128}", name)
                or name in names):
            raise StatusError("Google gaf een ongeldige of dubbele track-ID terug.")
        names.add(name)
        releases = []
        for release in list_field(track, "releases"):
            if (not isinstance(release, dict) or not isinstance(release.get("status"), str)
                    or release["status"] not in RELEASE_STATUSES):
                raise StatusError("Google gaf een onbekende releasestatus terug.")
            codes = [version_code(code) for code in list_field(release, "versionCodes")]
            if len(codes) != len(set(codes)):
                raise StatusError("Google gaf dubbele release-versionCodes terug.")
            fraction = release.get("userFraction")
            if fraction is not None and (
                    isinstance(fraction, bool) or not isinstance(fraction, (int, float))
                    or not math.isfinite(fraction) or not 0 < fraction < 1
                    or release["status"] not in {"inProgress", "halted"}):
                raise StatusError("Google gaf een ongeldig uitrolpercentage terug.")
            # Only allowlisted fields enter the artifact; no release notes,
            # release names, country targeting or arbitrary server metadata.
            releases.append({"versionCodes": sorted(codes), "status": release["status"],
                             "userFraction": fraction})
        result.append({"track": name, "releases": releases})
    return sorted(result, key=lambda track: track["track"])


def summarize_bundles(response):
    result = []
    codes = set()
    for bundle in list_field(response, "bundles"):
        if not isinstance(bundle, dict):
            raise StatusError("Google gaf een ongeldige bundelstructuur terug.")
        code = version_code(bundle.get("versionCode"))
        digest = bundle.get("sha256")
        if (code in codes or not isinstance(digest, str)
                or not re.fullmatch(r"[a-fA-F0-9]{64}", digest)):
            raise StatusError("Google gaf een dubbele bundel of ongeldige SHA-256 terug.")
        codes.add(code)
        result.append({"versionCode": code, "sha256": digest.lower()})
    return sorted(result, key=lambda bundle: bundle["versionCode"])


def inspect(publisher):
    edit = publisher.create_edit()
    # Do not use Edit.__exit__: a cleanup error must fail this inspection.
    try:
        tracks = summarize_tracks(publisher.request("GET", f"{edit.path}/tracks"))
        bundles = summarize_bundles(publisher.request("GET", f"{edit.path}/bundles"))
    finally:
        try:
            deleted = publisher.request("DELETE", edit.path)
            if deleted != {}:
                raise StatusError("Google bevestigde het verwijderen van de tijdelijke edit niet.")
        except (ReleaseError, StatusError):
            raise StatusError("Tijdelijke Play-edit kon niet worden opgeruimd; controleer Play Console.") from None
    return tracks, bundles


def lifecycle_status(publisher, track):
    path = f"/androidpublisher/v3/applications/{PACKAGE}/tracks/{quote(track, safe='')}/releases"
    try:
        response = publisher.request("GET", path)
    except PlayHttpError as error:
        if error.status not in (403, 404):
            raise
        return {"available": False, "httpStatus": error.status, "releases": []}
    releases = []
    for release in list_field(response, "releases"):
        if (not isinstance(release, dict) or release.get("track") != track
                or not isinstance(release.get("releaseLifecycleState"), str)
                or release["releaseLifecycleState"] not in LIFECYCLE_STATES):
            raise StatusError("Google gaf een ongeldige release-lifecycle terug.")
        codes = []
        for artifact in list_field(release, "activeArtifacts"):
            if not isinstance(artifact, dict):
                raise StatusError("Google gaf een ongeldige actieve releasebundel terug.")
            codes.append(version_code(artifact.get("versionCode")))
        releases.append({"versionCodes": sorted(set(codes)),
                         "releaseLifecycleState": release["releaseLifecycleState"]})
    return {"available": True, "httpStatus": 200, "releases": releases}


def run_status(args, environment):
    target = argparse.Namespace(project="fabelpad", project_number="471984799009",
                                environment="production", service_account=args.service_account)
    try:
        validate_target(target, environment)
    except ProbeError:
        raise StatusError("Deze statuscontrole vereist de vastgelegde Fabelpad-productieworkflow op main.") from None
    if environment.get("PLAY_STATUS_ACTION") != "status":
        raise StatusError("Deze statuscontrole vereist de expliciete workflowactie status.")
    token = environment.get("PLAY_ACCESS_TOKEN", "")
    if not re.fullmatch(r"[\x21-\x7e]{16,16384}", token):
        raise StatusError("PLAY_ACCESS_TOKEN ontbreekt of heeft een ongeldige vorm.")
    publisher = Publisher(PACKAGE, token)
    tracks, bundles = inspect(publisher)
    # The edit statuses alone do not prove Google review/publication state.
    # Read the separate lifecycle endpoint only after the edit is discarded.
    for track in tracks:
        track["lifecycle"] = lifecycle_status(publisher, track["track"])
    codes = {bundle["versionCode"] for bundle in bundles}
    codes.update(code for track in tracks for release in track["releases"] for code in release["versionCodes"])
    codes.update(code for track in tracks for release in track["lifecycle"]["releases"]
                 for code in release["versionCodes"])
    return {
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "packageName": PACKAGE, "repository": "fabelpad/platform",
        "sourceSha": environment["GITHUB_SHA"], "runId": environment["GITHUB_RUN_ID"],
        "runAttempt": environment["GITHUB_RUN_ATTEMPT"],
        "workflowRef": environment["GITHUB_WORKFLOW_REF"],
        "tracks": tracks, "bundles": bundles, "versionCodes": sorted(codes),
        "versionCodeScope": "current-tracks-bundles-and-release-lifecycles",
        "historicalVersionCodeInventoryComplete": False,
        "playEditCreated": True, "playEditDeleted": True,
        "playPublicationPerformed": False,
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--service-account", required=True)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args(argv)
    try:
        result = run_status(args, os.environ)
        args.output.write_text(json.dumps(result, indent=2, allow_nan=False) + "\n", encoding="utf-8")
        print("Play-status gelezen en tijdelijke edit verwijderd. Er is niets gepubliceerd.")
        return 0
    except StatusError as error:
        print(f"Play-statuscontrole gestopt: {error}", file=sys.stderr)
    except PlayHttpError as error:
        print(f"Play-statuscontrole gestopt: Google Play HTTP {error.status}.", file=sys.stderr)
    except (ReleaseError, OSError, ValueError, TypeError, AttributeError, OverflowError):
        print("Play-statuscontrole gestopt: onbetrouwbaar API-antwoord of resultaat kon niet veilig worden opgeslagen.",
              file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
