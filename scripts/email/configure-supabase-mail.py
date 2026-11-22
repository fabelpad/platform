#!/usr/bin/env python3
"""Configure only the two confirmed Fabelpad mail targets; never send mail.

Default: offline plan. --check: read-only API checks. --apply: explicit changes.
Credentials are requested through a private terminal and are never persisted.
"""
import argparse
import base64
import getpass
import hashlib
import hmac
import json
from pathlib import Path
import re
import secrets
import sys
import urllib.error
import urllib.parse
import urllib.request
import warnings

ROOT = Path(__file__).resolve().parents[2]
TARGETS = {
    'staging': {'ref': 'tlwfpivafcokcjyjwgmq', 'origin': 'https://staging.fabelpad.nl'},
    'production': {'ref': 'aptprpkosqctwrzeetgs', 'origin': 'https://fabelpad.nl'},
}
ACTIONS = {
    'signup': 'confirmation', 'invite': 'invite', 'magiclink': 'magic_link',
    'recovery': 'recovery', 'email_change': 'email_change', 'reauthentication': 'reauthentication',
    **{name + '_notification': name + '_notification' for name in (
        'password_changed', 'email_changed', 'phone_changed', 'identity_linked',
        'identity_unlinked', 'mfa_factor_enrolled', 'mfa_factor_unenrolled')},
}
SECRET_NAMES = {'RESEND_API_KEY', 'SEND_EMAIL_HOOK_SECRET', 'FABELPAD_EMAIL_FROM',
                'FABELPAD_EMAIL_REPLY_TO', 'FABELPAD_APP_ORIGIN', 'FABELPAD_ENVIRONMENT'}
MAILBOX = re.compile(r'[A-Za-z0-9.!#$%&\x27*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}\Z')


class PreparationError(Exception):
    """Only deliberately non-secret messages cross the CLI output boundary."""


class HttpFailure(PreparationError):
    def __init__(self, status):
        self.status = status
        super().__init__(f'Externe API geweigerd (HTTP {status}); antwoordinhoud blijft verborgen.')


class NoRedirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise PreparationError('API-redirect geweigerd; credentials worden niet doorgestuurd.')


class Api:
    def __init__(self, opener=None):
        self.opener = opener or urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirects())

    def call(self, method, url, token, body=None):
        parsed = urllib.parse.urlsplit(url)
        if parsed.scheme != 'https' or parsed.netloc not in {'api.supabase.com', 'api.resend.com'} or parsed.fragment or parsed.username:
            raise PreparationError('Niet-toegestane API-bestemming.')
        data = None if body is None else json.dumps(body, separators=(',', ':')).encode()
        request = urllib.request.Request(url, method=method, data=data, headers={
            'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json',
            'User-Agent': 'Fabelpad-mail-configuration/2026-11-22',
        })
        try:
            with self.opener.open(request, timeout=20) as response:
                raw = response.read(4 * 1024 * 1024 + 1)
                if len(raw) > 4 * 1024 * 1024:
                    raise PreparationError('API-antwoord overschrijdt de veilige limiet.')
                if not raw:
                    return None
                try:
                    return json.loads(raw)
                except (ValueError, UnicodeError):
                    raise PreparationError('API gaf geen geldig JSON-antwoord.') from None
        except urllib.error.HTTPError as error:
            error.close()
            raise HttpFailure(error.code) from None
        except (urllib.error.URLError, TimeoutError, OSError):
            raise PreparationError('API-verbinding mislukt; technische details blijven verborgen.') from None


def target(environment):
    if environment not in TARGETS:
        raise PreparationError('Alleen de bevestigde staging- en productionprojecten zijn toegestaan.')
    return TARGETS[environment]


def sender(environment, address):
    if not isinstance(address, str) or len(address) > 254 or not MAILBOX.fullmatch(address):
        raise PreparationError('Gebruik een geldig afzenderadres met een kleine-letterdomein, zonder weergavenaam.')
    return f'Fabelpad{" Staging" if environment == "staging" else ""} <{address}>'


def templates(environment, root=ROOT):
    directory = root / 'supabase/email-templates'
    try:
        manifest = json.loads((directory / 'manifest.json').read_text())
        rows = manifest['environments'][environment]
        if set(rows) != set(ACTIONS):
            raise ValueError()
        result = {}
        for action, key in ACTIONS.items():
            row = rows[action]
            expected_file = f'{environment}/{action}.html'
            if (row['file'] != expected_file or row['subjectKey'] != f'mailer_subjects_{key}'
                    or row['contentKey'] != f'mailer_templates_{key}_content'):
                raise ValueError()
            path = directory / expected_file
            if path.is_symlink() or path.stat().st_size > 128 * 1024:
                raise ValueError()
            html = path.read_text()
            subject = row['subject']
            if not isinstance(subject, str) or len(subject) > 180 or '\n' in subject or '\r' in subject or not html.startswith('<!doctype html>'):
                raise ValueError()
            if environment == 'staging' and not subject.startswith('[TEST] '):
                raise ValueError()
            result[row['subjectKey']] = subject
            result[row['contentKey']] = html
        return result
    except (OSError, ValueError, KeyError, TypeError):
        raise PreparationError('De 13 geëxporteerde e-mailtemplates zijn onvolledig of ongeldig; exporteer en test ze opnieuw.') from None


def auth_configuration(environment, root=ROOT):
    destination = target(environment)
    origin = destination['origin']
    payload = {
        **templates(environment, root),
        'site_url': origin,
        'uri_allow_list': ','.join(origin + path for path in ('/inloggen', '/auth/callback', '/auth/confirm')),
        'external_email_enabled': True,
        'disable_signup': False,
        'mailer_autoconfirm': False,
        'mailer_allow_unverified_email_sign_ins': False,
        'mailer_secure_email_change_enabled': True,
        'mailer_otp_exp': 600,
        'mailer_otp_length': 8,
        'hook_send_email_enabled': True,
        'hook_send_email_uri': f'https://{destination["ref"]}.supabase.co/functions/v1/auth-email',
    }
    # Confirmation and login use numeric OTPs; the other action links require a
    # deliberate POST from /auth/confirm. Do not enable unrelated providers.
    for action in ACTIONS:
        if action.endswith('_notification'):
            payload['mailer_notifications_' + action.removesuffix('_notification') + '_enabled'] = True
    return payload


def canonical_secret(value):
    if not isinstance(value, str) or not value.startswith('v1,whsec_'):
        return False
    try:
        raw = base64.b64decode(value[9:], validate=True)
        return len(raw) == 32 and base64.b64encode(raw).decode() == value[9:]
    except (ValueError, TypeError):
        return False


def verify_domain(api, key, domain, *, sending_only=False, verified_domain=None, tracking_confirmed=False):
    if sending_only:
        if verified_domain != domain or not tracking_confirmed:
            raise PreparationError('Een sending-only key vereist het exact bevestigde verzenddomein én expliciete bevestiging dat open- en kliktracking uitstaan.')
        return 'door eigenaar verklaard; niet via API geverifieerd'
    if verified_domain is not None or tracking_confirmed:
        raise PreparationError('Domeinverklaringen zijn uitsluitend geldig met --sending-only-key.')
    listing = api.call('GET', 'https://api.resend.com/domains', key)
    if not isinstance(listing, dict) or not isinstance(listing.get('data'), list) or listing.get('has_more') is True:
        raise PreparationError('Resend-domeinlijst is onvolledig; geen domeinstatus aangenomen.')
    matches = [row for row in listing['data'] if row.get('name') == domain]
    if len(matches) != 1:
        raise PreparationError('Het exacte afzenderdomein is niet bij deze Resend-key gevonden.')
    row = matches[0]
    if row.get('status') != 'verified' or row.get('capabilities', {}).get('sending') != 'enabled':
        raise PreparationError('Het Resend-domein is nog niet geverifieerd voor verzenden.')
    if row.get('open_tracking') is not False or row.get('click_tracking') is not False:
        raise PreparationError('Resend open- en kliktracking moeten aantoonbaar uitstaan; ontbrekende velden gelden als onbekend.')
    return 'via Resend API geverifieerd'


def preflight(api, environment, supabase_token, resend_key, address, *, sending_only=False, verified_domain=None, tracking_confirmed=False):
    destination = target(environment)
    sender(environment, address)
    if not isinstance(supabase_token, str) or not re.fullmatch(r'sbp_[A-Za-z0-9_-]{16,}', supabase_token):
        raise PreparationError('Ongeldige Supabase-beheertokenstructuur; gebruik een persoonlijk toegangstoken, geen projectkey.')
    if not isinstance(resend_key, str) or not re.fullmatch(r're_[A-Za-z0-9_-]{8,}', resend_key):
        raise PreparationError('Ongeldige Resend-keystructuur.')
    base = f'https://api.supabase.com/v1/projects/{destination["ref"]}'
    project = api.call('GET', base, supabase_token)
    if not isinstance(project, dict) or project.get('ref', project.get('id')) != destination['ref'] or project.get('status') != 'ACTIVE_HEALTHY':
        raise PreparationError('Supabase-projectidentiteit of gezonde status is niet bevestigd.')
    function = api.call('GET', base + '/functions/auth-email', supabase_token)
    if (not isinstance(function, dict) or function.get('slug') != 'auth-email'
            or function.get('status') != 'ACTIVE' or function.get('verify_jwt') is not False):
        raise PreparationError('De beoordeelde auth-email Edge Function moet actief zijn met verify_jwt=false en eigen verplichte webhookcontrole.')
    current = api.call('GET', base + '/config/auth', supabase_token)
    if not isinstance(current, dict):
        raise PreparationError('Auth-configuratie kon niet worden gecontroleerd.')
    expected_hook = f'https://{destination["ref"]}.supabase.co/functions/v1/auth-email'
    if current.get('hook_send_email_enabled') and current.get('hook_send_email_uri') != expected_hook:
        raise PreparationError('Er staat een andere actieve mailhook; die wordt niet vervangen.')
    if current.get('hook_send_email_enabled') and not canonical_secret(current.get('hook_send_email_secrets')):
        raise PreparationError('Bestaande actieve hook kan niet veilig worden hergebruikt: het canonieke geheim ontbreekt of is afgeschermd. Laat de eigenaar de rotatie afzonderlijk beoordelen.')
    configured_origin = current.get('site_url')
    if configured_origin not in (None, '', 'http://localhost:3000', destination['origin']):
        raise PreparationError('Er staat een afwijkende Auth Site URL; beoordeel deze eerst afzonderlijk.')
    allowed_redirects = {destination['origin'] + path for path in ('/inloggen', '/auth/callback', '/auth/confirm')}
    existing_redirects = current.get('uri_allow_list') or ''
    if not isinstance(existing_redirects, str) or any(value.strip() not in allowed_redirects for value in existing_redirects.split(',') if value.strip()):
        raise PreparationError('Er staan andere Auth-redirects; die worden niet stilzwijgend verwijderd. Beoordeel deze eerst afzonderlijk.')
    domain_state = verify_domain(api, resend_key, address.rsplit('@', 1)[1], sending_only=sending_only,
                                 verified_domain=verified_domain, tracking_confirmed=tracking_confirmed)
    return base, current, domain_state


def edge_values(environment, address, resend_key, hook_secret):
    destination = target(environment)
    return {'RESEND_API_KEY': resend_key, 'SEND_EMAIL_HOOK_SECRET': hook_secret,
            'FABELPAD_EMAIL_FROM': sender(environment, address), 'FABELPAD_EMAIL_REPLY_TO': 'support@fabelpad.nl',
            'FABELPAD_APP_ORIGIN': destination['origin'], 'FABELPAD_ENVIRONMENT': environment}


def secret_differences(rows, values):
    """Management API `value` is a SHA-256 hex digest, never secret plaintext.

    Official format: supabase.com/docs/guides/deployment/terraform/reference,
    supabase_edge_function_secrets.secret_digests. No digest is printed.
    """
    if not isinstance(rows, list):
        raise PreparationError('Edge-secret-digests konden niet worden gecontroleerd.')
    found = {}
    for row in rows:
        if not isinstance(row, dict) or row.get('name') not in values:
            continue
        name = row['name']
        if name in found:
            raise PreparationError('Edge-secret-digests zijn niet eenduidig; geen wijzigingen uitgevoerd.')
        found[name] = row.get('value')
    return sorted(name for name, value in values.items()
                  if not isinstance(found.get(name), str)
                  or not re.fullmatch(r'[0-9a-f]{64}', found[name])
                  or not hmac.compare_digest(found[name], hashlib.sha256(value.encode()).hexdigest()))


def restore_auth(api, base, token, previous):
    api.call('PATCH', base + '/config/auth', token, previous)
    actual = api.call('GET', base + '/config/auth', token)
    if not isinstance(actual, dict) or any(actual.get(key) != value for key, value in previous.items()):
        raise PreparationError('Auth-herstel is niet bevestigd.')


def run_configuration(api, environment, supabase_token, resend_key, address, *, apply=False, sending_only=False,
                      verified_domain=None, tracking_confirmed=False, root=ROOT):
    desired = auth_configuration(environment, root)
    base, current, domain_state = preflight(api, environment, supabase_token, resend_key, address,
        sending_only=sending_only, verified_domain=verified_domain, tracking_confirmed=tracking_confirmed)
    if not apply:
        present = api.call('GET', base + '/secrets', supabase_token)
        names = {entry.get('name') for entry in present if isinstance(entry, dict)} if isinstance(present, list) else set()
        differences = [key for key, value in desired.items() if current.get(key) != value]
        configured_secret = current.get('hook_send_email_secrets')
        values = edge_values(environment, address, resend_key, configured_secret if canonical_secret(configured_secret) else '')
        edge_differences = secret_differences(present, values)
        if not canonical_secret(configured_secret):
            differences.append('hook_send_email_secrets')
        return {'mode': 'alleen-lezen', 'environment': environment, 'domainVerification': domain_state,
                'differentAuthFields': differences, 'missingEdgeSecretNames': sorted(SECRET_NAMES - names),
                'differentEdgeSecretNames': edge_differences,
                'deliveryAndLogin': 'niet getest'}
    # A missing previous value cannot be safely invented during recovery.
    if any(key not in current for key in desired if not key.startswith('hook_send_email_')):
        raise PreparationError('Auth-readback mist eerdere instellingen; veilige terugkeer kan niet worden voorbereid. Geen wijzigingen uitgevoerd.')
    active = current.get('hook_send_email_enabled') is True
    hook_secret = current['hook_send_email_secrets'] if active else 'v1,whsec_' + base64.b64encode(secrets.token_bytes(32)).decode()
    values = edge_values(environment, address, resend_key, hook_secret)
    if active:
        present = api.call('GET', base + '/secrets', supabase_token)
        if secret_differences(present, values):
            raise PreparationError('De actieve mailroute heeft afwijkende of ontbrekende Edge-secrets. Deze tool is alleen voor eerste inrichting en ongewijzigde herhaling; laat een afzonderlijke, beoordeelde rotatie voorbereiden. Geen wijzigingen uitgevoerd.')
        # Exact matches need no secret writes; a working route stays untouched.
    else:
        api.call('POST', base + '/secrets', supabase_token, [{'name': key, 'value': values[key]} for key in sorted(values)])
        present = api.call('GET', base + '/secrets', supabase_token)
        if secret_differences(present, values):
            raise PreparationError('Edge-secrets zijn aangeboden maar hun digests zijn niet volledig bevestigd. Auth is niet gewijzigd; beoordeel de inrichting voordat je doorgaat.')
    desired['hook_send_email_secrets'] = hook_secret
    previous = {key: current[key] for key in desired if key in current}
    previous.setdefault('hook_send_email_enabled', False)
    previous.setdefault('hook_send_email_uri', None)
    previous.setdefault('hook_send_email_secrets', None)
    try:
        api.call('PATCH', base + '/config/auth', supabase_token, desired)
        actual = api.call('GET', base + '/config/auth', supabase_token)
        if not isinstance(actual, dict) or any(actual.get(key) != value for key, value in desired.items()):
            raise PreparationError('Auth-readback wijkt af; configuratie is niet als volledig bevestigd gemarkeerd.')
    except (PreparationError, KeyboardInterrupt):
        try:
            restore_auth(api, base, supabase_token, previous)
        except (PreparationError, KeyboardInterrupt):
            raise PreparationError('Auth-update en herstel zijn niet bevestigd. Handmatig herstel is nodig: controleer de laatst gezonde Auth-inrichting en laat de mailroute niet vrijgeven. Er is geen testmail verstuurd; geheimen en API-inhoud blijven verborgen.') from None
        raise PreparationError('Auth-update is niet volledig bevestigd. De eerdere Auth-instellingen zijn hersteld en gecontroleerd; de eerdere hookstatus is behouden. De eigen inactieve Edge-secrets kunnen voorbereid blijven staan. Er is geen testmail verstuurd.') from None
    return {'mode': 'toegepast', 'environment': environment, 'domainVerification': domain_state,
            'templateCount': 13, 'edgeSecretNamesConfirmed': sorted(SECRET_NAMES),
            'authReadback': 'overeenkomstig', 'deliveryAndLogin': 'niet getest'}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--environment', required=True, choices=sorted(TARGETS))
    parser.add_argument('--from-address', required=True, help='Openbaar afzenderadres op het geverifieerde Resend-verzenddomein')
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument('--check', action='store_true', help='Alleen-lezen controles; vraagt credentials afgeschermd')
    modes.add_argument('--apply', action='store_true', help='Plaats Edge-secrets en Auth-configuratie; verstuurt geen mail')
    parser.add_argument('--sending-only-key', action='store_true', help='Sla domein-API over; vereist expliciete eigenaarverklaringen')
    parser.add_argument('--verified-sending-domain', help='Exact domein dat de eigenaar in Resend als verified/sending enabled heeft gecontroleerd')
    parser.add_argument('--confirm-tracking-disabled', action='store_true', help='Eigenaar heeft open- en kliktracking uit gecontroleerd')
    args = parser.parse_args(argv)
    sender(args.environment, args.from_address)
    payload = auth_configuration(args.environment)
    if args.sending_only_key:
        verify_domain(None, None, args.from_address.rsplit('@', 1)[1], sending_only=True,
                      verified_domain=args.verified_sending_domain, tracking_confirmed=args.confirm_tracking_disabled)
    elif args.verified_sending_domain is not None or args.confirm_tracking_disabled:
        raise PreparationError('Gebruik de eigenaarverklaringen uitsluitend samen met --sending-only-key.')
    if not args.check and not args.apply:
        print(json.dumps({'mode': 'offline plan — geen API-aanroep', 'environment': args.environment, **target(args.environment),
                          'authFieldNames': sorted(payload), 'edgeSecretNames': sorted(SECRET_NAMES),
                          'required': 'Afgeschermde Supabase PAT, Resend-key en geverifieerd verzenddomein zonder tracking',
                          'deliveryAndLogin': 'niet getest'}, ensure_ascii=False, indent=2))
        return 0
    if not sys.stdin.isatty():
        raise PreparationError('Voer --check/--apply uit in een eigen interactieve terminal; credentials mogen niet in argumenten, pipes, bestanden of logs.')
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', getpass.GetPassWarning)
            supabase_token = getpass.getpass('Supabase persoonlijk toegangstoken voor dit project (verborgen): ')
            resend_key = getpass.getpass('Resend API-key voor Fabelpad (verborgen): ')
    except getpass.GetPassWarning:
        raise PreparationError('Afgeschermde invoer is niet beschikbaar; credentials zijn niet opgevraagd via een zichtbare fallback.') from None
    result = run_configuration(Api(), args.environment, supabase_token, resend_key, args.from_address,
        apply=args.apply, sending_only=args.sending_only_key, verified_domain=args.verified_sending_domain,
        tracking_confirmed=args.confirm_tracking_disabled)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 2 if result.get('differentAuthFields') or result.get('missingEdgeSecretNames') or result.get('differentEdgeSecretNames') else 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except PreparationError as error:
        print('Niet afgerond: ' + str(error), file=sys.stderr)
        raise SystemExit(1)
    except (KeyboardInterrupt, EOFError):
        print('Afgebroken; geen geheimwaarden gelogd. Controleer de configuratiestatus als toepassen al was gestart.', file=sys.stderr)
        raise SystemExit(130)
    except Exception:
        # Provider responses, credentials and message bodies never become traces.
        print('Niet afgerond door een onverwachte fout; technische inhoud blijft verborgen. Controleer de API-status en herhaal de afgeschermde procedure.', file=sys.stderr)
        raise SystemExit(1)
