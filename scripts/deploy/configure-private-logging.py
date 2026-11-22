#!/usr/bin/env python3
"""Prepare only the two own journal namespaces; shared host logging is untouched."""
import argparse
import json
import os
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--environment', choices=['staging', 'production'], required=True)
parser.add_argument('--apply', action='store_true')
args = parser.parse_args()
site = 'fabelpad-vps08-' + args.environment
assert Path('/etc/machine-id').read_text().strip() == '05db94b99eca4c3d815f6585ef8ed517', 'Wrong host'
assert os.geteuid() == 0, 'Root required'
files = {
    Path('/etc/systemd/system') / (site + '.service.d/30-private-journal.conf'): '[Service]\nLogNamespace=' + site + '\n',
    Path('/etc/systemd') / ('journald@' + site + '.conf.d/30-retention.conf'): '[Journal]\nStorage=persistent\nMaxRetentionSec=29day\nMaxFileSec=12h\nSystemMaxUse=100M\nForwardToSyslog=no\nForwardToKMsg=no\nForwardToConsole=no\n',
}
for path, content in files.items():
    assert not path.is_symlink() and not path.parent.is_symlink(), 'Refuse symlinks'
    if path.exists():
        assert path.stat().st_uid == 0 and path.read_text() == content, 'Existing custom logging differs; review first'
    elif args.apply:
        path.parent.mkdir(mode=0o755, parents=True, exist_ok=True)
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o644)
        with os.fdopen(fd, 'w') as handle:
            handle.write(content)
print(json.dumps({'environment': args.environment, 'applied': args.apply, 'namespace': site, 'retentionDays': 29, 'maxJournalFileHours': 12, 'sharedLoggingChanged': False}))
