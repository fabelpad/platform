"""Exercise the credential-bearing job conditions without credentials or publication."""
from itertools import product
from pathlib import Path
import re
import unittest


WORKFLOWS = Path(__file__).resolve().parents[2] / '.github' / 'workflows'


def job_text(workflow, name):
    text = (WORKFLOWS / workflow).read_text(encoding='utf-8')
    match = re.search(r'^  ' + re.escape(name) + r':\n(?P<job>(?:[ \t].*\n|\n)*?)(?=^  [a-z_]+:|\Z)',
                      text, re.MULTILINE)
    if not match:
        raise AssertionError(f'Missing workflow job: {name}')
    return match.group('job')


def allows(job, values):
    expression = re.search(r'^    if: (.+)$', job, re.MULTILINE).group(1)
    # This small evaluator is deliberately limited to the reviewed job conditions.
    expression = re.sub(r'\b[a-z_]\w*(?:\.[a-z_]\w*)+\b',
                        lambda token: repr(values[token.group()]), expression)
    expression = expression.replace('&&', ' and ').replace('||', ' or ')
    return bool(eval(expression, {'__builtins__': {}}, {}))


class CredentialJobBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.values = {'github.event_name': 'push', 'github.ref': 'refs/heads/main',
                       'github.repository': 'fabelpad/platform', 'inputs.action': 'verify',
                       'inputs.signed_bundle': False, 'needs.verify.outputs.native_changed': 'true',
                       'needs.play_config.outputs.connection_check_enabled': 'true',
                       'needs.play_config.outputs.signing_enabled': 'false',
                       'needs.play_config.outputs.play_enabled': 'false'}

    def test_internal_probe_only_has_the_reviewed_main_push_context(self):
        job = job_text('fabelpad-android-ci.yml', 'connection')
        for event, ref, repository, enabled in product(
                ['push', 'pull_request', 'workflow_dispatch'],
                ['refs/heads/main', 'refs/heads/unreviewed', 'refs/tags/fabelpad-v1.0.2'],
                ['fabelpad/platform', 'someone/fork'], ['true', 'false']):
            values = {**self.values, 'github.event_name': event, 'github.ref': ref,
                      'github.repository': repository,
                      'needs.play_config.outputs.connection_check_enabled': enabled}
            self.assertEqual(allows(job, values),
                             event == 'push' and ref == 'refs/heads/main'
                             and repository == 'fabelpad/platform' and enabled == 'true')

    def test_production_probe_only_has_the_reviewed_verify_context(self):
        job = job_text('fabelpad-play-production.yml', 'connection')
        for event, action, enabled in product(['push', 'workflow_dispatch', 'pull_request'],
                                              ['verify', 'status', 'complete', 'halt'], ['true', 'false']):
            values = {**self.values, 'github.event_name': event, 'inputs.action': action,
                      'needs.play_config.outputs.connection_check_enabled': enabled}
            self.assertEqual(allows(job, values),
                             event == 'workflow_dispatch' and action == 'verify' and enabled == 'true')

    def test_status_only_has_the_reviewed_main_production_dispatch_context(self):
        job = job_text('fabelpad-play-production.yml', 'status')
        for event, action, ref, repository, enabled in product(
                ['push', 'workflow_dispatch', 'pull_request'],
                ['verify', 'status', 'complete', 'halt'],
                ['refs/heads/main', 'refs/heads/unreviewed', 'refs/tags/fabelpad-v1.0.2'],
                ['fabelpad/platform', 'someone/fork'], ['true', 'false']):
            values = {**self.values, 'github.event_name': event, 'inputs.action': action,
                      'github.ref': ref, 'github.repository': repository,
                      'needs.play_config.outputs.connection_check_enabled': enabled}
            self.assertEqual(allows(job, values),
                             event == 'workflow_dispatch' and action == 'status'
                             and ref == 'refs/heads/main' and repository == 'fabelpad/platform'
                             and enabled == 'true')

    def test_verify_status_and_unknown_actions_cannot_enter_release_when_play_is_enabled(self):
        job = job_text('fabelpad-play-production.yml', 'release')
        for enabled, action in product(['true', 'false'], ['verify', 'status', '', 'unknown']):
            self.assertFalse(allows(job, {**self.values, 'github.event_name': 'workflow_dispatch',
                                        'inputs.action': action,
                                        'needs.play_config.outputs.play_enabled': enabled}))

    def test_release_dispatch_only_allows_complete_or_halt_on_main(self):
        job = job_text('fabelpad-play-production.yml', 'release')
        for event, action, ref in product(['workflow_dispatch', 'pull_request'],
                                          ['verify', 'status', 'complete', 'halt'],
                                          ['refs/heads/main', 'refs/heads/unreviewed']):
            values = {**self.values, 'github.event_name': event, 'inputs.action': action,
                      'github.ref': ref, 'needs.play_config.outputs.play_enabled': 'true'}
            self.assertEqual(allows(job, values), event == 'workflow_dispatch'
                             and action in {'complete', 'halt'} and ref == 'refs/heads/main')

    def test_current_false_gates_prevent_signing_and_release_in_every_dispatch(self):
        signed = job_text('fabelpad-android-ci.yml', 'signed')
        release = job_text('fabelpad-play-production.yml', 'release')
        for event, action, request in product(['push', 'workflow_dispatch', 'pull_request'],
                                              ['verify', 'status', 'complete', 'halt'], [True, False]):
            values = {**self.values, 'github.event_name': event, 'inputs.action': action,
                      'inputs.signed_bundle': request}
            self.assertFalse(allows(signed, values))
            self.assertFalse(allows(release, values))

    def test_connection_jobs_only_call_the_readonly_probe_and_minimal_permissions(self):
        for workflow, environment in [('fabelpad-android-ci.yml', 'internal'),
                                      ('fabelpad-play-production.yml', 'production')]:
            job = job_text(workflow, 'connection')
            self.assertIn(f'environment: fabelpad-play-{environment}', job)
            self.assertIn('contents: read\n      id-token: write', job)
            self.assertIn('scripts/play/probe_connection.py', job)
            self.assertIn(f'--environment {environment}', job)
            self.assertIn('https://www.googleapis.com/auth/userinfo.email', job)
            self.assertNotIn('release.py', job)
            self.assertNotIn('native-build-production.sh', job)
            self.assertNotIn('ANDROID_UPLOAD_', job)
            self.assertNotIn('contents: write', job)
            self.assertNotIn('secrets: inherit', job)

    def test_status_has_its_own_minimal_credentials_and_no_release_command(self):
        job = job_text('fabelpad-play-production.yml', 'status')
        self.assertIn('environment: fabelpad-play-production', job)
        self.assertIn('contents: read\n      id-token: write', job)
        self.assertIn('access_token_scopes: https://www.googleapis.com/auth/androidpublisher\n', job)
        self.assertIn('create_credentials_file: false', job)
        self.assertIn('export_environment_variables: false', job)
        self.assertIn('scripts/play/inspect_status.py', job)
        self.assertNotIn('scripts/play/release.py', job)
        self.assertNotIn('probe_connection.py', job)
        self.assertNotIn('userinfo', job)
        self.assertNotIn('ANDROID_UPLOAD_', job)
        workflow = (WORKFLOWS / 'fabelpad-play-production.yml').read_text()
        self.assertIn('group: fabelpad-play-release\n  queue: max', workflow)
        self.assertNotIn('cancel-in-progress: true', workflow)


if __name__ == '__main__':
    unittest.main()
