#!/usr/bin/env python3
"""No-network tests of request boundaries and configuration ordering."""
import base64
import contextlib
import copy
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import unittest
from unittest.mock import patch
import urllib.error
import urllib.request

SPEC = importlib.util.spec_from_file_location('mail_configuration', Path(__file__).with_name('configure-supabase-mail.py'))
mail = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(mail)
PAT = 'sbp_synthetic_private_management_token'
KEY = 're_synthetic_private_sending_token'


class FakeApi:
    def __init__(self, environment='staging'):
        self.environment = environment
        self.target = mail.target(environment)
        self.project = {'ref': self.target['ref'], 'status': 'ACTIVE_HEALTHY'}
        self.function = {'slug': 'auth-email', 'status': 'ACTIVE', 'verify_jwt': False}
        self.auth = {**mail.auth_configuration(environment), 'site_url': 'http://localhost:3000',
                     'uri_allow_list': '', 'external_google_enabled': False, 'hook_send_email_enabled': False,
                     'hook_send_email_uri': '', 'hook_send_email_secrets': None, 'mailer_otp_length': 6,
                     'rate_limit_email_sent': 2, 'smtp_max_frequency': 120,
                     'rate_limit_otp': 777, 'rate_limit_verify': 888,
                     'existing_unrelated_setting': 'unchanged'}
        for key in self.auth:
            if key.startswith('mailer_subjects_'):
                self.auth[key] = 'Previous subject'
            elif key.startswith('mailer_templates_'):
                self.auth[key] = '<html>Previous template</html>'
            elif key.startswith('mailer_notifications_'):
                self.auth[key] = False
        self.domain = {'name': 'fabelpad.nl', 'status': 'verified', 'open_tracking': False,
                       'click_tracking': False, 'capabilities': {'sending': 'enabled'}}
        self.calls = []
        self.secrets = []
        self.fail_patch = False
        self.fail_first_patch_after_update = False
        self.fail_recovery = False
        self.patch_count = 0
        self.bad_readback = False

    def call(self, method, url, token, body=None):
        self.calls.append((method, url, token, copy.deepcopy(body)))
        if url == 'https://api.resend.com/domains':
            assert token == KEY and method == 'GET'
            return {'data': [self.domain], 'has_more': False}
        assert token == PAT
        assert url.startswith('https://api.supabase.com/v1/projects/' + self.target['ref'])
        if url.endswith('/functions/auth-email'):
            return copy.deepcopy(self.function)
        if url.endswith('/config/auth'):
            if method == 'PATCH':
                self.patch_count += 1
                if self.fail_patch or (self.fail_recovery and self.patch_count > 1):
                    raise mail.HttpFailure(403)
                self.auth.update(body)
                if self.fail_first_patch_after_update and self.patch_count == 1:
                    raise mail.HttpFailure(502)
            result = copy.deepcopy(self.auth)
            if self.bad_readback and self.patch_count == 1:
                # A valid provider value that differs from the required six
                # digits must trigger readback recovery, not a false success.
                result['mailer_otp_length'] = 8
            return result
        if url.endswith('/secrets'):
            if method == 'POST':
                self.secrets = copy.deepcopy(body)
            return [{'name': item['name'], 'value': hashlib.sha256(item['value'].encode()).hexdigest()} for item in self.secrets]
        return copy.deepcopy(self.project)

    @property
    def writes(self):
        return [item for item in self.calls if item[0] in ('POST', 'PATCH', 'DELETE')]


class Response:
    def __init__(self, raw):
        self.raw = raw

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def read(self, amount):
        return self.raw[:amount]


class Opener:
    def __init__(self, reply):
        self.reply = reply
        self.requests = []

    def open(self, request, timeout):
        self.requests.append(request)
        if isinstance(self.reply, Exception):
            raise self.reply
        return Response(self.reply)


class MailConfigurationTests(unittest.TestCase):
    def run_config(self, api, **options):
        return mail.run_configuration(api, api.environment, PAT, KEY, 'noreply@fabelpad.nl', **options)

    def test_offline_plan_has_no_api_or_credentials_and_uses_only_fixed_targets(self):
        output = io.StringIO()
        with contextlib.redirect_stdout(output), patch.object(mail, 'Api', side_effect=AssertionError('No network')), patch.object(mail.getpass, 'getpass', side_effect=AssertionError('No credentials')):
            self.assertEqual(mail.main(['--environment', 'staging', '--from-address', 'noreply@fabelpad.nl']), 0)
        plan = json.loads(output.getvalue())
        self.assertEqual(plan['ref'], 'tlwfpivafcokcjyjwgmq')
        self.assertEqual(set(plan['edgeSecretNames']), mail.SECRET_NAMES)
        self.assertNotIn(KEY, output.getvalue())
        with self.assertRaises(mail.PreparationError):
            mail.target('another-project')

    def test_both_targets_pair_auth_and_edge_secrets_and_all_templates(self):
        for environment in ('staging', 'production'):
            with self.subTest(environment=environment):
                api = FakeApi(environment)
                result = self.run_config(api, apply=True)
                edge = {item['name']: item['value'] for item in api.secrets}
                self.assertEqual(set(edge), mail.SECRET_NAMES)
                self.assertEqual(edge['SEND_EMAIL_HOOK_SECRET'], api.auth['hook_send_email_secrets'])
                self.assertTrue(mail.canonical_secret(edge['SEND_EMAIL_HOOK_SECRET']))
                self.assertEqual(len(base64.b64decode(edge['SEND_EMAIL_HOOK_SECRET'][9:])), 32)
                self.assertEqual(edge['FABELPAD_APP_ORIGIN'], api.target['origin'])
                self.assertEqual(edge['FABELPAD_ENVIRONMENT'], environment)
                self.assertEqual(edge['FABELPAD_EMAIL_FROM'], mail.sender(environment, 'noreply@fabelpad.nl'))
                self.assertEqual(api.auth['mailer_otp_length'], 6)
                self.assertEqual(api.auth['mailer_otp_exp'], 600)
                self.assertEqual(api.auth['rate_limit_email_sent'], 30)
                self.assertEqual(api.auth['smtp_max_frequency'], 60)
                self.assertEqual(api.auth['rate_limit_otp'], 777)
                self.assertEqual(api.auth['rate_limit_verify'], 888)
                self.assertEqual(api.auth['external_google_enabled'], False)
                self.assertEqual(api.auth['existing_unrelated_setting'], 'unchanged')
                self.assertEqual(sum(key.startswith('mailer_templates_') for key in api.auth), 13)
                self.assertEqual(sum(key.startswith('mailer_subjects_') for key in api.auth), 13)
                self.assertEqual(sum(key.startswith('mailer_notifications_') for key in api.auth), 7)
                self.assertEqual([method for method, *_ in api.writes], ['POST', 'PATCH'])
                self.assertFalse(any('/emails' in url for _, url, *_ in api.calls))
                self.assertEqual(result['deliveryAndLogin'], 'niet getest')
                serial = json.dumps(result)
                self.assertNotIn(KEY, serial)
                self.assertNotIn(PAT, serial)
                self.assertNotIn(edge['SEND_EMAIL_HOOK_SECRET'], serial)

    def test_repeat_apply_reuses_existing_own_active_hook_secret(self):
        api = FakeApi()
        self.run_config(api, apply=True)
        first_secret = api.auth['hook_send_email_secrets']
        api.calls = []
        self.run_config(api, apply=True)
        self.assertEqual(api.auth['hook_send_email_secrets'], first_secret)
        self.assertEqual([method for method, *_ in api.writes], ['PATCH'], 'Idempotent active setup never rewrites Edge secrets')

    def test_readonly_check_has_no_writes_and_reports_only_names(self):
        api = FakeApi()
        result = self.run_config(api)
        self.assertFalse(api.writes)
        self.assertEqual(set(result['missingEdgeSecretNames']), mail.SECRET_NAMES)
        self.assertIn('hook_send_email_secrets', result['differentAuthFields'])
        self.assertNotIn(KEY, json.dumps(result))
        self.run_config(api, apply=True)
        api.calls = []
        result = self.run_config(api)
        self.assertEqual(result['differentAuthFields'], [])
        self.assertEqual(result['missingEdgeSecretNames'], [])
        self.assertEqual(result['differentEdgeSecretNames'], [])
        self.assertFalse(api.writes)

    def test_identity_and_hosted_function_mismatches_fail_before_writes(self):
        for collection, key, value in [
            ('project', 'ref', mail.TARGETS['production']['ref']),
            ('project', 'status', 'ACTIVE_UNHEALTHY'),
            ('function', 'verify_jwt', True),
            ('function', 'status', 'REMOVED'),
            ('function', 'slug', 'another-function'),
            ('auth', 'site_url', 'https://another.example.test'),
            ('auth', 'uri_allow_list', 'https://another.example.test/auth/callback'),
        ]:
            api = FakeApi(); getattr(api, collection)[key] = value
            with self.subTest(collection=collection, key=key), self.assertRaises(mail.PreparationError):
                self.run_config(api, apply=True)
            self.assertFalse(api.writes)

    def test_other_or_unreadable_active_hook_is_never_replaced(self):
        for uri, secret in [('https://another.example.test/hook', ''),
                            ('https://tlwfpivafcokcjyjwgmq.supabase.co/functions/v1/auth-email', 'redacted')]:
            api = FakeApi(); api.auth.update(hook_send_email_enabled=True, hook_send_email_uri=uri, hook_send_email_secrets=secret)
            with self.assertRaises(mail.PreparationError):
                self.run_config(api, apply=True)
            self.assertFalse(api.writes)

    def test_unverified_disabled_or_unknown_tracking_domain_cannot_activate_hook(self):
        for key, value in [('name', 'another.example.test'), ('status', 'pending'),
                           ('capabilities', {'sending': 'disabled'}), ('capabilities', {}),
                           ('open_tracking', True), ('click_tracking', None)]:
            api = FakeApi(); api.domain[key] = value
            with self.subTest(key=key), self.assertRaises(mail.PreparationError):
                self.run_config(api, apply=True)
            self.assertFalse(api.writes)

    def test_sending_only_requires_explicit_exact_domain_and_no_tracking_declaration(self):
        for options in [{}, {'verified_domain':'another.example.test','tracking_confirmed':True}, {'verified_domain':'fabelpad.nl'}]:
            api = FakeApi()
            with self.assertRaises(mail.PreparationError):
                self.run_config(api, apply=True, sending_only=True, **options)
            self.assertFalse(api.writes)
        api = FakeApi()
        result = self.run_config(api, apply=True, sending_only=True, verified_domain='fabelpad.nl', tracking_confirmed=True)
        self.assertIn('niet via API geverifieerd', result['domainVerification'])
        self.assertFalse(any('api.resend.com' in url for _, url, *_ in api.calls))

    def test_partial_auth_failure_restores_initial_auth_and_keeps_hook_disabled(self):
        for attribute in ('fail_first_patch_after_update', 'bad_readback'):
            with self.subTest(attribute=attribute):
                api = FakeApi(); previous = copy.deepcopy(api.auth); setattr(api, attribute, True)
                with self.assertRaises(mail.PreparationError) as caught:
                    self.run_config(api, apply=True)
                self.assertIn('niet volledig bevestigd', str(caught.exception))
                self.assertIn('hersteld en gecontroleerd', str(caught.exception))
                self.assertEqual(api.auth, previous)
                self.assertEqual(api.auth['hook_send_email_enabled'], False)
                self.assertEqual(api.auth['mailer_otp_length'], 6)
                self.assertEqual(api.auth['rate_limit_email_sent'], 2)
                self.assertEqual(api.auth['smtp_max_frequency'], 120)
                self.assertEqual([method for method, *_ in api.writes], ['POST', 'PATCH', 'PATCH'])
                self.assertNotIn(KEY, str(caught.exception))
                self.assertNotIn(PAT, str(caught.exception))

    def test_active_hook_changed_or_missing_edge_secret_refuses_every_write(self):
        for name in sorted(mail.SECRET_NAMES):
            with self.subTest(secret=name):
                api = FakeApi(); self.run_config(api, apply=True)
                previous = copy.deepcopy(api.auth)
                for item in api.secrets:
                    if item['name'] == name:
                        item['value'] = 'synthetic-previous-different-value'
                api.calls = []
                with self.assertRaises(mail.PreparationError) as caught:
                    self.run_config(api, apply=True)
                self.assertIn('rotatie', str(caught.exception))
                self.assertEqual(api.writes, [])
                self.assertEqual(api.auth, previous)
                self.assertNotIn('synthetic-previous-different-value', str(caught.exception))
        api = FakeApi(); self.run_config(api, apply=True)
        api.secrets = [item for item in api.secrets if item['name'] != 'RESEND_API_KEY']
        api.calls = []
        with self.assertRaises(mail.PreparationError):
            self.run_config(api, apply=True)
        self.assertEqual(api.writes, [])

    def test_active_hook_auth_readback_failure_restores_working_settings_without_secret_writes(self):
        api = FakeApi(); self.run_config(api, apply=True)
        api.auth['mailer_subjects_magic_link'] = 'Previous healthy subject'
        api.auth['rate_limit_email_sent'] = 12
        api.auth['smtp_max_frequency'] = 90
        previous_auth = copy.deepcopy(api.auth); previous_secrets = copy.deepcopy(api.secrets)
        api.calls = []; api.patch_count = 0; api.bad_readback = True
        with self.assertRaises(mail.PreparationError) as caught:
            self.run_config(api, apply=True)
        self.assertIn('hersteld en gecontroleerd', str(caught.exception))
        self.assertEqual(api.auth, previous_auth)
        self.assertEqual(api.secrets, previous_secrets)
        self.assertEqual([method for method, *_ in api.writes], ['PATCH', 'PATCH'])
        self.assertEqual(api.auth['hook_send_email_enabled'], True)
        self.assertEqual(api.auth['rate_limit_email_sent'], 12)
        self.assertEqual(api.auth['smtp_max_frequency'], 90)

    def test_failed_restore_requires_manual_recovery_and_never_exposes_provider_details(self):
        for failure in ('fail_patch', 'fail_recovery'):
            with self.subTest(failure=failure):
                api = FakeApi(); api.bad_readback = True; setattr(api, failure, True)
                with self.assertRaises(mail.PreparationError) as caught:
                    self.run_config(api, apply=True)
                self.assertIn('Handmatig herstel is nodig', str(caught.exception))
                self.assertEqual(api.patch_count, 2, 'A failed update must still attempt recovery exactly once')
                self.assertFalse(any('/emails' in url for _, url, *_ in api.calls))
                self.assertNotIn(KEY, str(caught.exception)); self.assertNotIn(PAT, str(caught.exception))

    def test_missing_previous_auth_value_blocks_before_any_change(self):
        for field in ['mailer_otp_exp', 'rate_limit_email_sent', 'smtp_max_frequency']:
            with self.subTest(field=field):
                api = FakeApi(); del api.auth[field]
                with self.assertRaises(mail.PreparationError) as caught:
                    self.run_config(api, apply=True)
                self.assertIn('eerdere instellingen', str(caught.exception))
                self.assertEqual(api.writes, [])

    def test_terminal_echo_fallback_is_refused_without_api_calls(self):
        with patch.object(mail.sys.stdin, 'isatty', return_value=True), patch.object(mail.getpass, 'getpass', side_effect=mail.getpass.GetPassWarning('synthetic-private-terminal-detail')), patch.object(mail, 'Api', side_effect=AssertionError('No API')):
            with self.assertRaises(mail.PreparationError) as caught:
                mail.main(['--environment','staging','--from-address','noreply@fabelpad.nl','--check'])
        self.assertIn('Afgeschermde invoer is niet beschikbaar', str(caught.exception))
        self.assertNotIn('synthetic-private-terminal-detail', str(caught.exception))

    def test_sender_and_credential_input_are_validated_without_echo(self):
        for address in ['Fabelpad <noreply@fabelpad.nl>', 'noreply@fabelpad.nl\nBcc: someone@example.test', 'invalid']:
            with self.assertRaises(mail.PreparationError) as caught:
                mail.sender('production', address)
            self.assertNotIn(address, str(caught.exception))
        for token in ['', 'sb_publishable_synthetic', 'sb_secret_synthetic']:
            api = FakeApi()
            with self.assertRaises(mail.PreparationError):
                mail.preflight(api,'staging',token,KEY,'noreply@fabelpad.nl')
            self.assertFalse(api.calls)

    def test_http_client_blocks_foreign_destinations_redirects_and_error_body_disclosure(self):
        opener = Opener(b'{}')
        with self.assertRaises(mail.PreparationError):
            mail.Api(opener).call('GET','https://attacker.example.test',PAT)
        self.assertEqual(opener.requests, [])
        with self.assertRaises(mail.PreparationError):
            mail.NoRedirects().redirect_request(urllib.request.Request('https://api.supabase.com'),None,302,'Found',{},'https://attacker.example.test')
        secret_body = io.BytesIO((PAT + KEY).encode())
        opener = Opener(urllib.error.HTTPError('https://api.supabase.com',403,'Forbidden',{},secret_body))
        with self.assertRaises(mail.HttpFailure) as caught:
            mail.Api(opener).call('GET','https://api.supabase.com/v1/projects',PAT)
        self.assertEqual(caught.exception.status,403)
        self.assertNotIn(PAT,str(caught.exception)); self.assertNotIn(KEY,str(caught.exception))
        self.assertEqual(opener.requests[0].get_header('Authorization'),'Bearer ' + PAT)

    def test_malformed_json_and_oversized_api_responses_fail_closed(self):
        for raw in [(KEY + '{not-json').encode(), b' ' * (4 * 1024 * 1024 + 1)]:
            with self.assertRaises(mail.PreparationError) as caught:
                mail.Api(Opener(raw)).call('GET','https://api.supabase.com/v1/projects',PAT)
            self.assertNotIn(KEY,str(caught.exception))


if __name__ == '__main__':
    unittest.main()
