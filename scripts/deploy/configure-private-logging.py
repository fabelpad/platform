#!/usr/bin/env python3
"""Prepare only Fabelpad's own journal namespaces and retention timers.

Without --apply this validates identity and existing paths but changes nothing.
--apply installs the fixed files, verifies the two new units, reloads systemd and
starts only the selected retention timer. It never starts an application or
journald service and never rotates/vacuums the shared/default journal.
"""
import argparse
import json
import os
from pathlib import Path
import socket
import stat
import subprocess
import tempfile

MACHINE_ID = '05db94b99eca4c3d815f6585ef8ed517'
HOSTNAME = 'dg-vps-08'
CLEAN_ENV = {'PATH': '/usr/sbin:/usr/bin:/sbin:/bin', 'LANG': 'C.UTF-8'}


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def configuration(environment):
    require(environment in ('staging', 'production'), 'Unknown environment')
    site = 'fabelpad-vps08-' + environment
    service = site + '-log-retention.service'
    timer = site + '-log-retention.timer'
    files = {
        Path('/etc/systemd/system') / (site + '.service.d/30-private-journal.conf'):
            '[Service]\nLogNamespace=' + site + '\n',
        Path('/etc/systemd') / ('journald@' + site + '.conf.d/30-retention.conf'):
            '[Journal]\nStorage=persistent\nMaxRetentionSec=29day\nMaxFileSec=12h\n'
            'SystemMaxUse=100M\nForwardToSyslog=no\nForwardToKMsg=no\nForwardToConsole=no\n',
        Path('/etc/systemd/system') / service:
            '[Unit]\nDescription=Retain only the ' + site + ' journal\n'
            'ConditionPathIsDirectory=/var/log/journal/' + MACHINE_ID + '.' + site + '\n\n'
            '[Service]\nType=oneshot\nUser=root\nGroup=root\nUMask=0077\n'
            'ExecStart=/usr/bin/journalctl --namespace=' + site + ' --rotate --vacuum-time=29days\n'
            'TimeoutStartSec=2min\nNoNewPrivileges=yes\nPrivateTmp=yes\n'
            'ProtectHome=yes\nProtectSystem=full\n',
        Path('/etc/systemd/system') / timer:
            '[Unit]\nDescription=Six-hourly retention for the ' + site + ' journal\n\n'
            '[Timer]\nOnCalendar=*-*-* 00,06,12,18:00:00\nAccuracySec=1min\n'
            'RandomizedDelaySec=0\nPersistent=true\nUnit=' + service + '\n\n'
            '[Install]\nWantedBy=timers.target\n',
    }
    return site, service, timer, files


class Host:
    def identity(self):
        return os.geteuid(), socket.gethostname(), Path('/etc/machine-id').read_text().strip()

    def metadata(self, path):
        try:
            return os.lstat(path)
        except FileNotFoundError:
            return None

    def read(self, path):
        return Path(path).read_text()

    def command(self, argv):
        result = subprocess.run(argv, capture_output=True, text=True, env=CLEAN_ENV, timeout=60)
        require(result.returncode == 0, 'Logging preparation command failed: ' + Path(argv[0]).name)
        return result.stdout.strip()

    def install(self, path, content):
        # Every ancestor is rechecked; root-owned, non-writable ancestors make
        # symlink substitution by the runner/build/app accounts impossible.
        for parent in reversed(path.parents):
            if self.metadata(parent) is None:
                os.mkdir(parent, 0o755)
            safe_path(self, parent, directory=True)
        safe_path(self, path, allow_missing=True)
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o644)
        with os.fdopen(fd, 'w') as handle:
            os.fchown(handle.fileno(), 0, 0)
            os.fchmod(handle.fileno(), 0o644)
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())

    def verify_units(self, files, service, timer):
        # A private scratch directory lets systemd validate both fixed unit
        # names before any persistent file or active timer is changed.
        with tempfile.TemporaryDirectory(prefix='fabelpad-private-journal-') as directory:
            names = []
            for name in (service, timer):
                scratch = Path(directory) / name
                scratch.write_text(files[Path('/etc/systemd/system') / name])
                names.append(str(scratch))
            self.command(['/usr/bin/systemd-analyze', 'verify', *names])


def safe_path(host, path, *, allow_missing=False, directory=False):
    path = Path(path)
    require(path.is_absolute(), 'Absolute path required')
    for current in [*reversed(path.parents), path]:
        item = host.metadata(current)
        if item is None:
            require(allow_missing, 'Required logging path missing')
            return False
        require(not stat.S_ISLNK(item.st_mode), 'Refuse symlink in logging path')
        require(item.st_uid == 0 and not item.st_mode & 0o022, 'Logging path must be root-owned and protected')
        if current != path or directory:
            require(stat.S_ISDIR(item.st_mode), 'Logging ancestor must be a directory')
        else:
            require(stat.S_ISREG(item.st_mode) and item.st_nlink == 1, 'Logging file must be regular with one link')
    return True


def prepare(host, environment, apply=False):
    site, service, timer, files = configuration(environment)
    require(host.identity() == (0, HOSTNAME, MACHINE_ID), 'Root on the verified target host required')
    profile_path = Path('/etc/dg-webservices') / site / 'host.json'
    safe_path(host, profile_path)
    profile = json.loads(host.read(profile_path))
    require(all(profile.get(key) == value for key, value in {
        'siteId': site, 'environment': environment, 'hostname': HOSTNAME,
        'machineId': MACHINE_ID, 'repository': 'fabelpad/platform', 'branch': 'main',
        'configRoot': '/etc/dg-webservices/' + site,
        'siteRoot': '/srv/sites/' + site,
    }.items()), 'Logging site profile does not match the selected Fabelpad environment')
    missing = []
    for path, content in files.items():
        exists = safe_path(host, path, allow_missing=True)
        if exists:
            item = host.metadata(path)
            require(stat.S_IMODE(item.st_mode) == 0o644 and host.read(path) == content,
                    'Existing custom logging differs; review first')
        else:
            missing.append(path)
    if apply:
        host.verify_units(files, service, timer)
        for path in missing:
            host.install(path, files[path])
        # Check all persisted bytes and protection again before systemd sees
        # them. No shared unit, app service, or journald service is activated.
        for path, content in files.items():
            safe_path(host, path)
            require(stat.S_IMODE(host.metadata(path).st_mode) == 0o644 and host.read(path) == content,
                    'Installed logging configuration changed')
        host.command(['/usr/bin/systemctl', 'daemon-reload'])
        host.command(['/usr/bin/systemctl', 'enable', '--now', timer])
        require(host.command(['/usr/bin/systemctl', 'is-enabled', timer]) == 'enabled', 'Own retention timer is not enabled')
        require(host.command(['/usr/bin/systemctl', 'is-active', timer]) == 'active', 'Own retention timer is not active')
    return {'environment': environment, 'applied': apply, 'namespace': site,
            'retentionDays': 29, 'maxJournalFileHours': 12,
            'retentionTimer': timer, 'retentionSchedule': '*-*-* 00,06,12,18:00:00',
            'timerAccuracySeconds': 60, 'timerPersistent': True,
            'missingNamespaceSkipped': True, 'unitVerification': 'passed' if apply else 'not-run-without-apply',
            'timerEnabledAndActive': apply, 'sharedLoggingChanged': False,
            'appServicesStarted': False, 'configurationFiles': [str(path) for path in files]}


def self_test():
    """Exercise the real planner and guards with in-memory host capabilities."""
    from types import SimpleNamespace
    import unittest

    class FakeHost:
        def __init__(self, environment='staging'):
            self.nodes = {Path('/'): (stat.S_IFDIR | 0o755, 0, 1, '')}
            self.calls = []
            self.writes = []
            self.host_identity = (0, HOSTNAME, MACHINE_ID)
            site = 'fabelpad-vps08-' + environment
            profile = {'siteId': site, 'environment': environment, 'hostname': HOSTNAME,
                       'machineId': MACHINE_ID, 'repository': 'fabelpad/platform', 'branch': 'main',
                       'configRoot': '/etc/dg-webservices/' + site, 'siteRoot': '/srv/sites/' + site}
            self.add(Path('/etc/dg-webservices') / site / 'host.json', json.dumps(profile))
            self.add_directory(Path('/etc/systemd/system'))

        def add_directory(self, path):
            for parent in [*reversed(path.parents), path]:
                self.nodes.setdefault(parent, (stat.S_IFDIR | 0o755, 0, 1, ''))

        def add(self, path, content):
            self.add_directory(path.parent)
            self.nodes[path] = (stat.S_IFREG | 0o644, 0, 1, content)

        def identity(self):
            return self.host_identity

        def metadata(self, path):
            item = self.nodes.get(Path(path))
            return None if item is None else SimpleNamespace(st_mode=item[0], st_uid=item[1], st_nlink=item[2])

        def read(self, path):
            return self.nodes[Path(path)][3]

        def install(self, path, content):
            self.writes.append(path)
            self.add(path, content)

        def verify_units(self, files, service, timer):
            self.calls.append(['verify', service, timer])

        def command(self, argv):
            self.calls.append(argv)
            return 'enabled' if 'is-enabled' in argv else 'active' if 'is-active' in argv else ''

    class Checks(unittest.TestCase):
        def test_fixed_namespace_calendar_and_skip_without_app_start(self):
            for environment in ('staging', 'production'):
                site, service, timer, files = configuration(environment)
                unit = files[Path('/etc/systemd/system') / service]
                clock = files[Path('/etc/systemd/system') / timer]
                self.assertEqual([line for line in unit.splitlines() if line.startswith('ExecStart=')],
                                 ['ExecStart=/usr/bin/journalctl --namespace=' + site + ' --rotate --vacuum-time=29days'])
                self.assertIn('ConditionPathIsDirectory=/var/log/journal/' + MACHINE_ID + '.' + site + '\n', unit)
                self.assertNotIn('Requires=', unit)
                for field in ('OnCalendar=*-*-* 00,06,12,18:00:00', 'AccuracySec=1min', 'RandomizedDelaySec=0', 'Persistent=true', 'Unit=' + service):
                    self.assertIn(field + '\n', clock)

        def test_plan_has_no_writes_or_commands(self):
            host = FakeHost()
            result = prepare(host, 'staging')
            self.assertFalse(result['applied'])
            self.assertEqual(host.calls, [])
            self.assertEqual(host.writes, [])

        def test_apply_is_idempotent_and_only_enables_own_timer(self):
            host = FakeHost('production')
            result = prepare(host, 'production', True)
            self.assertTrue(result['timerEnabledAndActive'])
            self.assertEqual(len(host.writes), 4)
            expected = [['verify', 'fabelpad-vps08-production-log-retention.service', 'fabelpad-vps08-production-log-retention.timer'],
                        ['/usr/bin/systemctl', 'daemon-reload'],
                        ['/usr/bin/systemctl', 'enable', '--now', 'fabelpad-vps08-production-log-retention.timer'],
                        ['/usr/bin/systemctl', 'is-enabled', 'fabelpad-vps08-production-log-retention.timer'],
                        ['/usr/bin/systemctl', 'is-active', 'fabelpad-vps08-production-log-retention.timer']]
            self.assertEqual(host.calls, expected)
            host.calls.clear()
            prepare(host, 'production', True)
            self.assertEqual(len(host.writes), 4)
            self.assertEqual(host.calls, expected)

        def test_wrong_host_and_profile_fail_before_any_write(self):
            for change in ('host', 'profile'):
                host = FakeHost()
                if change == 'host':
                    host.host_identity = (0, HOSTNAME, 'wrong-machine')
                else:
                    path = Path('/etc/dg-webservices/fabelpad-vps08-staging/host.json')
                    profile = json.loads(host.read(path)); profile['siteId'] = 'another-project'
                    host.add(path, json.dumps(profile))
                with self.assertRaises(RuntimeError):
                    prepare(host, 'staging', True)
                self.assertEqual(host.calls, [])
                self.assertEqual(host.writes, [])

        def test_symlink_unsafe_parent_custom_file_hardlink_and_mode_rejected(self):
            for bad in ('symlink', 'unsafe-parent', 'custom', 'hardlink', 'mode'):
                host = FakeHost()
                _, _, timer, files = configuration('staging')
                target = Path('/etc/systemd/system') / timer
                host.add(target, files[target])
                if bad == 'unsafe-parent':
                    host.nodes[target.parent] = (stat.S_IFDIR | 0o777, 0, 1, '')
                elif bad == 'custom':
                    host.add(target, '[Timer]\nUnit=some-other-project.service\n')
                else:
                    host.nodes[target] = (stat.S_IFLNK | 0o777 if bad == 'symlink' else stat.S_IFREG | (0o600 if bad == 'mode' else 0o644),
                                          0, 2 if bad == 'hardlink' else 1, files[target])
                with self.assertRaises(RuntimeError):
                    prepare(host, 'staging', True)
                self.assertEqual(host.calls, [])
                self.assertEqual(host.writes, [])

        def test_verification_failure_never_installs_or_enables(self):
            host = FakeHost()
            def reject(*_):
                raise RuntimeError('synthetic unit verification failure')
            host.verify_units = reject
            with self.assertRaises(RuntimeError):
                prepare(host, 'staging', True)
            self.assertEqual(host.writes, [])
            self.assertEqual(host.calls, [])

    result = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(Checks))
    return 0 if result.wasSuccessful() else 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--environment', choices=['staging', 'production'])
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    if args.self_test:
        require(not args.environment and not args.apply, '--self-test cannot target or change a host')
        return self_test()
    parser.error('--environment is required') if not args.environment else None
    print(json.dumps(prepare(Host(), args.environment, args.apply)))
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (RuntimeError, OSError, ValueError, subprocess.TimeoutExpired) as error:
        # No file content, journal entry, credential or command output is logged.
        raise SystemExit('Private logging preparation refused: ' + str(error)) from None
