#!/usr/bin/python3 -I
"""Additive, fixed-target preparation; no activation, registration or proxy reload."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import pwd
import grp
import re
import socket
import stat
import subprocess
import sys

SITE = 'fabelpad-vps08-staging'
HOSTNAME = 'dg-vps-08'
MACHINE_ID = '05db94b99eca4c3d815f6585ef8ed517'
NODE = '/opt/dg-toolchains/fabelpad-vps08-staging/node-v24.18.0-linux-x64/bin/node'
PNPM = '/opt/dg-toolchains/fabelpad-vps08-staging/pnpm/11.25.0/lib/node_modules/pnpm/bin/pnpm.mjs'
CONFIG_ROOT = f'/etc/dg-webservices/{SITE}'
SITE_ROOT = f'/srv/sites/{SITE}'
BUILD_ROOT = f'/var/lib/dg-build/{SITE}'
INSTALL_ROOT = f'/usr/local/libexec/{SITE}'
RUNNER_ROOT = f'/opt/actions-runner/{SITE}'
USERS = {'runner': 'run-fab-v08-stg', 'build': 'build-fab-v08-stg', 'app': 'app-fab-v08-stg'}
APP_UNIT = f'/etc/systemd/system/{SITE}.service'
SUDOERS = f'/etc/sudoers.d/{SITE}'
MODULES = (
    'release-contract.mjs', 'host-runtime.mjs', 'candidate-build.sh',
    'candidate-build.mjs', 'candidate-worker.mjs', 'locked-operation.mjs',
    'activate.mjs', 'rollback.mjs', 'release-actions.mjs', 'verify-release-sha.mjs',
    'seal-artifact.py', 'bounded-operation.py',
)
TEMPLATES = (f'{SITE}.service', f'{SITE}-runner.service', f'{SITE}.caddy.disabled')
CLEAN_ENV = {'PATH': '/usr/sbin:/usr/bin:/sbin:/bin', 'LANG': 'C.UTF-8'}
MANAGED_PARENTS = ('/srv/sites', '/var/lib/dg-build', '/opt/actions-runner', '/etc/dg-webservices', '/usr/local/libexec')
LOCK_FILE = '/run/lock/dg-build.lock'
LOCK_TMPFILES = '/etc/tmpfiles.d/dg-build.conf'
LOCK_TMPFILES_BODY = b'f /run/lock/dg-build.lock 0660 root dg-build - -\n'
# Verified on dg-vps-08: Castiq introduced the same host-wide lock. Reuse it
# read-only; a missing optional tmpfiles argument has the same meaning as '-'.
LOCK_REFERENCE_TMPFILES = '/etc/tmpfiles.d/castiq-staging-build-lock.conf'
LOCK_PERSISTENCE_SOURCES = (LOCK_TMPFILES, LOCK_REFERENCE_TMPFILES)
LOCK_PERSISTENCE_BODIES = (LOCK_TMPFILES_BODY, b'f /run/lock/dg-build.lock 0660 root dg-build -\n')


def require(condition, message):
    if not condition:
        raise ValueError(message)


def render_proxy(domain):
    """Render only a separately verified DNS name; never activate or infer one."""
    require(isinstance(domain, str) and len(domain) <= 253 and '.' in domain
            and all(re.fullmatch(r'[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?', part)
                    for part in domain.split('.'))
            and not domain.endswith(('.invalid', '.example', '.test', '.localhost')),
            'Proxy vereist een expliciet geverifieerde DNS-naam.')
    return (f'{domain} {{\n    encode zstd gzip\n'
            '    reverse_proxy 127.0.0.1:4188\n}\n')


class SystemHost:
    def identity(self):
        return os.geteuid(), socket.gethostname(), Path('/etc/machine-id').read_text().strip()

    def metadata(self, path):
        try:
            return os.lstat(path)
        except FileNotFoundError:
            return None

    def user(self, name):
        try:
            record = pwd.getpwnam(name)
            return {'user': name, 'uid': record.pw_uid, 'gid': record.pw_gid}
        except KeyError:
            return None

    def group(self, name):
        try:
            return grp.getgrnam(name).gr_gid
        except KeyError:
            return None

    def command(self, argv, *, body=None, env=None):
        result = subprocess.run(argv, input=body, capture_output=True, check=False,
                                env=CLEAN_ENV if env is None else env, timeout=60)
        require(result.returncode == 0, 'Hostcontrole of voorbereiding geweigerd: ' + Path(argv[0]).name)
        return result.stdout.decode().strip()

    def trusted(self, path, *, executable=False):
        """Resolve root-owned tool links without trusting their 0777 link mode."""
        pending, resolved, links = path.split('/')[1:], [], 0
        while pending:
            part = pending.pop(0)
            if part in ('', '.'):
                continue
            if part == '..':
                require(bool(resolved), 'Toolpad verlaat root.')
                resolved.pop()
                continue
            current = '/' + '/'.join([*resolved, part])
            item = self.metadata(current)
            require(item is not None and item.st_uid == 0, 'Bovenliggend pad of tool is niet root-owned.')
            if stat.S_ISLNK(item.st_mode):
                links += 1
                require(links <= 40, 'Toolsymlinkcyclus.')
                target = os.readlink(current)
                if target.startswith('/'):
                    resolved = []
                pending = target.split('/') + pending
                continue
            require(not item.st_mode & 0o022, 'Bovenliggend pad of tool is schrijfbaar door anderen.')
            require(not pending or stat.S_ISDIR(item.st_mode), 'Ongeldig bovenliggend toolpad.')
            resolved.append(part)
        item = self.metadata('/' + '/'.join(resolved))
        if executable:
            require(stat.S_ISREG(item.st_mode) and item.st_mode & 0o111, 'Tool is niet uitvoerbaar.')
        return item

    def port_available(self):
        connection = socket.socket()
        try:
            connection.bind(('127.0.0.1', 4188))
            return True
        except OSError:
            return False
        finally:
            connection.close()

    def read(self, path):
        return Path(path).read_bytes()

    def create_user(self, role):
        name = USERS[role]
        home = f'/home/{name}' if role == 'runner' else BUILD_ROOT if role == 'build' else SITE_ROOT
        argv = ['/usr/sbin/useradd', '--system', '--user-group', '--no-create-home',
                '--home-dir', home, '--shell', '/usr/sbin/nologin']
        self.command([*argv, name])

    def mkdir(self, path, mode, uid=0, gid=0):
        os.mkdir(path, mode)
        os.chown(path, uid, gid)
        os.chmod(path, mode)

    def write(self, path, body, mode, uid=0, gid=0):
        descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW | os.O_CLOEXEC, mode)
        with os.fdopen(descriptor, 'wb') as stream:
            stream.write(body)
            stream.flush()
            os.fchown(stream.fileno(), uid, gid)
            os.fchmod(stream.fileno(), mode)
            os.fsync(stream.fileno())


class Preparation:
    def __init__(self, host, bundle):
        self.host, self.bundle = host, bundle

    def preflight(self):
        host = self.host
        require(host.identity() == (0, HOSTNAME, MACHINE_ID), 'Uitsluitend root op de geverifieerde doelhost is toegestaan.')
        for name in USERS.values():
            require(host.user(name) is None and host.group(name) is None, 'Eigen doelaccount of -groep bestaat al; niets gewijzigd.')
        for path in (SITE_ROOT, BUILD_ROOT, CONFIG_ROOT, INSTALL_ROOT, RUNNER_ROOT,
                     f'/home/{USERS["runner"]}', APP_UNIT, SUDOERS,
                     f'/etc/systemd/system/{SITE}-runner.service', f'/etc/caddy/sites/{SITE}.caddy'):
            require(host.metadata(path) is None, 'Eigen doelpad bestaat al; niets overschrijven: ' + path)
        for path in ('/srv', '/var/lib', '/opt', '/usr/local', '/etc', '/etc/tmpfiles.d',
                     '/etc/systemd/system', '/etc/sudoers.d', '/home'):
            item = host.trusted(path)
            require(stat.S_ISDIR(item.st_mode), 'Verwachte vertrouwde oudermap ontbreekt.')
        for path in MANAGED_PARENTS:
            if host.metadata(path) is not None:
                item = host.trusted(path)
                require(stat.S_ISDIR(item.st_mode) and item.st_mode & 0o001,
                        'Gedeelde ouder is geen vertrouwde, traverseerbare map.')
        lock_parent = host.metadata('/run/lock')
        require(lock_parent is not None and stat.S_ISDIR(lock_parent.st_mode)
                and lock_parent.st_uid == 0
                and (not lock_parent.st_mode & 0o022 or lock_parent.st_mode & stat.S_ISVTX),
                'Gedeelde lockdirectory is niet root-owned of veilig sticky.')
        lock = host.metadata(LOCK_FILE)
        group = host.group('dg-build')
        persistence = [path for path in LOCK_PERSISTENCE_SOURCES if host.metadata(path) is not None]
        if lock is None:
            require(group is None and not persistence,
                    'Gedeelde lockinrichting is onvolledig; bestaande onderdelen niet aanpassen.')
        else:
            require(group is not None and stat.S_ISREG(lock.st_mode)
                    and lock.st_uid == 0 and lock.st_gid == group and lock.st_nlink == 1
                    and stat.S_IMODE(lock.st_mode) == 0o660, 'Bestaande gedeelde buildlock wijkt af; niet repareren of vervangen.')
            require(persistence, 'Bestaande lockpersistentie ontbreekt; niet aanpassen.')
            for source in persistence:
                item = host.trusted(source)
                require(stat.S_ISREG(item.st_mode) and item.st_nlink == 1
                        and host.read(source) in LOCK_PERSISTENCE_BODIES,
                        'Bestaande lockpersistentie wijkt af; niet aanpassen.')
        require(host.port_available(), 'Loopbackpoort 4188 is niet vrij.')
        for tool in (NODE, PNPM, '/usr/sbin/useradd', '/usr/sbin/visudo', '/usr/bin/systemd-analyze',
                     '/usr/bin/uname', '/usr/bin/python3', '/usr/sbin/runuser', '/usr/bin/flock',
                     '/usr/bin/systemctl', '/usr/bin/tar', '/usr/sbin/groupadd'):
            host.trusted(tool, executable=True)
        require(host.command(['/usr/bin/uname', '-m']) == 'x86_64', 'Doelarchitectuur wijkt af van Linux x64.')
        tool_env = {**CLEAN_ENV, 'PATH': '/opt/dg-toolchains/fabelpad-vps08-staging/node-v24.18.0-linux-x64/bin:/opt/dg-toolchains/fabelpad-vps08-staging/pnpm/11.25.0/bin:/usr/bin:/bin', 'HOME': '/nonexistent'}
        require(host.command([NODE, '--version'], env=tool_env) == 'v24.18.0'
                and host.command([NODE, PNPM, '--version'], env=tool_env) == '11.25.0', 'Gepinde native toolchain wijkt af.')
        require(set(self.bundle) == {*MODULES, *TEMPLATES}, 'Onvolledige beoordeelde installatiebundel.')
        for entry in ('activate.mjs', 'rollback.mjs'):
            require(self.bundle[entry].startswith(('#!' + NODE + '\n').encode()), 'Geprivilegieerd entrypoint mist de vaste Node-shebang.')
        require(self.bundle['candidate-build.sh'].startswith(b'#!/usr/bin/bash\n'),
                'Kandidaatentrypoint mist de vaste Bash-interpreter.')
        sudoers = self.sudoers()
        # visudo reads stdin. There is no temporary file and no installation here.
        host.command(['/usr/sbin/visudo', '-cf', '/dev/stdin'], body=sudoers)
        return {'siteId': SITE, 'hostname': HOSTNAME, 'port': 4188,
                'accounts': USERS, 'appService': APP_UNIT, 'runnerRegistration': 'not performed',
                'routing': 'disabled template only', 'configuration': 'not provisioned',
                'activation': 'not performed', 'sharedBuildLock': LOCK_FILE,
                'lockPersistence': persistence[0] if persistence else LOCK_TMPFILES,
                'existingLockPersistenceSources': persistence, 'newManagedParents': [p for p in MANAGED_PARENTS if host.metadata(p) is None], 'installedCodeSha256': {
                    name: hashlib.sha256(self.bundle[name]).hexdigest() for name in MODULES}}

    def sudoers(self):
        identifier = '[a-z0-9][a-z0-9-]{0,62}'
        number = '[1-9][0-9]{0,19}'
        attempt = '[1-9][0-9]{0,5}'
        candidate = '[a-f0-9]{40}-' + number + '-' + attempt
        arguments = {
            'candidate-build.sh': ('--sha [a-f0-9]{40} --config-id ' + identifier
                + ' --run-id ' + number + ' --run-attempt ' + attempt + ' --ci-run-id ' + number
                + ' --ci-run-attempt ' + attempt + ' --ci-job-id ' + number),
            'activate.mjs': '--candidate ' + candidate + ' --config-id ' + identifier + ' --run-id ' + number + ' --run-attempt ' + attempt,
            'rollback.mjs': '--sha [a-f0-9]{40} --run-id ' + number + ' --run-attempt ' + attempt,
        }
        lines = ['# Fixed Fabelpad target only. API token arrives on bounded stdin, never env or argv.']
        for filename, expression in arguments.items():
            digest = hashlib.sha256(self.bundle[filename]).hexdigest()
            # Commas delimit sudoers command lists, including inside a regex.
            argument_rule = '^' + expression.replace(',', r'\,') + '$' if expression else '""'
            lines.append(f'{USERS["runner"]} ALL=(root) NOPASSWD: NOSETENV: sha256:{digest} {INSTALL_ROOT}/{filename} {argument_rule}')
        return ('\n'.join(lines) + '\n').encode()

    def profile(self):
        roles = {role: self.host.user(name) for role, name in USERS.items()}
        require(all(roles.values()) and len({v['uid'] for v in roles.values()}) == 3, 'Nieuwe accounts zijn niet gescheiden.')
        return {'version': 1, 'repository': 'fabelpad/platform', 'branch': 'main',
                'hostname': HOSTNAME, 'machineId': MACHINE_ID, 'environment': 'staging',
                'siteId': SITE, 'port': 4188, **roles, 'siteRoot': SITE_ROOT,
                'buildRoot': BUILD_ROOT, 'sourceWorkspace': f'{RUNNER_ROOT}/_work/platform/platform',
                'configRoot': CONFIG_ROOT, 'installRoot': INSTALL_ROOT, 'node': NODE, 'pnpm': PNPM,
                'toolchainPath': '/opt/dg-toolchains/fabelpad-vps08-staging/node-v24.18.0-linux-x64/bin:/opt/dg-toolchains/fabelpad-vps08-staging/pnpm/11.25.0/bin:/usr/bin:/bin',
                'buildHome': f'{BUILD_ROOT}/home', 'sharedBuildLock': '/run/lock/dg-build.lock',
                'activationLock': f'{CONFIG_ROOT}/activation.lock', 'service': f'{SITE}.service',
                'nodeVersion': '24.18.0', 'pnpmVersion': '11.25.0',
                'minimumFreeBytes': 4294967296, 'minimumFreeInodes': 50000}

    def run(self, apply=False):
        plan = self.preflight()
        if not apply:
            return {'status': 'dry-run', **plan}
        host = self.host
        # Every mutation below creates an exclusively new, fixed-name resource.
        # A partial failure is reported; no existing resources are repaired.
        for path in MANAGED_PARENTS:
            if host.metadata(path) is None:
                host.mkdir(path, 0o755)
        if host.metadata(LOCK_FILE) is None:
            host.command(['/usr/sbin/groupadd', '--system', 'dg-build'])
            host.write(LOCK_FILE, b'', 0o660, 0, host.group('dg-build'))
            host.write(LOCK_TMPFILES, LOCK_TMPFILES_BODY, 0o644)
        for role in USERS:
            host.create_user(role)
        profile = self.profile()
        runner, build, app = (profile[role] for role in ('runner', 'build', 'app'))
        directories = [
            (CONFIG_ROOT, 0o755, 0, 0), (f'{CONFIG_ROOT}/build-configs', 0o750, 0, build['gid']),
            (f'{CONFIG_ROOT}/runtime-configs', 0o750, 0, app['gid']), (f'{CONFIG_ROOT}/prepared', 0o755, 0, 0),
            (SITE_ROOT, 0o750, 0, app['gid']), (f'{SITE_ROOT}/candidates', 0o750, 0, app['gid']),
            (f'{SITE_ROOT}/releases', 0o750, 0, app['gid']), (f'{SITE_ROOT}/shared', 0o750, app['uid'], app['gid']),
            (BUILD_ROOT, 0o750, 0, build['gid']), (f'{BUILD_ROOT}/home', 0o750, build['uid'], build['gid']),
            (f'{BUILD_ROOT}/work', 0o750, 0, build['gid']),
            (f'/home/{runner["user"]}', 0o700, runner['uid'], runner['gid']),
            (RUNNER_ROOT, 0o700, runner['uid'], runner['gid']), (INSTALL_ROOT, 0o755, 0, 0),
        ]
        for path, mode, uid, gid in directories:
            host.mkdir(path, mode, uid, gid)
        for filename in MODULES:
            mode = 0o755 if filename in ('candidate-build.sh', 'activate.mjs', 'rollback.mjs') else 0o644
            host.write(f'{INSTALL_ROOT}/{filename}', self.bundle[filename], mode)
        host.write(f'{CONFIG_ROOT}/host.json', (json.dumps(profile, indent=2) + '\n').encode(), 0o644)
        host.write(f'{CONFIG_ROOT}/activation.lock', b'', 0o600)
        for filename in TEMPLATES:
            host.write(f'{CONFIG_ROOT}/prepared/{filename}', self.bundle[filename], 0o644)
        host.command(['/usr/bin/systemd-analyze', 'verify', f'{CONFIG_ROOT}/prepared/{SITE}.service'])
        host.write(APP_UNIT, self.bundle[f'{SITE}.service'], 0o644)
        host.write(SUDOERS, self.sudoers(), 0o440)
        host.command(['/usr/sbin/visudo', '-cf', SUDOERS])
        receipt = {'status': 'prepared-inactive', **plan, 'profile': profile,
                   'runnerUnit': f'{CONFIG_ROOT}/prepared/{SITE}-runner.service',
                   'proxyTemplate': f'{CONFIG_ROOT}/prepared/{SITE}.caddy.disabled'}
        host.write(f'{CONFIG_ROOT}/installation.json', (json.dumps(receipt, indent=2) + '\n').encode(), 0o644)
        return receipt


def load_bundle(source_root):
    root = Path(source_root).resolve()
    result = {}
    for directory, names in (('scripts/deploy', MODULES), ('deploy/host', TEMPLATES)):
        for name in names:
            path = root / directory / name
            require(path.is_file() and not path.is_symlink() and path.resolve().is_relative_to(root),
                    'Installatiebron ontbreekt of verwijst buiten de beoordeelde bundel: ' + name)
            item = path.stat()
            require(item.st_nlink == 1 and item.st_size <= 1024 * 1024, 'Ongeldige installatiebron: ' + name)
            result[name] = path.read_bytes()
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true', help='Maak uitsluitend nieuwe vaste doelresources; standaard alleen controles.')
    parser.add_argument('--source-root', default=str(Path(__file__).resolve().parents[2]))
    args = parser.parse_args()
    result = Preparation(SystemHost(), load_bundle(args.source_root)).run(apply=args.apply)
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    try:
        main()
    except ValueError as error:
        # All ValueError messages originate from the reviewed require() calls
        # above. They contain fixed contract names, never command output or env.
        print('Fabelpad-hostvoorbereiding geweigerd: ' + str(error), file=sys.stderr)
        sys.exit(1)
    except OSError as error:
        print(f'Fabelpad-hostvoorbereiding gestopt tijdens bestands- of hostbewerking ({type(error).__name__}, errno={error.errno}).', file=sys.stderr)
        sys.exit(1)
    except subprocess.SubprocessError as error:
        print(f'Fabelpad-hostvoorbereiding gestopt tijdens een hostcontrole ({type(error).__name__}).', file=sys.stderr)
        sys.exit(1)
