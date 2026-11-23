"""Exercise the diagnostic with synthetic tokens and transport doubles only."""
import argparse
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest import mock

spec = importlib.util.spec_from_file_location("probe_connection", Path(__file__).with_name("probe_connection.py"))
probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)

TOKEN = "synthetic-only-never-a-real-token"
NOW = 1795428000
ACCOUNT = "fabelpad-play-internal@fabelpad.iam.gserviceaccount.com"


def arguments(environment="internal", **changes):
    return argparse.Namespace(project="fabelpad", project_number="471984799009",
                              environment=environment,
                              service_account=f"fabelpad-play-{environment}@fabelpad.iam.gserviceaccount.com",
                              **changes)


def github_context(environment="internal", **changes):
    workflow, event = probe.WORKFLOWS[environment]
    return {
        "GITHUB_REPOSITORY": "fabelpad/platform", "GITHUB_REPOSITORY_ID": "1446419952",
        "GITHUB_REPOSITORY_OWNER_ID": "352706055", "GITHUB_REF": "refs/heads/main",
        "GITHUB_EVENT_NAME": event,
        "GITHUB_WORKFLOW_REF": f"fabelpad/platform/.github/workflows/{workflow}@refs/heads/main",
        "GITHUB_SHA": "a" * 40, "GITHUB_RUN_ID": "1234567", "GITHUB_RUN_ATTEMPT": "1",
        "PLAY_ACCESS_TOKEN": TOKEN, **changes,
    }


def token_claims(**changes):
    return {"email": ACCOUNT, "email_verified": "true", "scope": " ".join(sorted(probe.SCOPES)),
            "expires_in": "600", "exp": str(NOW + 600), **changes}


class Response:
    def __init__(self, status=200, body=None):
        self.status = status
        self.body = json.dumps(token_claims()).encode() if body is None else body
        self.read_sizes = []

    def read(self, size):
        self.read_sizes.append(size)
        return self.body[:size]


class Connection:
    def __init__(self, response=None, error=None):
        self.response = response or Response()
        self.error = error
        self.requests = []
        self.closed = False

    def request(self, *args, **kwargs):
        self.requests.append((args, kwargs))
        if self.error:
            raise self.error

    def getresponse(self):
        return self.response

    def close(self):
        self.closed = True


class Targets(unittest.TestCase):
    def test_both_exact_environments_are_pinned(self):
        for environment in probe.WORKFLOWS:
            self.assertEqual(probe.validate_target(arguments(environment), github_context(environment)),
                             f"fabelpad-play-{environment}@fabelpad.iam.gserviceaccount.com")

    def test_wrong_project_number_account_or_cross_environment_is_rejected_before_network(self):
        for key, value in (("project", "other"), ("project_number", "42"),
                           ("service_account", "fabelpad-play-production@fabelpad.iam.gserviceaccount.com"),
                           ("service_account", ACCOUNT + "\n")):
            args = arguments()
            setattr(args, key, value)
            with self.subTest(key=key, value=value), self.assertRaises(probe.ProbeError):
                probe.validate_target(args, github_context())

    def test_other_repository_owner_branch_event_or_workflow_is_rejected(self):
        for key in ("GITHUB_REPOSITORY", "GITHUB_REPOSITORY_ID", "GITHUB_REPOSITORY_OWNER_ID",
                    "GITHUB_REF", "GITHUB_EVENT_NAME", "GITHUB_WORKFLOW_REF"):
            for value in ("", "untrusted"):
                with self.subTest(key=key, value=value), self.assertRaises(probe.ProbeError):
                    probe.validate_target(arguments(), github_context(**{key: value}))

    def test_run_metadata_must_be_nonempty_and_well_formed(self):
        for key in ("GITHUB_SHA", "GITHUB_RUN_ID", "GITHUB_RUN_ATTEMPT"):
            for value in ("", "0", "1\nattack=true", "../other"):
                with self.subTest(key=key, value=value), self.assertRaises(probe.ProbeError):
                    probe.validate_target(arguments(), github_context(**{key: value}))

    def test_missing_or_malformed_token_never_opens_network(self):
        with mock.patch.object(probe.http.client, "HTTPSConnection") as network:
            for token in ("", "short", TOKEN + "\n", " " + TOKEN, "x" * 16385):
                with self.subTest(length=len(token)), self.assertRaises(probe.ProbeError):
                    probe.run_probe(arguments(), github_context(PLAY_ACCESS_TOKEN=token))
            network.assert_not_called()


class Claims(unittest.TestCase):
    def test_exact_identity_verified_scope_and_expiry(self):
        for verified in (True, "true"):
            self.assertEqual(probe.verify_claims(token_claims(email_verified=verified), ACCOUNT, NOW), NOW + 600)

    def test_missing_or_unverified_identity_is_rejected(self):
        for changes in ({"email": None}, {"email": "other@example.com"}, {"email_verified": False},
                        {"email_verified": "false"}, {"email_verified": 1}, {"email_verified": None}):
            with self.subTest(changes=changes), self.assertRaises(probe.ProbeError):
                probe.verify_claims(token_claims(**changes), ACCOUNT, NOW)

    def test_scope_must_contain_exactly_the_two_requested_scopes(self):
        for scope in (None, [], "", "https://www.googleapis.com/auth/androidpublisher",
                      " ".join(probe.SCOPES) + " https://www.googleapis.com/auth/cloud-platform"):
            with self.subTest(scope=scope), self.assertRaises(probe.ProbeError):
                probe.verify_claims(token_claims(scope=scope), ACCOUNT, NOW)

    def test_missing_expired_implausible_and_mismatched_expiries_are_rejected(self):
        for changes in ({"expires_in": None}, {"expires_in": True}, {"expires_in": "1.5"},
                        {"expires_in": 0}, {"expires_in": -1}, {"expires_in": 43201},
                        {"exp": None}, {"exp": NOW}, {"exp": NOW - 1},
                        {"exp": NOW + 43201}, {"exp": NOW + 100}):
            with self.subTest(changes=changes), self.assertRaises(probe.ProbeError):
                probe.verify_claims(token_claims(**changes), ACCOUNT, NOW)

    def test_non_object_claims_are_rejected(self):
        for value in (None, [], "", True):
            with self.subTest(value=value), self.assertRaises(probe.ProbeError):
                probe.verify_claims(value, ACCOUNT, NOW)


class Transport(unittest.TestCase):
    def test_tokeninfo_uses_pinned_https_post_and_header_only_token(self):
        connection = Connection()
        with mock.patch.object(probe.http.client, "HTTPSConnection", return_value=connection) as factory:
            self.assertEqual(probe.token_information(TOKEN), token_claims())
        factory.assert_called_once_with("oauth2.googleapis.com", timeout=30)
        positional, keyword = connection.requests[0]
        self.assertEqual(positional, ("POST", "/tokeninfo"))
        self.assertEqual(keyword["body"], b"")
        self.assertEqual(keyword["headers"]["Authorization"], f"Bearer {TOKEN}")
        self.assertEqual(connection.response.read_sizes, [65537])
        self.assertTrue(connection.closed)

    def test_tokeninfo_unsupported_status_and_redirect_never_disclose_response(self):
        for status in (301, 302, 400, 401, 403, 429, 500):
            response = Response(status, (TOKEN + " secret error").encode())
            connection = Connection(response)
            with self.subTest(status=status), mock.patch.object(probe.http.client, "HTTPSConnection", return_value=connection):
                with self.assertRaises(probe.ProbeError) as caught:
                    probe.token_information(TOKEN)
                self.assertNotIn(TOKEN, str(caught.exception))
            self.assertEqual(response.read_sizes, [])
            self.assertTrue(connection.closed)

    def test_tokeninfo_oversize_or_non_json_response_is_rejected(self):
        for body in (b"x" * 65537, b"not json", b"\xff"):
            connection = Connection(Response(body=body))
            with self.subTest(length=len(body)), mock.patch.object(probe.http.client, "HTTPSConnection", return_value=connection):
                with self.assertRaises(probe.ProbeError):
                    probe.token_information(TOKEN)
            self.assertTrue(connection.closed)

    def test_play_get_never_reads_private_review_or_error_content(self):
        for status in (200, 403, 404):
            response = Response(status, b'{"private": "synthetic review personal data"}')
            connection = Connection(response)
            with self.subTest(status=status), mock.patch.object(probe.http.client, "HTTPSConnection", return_value=connection) as factory:
                self.assertEqual(probe.probe_play(TOKEN), status)
            factory.assert_called_once_with("androidpublisher.googleapis.com", timeout=30)
            positional, keyword = connection.requests[0]
            self.assertEqual(positional, ("GET", "/androidpublisher/v3/applications/nl.fabelpad.app/reviews?maxResults=1"))
            self.assertEqual(keyword["headers"]["Authorization"], f"Bearer {TOKEN}")
            self.assertNotIn("body", keyword)
            self.assertEqual(response.read_sizes, [])
            self.assertTrue(connection.closed)

    def test_unexpected_play_status_is_a_hard_error_without_response_body(self):
        for status in (301, 401, 429, 500):
            response = Response(status, TOKEN.encode())
            with self.subTest(status=status), mock.patch.object(probe.http.client, "HTTPSConnection", return_value=Connection(response)):
                with self.assertRaises(probe.ProbeError) as caught:
                    probe.probe_play(TOKEN)
                self.assertNotIn(TOKEN, str(caught.exception))
            self.assertEqual(response.read_sizes, [])

    def test_transport_exceptions_do_not_echo_credentials(self):
        for operation in (probe.token_information, probe.probe_play):
            connection = Connection(error=OSError(TOKEN))
            with self.subTest(operation=operation.__name__), mock.patch.object(probe.http.client, "HTTPSConnection", return_value=connection):
                with self.assertRaises(probe.ProbeError) as caught:
                    operation(TOKEN)
                self.assertNotIn(TOKEN, str(caught.exception))
            self.assertTrue(connection.closed)


class Command(unittest.TestCase):
    def test_report_distinguishes_verified_oauth_from_open_play_permissions(self):
        for status in (200, 403, 404):
            with self.subTest(status=status), tempfile.TemporaryDirectory() as directory:
                result_file = Path(directory) / "metadata.json"
                github_output = Path(directory) / "github-output"
                output = io.StringIO()
                with mock.patch.dict(os.environ, github_context(), clear=True), mock.patch.object(probe.time, "time", return_value=NOW), \
                        mock.patch.object(probe, "token_information", return_value=token_claims()), \
                        mock.patch.object(probe, "probe_play", return_value=status), \
                        contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):
                    code = probe.main(["--project", "fabelpad", "--project-number", "471984799009",
                                       "--environment", "internal", "--service-account", ACCOUNT,
                                       "--output", str(result_file), "--github-output", str(github_output)])
                self.assertEqual(code, 0)
                report = json.loads(result_file.read_text())
                self.assertTrue(report["oidcExchangeVerified"])
                self.assertEqual(report["playReadAccessVerified"], status == 200)
                self.assertEqual(report["playHttpStatus"], status)
                for key in ("playReleasePermissionsVerified", "playPublicationPerformed", "playEditCreated",
                            "reviewResponseBodyRead", "serviceAccountKeysCreated"):
                    self.assertFalse(report[key])
                all_written = result_file.read_text() + github_output.read_text() + output.getvalue()
                self.assertNotIn(TOKEN, all_written)
                self.assertEqual(set(Path(directory).iterdir()), {result_file, github_output})
                self.assertIn("oidc_exchange_verified=true\n", github_output.read_text())
                self.assertIn(f"play_read_access_verified={str(status == 200).lower()}\n", github_output.read_text())

    def test_failed_identity_never_writes_success_report_or_calls_play(self):
        with tempfile.TemporaryDirectory() as directory:
            result_file = Path(directory) / "metadata.json"
            output = io.StringIO()
            with mock.patch.dict(os.environ, github_context(), clear=True), \
                    mock.patch.object(probe.time, "time", return_value=NOW), \
                    mock.patch.object(probe, "token_information", return_value=token_claims(email=TOKEN)), \
                    mock.patch.object(probe, "probe_play") as play, \
                    contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):
                code = probe.main(["--project", "fabelpad", "--project-number", "471984799009",
                                   "--environment", "internal", "--service-account", ACCOUNT,
                                   "--output", str(result_file)])
            self.assertEqual(code, 1)
            play.assert_not_called()
            self.assertFalse(result_file.exists())
            self.assertNotIn(TOKEN, output.getvalue())


if __name__ == "__main__":
    unittest.main()
