#!/usr/bin/env python3
"""Validate reviewed public Play configuration; never authenticate or publish."""
import argparse
import json
import math
from pathlib import Path
import sys

FIELDS = {
    'schemaVersion', 'signingEnabled', 'playEnabled', 'connectionCheckEnabled', 'versionCodeBase',
    'internalTracks', 'productionTracks', 'rolloutFraction',
}


def release_outputs(value):
    if not isinstance(value, dict) or set(value) != FIELDS:
        raise ValueError('De Play-configuratie heeft niet de vastgelegde velden.')
    if type(value['schemaVersion']) is not int or value['schemaVersion'] != 1:
        raise ValueError('Onbekende Play-configuratieversie.')
    if any(type(value[name]) is not bool for name in ('signingEnabled', 'playEnabled', 'connectionCheckEnabled')):
        raise ValueError('Signing, Play-vrijgave en verbindingscontrole moeten expliciete booleans zijn.')
    if value['playEnabled'] and not value['signingEnabled']:
        raise ValueError('Play-upload vereist expliciete signingvrijgave.')
    base = value['versionCodeBase']
    if type(base) is not int or not 1 <= base <= 2_100_000_000:
        raise ValueError('Ongeldige versiecode-offset.')
    fraction = value['rolloutFraction']
    if type(fraction) not in (int, float) or not math.isfinite(fraction) or not 0 < fraction <= 1:
        raise ValueError('De uitrolfractie moet groter dan 0 en maximaal 1 zijn.')
    internal, production = value['internalTracks'], value['productionTracks']
    if (not isinstance(internal, list) or not isinstance(production, list)
            or any(type(track) is not str for track in internal + production)
            or len(internal) > 1 or len(production) > 1
            or any(track not in ('internal', 'qa') for track in internal)
            or any(track != 'production' for track in production)):
        raise ValueError('Gebruik afzonderlijke geverifieerde telefoon/tablettracks.')
    if value['playEnabled'] and (len(internal) != 1 or production != ['production']):
        raise ValueError('Vul en verifieer beide tracks voordat Play wordt vrijgegeven.')
    return {
        'signing_enabled': str(value['signingEnabled']).lower(),
        'play_enabled': str(value['playEnabled']).lower(),
        'connection_check_enabled': str(value['connectionCheckEnabled']).lower(),
        'version_code_base': str(base),
        'internal_tracks': ','.join(internal),
        'production_tracks': ','.join(production),
        'rollout_fraction': format(fraction, '.15g'),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', required=True, type=Path)
    parser.add_argument('--github-output', required=True, type=Path)
    args = parser.parse_args()
    try:
        outputs = release_outputs(json.loads(args.config.read_text(encoding='utf-8')))
        with args.github_output.open('a', encoding='utf-8') as target:
            for key, value in outputs.items():
                target.write(f'{key}={value}\n')
        print('Vastgelegde Play-configuratie gecontroleerd; geen Google- of publicatieactie uitgevoerd.')
        return 0
    except (OSError, ValueError, TypeError, OverflowError):
        print('Play-configuratie geweigerd. Controleer de vastgelegde publieke instellingen.', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
