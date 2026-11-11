#!/usr/bin/env python3
"""Host preparation contract tests. Never creates Linux accounts or host files."""
import copy
import importlib.util
import json
from pathlib import Path
import shutil
import stat
import subprocess
import sys
from types import SimpleNamespace
import unittest

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('install_host', Path(__file__).with_name('install-host.py'))
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)


def item(mode=0o755, uid=0, gid=0, kind=stat.S_IFDIR):
    return SimpleNamespace(st_mode=kind | mode, st_uid=uid, st_gid=gid, st_nlink=1)


class FakeHost:
    def __init__(self):
        self.ident = (0, installer.HOSTNAME, installer.MACHINE_ID)
        self.users, self.groups, self.writes, self.commands, self.mutations = {}, {'dg-build': 42}, {}, [], []
        self.paths = {path: item() for path in ('/srv/sites', '/var/lib/dg-build', '/usr/local/libexec',
                     '/opt/actions-runner', '/etc/systemd/system', '/etc/sudoers.d', '/home')}
        self.paths['/run/lock/dg-build.lock'] = item(0o660, gid=42, kind=stat.S_IFREG)
        self.paths['/run/lock'] = item(0o1777)
        self.port = True
        self.node_version, self.pnpm_version = 'v24.18.0', '11.25.0'

    def identity(self): return self.ident
    def user(self, name): return self.users.get(name)
    def group(self, name): return self.groups.get(name)
    def metadata(self, path): return self.paths.get(path)
    def port_available(self): return self.port

    def trusted(self, path, executable=False):
        if executable:
            return item(0o755, kind=stat.S_IFREG)
        record = self.paths.get(path)
        installer.require(record is not None and record.st_uid == 0 and not record.st_mode & 0o022,
                          'Untrusted fixture parent')
        return record

    def command(self, argv, body=None, env=None):
        self.commands.append((argv, body, env))
        if argv == [installer.NODE, '--version']: return self.node_version
        if argv == [installer.NODE, installer.PNPM, '--version']: return self.pnpm_version
        if argv == ['/usr/bin/uname', '-m']: return 'x86_64'
        return ''

    def create_user(self, role):
        name = installer.USERS[role]
        assert name not in self.users and name not in self.groups
        number = 10000 + len(self.users)
        self.users[name] = {'user': name, 'uid': number, 'gid': number}
        self.groups[name] = number
        self.mutations.append(('user', name))

    def mkdir(self, path, mode, uid=0, gid=0):
        assert path not in self.paths, 'Would overwrite existing fixture path'
        self.paths[path] = item(mode, uid, gid)
        self.mutations.append(('directory', path))

    def write(self, path, body, mode, uid=0, gid=0):
        assert path not in self.paths, 'Would overwrite existing fixture file'
        self.paths[path] = item(mode, uid, gid, stat.S_IFREG)
        self.writes[path] = body
        self.mutations.append(('file', path))


class HostPreparationTest(unittest.TestCase):
    def setUp(self):
        self.host = FakeHost()
        self.bundle = {name: b'// reviewed fixture\n' for name in installer.MODULES}
        for name in ('activate.mjs', 'rollback.mjs'):
            self.bundle[name] = ('#!' + installer.NODE + '\n').encode()
        self.bundle['candidate-build.sh'] = b'#!/usr/bin/bash\n'
        for name in installer.TEMPLATES:
            self.bundle[name] = (Path(__file__).resolve().parents[2] / 'deploy/host' / name).read_bytes()
        self.preparation = installer.Preparation(self.host, self.bundle)

    def refused_without_mutation(self):
        with self.assertRaises(ValueError): self.preparation.run(apply=True)
        self.assertEqual(self.host.mutations, [])

    def test_default_is_only_a_dry_run(self):
        result = self.preparation.run()
        self.assertEqual(result['status'], 'dry-run')
        self.assertEqual(self.host.mutations, [])
        self.assertEqual(result['configuration'], 'not provisioned')

    def test_system_user_creation_adds_no_supplemental_groups(self):
        host = installer.SystemHost()
        commands = []
        host.command = commands.append
        for role in installer.USERS: host.create_user(role)
        for argv in commands:
            self.assertEqual(argv[0], '/usr/sbin/useradd')
            self.assertIn('--system', argv)
            self.assertIn('--user-group', argv)
            self.assertIn('--no-create-home', argv)
            self.assertNotIn('--groups', argv)
            self.assertNotIn('dg-build', argv)

    def test_wrong_host_machine_or_caller_is_rejected(self):
        for identity in ((1000, installer.HOSTNAME, installer.MACHINE_ID),
                         (0, 'other-host', installer.MACHINE_ID), (0, installer.HOSTNAME, 'other-id')):
            with self.subTest(identity=identity):
                self.host.ident = identity
                self.refused_without_mutation()

    def test_existing_target_user_group_or_path_is_never_reused(self):
        for resource in ('user', 'group', 'path'):
            with self.subTest(resource=resource):
                self.setUp()
                if resource == 'user': self.host.users['run-fab-nxt-stg'] = {'uid': 123}
                elif resource == 'group': self.host.groups['app-fab-nxt-stg'] = 123
                else: self.host.paths[installer.SITE_ROOT] = item()
                self.refused_without_mutation()

    def test_unsafe_shared_lock_or_parent_is_rejected(self):
        for record in (item(0o666, gid=42, kind=stat.S_IFREG), item(0o660, uid=123, gid=42, kind=stat.S_IFREG),
                       item(0o660, gid=123, kind=stat.S_IFREG), item(0o660, gid=42, kind=stat.S_IFLNK)):
            with self.subTest(mode=record.st_mode):
                self.host.paths['/run/lock/dg-build.lock'] = record
                self.refused_without_mutation()
        self.setUp()
        self.host.paths['/srv/sites'] = item(0o777)
        self.refused_without_mutation()
        self.setUp()
        self.host.paths['/run/lock'] = item(0o777)
        self.refused_without_mutation()

    def test_wrong_toolchain_busy_port_and_incomplete_sources_are_rejected(self):
        self.host.port = False
        self.refused_without_mutation()
        self.setUp()
        self.host.pnpm_version = 'different'
        self.refused_without_mutation()
        self.setUp()
        del self.bundle['release-actions.mjs']
        self.refused_without_mutation()

    def test_apply_keeps_existing_resources_and_creates_no_activation(self):
        before = copy.deepcopy(self.host.paths)
        result = self.preparation.run(apply=True)
        self.assertEqual(result['status'], 'prepared-inactive')
        for path, metadata in before.items(): self.assertEqual(vars(self.host.paths[path]), vars(metadata))
        profile = json.loads(self.host.writes[f'{installer.CONFIG_ROOT}/host.json'])
        self.assertEqual(profile['port'], 4176)
        self.assertEqual(len({profile[role]['uid'] for role in installer.USERS}), 3)
        self.assertIn('/opt/dg-toolchains/pnpm/11.25.0/bin', profile['toolchainPath'])
        self.assertEqual(self.host.paths[f'{installer.BUILD_ROOT}/work'].st_uid, 0)
        self.assertEqual(self.host.paths[f'{installer.CONFIG_ROOT}/build-configs'].st_gid, profile['build']['gid'])
        self.assertEqual(self.host.paths[f'{installer.CONFIG_ROOT}/runtime-configs'].st_gid, profile['app']['gid'])
        self.assertNotEqual(profile['build']['gid'], profile['app']['gid'])
        self.assertFalse(any(path.endswith('.env') or '/current' in path for path in self.host.writes))
        self.assertFalse(any('/etc/caddy/' in path for path in self.host.writes))
        self.assertFalse(any('systemctl' in part or 'reload' in part or 'enable' in part
                             for argv, _, _ in self.host.commands for part in argv))
        self.assertNotIn(f'/etc/systemd/system/{installer.SITE}-runner.service', self.host.writes)

    def test_sudoers_limits_the_exact_three_entries_and_no_argument_rollback(self):
        source = self.preparation.sudoers().decode()
        self.assertEqual(source.count('NOPASSWD: NOSETENV: sha256:'), 3)
        self.assertIn('/rollback.mjs ""', source)
        self.assertNotIn('env_keep', source)
        self.assertNotIn('locked-operation.mjs', source)
        self.assertNotIn('--profile', source)
        self.assertIn(r'{0\,62}', source)
        if shutil.which('visudo'):
            result = subprocess.run([shutil.which('visudo'), '-cf', '/dev/stdin'],
                                    input=source.encode(), capture_output=True)
            self.assertEqual(result.returncode, 0, result.stderr.decode())

    def test_proxy_renderer_fails_closed_for_missing_or_injected_domain(self):
        for value in ('', '__VERIFIED_FABELPAD_DOMAIN__', 'https://host.nl', 'host.nl\nother.nl',
                      'host.nl { respond compromised }', 'staging.example', 'localhost', '*.host.nl'):
            with self.subTest(value=value):
                with self.assertRaises(ValueError): installer.render_proxy(value)
        self.assertIn('reverse_proxy 127.0.0.1:4176', installer.render_proxy('staging.fabelpad.nl'))


if __name__ == '__main__':
    unittest.main()
