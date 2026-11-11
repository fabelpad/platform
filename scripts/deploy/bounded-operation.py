#!/usr/bin/python3
"""Hold the release lock until a bounded process group has fully stopped.

Private root implementation; there is no sudoers entry for this program. The
reviewed Node entry chooses the lock, command and time budget. stdin is passed
straight to the trusted child; credentials never enter argv or environment.
"""

import ctypes
import fcntl
import os
import signal
import stat
import subprocess
import sys
import time


def live_group_members(group):
    members = []
    for entry in os.scandir('/proc'):
        if not entry.name.isdigit():
            continue
        try:
            with open(f'{entry.path}/stat', encoding='utf-8') as source:
                fields = source.read().rpartition(')')[2].split()
            if int(fields[2]) == group and fields[0] not in ('Z', 'X'):
                members.append(int(entry.name))
        except (FileNotFoundError, ProcessLookupError, PermissionError, ValueError, IndexError):
            continue
    return members


def run_locked(lock_path, seconds, command, *, expected_uid=0, grace_seconds=30, expected_parent=None):
    lock = os.open(lock_path, os.O_RDWR | os.O_NOFOLLOW | os.O_CLOEXEC)
    child = None
    previous_handlers = {}
    try:
        metadata = os.fstat(lock)
        if not (stat.S_ISREG(metadata.st_mode) and metadata.st_uid == expected_uid
                and metadata.st_nlink == 1 and not metadata.st_mode & 0o007):
            raise ValueError("Unsafe lock")
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return 75

        def cancelled(_signal, _frame):
            raise InterruptedError("Operation cancelled")

        for name in (signal.SIGTERM, signal.SIGINT, signal.SIGHUP):
            previous_handlers[name] = signal.signal(name, cancelled)
        original_parent = expected_parent if expected_parent is not None else os.getppid()
        # Linux PR_SET_PDEATHSIG. If the sudo/Node parent is killed during a
        # cancelled Actions job, this supervisor still cleans its whole group
        # before it closes the lock descriptor.
        if ctypes.CDLL(None, use_errno=True).prctl(1, signal.SIGTERM, 0, 0, 0) != 0:
            raise OSError("Cannot protect parent death")
        if os.getppid() != original_parent:
            raise InterruptedError("Parent changed")
        child = subprocess.Popen(command, start_new_session=True, close_fds=True)
        try:
            return child.wait(timeout=seconds)
        except subprocess.TimeoutExpired:
            return 124
        except InterruptedError:
            return 130
    finally:
        # Ignore repeated cancellation while cleaning. Only this supervisor
        # holds the flock FD, so no next build can begin during graceful stop.
        for name in previous_handlers:
            signal.signal(name, signal.SIG_IGN)
        if child is not None:
            try:
                os.killpg(child.pid, signal.SIGTERM)
                deadline = time.monotonic() + grace_seconds
                while time.monotonic() < deadline:
                    child.poll()
                    try:
                        os.killpg(child.pid, 0)
                    except ProcessLookupError:
                        break
                    time.sleep(0.05)
                try:
                    os.killpg(child.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                child.wait(timeout=5)
                # SIGKILL delivery is asynchronous. Keep the flock until no
                # group member can execute, including orphaned grandchildren.
                deadline = time.monotonic() + 5
                while live_group_members(child.pid):
                    if time.monotonic() >= deadline:
                        raise RuntimeError('Process group did not stop')
                    time.sleep(0.01)
            except ProcessLookupError:
                child.wait(timeout=5)
        os.close(lock)
        for name, handler in previous_handlers.items():
            signal.signal(name, handler)


def main():
    if os.getuid() != 0 or len(sys.argv) < 6:
        raise ValueError("Private root supervisor")
    lock, seconds, parent, *command = sys.argv[1:]
    if not (os.path.isabs(lock) and seconds == '2700'
            and command[0] == '/opt/node-v24.18.0-linux-x64/bin/node'
            and command[1] == '/usr/local/libexec/fabelpad-nxttrack-staging/locked-operation.mjs'):
        raise ValueError("Unexpected operation")
    return run_locked(lock, 2700, command, expected_parent=int(parent))


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception:
        print('Releasebewerking of procesopruiming is gestopt; er is geen lock overgeslagen.', file=sys.stderr)
        sys.exit(1)
