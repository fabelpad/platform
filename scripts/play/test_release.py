"""Offline regression coverage for the real Google Play release planner."""
import argparse
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from contextlib import redirect_stdout
from unittest.mock import Mock
import warnings
import zipfile

spec=importlib.util.spec_from_file_location('play_release',Path(__file__).with_name('release.py'))
play=importlib.util.module_from_spec(spec)
spec.loader.exec_module(play)
def release(code,status='completed',**extra):
    return {'name':f'Fabelpad {code}','versionCodes':[str(code)],'status':status,**extra}

class Plans(unittest.TestCase):
    def test_internal_retry_does_not_replace_or_duplicate_a_release(self):
        self.assertEqual(play.plan_internal({'internal':[release(11)]},11,'Fabelpad'),{})
        self.assertEqual(play.plan_internal({'internal':[release(10)]},11,'Fabelpad')['internal']['versionCodes'],['11'])
    def test_internal_rejects_downgrade_and_incomplete_other_release(self):
        for tracks in ({'internal':[release(12)]},{'internal':[release(11,'draft')]}):
            with self.assertRaises(play.ReleaseError):play.plan_internal(tracks,11,'Fabelpad')
    def test_internal_upload_carries_notes_to_the_tested_bundle(self):
        notes=[{'language':'nl-NL','text':'Verhalen en eigen keuzes.'}]
        plan=play.plan_internal({'internal':[]},11,'Fabelpad 1.0.0',notes)
        self.assertEqual(plan['internal']['releaseNotes'],notes)
    def test_production_first_release_must_be_done_in_console(self):
        with self.assertRaises(play.ReleaseError):play.plan_production({'production':[]},11,'start',1,{'production':release(11)})
    def test_promotion_reuses_the_tested_code_and_release_notes(self):
        source=release(11,releaseNotes=[{'language':'nl-NL','text':'Fabelpad'}])
        plan=play.plan_production({'production':[release(10)]},11,'start',.1,{'production':source})
        self.assertEqual(plan['production'],{**source,'status':'inProgress','userFraction':.1})
    def test_retry_of_same_rollout_and_completed_release_is_idempotent(self):
        self.assertEqual(play.plan_production({'production':[release(10),release(11,'inProgress',userFraction=.1)]},11,'start',.1,{}),{})
        self.assertEqual(play.plan_production({'production':[release(11)]},11,'start',1,{}),{})
    def test_later_rollout_cannot_be_overwritten(self):
        for records in ([release(12)],[release(10),release(12,'inProgress',userFraction=.1)]):
            with self.assertRaises(play.ReleaseError):play.plan_production({'production':records},11,'start',1,{'production':release(11)})
    def test_complete_and_halt_require_the_exact_active_rollout(self):
        for action,target in [('complete','completed'),('halt','halted')]:
            plan=play.plan_production({'production':[release(10),release(11,'inProgress',userFraction=.1)]},11,action,1,{})
            self.assertEqual(plan['production']['status'],target)
            self.assertNotIn('userFraction',plan['production'])
            with self.assertRaises(play.ReleaseError):play.plan_production({'production':[release(10)]},11,action,1,{})
    def test_targeting_and_multiple_version_codes_are_not_silently_lost(self):
        for record in (release(11,countryTargeting={'countries':['NL']}),{**release(11),'versionCodes':['10','11']}):
            with self.assertRaises(play.ReleaseError):play.check_simple_track('production',[record])
    def test_play_bundle_digest_and_code_must_match_the_ci_receipt(self):
        good={'versionCode':11,'sha256':'a'*64}
        play.verify_bundle(good,11,'a'*64)
        for bundle,version,digest in [(good,12,'a'*64),(good,11,'b'*64),(None,11,'a'*64)]:
            with self.assertRaises(play.ReleaseError):play.verify_bundle(bundle,version,digest)
    def test_numeric_bounds_and_track_values_are_validated(self):
        for value in ['nan','inf','0','-1','1.1']:
            with self.assertRaises(argparse.ArgumentTypeError):play.valid_fraction(value)
        for value in ['0','2100000001','text']:
            with self.assertRaises(argparse.ArgumentTypeError):play.positive_version(value)
        for value in ['internal,internal','internal,','../production']:
            with self.assertRaises(argparse.ArgumentTypeError):play.track_ids(value)
    def test_provider_details_never_expose_token_values(self):
        failure=play.PlayHttpError(403,{'error':{'message':'secret-token-value','details':[{'reason':'secret-token-value'}]}})
        self.assertNotIn('secret-token-value',str(failure))

class FakePublisher:
    def __init__(self,failure=None):self.requests=[];self.failure=failure
    def request(self,method,path,**kwargs):
        self.requests.append((method,path))
        if ':commit?'in path and self.failure:raise self.failure
        return {}

class Commits(unittest.TestCase):
    def test_validate_only_never_submits_a_release(self):
        publisher=FakePublisher();edit=play.Edit(publisher,'/edit/123')
        edit.commit(validate_only=True)
        self.assertTrue(edit.should_discard)
        self.assertEqual(publisher.requests,[('POST','/edit/123:validate')])
    def test_lost_commit_reply_remains_uncertain_and_is_not_discarded(self):
        for error in [play.PlayTransportError('lost'),play.PlayHttpError(500,{})]:
            publisher=FakePublisher(error);edit=play.Edit(publisher,'/edit/123')
            with self.assertRaisesRegex(play.ReleaseError,'onzeker'):edit.commit(validate_only=False)
            self.assertFalse(edit.should_discard)
    def test_successful_commit_uses_review_conflict_guard(self):
        publisher=FakePublisher();edit=play.Edit(publisher,'/edit/123');edit.commit(validate_only=False)
        self.assertFalse(edit.should_discard)
        self.assertIn('changesInReviewBehavior=ERROR_IF_IN_REVIEW',publisher.requests[-1][1])

class ReleaseNotes(unittest.TestCase):
    def check_notes(self,value):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'notes.json'
            path.write_text(json.dumps(value,ensure_ascii=False),encoding='utf-8')
            return play.load_release_notes(path)
    def test_unicode_limit_and_two_distinct_locales(self):
        notes=[{'language':'nl-NL','text':'🌳'*500},{'language':'en-US','text':'Stories.'}]
        self.assertEqual(self.check_notes(notes),notes)
    def test_empty_duplicate_and_invalid_notes_fail_before_upload(self):
        for notes in ([],{},[{'language':'nl-NL','text':'x'*501}],[{'language':'nl-NL','text':''}],
                      [{'language':'nl-NL','text':'x'},{'language':'nl-NL','text':'y'}],
                      [{'language':'nl NL','text':'x'}],[{'language':'nl-NL','text':'x','extra':'bad'}]):
            with self.subTest(notes=notes):
                with self.assertRaises(play.ReleaseError):self.check_notes(notes)

class EmbeddedMapping(unittest.TestCase):
    """Exercise the upload entrypoint with stale build and R8 artifacts, offline."""

    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        root = Path(self.directory.name)
        self.mapping_bytes = b'# compiler: R8\nexample.Reader -> a:\n    void open() -> b\n'
        self.args = argparse.Namespace(
            command='upload-internal', package='nl.fabelpad.app', version_code=11,
            bundle=root/'fabelpad-production.aab', mapping=root/'fabelpad-production-mapping.txt',
            build_report=root/'fabelpad-production.json', release_name='Fabelpad 1.0.2 (11)',
            release_notes=root/'notes.json', tracks=['internal'], validate_only=False,
        )
        self.args.mapping.write_bytes(self.mapping_bytes)
        self.args.release_notes.write_text(json.dumps([{'language':'nl-NL','text':'Nieuwe verhalen.'}]))
        self.report = {
            'packageId':self.args.package, 'versionCode':11, 'variant':'production',
            'signed':True, 'source':{'workingTreeDirty':False},
            'r8Mapping':{'sha256':hashlib.sha256(self.mapping_bytes).hexdigest()},
        }
        self.write_bundle([self.mapping_bytes])

    def write_bundle(self, maps):
        with warnings.catch_warnings():
            warnings.simplefilter('ignore',UserWarning)
            with zipfile.ZipFile(self.args.bundle,'w') as bundle:
                for mapping in maps:
                    bundle.writestr(play.R8_MAPPING_ENTRY,mapping)
        self.write_report()

    def write_report(self):
        self.report.update(sha256=hashlib.sha256(self.args.bundle.read_bytes()).hexdigest(),
                           bytes=self.args.bundle.stat().st_size)
        self.args.build_report.write_text(json.dumps(self.report),encoding='utf-8')

    def fake_edit(self, *, existing=False):
        edit = Mock()
        edit.list_tracks.return_value = {'internal':{'releases':[release(11)] if existing else []}}
        bundle = {'versionCode':11,'sha256':self.report['sha256']}
        edit.get_bundle.return_value = bundle if existing else None
        edit.upload_bundle.return_value = bundle
        return edit

    def test_exact_embedded_map_and_build_report_are_accepted(self):
        play.validate_args(self.args)
        self.assertEqual(play.verify_upload_mapping(self.args),self.report['sha256'])
        # A separately named copy is acceptable: byte identity, not its basename, binds the map.
        renamed = self.args.mapping.with_name('mapping-copy.txt')
        renamed.write_bytes(self.mapping_bytes)
        self.args.mapping = renamed
        self.assertEqual(play.verify_upload_mapping(self.args),self.report['sha256'])

    def test_external_copy_is_optional_but_embedded_map_is_always_required(self):
        self.args.mapping = None
        self.assertEqual(play.verify_upload_mapping(self.args),self.report['sha256'])
        self.write_bundle([])
        with self.assertRaises(play.ReleaseError):play.verify_upload_mapping(self.args)

    def test_wrong_external_map_stops_before_any_upload_or_track_access(self):
        self.args.mapping.write_bytes(b'R8 map from a different build')
        edit = self.fake_edit()
        with self.assertRaises(play.ReleaseError):play.execute(self.args,edit)
        self.assertEqual(edit.mock_calls,[])

    def test_missing_empty_duplicate_and_wrong_embedded_maps_are_rejected(self):
        for maps in ([],[b''],[self.mapping_bytes,self.mapping_bytes],[b'wrong build']):
            with self.subTest(maps=maps):
                self.write_bundle(maps)
                with self.assertRaises(play.ReleaseError):play.verify_upload_mapping(self.args)

    def test_missing_or_malformed_mapping_receipt_is_rejected(self):
        for value in (None,{},'not an object',{'sha256':'not a hash'},{'sha256':True},
                      {'sha256':'0'*64}):
            with self.subTest(value=value):
                self.report['r8Mapping'] = value
                self.write_report()
                with self.assertRaises(play.ReleaseError):play.verify_upload_mapping(self.args)

    def test_stale_bundle_version_package_and_unsafe_build_receipts_are_rejected(self):
        for key,value in (('packageId','nl.other.app'),('versionCode',10),('sha256','0'*64),
                          ('bytes',1),('signed',False),('variant','debug'),
                          ('source',{'workingTreeDirty':True})):
            with self.subTest(key=key,value=value):
                changed = {**self.report,key:value}
                self.args.build_report.write_text(json.dumps(changed),encoding='utf-8')
                with self.assertRaises(play.ReleaseError):play.verify_upload_mapping(self.args)

    def test_unreadable_missing_and_non_zip_artifacts_fail_closed(self):
        self.args.build_report.write_text('{broken',encoding='utf-8')
        with self.assertRaises(play.ReleaseError):play.verify_upload_mapping(self.args)
        self.write_report()
        self.args.mapping.unlink()
        with self.assertRaises(play.ReleaseError):play.verify_upload_mapping(self.args)
        self.args.mapping.write_bytes(self.mapping_bytes)
        self.args.bundle.write_bytes(b'not an AAB')
        self.write_report()
        with self.assertRaises(play.ReleaseError):play.verify_upload_mapping(self.args)

    def test_missing_explicit_mapping_is_rejected_by_argument_validation(self):
        self.args.mapping.unlink()
        with self.assertRaises(play.ReleaseError):play.validate_args(self.args)

    def test_fresh_upload_sends_only_the_exact_bundle_containing_the_mapping(self):
        edit = self.fake_edit()
        with redirect_stdout(io.StringIO()):play.execute(self.args,edit)
        edit.upload_bundle.assert_called_once_with(self.args.bundle)
        edit.update_track.assert_called_once()
        edit.commit.assert_called_once_with(validate_only=False)
        # No second deobfuscation upload: Google imports the verified map from the AAB.
        self.assertEqual([call[0] for call in edit.mock_calls],
                         ['list_tracks','get_bundle','upload_bundle','update_track','commit'])

    def test_retry_checks_same_mapping_and_bundle_without_duplicate_uploads(self):
        edit = self.fake_edit(existing=True)
        with redirect_stdout(io.StringIO()):play.execute(self.args,edit)
        edit.upload_bundle.assert_not_called()
        edit.update_track.assert_not_called()
        edit.commit.assert_not_called()
        self.args.mapping.write_bytes(b'wrong retry map')
        with self.assertRaises(play.ReleaseError):play.execute(self.args,edit)

    def test_validate_only_preserves_upload_validation_without_committing(self):
        self.args.validate_only = True
        edit = self.fake_edit()
        with redirect_stdout(io.StringIO()):play.execute(self.args,edit)
        edit.commit.assert_called_once_with(validate_only=True)


if __name__=='__main__':unittest.main()
