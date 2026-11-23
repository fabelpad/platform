import importlib.util
import json
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('read_config', Path(__file__).with_name('read_config.py'))
config = importlib.util.module_from_spec(spec)
spec.loader.exec_module(config)


class PlayConfigTests(unittest.TestCase):
    def setUp(self):
        self.value = {'schemaVersion': 1, 'signingEnabled': False, 'playEnabled': False,
                      'connectionCheckEnabled': True,
                      'versionCodeBase': 1000, 'internalTracks': [], 'productionTracks': [],
                      'rolloutFraction': 1}

    def test_disabled_configuration_never_signs_or_publishes(self):
        output = config.release_outputs(self.value)
        self.assertEqual(output['signing_enabled'], 'false')
        self.assertEqual(output['play_enabled'], 'false')
        self.assertEqual(output['internal_tracks'], '')
        self.assertEqual(output['production_tracks'], '')
        self.assertEqual(output['connection_check_enabled'], 'true')

    def test_readonly_connection_check_is_independent_from_release_gates(self):
        self.value['connectionCheckEnabled'] = False
        output = config.release_outputs(self.value)
        self.assertEqual(output['connection_check_enabled'], 'false')
        self.assertEqual(output['signing_enabled'], 'false')
        self.assertEqual(output['play_enabled'], 'false')

    def test_connection_check_requires_explicit_boolean(self):
        for invalid in (None, 0, 1, '', 'false', 'true', [], {}):
            with self.subTest(value=invalid), self.assertRaises(ValueError):
                config.release_outputs({**self.value, 'connectionCheckEnabled': invalid})

    def test_missing_connection_check_is_not_silently_enabled(self):
        del self.value['connectionCheckEnabled']
        with self.assertRaises(ValueError): config.release_outputs(self.value)

    def test_reviewed_repository_config_is_valid(self):
        reviewed = json.loads(Path(__file__).with_name('config.json').read_text())
        config.release_outputs(reviewed)

    def test_signing_only_does_not_enable_play(self):
        self.value['signingEnabled'] = True
        output = config.release_outputs(self.value)
        self.assertEqual(output['signing_enabled'], 'true')
        self.assertEqual(output['play_enabled'], 'false')

    def test_play_needs_signing_and_both_real_tracks(self):
        self.value['playEnabled'] = True
        with self.assertRaises(ValueError): config.release_outputs(self.value)
        self.value['signingEnabled'] = True
        with self.assertRaises(ValueError): config.release_outputs(self.value)
        self.value.update(internalTracks=['internal'], productionTracks=['production'])
        self.assertEqual(config.release_outputs(self.value)['play_enabled'], 'true')

    def test_boolean_strings_are_rejected(self):
        self.value['playEnabled'] = 'false'
        with self.assertRaises(ValueError): config.release_outputs(self.value)

    def test_unknown_or_duplicate_tracks_and_output_injection_are_rejected(self):
        for tracks in [['alpha'], ['internal', 'internal'], ['internal\nplay_enabled=true'], [1]]:
            with self.subTest(tracks=tracks):
                self.value['internalTracks'] = tracks
                with self.assertRaises(ValueError): config.release_outputs(self.value)

    def test_invalid_fractions_and_versions_are_rejected(self):
        for fraction in [0, -0.1, 1.1, float('nan'), True, '1']:
            with self.subTest(fraction=fraction):
                self.value['rolloutFraction'] = fraction
                with self.assertRaises(ValueError): config.release_outputs(self.value)
        self.value['rolloutFraction'] = 1
        for base in [0, 2_100_000_001, True, '1000']:
            with self.subTest(base=base):
                self.value['versionCodeBase'] = base
                with self.assertRaises(ValueError): config.release_outputs(self.value)

    def test_unknown_fields_are_rejected(self):
        self.value['PLAY_SERVICE_ACCOUNT_JSON'] = 'not-permitted'
        with self.assertRaises(ValueError): config.release_outputs(self.value)

    def test_reviewed_fraction_and_offset_are_exported_without_expanding_names(self):
        self.value.update(rolloutFraction=0.1, versionCodeBase=2000)
        output = config.release_outputs(self.value)
        self.assertEqual(output['rollout_fraction'], '0.1')
        self.assertEqual(output['version_code_base'], '2000')
        self.assertTrue(all('\n' not in value for value in output.values()))


if __name__ == '__main__': unittest.main()
