"""A rerun must not attach an old or differently built AAB to its new receipt."""
import importlib.util
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location('verify_artifact',Path(__file__).with_name('verify_artifact.py'))
artifact=importlib.util.module_from_spec(spec)
spec.loader.exec_module(artifact)


class Receipt(unittest.TestCase):
    def setUp(self):
        self.expected={'sha':'a'*40,'package':'nl.fabelpad.app','name':'1.0.0','code':1001,'digest':'b'*64,'size':12345}
        self.report={'packageId':'nl.fabelpad.app','versionName':'1.0.0','versionCode':1001,
                     'sha256':'b'*64,'bytes':12345,'signed':True,'variant':'production',
                     'source':{'gitSha':'a'*40,'workingTreeDirty':False}}
    def test_exact_clean_signed_receipt_is_accepted(self):
        artifact.validate_report(self.report,**self.expected)
    def test_wrong_identity_bytes_or_unsigned_artifact_is_rejected(self):
        for key,value in [('packageId','nl.other.app'),('versionName','1.0.1'),('versionCode',1002),
                          ('sha256','c'*64),('bytes',987),('signed',False),('variant','demo')]:
            with self.subTest(key=key):
                with self.assertRaises(ValueError):artifact.validate_report({**self.report,key:value},**self.expected)
    def test_other_commit_and_dirty_working_tree_are_rejected(self):
        for source in ({'gitSha':'c'*40,'workingTreeDirty':False},{'gitSha':'a'*40,'workingTreeDirty':True}):
            with self.assertRaises(ValueError):artifact.validate_report({**self.report,'source':source},**self.expected)


if __name__=='__main__':unittest.main()
