#!/usr/bin/env python3
"""Exercise the actual release UI on an isolated emulator with synthetic data.

Requires adb and an installed/booted Android emulator; never uses a mocked device.
The explicit --reset-test-data flag permits clearing ONLY this emulator's app.
Screenshots/XML/report are written even on failure. No Google/Play login is used.
"""
import argparse
import hashlib
import json
import re
import subprocess
import struct
import time
import xml.etree.ElementTree as ET
from pathlib import Path


class Smoke:
    def __init__(self, args):
        self.args = args
        self.output = Path(args.output)
        self.output.mkdir(parents=True, exist_ok=True)
        self.started = time.monotonic()
        self.screen_size = None
        self.prefix = [args.adb, '-P', str(args.adb_port), '-s', args.serial]
        self.report = {'passed': False, 'package': args.package, 'serial': args.serial,
                       'syntheticDataOnly': True, 'checks': [],
                       'manualNotTested': ['TalkBack navigation and spoken order', 'physical gestures',
                                           'physical devices', 'successful installed Dutch offline voice',
                                           'connected accounts and purchases']}

    def adb(self, *parts, timeout=35, binary=False, check=True):
        if time.monotonic() - self.started > self.args.max_seconds:
            raise RuntimeError('Bounded emulator smoke deadline exceeded')
        result = subprocess.run(self.prefix + list(parts), capture_output=True,
                                text=not binary, timeout=timeout)
        if check and result.returncode:
            raise RuntimeError(f'adb {parts[:3]} failed ({result.returncode}): {str(result.stderr)[:250]}')
        return result.stdout

    def tree(self, name=None):
        self.adb('shell', 'uiautomator', 'dump', '/sdcard/fabelpad-ux.xml')
        raw = self.adb('exec-out', 'cat', '/sdcard/fabelpad-ux.xml')
        (self.output / (name or 'latest-ui.xml')).write_text(raw)
        return ET.fromstring(raw)

    @staticmethod
    def labels(root):
        return [n.get('content-desc') or n.get('text') for n in root.iter('node')
                if n.get('content-desc') or n.get('text')]

    @staticmethod
    def find(root, label, contains=False):
        for node in root.iter('node'):
            values = [node.get('text', ''), node.get('content-desc', ''), node.get('resource-id', '')]
            if not any(label in value if contains else label == value for value in values):
                continue
            numbers = list(map(int, re.findall(r'-?\d+', node.get('bounds', ''))))
            if len(numbers) == 4 and numbers[2] > numbers[0] >= 0 and numbers[3] > numbers[1] >= 0:
                return node, numbers
        return None

    def wait(self, label, contains=False, seconds=25):
        deadline = time.monotonic() + seconds
        while time.monotonic() < deadline:
            root = self.tree()
            found = self.find(root, label, contains)
            if found:
                return found
            time.sleep(.6)
        raise AssertionError(f'Visible native UI label missing: {label}')

    def viewport(self):
        if self.screen_size:
            return self.screen_size
        size = self.adb('shell', 'wm', 'size')
        return tuple(map(int, re.findall(r'(\d+)x(\d+)', size)[-1]))

    def reach(self, label, contains=False, scroll=0):
        for attempt in range(scroll + 1):
            root = self.tree()
            found = self.find(root, label, contains)
            if found:
                node, (left, top, right, bottom) = found
                width, height = self.viewport()
                if right <= width and bottom <= height:
                    assert node.get('enabled', 'true') == 'true', f'Native control disabled: {label}'
                    return node, (left, top, right, bottom)
            if attempt < scroll:
                if not self.swipe_scroll_view(root):
                    break
        raise AssertionError(f'Native action not reachable: {label}')

    def tap(self, label, contains=False, scroll=0):
        _, (left, top, right, bottom) = self.reach(label, contains, scroll)
        self.adb('shell', 'input', 'tap', str((left + right) // 2), str((top + bottom) // 2))
        time.sleep(.45)

    def input(self, label, value):
        assert re.fullmatch(r'[A-Za-z0-9]+', value), 'Smoke input must be synthetic ASCII'
        self.tap(label)
        self.adb('shell', 'input', 'keyevent', 'KEYCODE_MOVE_END')
        self.adb('shell', 'input', 'keyevent', *(['KEYCODE_DEL'] * 24))
        self.adb('shell', 'input', 'text', value)

    def back(self):
        self.adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
        time.sleep(.5)

    def swipe_scroll_view(self, root, towards_top=False):
        # Use the real viewport: fixed tabs occupy much of a short landscape
        # screen, so a percentage of the whole display can hit the tabbar.
        views = [node for node in root.iter('node')
                 if node.get('class') == 'android.widget.ScrollView'
                 and node.get('scrollable') == 'true']
        if not views:
            return False  # A fully visible native panel does not need scrolling.
        left, top, right, bottom = map(int, re.findall(r'\d+', views[0].get('bounds', '')))
        x = (left + right) // 2
        low, high = int(top + (bottom-top)*.8), int(top + (bottom-top)*.2)
        start, end = (high, low) if towards_top else (low, high)
        self.adb('shell', 'input', 'swipe', str(x), str(start), str(x), str(end), '300')
        return True

    def top(self):
        root = self.tree()
        for _ in range(12):
            if not self.swipe_scroll_view(root, towards_top=True):
                break

    def capture(self, name):
        self.tree(f'{name}.xml')
        png = self.adb('exec-out', 'screencap', '-p', binary=True)
        self.screen_size = struct.unpack('>II', png[16:24])
        (self.output / f'{name}.png').write_bytes(png)

    def passed(self, name, **evidence):
        self.report['checks'].append({'name': name, 'passed': True, **evidence})
        (self.output / 'report.json').write_text(json.dumps(self.report, ensure_ascii=False, indent=2) + '\n')
        print(f'PASS {name}', flush=True)

    def launch(self, cold=True):
        flags = ['-S'] if cold else []
        self.adb('shell', 'am', 'start', '-W', *flags, '-n', f'{self.args.package}/.MainActivity', timeout=90)
        self.wait('Ontdek')

    def unlock(self):
        self.reach('Geboortejaar van de ouder', scroll=14)
        self.input('Geboortejaar van de ouder', '1985')
        self.back()  # IME closes before the screen can navigate.
        self.tap('Open het ouderhoekje', scroll=14)
        self.reach('Kindprofielen', scroll=14)

    def parent_after_configuration(self):
        # Android may recreate the Activity after font/rotation settings. Enter
        # through the existing tab and gate; do not assume React state survived.
        self.tap('Ouders')
        self.top()
        if self.find(self.tree(), 'Alleen voor ouders en verzorgers'):
            self.unlock()
        else:
            self.reach('Kindprofielen', scroll=14)

    def assert_targets(self, labels):
        density_text = self.adb('shell', 'wm', 'density')
        density = int(re.findall(r'(?:Physical|Override) density:\s*(\d+)', density_text)[-1]) / 160
        root = self.tree()
        measured = {}
        for label in labels:
            found = self.find(root, label)
            assert found, f'Missing target for bounds inspection: {label}'
            _, (left, top, right, bottom) = found
            measured[label] = {'widthDp': round((right-left)/density, 1),
                               'heightDp': round((bottom-top)/density, 1)}
            assert right-left >= 47.5*density and bottom-top >= 47.5*density, f'Target smaller than 48dp: {label}: {measured[label]}'
        self.passed('48dp bounds on native appbar and four tabs', targets=measured)

    def audio_fixture(self):
        self.tap('Fixturepakket voorbereiden', contains=True, scroll=14)
        self.wait('Fixturepakket voorbereiden · offline beschikbaar')
        self.tap('Fixturedownload pauzeren en hervatten', contains=True, scroll=14)
        self.wait('Fixturedownload pauzeren en hervatten · gecontroleerd')
        self.capture('audio-01-complete-resumed-download')
        self.passed('real Android fixture download pauses, preserves verified fragments and resumes to an atomic complete package', providerAudio=False)
        self.tap('Speel twee fixturefragmenten', contains=True, scroll=14)
        self.wait('Speel twee fixturefragmenten · playing · 1')
        self.tap('Pauzeer fixtureaudio', contains=True, scroll=14)
        self.wait('Pauzeer fixtureaudio · paused')
        time.sleep(1)
        self.wait('Pauzeer fixtureaudio · paused')
        self.tap('Hervat fixtureaudio', contains=True, scroll=14)
        self.wait('Hervat fixtureaudio · playing')
        self.wait('Speel twee fixturefragmenten · playing · 2', seconds=35)
        self.capture('audio-02-second-real-decoded-segment')
        self.passed('real WAV decoder starts two sequential fragments, pauses without restarting and resumes to the next fragment', format='PCM16 mono 24000 Hz', acousticQualityTested=False)
        self.tap('Luister fixturekeuze 1', contains=True, scroll=14)
        self.wait('Luister fixturekeuze 1 · playing')
        self.tap('Luister fixture-einde 2', contains=True, scroll=14)
        self.wait('Luister fixture-einde 2 · playing')
        self.tap('Stop fixtureaudio', scroll=14)
        self.capture('audio-03-choice-and-ending')
        self.passed('choice and ending audio replace the previous native playback chain')
        self.tap('Controleer beschadigd fixturepakket', contains=True, scroll=14)
        self.wait('Controleer beschadigd fixturepakket · gecontroleerd')
        self.tap('Controleer verlopen fixturepakket', contains=True, scroll=14)
        self.wait('Controleer verlopen fixturepakket · gecontroleerd')
        self.capture('audio-04-integrity-expiry-repair')
        self.passed('corrupted bytes lose complete status and are repaired; an expired package is refused without extending its lease')
        self.launch()
        self.tap('Ouders')
        self.unlock()
        self.reach('Fixturepakket voorbereiden · offline beschikbaar', scroll=14)
        self.tap('Speel twee fixturefragmenten', contains=True, scroll=14)
        self.wait('Speel twee fixturefragmenten · playing · 1')
        self.tap('Stop fixtureaudio', scroll=14)
        self.capture('audio-05-cold-start-offline-playback')
        self.passed('verified package plays after an actual cold restart with Wi-Fi and mobile data still disabled')
        self.top()

    def run(self):
        assert self.args.reset_test_data, 'Explicit --reset-test-data is required'
        assert self.adb('shell', 'getprop', 'ro.kernel.qemu').strip() == '1', 'Refusing destructive smoke on a physical device'
        # AOSP API24 requires root for svc wifi; Google APIs emulator images
        # support this. The emulator guard runs before requesting adb root.
        self.adb('root', check=False)
        self.adb('wait-for-device')
        self.report.update(api=self.adb('shell', 'getprop', 'ro.build.version.sdk').strip(),
                           abi=self.adb('shell', 'getprop', 'ro.product.cpu.abi').strip(),
                           apkSha256=hashlib.sha256(Path(self.args.apk).read_bytes()).hexdigest())
        self.adb('uninstall', self.args.package, timeout=45, check=False)
        self.adb('install', '-r', self.args.apk, timeout=120)
        self.adb('shell', 'pm', 'clear', self.args.package)
        self.adb('logcat', '-c')
        for key in ['window_animation_scale', 'transition_animation_scale', 'animator_duration_scale']:
            self.adb('shell', 'settings', 'put', 'global', key, '0')
        self.adb('shell', 'settings', 'put', 'system', 'font_scale', '1.0')
        # Keep the activity foregrounded during the real five-minute deadline;
        # screen sleep would exercise the background lock instead.
        self.adb('shell', 'settings', 'put', 'global', 'stay_on_while_plugged_in', '7')
        self.adb('shell', 'settings', 'put', 'system', 'screen_off_timeout', '1800000')
        self.adb('shell', 'settings', 'put', 'secure', 'show_ime_with_hard_keyboard', '1')
        self.adb('shell', 'settings', 'put', 'system', 'accelerometer_rotation', '0')
        self.adb('shell', 'settings', 'put', 'system', 'user_rotation', '0')
        self.adb('shell', 'svc', 'wifi', 'disable')
        self.adb('shell', 'svc', 'data', 'disable')
        self.adb('logcat', '-c')
        self.launch()
        self.wait('Waar gaan we', contains=True)
        self.capture('01-cold-offline')
        self.passed('cold start with Wi-Fi and mobile data disabled')
        for label, expected in [('Schatkist', 'Jouw schatkist.'), ('Wie speelt?', 'Wie gaat er mee?'),
                                ('Ontdek', 'Waar gaan we'), ('Ouders', 'Geboortejaar van de ouder')]:
            self.tap(label)
            self.wait(expected, contains=True)
        self.passed('four existing native tabs and parent gate')
        self.capture('02-parent-gate')
        self.unlock()
        self.capture('03-parent-overview')
        self.assert_targets(['Terug naar de verhalen', 'Oudermenu openen', 'Ontdek', 'Schatkist', 'Wie speelt?', 'Ouders'])
        self.tap('Oudermenu openen')
        self.wait('Ouders, huidige pagina')
        self.back()
        self.wait('Kindprofielen')
        assert not self.find(self.tree(), 'Ouders, huidige pagina'), 'Back must close only the menu'
        self.passed('native menu current selection and Android Back dismissal')
        self.tap('Kindprofiel van Avonturier bewerken')
        self.wait('Kindprofiel bewerken')
        self.tap('Geboortedatum toevoegen', scroll=3)
        self.wait('OK', seconds=10)
        self.capture('04-native-date-picker')
        self.back()
        self.wait('Dag · maand · jaar')
        self.tap('Geboortedatum toevoegen', scroll=3)
        self.tap('OK')
        self.wait('Dag · maand · jaar')
        # Rename using the actual native EditText. Both names are synthetic.
        self.top()
        self.tap('Voornaam of bijnaam')
        self.adb('shell', 'input', 'keyevent', 'KEYCODE_MOVE_END')
        self.adb('shell', 'input', 'keyevent', *(['KEYCODE_DEL'] * 24))
        self.adb('shell', 'input', 'text', 'UXKind')
        self.back()
        self.tap('Handmatig', scroll=4)
        self.tap('9+ jaar', scroll=2)
        self.back()
        self.wait('Wijzigingen niet bewaren?')
        self.back()
        self.reach('Opslaan', scroll=14)
        self.tap('Opslaan', scroll=14)
        self.wait('UXKind')
        self.capture('05-profile-saved')
        self.passed('native date dialog Back and confirmation, nickname and manual reading level saved')
        self.tap('Terug naar de verhalen')
        self.tap('Open Het Verdwaalde Station')
        self.wait('Deel 1 van 5')
        self.capture('06-offline-reader')
        self.back()
        self.launch()
        self.tap('Ouders')
        self.unlock()
        self.wait('UXKind')
        self.tap('Kindprofiel van UXKind bewerken')
        self.wait('Kindprofiel bewerken')
        manual, _ = self.reach('Handmatig', scroll=5)
        assert manual.get('checked') == 'true', 'Manual reading mode did not survive the cold restart'
        level, _ = self.reach('9+ jaar', scroll=3)
        assert level.get('checked') == 'true', 'The selected 9+ reading level did not survive the cold restart'
        self.capture('07-profile-after-restart')
        self.back()
        self.wait('Kindprofielen')
        self.passed('cold restart retains local profile and Back returns to parent overview')
        if self.args.narration_fixture:
            self.audio_fixture()
        self.adb('shell', 'input', 'keyevent', 'KEYCODE_HOME')
        self.launch(cold=False)
        self.tap('Ouders')
        self.wait('Geboortejaar van de ouder')
        self.passed('resume requires the same parent gate')
        self.unlock()
        self.adb('shell', 'settings', 'put', 'system', 'font_scale', '1.5')
        time.sleep(2)
        self.parent_after_configuration()
        self.capture('08-larger-system-text')
        self.tap('Oudermenu openen')
        self.wait('Ouders, huidige pagina')
        self.back()
        self.adb('shell', 'settings', 'put', 'system', 'user_rotation', '1')
        time.sleep(2)
        self.capture('09-landscape')
        self.parent_after_configuration()
        self.capture('09-landscape')
        self.adb('shell', 'settings', 'put', 'system', 'user_rotation', '0')
        self.adb('shell', 'settings', 'put', 'system', 'font_scale', '1.0')
        time.sleep(2)
        self.capture('09b-portrait-restored')
        self.parent_after_configuration()
        self.capture('09b-portrait-restored')
        self.passed('larger system text and landscape retain usable parent controls')
        self.tap('Ouderhoekje vergrendelen', scroll=14)
        self.unlock()
        print('Waiting for the real five-minute parent session boundary', flush=True)
        deadline = time.monotonic() + 302
        while time.monotonic() < deadline:
            time.sleep(min(15, deadline-time.monotonic()))
        self.wait('Geboortejaar van de ouder')
        self.capture('10-expired-parent-gate')
        self.passed('open parent screen relocks after the real five-minute session')
        self.unlock()
        self.tap('Alle gegevens op dit apparaat wissen', scroll=14)
        self.wait('Alle lokale gegevens wissen?')
        self.wait('android:id/button1')
        self.back()
        self.wait('Alle gegevens op dit apparaat wissen')
        self.tap('Wie speelt?')
        self.wait('UXKind')
        self.tap('Ouders')
        self.wait('Kindprofielen')
        self.passed('Back dismisses local wipe confirmation without deleting the profile')
        self.tap('Alle gegevens op dit apparaat wissen', scroll=14)
        self.wait('Alle lokale gegevens wissen?')
        self.tap('android:id/button1')
        self.wait('Waar gaan we', contains=True)
        self.tap('Wie speelt?')
        assert not any('UXKind' in label for label in self.labels(self.tree())), 'Confirmed device wipe retained the synthetic profile'
        self.capture('11-confirmed-local-wipe')
        self.passed('confirmed whole-device wipe removes the synthetic local profile')
        crashes = self.adb('logcat', '-b', 'crash', '-d')
        (self.output / 'crash-logcat.txt').write_text(crashes)
        assert not re.search(r'FATAL EXCEPTION|Fatal signal', crashes), 'Native crash buffer is not empty'
        self.report['passed'] = True

    def finish(self):
        self.report['elapsedSeconds'] = round(time.monotonic()-self.started, 1)
        try:
            self.capture('final')
            (self.output / 'logcat.txt').write_text(self.adb('logcat', '-d', '-t', '1200', check=False))
        except Exception:
            pass
        (self.output / 'report.json').write_text(json.dumps(self.report, ensure_ascii=False, indent=2) + '\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--adb', default='adb')
    parser.add_argument('--adb-port', type=int, default=5037)
    parser.add_argument('--serial', required=True)
    parser.add_argument('--apk', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--package', default='nl.fabelpad.app', choices=['nl.fabelpad.app'])
    parser.add_argument('--max-seconds', type=int, default=1050)
    parser.add_argument('--reset-test-data', action='store_true')
    parser.add_argument('--narration-fixture', action='store_true', help='Require CI-only real native WAV/package acceptance controls')
    args = parser.parse_args()
    smoke = Smoke(args)
    try:
        smoke.run()
    except Exception as error:
        smoke.report['error'] = str(error)
        raise
    finally:
        smoke.finish()


if __name__ == '__main__':
    main()
