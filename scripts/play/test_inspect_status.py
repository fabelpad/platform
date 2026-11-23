"""Verify current-track inspection and mandatory cleanup with synthetic API data."""
import argparse
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock

with mock.patch.object(sys, 'path', [str(Path(__file__).parent), *sys.path]):
    spec = importlib.util.spec_from_file_location('inspect_status', Path(__file__).with_name('inspect_status.py'))
    status = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(status)

TOKEN = 'synthetic-only-never-a-real-token'
ACCOUNT = 'fabelpad-play-production@fabelpad.iam.gserviceaccount.com'
EDIT_PATH = '/androidpublisher/v3/applications/nl.fabelpad.app/edits/synthetic-edit'


def context(**changes):
    return {
        'GITHUB_REPOSITORY': 'fabelpad/platform', 'GITHUB_REPOSITORY_ID': '1446419952',
        'GITHUB_REPOSITORY_OWNER_ID': '352706055', 'GITHUB_REF': 'refs/heads/main',
        'GITHUB_EVENT_NAME': 'workflow_dispatch',
        'GITHUB_WORKFLOW_REF': 'fabelpad/platform/.github/workflows/fabelpad-play-production.yml@refs/heads/main',
        'GITHUB_SHA': 'a' * 40, 'GITHUB_RUN_ID': '1234567', 'GITHUB_RUN_ATTEMPT': '1',
        'PLAY_ACCESS_TOKEN': TOKEN, 'PLAY_STATUS_ACTION': 'status', **changes,
    }


def tracks():
    return {'tracks': [
        {'track': 'production', 'releases': [
            {'versionCodes': ['2'], 'status': 'completed', 'releaseNotes': [{'text': TOKEN}]},
            {'versionCodes': ['3'], 'status': 'inProgress', 'userFraction': 0.1}]},
        {'track': 'internal', 'releases': [{'versionCodes': ['4'], 'status': 'draft'}]},
        {'track': 'wear:production'},
    ]}


def bundles():
    return {'bundles': [{'versionCode': 5, 'sha256': 'B' * 64},
                        {'versionCode': 3, 'sha256': 'a' * 64, 'ignored': TOKEN}]}


def publisher(*responses):
    result = mock.Mock()
    result.create_edit.return_value.path = EDIT_PATH
    result.request.side_effect = list(responses or (tracks(), bundles(), {},
        {'releases': [{'track': 'internal', 'activeArtifacts': [{'versionCode': 4}],
                       'releaseLifecycleState': 'RELEASE_LIFECYCLE_STATE_DRAFT', 'releaseName': TOKEN}]},
        {'releases': [{'track': 'production', 'activeArtifacts': [{'versionCode': 2}],
                       'releaseLifecycleState': 'RELEASE_LIFECYCLE_STATE_PUBLISHED'}]}, {}))
    return result


class ContextBoundary(unittest.TestCase):
    def test_other_identity_ref_event_workflow_action_and_token_fail_before_network(self):
        for key in ('GITHUB_REPOSITORY', 'GITHUB_REPOSITORY_ID', 'GITHUB_REPOSITORY_OWNER_ID',
                    'GITHUB_REF', 'GITHUB_EVENT_NAME', 'GITHUB_WORKFLOW_REF', 'GITHUB_SHA',
                    'GITHUB_RUN_ID', 'GITHUB_RUN_ATTEMPT', 'PLAY_STATUS_ACTION', 'PLAY_ACCESS_TOKEN'):
            with self.subTest(key=key), mock.patch.object(status, 'Publisher') as network:
                with self.assertRaises(status.StatusError):
                    status.run_status(argparse.Namespace(service_account=ACCOUNT), context(**{key: ''}))
                network.assert_not_called()
        for account in ('fabelpad-play-internal@fabelpad.iam.gserviceaccount.com', ACCOUNT + '\n'):
            with self.subTest(account=account), mock.patch.object(status, 'Publisher') as network:
                with self.assertRaises(status.StatusError):
                    status.run_status(argparse.Namespace(service_account=account), context())
                network.assert_not_called()


class Inspection(unittest.TestCase):
    def test_only_edit_creation_two_gets_and_delete_occur(self):
        client = publisher()
        track_result, bundle_result = status.inspect(client)
        client.create_edit.assert_called_once_with()
        self.assertEqual(client.method_calls, [mock.call.create_edit(),
                         mock.call.request('GET', EDIT_PATH + '/tracks'),
                         mock.call.request('GET', EDIT_PATH + '/bundles'),
                         mock.call.request('DELETE', EDIT_PATH)])
        self.assertEqual(track_result[0]['releases'][0]['status'], 'draft')
        self.assertEqual(bundle_result, [{'versionCode': 3, 'sha256': 'a' * 64},
                                         {'versionCode': 5, 'sha256': 'b' * 64}])
        self.assertNotIn(TOKEN, json.dumps((track_result, bundle_result)))

    def test_get_or_validation_failure_still_deletes_the_edit(self):
        for responses in ([status.ReleaseError(TOKEN), {}],
                          [tracks(), status.ReleaseError(TOKEN), {}],
                          [{'tracks': 'invalid'}, {}],
                          [tracks(), {'bundles': [None]}, {}]):
            client = publisher(*responses)
            with self.subTest(responses=responses), self.assertRaises((status.ReleaseError, status.StatusError)):
                status.inspect(client)
            self.assertEqual(client.request.call_args, mock.call('DELETE', EDIT_PATH))

    def test_cleanup_failure_fails_even_after_successful_gets_or_an_earlier_error(self):
        for responses in ([tracks(), bundles(), status.ReleaseError(TOKEN)],
                          [tracks(), bundles(), {'unexpected': TOKEN}],
                          [status.ReleaseError('prior failure'), status.ReleaseError(TOKEN)]):
            with self.subTest(responses=responses), self.assertRaises(status.StatusError) as caught:
                status.inspect(publisher(*responses))
            self.assertIn('opgeruimd', str(caught.exception))
            self.assertNotIn(TOKEN, str(caught.exception))

    def test_failed_edit_creation_never_attempts_to_delete_an_unknown_edit(self):
        client = publisher()
        client.create_edit.side_effect = status.ReleaseError(TOKEN)
        with self.assertRaises(status.ReleaseError):
            status.inspect(client)
        client.request.assert_not_called()

    def test_malformed_tracks_codes_status_and_fraction_are_rejected(self):
        for response in (None, {'tracks': [None]}, {'tracks': [{'track': '../private'}]},
                         {'tracks': [{'track': 'internal'}, {'track': 'internal'}]},
                         {'tracks': [{'track': 'internal', 'releases': None}]}):
            with self.subTest(response=response), self.assertRaises(status.StatusError):
                status.summarize_tracks(response)
        for extra in ({'status': 'unknown'}, {'status': []}, {'versionCodes': [True]},
                      {'versionCodes': ['0']}, {'versionCodes': ['2100000001']},
                      {'versionCodes': ['2', 2]}, {'versionCodes': None},
                      {'userFraction': float('nan')}, {'userFraction': True}, {'userFraction': 0.1}):
            release = {'versionCodes': ['2'], 'status': 'completed', **extra}
            with self.subTest(extra=extra), self.assertRaises(status.StatusError):
                status.summarize_tracks({'tracks': [{'track': 'production', 'releases': [release]}]})

    def test_malformed_bundles_and_duplicate_codes_are_rejected(self):
        for response in (None, {'bundles': {}}, {'bundles': [None]},
                         {'bundles': [{'versionCode': 3, 'sha256': TOKEN}]},
                         {'bundles': [{'versionCode': False, 'sha256': 'a' * 64}]},
                         {'bundles': [bundles()['bundles'][0]] * 2}):
            with self.subTest(response=response), self.assertRaises(status.StatusError):
                status.summarize_bundles(response)
        self.assertEqual(status.summarize_tracks({}), [])
        self.assertEqual(status.summarize_bundles({}), [])


class Command(unittest.TestCase):
    def test_artifact_is_allowlisted_bound_to_source_and_written_after_cleanup(self):
        with tempfile.TemporaryDirectory() as directory:
            output_file = Path(directory) / 'status.json'
            client = publisher()
            output = io.StringIO()
            with mock.patch.dict(os.environ, context(), clear=True), \
                    mock.patch.object(status, 'Publisher', return_value=client) as factory, \
                    contextlib.redirect_stdout(output):
                self.assertEqual(status.main(['--service-account', ACCOUNT, '--output', str(output_file)]), 0)
            factory.assert_called_once_with('nl.fabelpad.app', TOKEN)
            report = json.loads(output_file.read_text())
            self.assertEqual(report['sourceSha'], 'a' * 40)
            self.assertEqual(report['versionCodes'], [2, 3, 4, 5])
            self.assertEqual(report['tracks'][1]['lifecycle']['releases'],
                             [{'versionCodes': [2], 'releaseLifecycleState': 'RELEASE_LIFECYCLE_STATE_PUBLISHED'}])
            self.assertTrue(report['playEditCreated'])
            self.assertTrue(report['playEditDeleted'])
            self.assertFalse(report['playPublicationPerformed'])
            self.assertFalse(report['historicalVersionCodeInventoryComplete'])
            self.assertNotIn(TOKEN, output_file.read_text() + output.getvalue())
            self.assertEqual(set(Path(directory).iterdir()), {output_file})

    def test_failures_write_no_artifact_and_do_not_expose_server_payload(self):
        for responses in ([tracks(), bundles(), status.ReleaseError(TOKEN)],
                          [status.PlayHttpError(403, {'error': {'message': TOKEN}}), {}],
                          [{'tracks': [{'track': TOKEN + '\n'}]}, {}]):
            with self.subTest(responses=responses), tempfile.TemporaryDirectory() as directory:
                output_file = Path(directory) / 'status.json'
                output = io.StringIO()
                with mock.patch.dict(os.environ, context(), clear=True), \
                        mock.patch.object(status, 'Publisher', return_value=publisher(*responses)), \
                        contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):
                    self.assertEqual(status.main(['--service-account', ACCOUNT, '--output', str(output_file)]), 1)
                self.assertFalse(output_file.exists())
                self.assertNotIn(TOKEN, output.getvalue())


class Lifecycle(unittest.TestCase):
    def test_pinned_get_discards_names_and_reports_lifecycle_separately(self):
        client = mock.Mock()
        client.request.return_value = {'releases': [{
            'track': 'wear:production', 'releaseName': TOKEN,
            'activeArtifacts': [{'versionCode': 6}],
            'releaseLifecycleState': 'RELEASE_LIFECYCLE_STATE_IN_REVIEW'}]}
        result = status.lifecycle_status(client, 'wear:production')
        client.request.assert_called_once_with('GET',
            '/androidpublisher/v3/applications/nl.fabelpad.app/tracks/wear%3Aproduction/releases')
        self.assertEqual(result['releases'], [{'versionCodes': [6],
            'releaseLifecycleState': 'RELEASE_LIFECYCLE_STATE_IN_REVIEW'}])
        self.assertNotIn(TOKEN, json.dumps(result))

    def test_unavailable_lifecycle_is_explicit_and_other_http_errors_fail(self):
        for http_status in (403, 404, 401, 429, 500):
            client = mock.Mock()
            client.request.side_effect = status.PlayHttpError(http_status, {'error': {'message': TOKEN}})
            with self.subTest(status=http_status):
                if http_status in (403, 404):
                    self.assertEqual(status.lifecycle_status(client, 'production'),
                                     {'available': False, 'httpStatus': http_status, 'releases': []})
                else:
                    with self.assertRaises(status.PlayHttpError):
                        status.lifecycle_status(client, 'production')

    def test_malformed_or_cross_track_lifecycle_is_rejected(self):
        for release in ({'track': 'other', 'releaseLifecycleState': 'RELEASE_LIFECYCLE_STATE_PUBLISHED'},
                        {'track': 'production', 'releaseLifecycleState': 'unknown'},
                        {'track': 'production', 'releaseLifecycleState': []},
                        {'track': 'production', 'releaseLifecycleState': 'RELEASE_LIFECYCLE_STATE_PUBLISHED',
                         'activeArtifacts': [None]}):
            client = mock.Mock()
            client.request.return_value = {'releases': [release]}
            with self.subTest(release=release), self.assertRaises(status.StatusError):
                status.lifecycle_status(client, 'production')


if __name__ == '__main__':
    unittest.main()
