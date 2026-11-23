import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('native_scope', Path(__file__).with_name('native_scope.py'))
scope = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scope)


class NativeInputRulesTests(unittest.TestCase):
    def test_mobile_runtime_assets_native_modules_and_config(self):
        for path in ['mobile/App.tsx', 'mobile/src/content.json', 'mobile/src/releases/123.json',
                     'mobile/assets/brand/launcher.png', 'mobile/assets/art/play/station.webp',
                     'mobile/modules/speech/android/src/Speech.kt', 'mobile/plugins/signing.cjs',
                     'mobile/app.config.ts', 'mobile/metro.config.cjs', 'mobile/babel.config.cjs',
                     'mobile/package-lock.json', 'mobile/package.json', 'mobile/tsconfig.json']:
            with self.subTest(path=path): self.assertTrue(scope.is_native_input(path))

    def test_all_shared_story_and_reading_sources(self):
        for path in ['src/storyData.ts', 'src/storyCollectionA.ts', 'src/storyCollectionB.ts',
                     'src/storyLevelsWeather.ts', 'src/storyLevelsFuture.ts', 'src/storyReadingLevels.ts',
                     'src/storyPlayArt.ts', 'src/storyPlayLogic.ts', 'src/storyTypes.ts', 'src/storyCatalog.ts',
                     'src/newStories.ts', 'src/worlds.ts', 'src/readingLevel.ts', 'src/youngChapterLabels.ts',
                     'src/contentReadingLevels.ts', 'src/profileReading.ts',
                     'src/storyPersonalization.ts', 'lib/contentHash.ts']:
            with self.subTest(path=path): self.assertTrue(scope.is_native_input(path))

    def test_export_toolchain_and_native_validation_inputs(self):
        for path in ['scripts/export-native-content.mjs', 'scripts/source-test-loader.mjs',
                     'scripts/native-build-production.sh', 'scripts/native-runtime-check.mjs',
                     'scripts/native-production-manifest.py', 'scripts/native-android-preflight.mjs',
                     'scripts/native-signing-init.py', 'scripts/story-reading-levels-check.mjs',
                     'scripts/story-play-check.mjs', 'scripts/story-memory-check.mjs',
                     'scripts/profile-reading-check.mjs',
                     'scripts/local-checks.mjs', 'scripts/local-build.sh', 'scripts/local-preflight.mjs',
                     'scripts/fixtures/story-length-baseline.json']:
            with self.subTest(path=path): self.assertTrue(scope.is_native_input(path))

    def test_locks_build_configuration_and_release_workflows(self):
        for path in ['.nvmrc', '.npmrc', '.pnpmfile.cjs', 'package.json', 'pnpm-lock.yaml',
                     'pnpm-workspace.yaml', 'package-lock.json', 'yarn.lock', 'tsconfig.json',
                     'tsconfig.build.json', '.github/workflows/verify.yml',
                     '.github/workflows/fabelpad-android-ci.yml', '.github/workflows/fabelpad-play-production.yml',
                     '.github/actions/native-build/action.yml', 'scripts/play/read_config.py',
                     'scripts/play/native_scope.py', 'scripts/play/config.json', 'scripts/play/release-notes.json']:
            with self.subTest(path=path): self.assertTrue(scope.is_native_input(path))

    def test_exported_public_runtime_art_and_brand(self):
        for path in ['public/art/weather-v2.webp', 'public/art/play/dream-scene.webp',
                     'public/art/new-world.png', 'public/brand/logo.webp', 'public/brand/mascot.webp']:
            with self.subTest(path=path): self.assertTrue(scope.is_native_input(path))

    def test_documentation_art_prompts_and_web_only_changes_do_not_release(self):
        for path in ['README.md', 'AGENTS.md', 'docs/GOOGLE-PLAY-RELEASE-RUNBOOK.md',
                     'mobile/README.md', 'mobile/VALIDATIE.md', 'mobile/docs/guide.txt',
                     'mobile/docs/image.png', 'mobile/src/README.mdx', 'mobile/.env.example',
                     'mobile/.gitignore', 'scripts/play/README.md', '.github/RELEASE-GATES.md',
                     'public/art/play/prompts.json', 'public/art/prompts-a.json',
                     'src/MarketingSite.tsx', 'src/reader.css', 'lib/server/parent.ts',
                     '.github/workflows/fabelpad-dg-vps-08-production-activate.yml']:
            with self.subTest(path=path): self.assertFalse(scope.is_native_input(path))

    def test_absolute_or_parent_paths_are_not_valid_repository_inputs(self):
        for path in ['/mobile/App.tsx', '../mobile/App.tsx', 'src/../mobile/App.tsx', 'mobile\\App.tsx', '']:
            with self.subTest(path=path): self.assertFalse(scope.is_native_input(path))

    def test_pr_dispatch_and_other_branches_never_auto_release(self):
        for event, ref in [('pull_request', 'refs/pull/123/merge'),
                           ('workflow_dispatch', 'refs/heads/main'), ('push', 'refs/heads/review')]:
            with self.subTest(event=event, ref=ref), patch.object(scope, 'git') as git:
                self.assertFalse(scope.native_changed(event=event, ref=ref, repository='fabelpad/platform',
                                                      before='', sha='', root=Path('/unused')))
                git.assert_not_called()


class NativeGitDiffTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='fabelpad-native-scope-fixture-')
        self.root = Path(self.temporary.name)
        self.git('init', '-q', '--initial-branch=main')
        self.git('config', 'user.name', 'Synthetic scope test')
        self.git('config', 'user.email', 'scope@example.test')
        self.before = self.commit_file('README.md', 'Synthetic fixture')

    def tearDown(self): self.temporary.cleanup()

    def git(self, *args):
        return subprocess.run(['git', '-c', 'core.hooksPath=/dev/null', '-C', str(self.root), *args],
                              check=True, capture_output=True, timeout=15).stdout

    def commit_file(self, filename, text='synthetic'):
        target = self.root / filename
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text)
        return self.commit()

    def commit(self):
        self.git('add', '--all')
        self.git('commit', '-qm', 'Synthetic test fixture')
        return self.git('rev-parse', 'HEAD').strip().decode()

    def changed(self, before, sha):
        return scope.native_changed(event='push', ref='refs/heads/main', repository='fabelpad/platform',
                                    before=before, sha=sha, root=self.root)

    def test_shared_source_change_detected_outside_mobile(self):
        self.assertTrue(self.changed(self.before, self.commit_file('src/storyLevelsWeather.ts')))

    def test_shared_birthdate_logic_change_detected_outside_mobile(self):
        self.assertTrue(self.changed(self.before, self.commit_file('src/profileReading.ts')))

    def test_shared_birthdate_validation_change_detected_outside_mobile(self):
        self.assertTrue(self.changed(self.before, self.commit_file('scripts/profile-reading-check.mjs')))

    def test_docs_only_commit_and_rename_do_not_release(self):
        before = self.commit_file('mobile/README.md', 'Document')
        (self.root / 'mobile/README.md').rename(self.root / 'mobile/VALIDATIE.md')
        self.assertFalse(self.changed(before, self.commit()))

    def test_rename_out_of_native_input_still_detects_old_path(self):
        before = self.commit_file('mobile/src/old.ts')
        (self.root / 'docs').mkdir()
        (self.root / 'mobile/src/old.ts').rename(self.root / 'docs/moved.txt')
        self.assertTrue(self.changed(before, self.commit()))

    def test_rename_into_native_input_detects_new_path(self):
        before = self.commit_file('docs/moved.txt')
        (self.root / 'mobile/src').mkdir(parents=True)
        (self.root / 'docs/moved.txt').rename(self.root / 'mobile/src/new.ts')
        self.assertTrue(self.changed(before, self.commit()))

    def test_deleting_native_input_is_detected(self):
        before = self.commit_file('mobile/src/removed.ts')
        (self.root / 'mobile/src/removed.ts').unlink()
        self.assertTrue(self.changed(before, self.commit()))

    def test_nul_separation_preserves_spaces_and_newlines(self):
        after = self.commit_file('mobile/src/with space\nand-newline.ts')
        self.assertTrue(self.changed(self.before, after))

    def test_first_main_push_inspects_whole_tree(self):
        after = self.commit_file('mobile/App.tsx')
        self.assertTrue(self.changed(scope.ZERO_SHA, after))

    def test_first_main_push_with_only_docs_does_not_release(self):
        self.assertFalse(self.changed(scope.ZERO_SHA, self.before))

    def test_missing_invalid_or_unavailable_commit_fails_closed(self):
        for before in ['', 'main', 'short-sha', 'f' * 40]:
            with self.subTest(before=before), self.assertRaises((ValueError, subprocess.SubprocessError)):
                self.changed(before, self.before)

    def test_different_checkout_is_rejected(self):
        self.commit_file('mobile/App.tsx')
        with self.assertRaises(ValueError): self.changed(self.before, self.before)

    def test_different_repository_is_rejected(self):
        with self.assertRaises(ValueError):
            scope.native_changed(event='push', ref='refs/heads/main', repository='someone/else',
                                 before=self.before, sha=self.before, root=self.root)

    def test_identical_before_and_after_do_not_release(self):
        self.assertFalse(self.changed(self.before, self.before))


if __name__ == '__main__': unittest.main()
