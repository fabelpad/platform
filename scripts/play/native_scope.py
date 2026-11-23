#!/usr/bin/env python3
"""Detect reviewed native build inputs on main; no signing or publishing."""
import argparse
from fnmatch import fnmatchcase
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys

ZERO_SHA = '0' * 40
ROOT_INPUTS = {
    '.nvmrc', '.node-version', '.tool-versions', '.npmrc', '.pnpmfile.cjs',
    'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'package-lock.json',
    'npm-shrinkwrap.json', 'yarn.lock', 'bun.lock', 'bun.lockb', 'tsconfig.json',
}
WORKFLOWS = {
    '.github/workflows/verify.yml',
    '.github/workflows/fabelpad-android-ci.yml',
    '.github/workflows/fabelpad-play-production.yml',
}
SHARED_SOURCE = (
    'src/story*.ts', 'src/newStories.ts', 'src/worlds.ts', 'src/readingLevel.ts',
    'src/youngChapterLabels.ts', 'src/contentReadingLevels.ts', 'src/profileReading.ts',
    'lib/contentHash.ts',
)
EXPORT_AND_CHECKS = {
    'scripts/export-native-content.mjs', 'scripts/source-test-loader.mjs',
    'scripts/story-reading-levels-check.mjs', 'scripts/story-play-check.mjs',
    'scripts/story-catalog-check.mjs', 'scripts/story-growth-check.mjs',
    'scripts/story-memory-check.mjs', 'scripts/local-checks.mjs',
    'scripts/profile-reading-check.mjs',
    'scripts/local-build.sh', 'scripts/local-preflight.mjs',
    'scripts/fixtures/story-length-baseline.json',
}
IMAGE_SUFFIXES = {'.webp', '.png', '.jpg', '.jpeg', '.avif', '.gif', '.svg'}
DOCUMENT_SUFFIXES = {'.md', '.mdx', '.rst', '.adoc'}


def is_native_input(filename):
    path = PurePosixPath(filename)
    if path.is_absolute() or '..' in path.parts or not filename or '\\' in filename:
        return False
    # Documentation and artwork prompts are not app/runtime inputs.
    if (path.suffix.lower() in DOCUMENT_SUFFIXES
            or filename.startswith(('docs/', 'mobile/docs/', 'scripts/play/docs/'))
            or (path.name.lower().startswith(('readme', 'changelog', 'validatie'))
                and path.suffix.lower() in {'.txt', '.pdf'})):
        return False
    if filename in ROOT_INPUTS or filename in WORKFLOWS or filename in EXPORT_AND_CHECKS:
        return True
    if fnmatchcase(filename, 'tsconfig.*.json') or any(fnmatchcase(filename, pattern) for pattern in SHARED_SOURCE):
        return True
    if filename.startswith('mobile/'):
        return path.name not in {'.gitignore', '.env.example'}
    if filename.startswith(('.github/actions/', 'scripts/play/')):
        return True
    if filename.startswith('scripts/native-'):
        return path.suffix in {'.py', '.mjs', '.cjs', '.js', '.sh'}
    if filename.startswith(('public/art/', 'public/brand/')):
        return path.suffix.lower() in IMAGE_SUFFIXES
    return False


def git(root, *args):
    return subprocess.run(['git', '-C', str(root), *args], check=True,
                          capture_output=True, timeout=60).stdout


def native_changed(*, event, ref, repository, before, sha, root):
    # A PR, manual signing-only run or another branch never auto-uploads.
    if event != 'push' or ref != 'refs/heads/main':
        return False
    if repository != 'fabelpad/platform':
        raise ValueError('Onverwachte release-repository.')
    if not re.fullmatch('[a-f0-9]{40}', sha) or sha == ZERO_SHA:
        raise ValueError('Een volledige bestaande bron-SHA is vereist.')
    if not re.fullmatch('[a-f0-9]{40}', before):
        raise ValueError('De vorige push-SHA ontbreekt of is ongeldig.')
    if git(root, 'rev-parse', 'HEAD').strip().decode('ascii') != sha:
        raise ValueError('De checkout is niet de exacte push-SHA.')
    git(root, 'cat-file', '-e', f'{sha}^{{commit}}')
    if before == ZERO_SHA:
        # A newly created main ref must inspect its entire committed tree.
        names = git(root, 'ls-tree', '-r', '--name-only', '-z', sha)
    else:
        git(root, 'cat-file', '-e', f'{before}^{{commit}}')
        # Disable rename collapsing so both old and new paths remain visible.
        # NUL-separated names preserve spaces and newlines without shell parsing.
        names = git(root, 'diff', '--no-ext-diff', '--no-renames', '--name-only', '-z', before, sha, '--')
    paths = [name.decode('utf-8', errors='surrogateescape') for name in names.split(b'\0') if name]
    return any(is_native_input(filename) for filename in paths)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for flag in ('event', 'ref', 'repository', 'before', 'sha'):
        parser.add_argument('--' + flag, required=True)
    parser.add_argument('--github-output', required=True, type=Path)
    args = parser.parse_args()
    try:
        changed = native_changed(event=args.event, ref=args.ref, repository=args.repository,
                                 before=args.before, sha=args.sha, root=Path.cwd())
        with args.github_output.open('a', encoding='utf-8') as output:
            output.write(f'changed={str(changed).lower()}\n')
        print('Native buildinputs gecontroleerd; geen signing- of publicatieactie uitgevoerd.')
        return 0
    except (OSError, ValueError, UnicodeError, subprocess.SubprocessError):
        print('Native wijzigingscontrole geweigerd; controleer de exacte checkout en beide pushcommits.', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
