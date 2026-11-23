#!/usr/bin/env python3
"""Verify one Fabelpad Actions/WIF connection without opening a Play edit.

PLAY_ACCESS_TOKEN is accepted only through the process environment. Google
tokeninfo uses POST and an Authorization header, as in Google's own auth client:
https://github.com/googleapis/google-auth-library-nodejs/blob/main/src/auth/oauth2client.ts
The userinfo.email scope is required to verify the service-account email:
https://docs.cloud.google.com/docs/authentication/token-types#service_account_access_tokens
Google's email shorthand has the same scope meaning (observed redundantly in
tokeninfo during the 2026-11-23 connection check):
https://developers.google.com/identity/protocols/oauth2/scopes
The only Play call is GET reviews.list with maxResults=1. Its body is discarded:
https://developers.google.com/android-publisher/api-ref/rest/v3/reviews/list
Sources checked 2026-11-23. This is a diagnostic, never a release authorization.
"""

import argparse
from datetime import datetime, timezone
import http.client
import json
import os
from pathlib import Path
import re
import sys
import time

PROJECT = "fabelpad"
PROJECT_NUMBER = "471984799009"
REPOSITORY = "fabelpad/platform"
REPOSITORY_ID = "1446419952"
OWNER_ID = "352706055"
PACKAGE = "nl.fabelpad.app"
SCOPES = frozenset({"https://www.googleapis.com/auth/androidpublisher",
                    "https://www.googleapis.com/auth/userinfo.email"})
# Diagnostics may name only these static public identifiers, never arbitrary
# server text. In particular, a malformed scope could itself contain a token.
DIAGNOSTIC_SCOPES = SCOPES | frozenset({"openid", "email", "profile",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/cloud-platform"})
MAX_TOKENINFO_BYTES = 65536
PLAY_PATH = f"/androidpublisher/v3/applications/{PACKAGE}/reviews?maxResults=1"
WORKFLOWS = {
    "internal": ("fabelpad-android-ci.yml", "push"),
    "production": ("fabelpad-play-production.yml", "workflow_dispatch"),
}


class ProbeError(Exception):
    """Only fixed, non-secret messages cross the command-line boundary."""


def validate_target(args, environment):
    expected_account = f"fabelpad-play-{args.environment}@{PROJECT}.iam.gserviceaccount.com"
    if (args.project != PROJECT or args.project_number != PROJECT_NUMBER
            or args.service_account != expected_account):
        raise ProbeError("Doelproject, projectnummer of serviceaccount wijkt af van Fabelpad.")
    workflow, event = WORKFLOWS[args.environment]
    expected = {
        "GITHUB_REPOSITORY": REPOSITORY,
        "GITHUB_REPOSITORY_ID": REPOSITORY_ID,
        "GITHUB_REPOSITORY_OWNER_ID": OWNER_ID,
        "GITHUB_REF": "refs/heads/main",
        "GITHUB_EVENT_NAME": event,
        "GITHUB_WORKFLOW_REF": f"{REPOSITORY}/.github/workflows/{workflow}@refs/heads/main",
    }
    if any(environment.get(key) != value for key, value in expected.items()):
        raise ProbeError("Deze controle vereist de vastgelegde Fabelpad-mainworkflow en repository-identiteit.")
    if (not re.fullmatch(r"[a-f0-9]{40}", environment.get("GITHUB_SHA", ""))
            or not re.fullmatch(r"[1-9][0-9]*", environment.get("GITHUB_RUN_ID", ""))
            or not re.fullmatch(r"[1-9][0-9]*", environment.get("GITHUB_RUN_ATTEMPT", ""))):
        raise ProbeError("Een geldige Actions-run en volledige commit-SHA zijn vereist.")
    return expected_account


def integer_field(value):
    if isinstance(value, bool) or not re.fullmatch(r"[0-9]{1,12}", str(value)):
        raise ProbeError("Google gaf geen geldige tokenvervaltijd terug.")
    return int(value)


def describe_scopes(value):
    if not isinstance(value, str):
        return "geen tekstveld"
    if len(value) > 2048:
        return "te lang; inhoud afgeschermd"
    items = value.split()
    visible = sorted(set(items) & DIAGNOSTIC_SCOPES)
    hidden = len(items) - len(visible)
    return ", ".join(visible) + (f"; {hidden} onbekende items afgeschermd" if hidden else "") or "leeg"


def verify_claims(claims, expected_account, now):
    if not isinstance(claims, dict):
        raise ProbeError("Google gaf geen geldig tokeninformatie-object terug.")
    verified = claims.get("email_verified")
    if (claims.get("email") != expected_account
            or not (verified is True or verified == "true")):
        raise ProbeError("De daadwerkelijke Google-tokenidentiteit is niet het verwachte geverifieerde serviceaccount.")
    scope = claims.get("scope")
    # Accept only the redundant "email" identifier seen in Google tokeninfo.
    # The two canonical scopes remain required; aliases cannot replace either
    # one, and openid/profile/cloud-platform remain forbidden.
    if not isinstance(scope, str) or frozenset(scope.split()) - {"email"} != SCOPES:
        raise ProbeError("De daadwerkelijke OAuth-scopes wijken af van de twee beperkte controlescopes. "
                         f"Ontvangen, veilig samengevat: {describe_scopes(scope)}.")
    remaining = integer_field(claims.get("expires_in"))
    expiry = integer_field(claims.get("exp"))
    if not 0 < remaining <= 43200 or not 0 < expiry - now <= 43200:
        raise ProbeError("Het Google-token is verlopen of heeft een onverwachte geldigheidsduur.")
    if abs((expiry - now) - remaining) > 120:
        raise ProbeError("De Google-tokenvervaltijden komen niet overeen.")
    return expiry


def token_information(access_token):
    connection = http.client.HTTPSConnection("oauth2.googleapis.com", timeout=30)
    try:
        # Do not put a credential in a URL, exception message, subprocess or file.
        # This header-only POST matches Google's getTokenInfo implementation.
        connection.request("POST", "/tokeninfo", body=b"", headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
            "Accept": "application/json",
        })
        response = connection.getresponse()
        if response.status != 200:
            raise ProbeError("Google kon de daadwerkelijke OAuth-tokenidentiteit niet bevestigen.")
        raw = response.read(MAX_TOKENINFO_BYTES + 1)
        if len(raw) > MAX_TOKENINFO_BYTES:
            raise ProbeError("Het antwoord van Google tokeninfo overschrijdt de toegestane omvang.")
        try:
            return json.loads(raw)
        except (ValueError, UnicodeError):
            raise ProbeError("Google gaf onleesbare tokeninformatie terug.") from None
    except (OSError, http.client.HTTPException):
        raise ProbeError("De beveiligde verbinding met Google tokeninfo kon niet worden voltooid.") from None
    finally:
        connection.close()


def probe_play(access_token):
    connection = http.client.HTTPSConnection("androidpublisher.googleapis.com", timeout=30)
    try:
        connection.request("GET", PLAY_PATH, headers={
            "Authorization": f"Bearer {access_token}", "Accept": "application/json",
        })
        response = connection.getresponse()
        status = response.status
        # Review content may contain personal data. Do not read, parse or persist
        # the response body, including Google's error payloads. Closing the
        # connection discards it; no request can mutate a review or a release.
        if status not in (200, 403, 404):
            raise ProbeError("De alleen-lezen Play-controle kon niet betrouwbaar worden voltooid.")
        return status
    except (OSError, http.client.HTTPException):
        raise ProbeError("De beveiligde alleen-lezen verbinding met Google Play is onderbroken.") from None
    finally:
        connection.close()


def run_probe(args, environment):
    expected_account = validate_target(args, environment)
    access_token = environment.get("PLAY_ACCESS_TOKEN", "")
    if not re.fullmatch(r"[\x21-\x7e]{16,16384}", access_token):
        raise ProbeError("PLAY_ACCESS_TOKEN ontbreekt of heeft een ongeldige vorm.")
    now = int(time.time())
    claims = token_information(access_token)
    expiry = verify_claims(claims, expected_account, now)
    status = probe_play(access_token)
    return {
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "projectId": PROJECT, "projectNumber": PROJECT_NUMBER,
        "repository": REPOSITORY, "repositoryId": REPOSITORY_ID, "ownerId": OWNER_ID,
        "packageName": PACKAGE, "environment": f"fabelpad-play-{args.environment}",
        "serviceAccount": expected_account,
        "commit": environment["GITHUB_SHA"], "runId": environment["GITHUB_RUN_ID"],
        "runAttempt": environment["GITHUB_RUN_ATTEMPT"],
        "workflowRef": environment["GITHUB_WORKFLOW_REF"],
        "oidcExchangeVerified": True, "tokenIdentityVerified": True,
        "scopes": sorted(SCOPES),
        "returnedScopes": sorted(set(claims["scope"].split())),
        "tokenExpiresAt": datetime.fromtimestamp(expiry, timezone.utc).isoformat(),
        "playHttpStatus": status, "playReadAccessVerified": status == 200,
        "playReleasePermissionsVerified": False,
        "playPublicationPerformed": False, "playEditCreated": False,
        "reviewResponseBodyRead": False, "serviceAccountKeysCreated": False,
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", required=True)
    parser.add_argument("--project-number", required=True)
    parser.add_argument("--environment", required=True, choices=tuple(WORKFLOWS))
    parser.add_argument("--service-account", required=True)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--github-output", type=Path)
    args = parser.parse_args(argv)
    try:
        result = run_probe(args, os.environ)
        args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
        if args.github_output:
            with args.github_output.open("a", encoding="utf-8") as output:
                output.write("oidc_exchange_verified=true\n")
                output.write(f"play_read_access_verified={str(result['playReadAccessVerified']).lower()}\n")
                output.write(f"play_http_status={result['playHttpStatus']}\n")
        print("Bevestigd: tijdelijke Google-toegang, verwacht serviceaccount en beperkte OAuth-scopes.")
        if result["playReadAccessVerified"]:
            print("Bevestigd: alleen-lezen app-toegang. Publicatierechten en een release zijn niet getest.")
        else:
            print(f"Play-app-toegang nog niet bevestigd (HTTP {result['playHttpStatus']}); "
                  "controleer appregistratie en apprechten in Play Console.")
        return 0
    except ProbeError as error:
        print(f"Verbindingscontrole gestopt: {error}", file=sys.stderr)
        return 1
    except (OSError, ValueError, TypeError, OverflowError):
        # In particular, never print an arbitrary transport/path/JSON error that
        # could contain a credential supplied by a remote endpoint or argument.
        print("Verbindingscontrole gestopt: ongeldige metadata of resultaat kon niet veilig worden opgeslagen.",
              file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
