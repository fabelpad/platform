#!/usr/bin/python3
"""Copy a mutable build through directory descriptors without following links.

The CLI is private implementation code, outside sudoers. Only the reviewed root
dispatcher chooses its paths and owners. The source must belong entirely to the
dedicated build account; the destination is beneath a root-private pending dir.
"""

import os
import stat
import sys


def require(condition):
    if not condition:
        raise ValueError("Unsafe artifact")


def copy_artifact(source, destination, source_uid, app_gid, destination_uid=0):
    flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC
    source_fd = os.open(source, flags)
    try:
        require(os.fstat(source_fd).st_uid == source_uid)
        os.mkdir(destination, 0o700)
        destination_fd = os.open(destination, flags)
        try:
            _copy_directory(source_fd, destination_fd, source_uid, destination_uid, app_gid)
        finally:
            os.close(destination_fd)
    finally:
        os.close(source_fd)


def _copy_directory(source_fd, destination_fd, source_uid, destination_uid, app_gid):
    for name in sorted(os.listdir(source_fd)):
        require(name not in ("", ".", "..") and "/" not in name)
        metadata = os.stat(name, dir_fd=source_fd, follow_symlinks=False)
        require(metadata.st_uid == source_uid and not metadata.st_mode & 0o6000)
        if stat.S_ISLNK(metadata.st_mode):
            target = os.readlink(name, dir_fd=source_fd)
            require(not os.path.isabs(target))
            os.symlink(target, name, dir_fd=destination_fd)
            os.chown(name, destination_uid, app_gid, dir_fd=destination_fd, follow_symlinks=False)
        elif stat.S_ISDIR(metadata.st_mode):
            child_source = os.open(name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC, dir_fd=source_fd)
            try:
                opened = os.fstat(child_source)
                require(opened.st_uid == source_uid and opened.st_ino == metadata.st_ino and opened.st_dev == metadata.st_dev)
                os.mkdir(name, 0o700, dir_fd=destination_fd)
                child_destination = os.open(name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC, dir_fd=destination_fd)
                try:
                    _copy_directory(child_source, child_destination, source_uid, destination_uid, app_gid)
                finally:
                    os.close(child_destination)
            finally:
                os.close(child_source)
        else:
            require(stat.S_ISREG(metadata.st_mode) and metadata.st_nlink == 1)
            # O_NONBLOCK also prevents a FIFO swapped in after stat() from
            # hanging the privileged copier. fstat below rejects every device.
            source_file = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK | os.O_CLOEXEC, dir_fd=source_fd)
            try:
                opened = os.fstat(source_file)
                require(stat.S_ISREG(opened.st_mode) and opened.st_nlink == 1
                        and opened.st_uid == source_uid and opened.st_ino == metadata.st_ino
                        and opened.st_dev == metadata.st_dev and not opened.st_mode & 0o6000)
                destination_file = os.open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW | os.O_CLOEXEC, 0o600, dir_fd=destination_fd)
                try:
                    while True:
                        chunk = os.read(source_file, 1024 * 1024)
                        if not chunk:
                            break
                        view = memoryview(chunk)
                        while view:
                            view = view[os.write(destination_file, view):]
                    final = os.fstat(source_file)
                    require(final.st_nlink == 1 and final.st_size == opened.st_size
                            and final.st_mtime_ns == opened.st_mtime_ns and final.st_ctime_ns == opened.st_ctime_ns)
                    os.fchown(destination_file, destination_uid, app_gid)
                    os.fchmod(destination_file, 0o750 if opened.st_mode & 0o100 else 0o640)
                finally:
                    os.close(destination_file)
            finally:
                os.close(source_file)
    os.fchown(destination_fd, destination_uid, app_gid)
    os.fchmod(destination_fd, 0o750)


def main():
    require(os.getuid() == 0 and len(sys.argv) == 5)
    source, destination, uid, gid = sys.argv[1:]
    require(os.path.isabs(source) and os.path.isabs(destination) and int(uid) > 0 and int(gid) > 0)
    copy_artifact(source, destination, int(uid), int(gid))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        # No source paths, file contents or arbitrary exception snippets appear
        # in root output when a mutable build races this copy.
        print("Artefact kon niet veilig worden verzegeld.", file=sys.stderr)
        sys.exit(1)
