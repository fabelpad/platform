"""Release gates must never accept PR, other-SHA, skipped or failed checks."""
import importlib.util
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location('verify_ci',Path(__file__).with_name('verify_ci.py'))
ci=importlib.util.module_from_spec(spec)
spec.loader.exec_module(ci)


def run(**kwargs):
    return {'head_sha':'a'*40,'head_branch':'main','event':'push','run_number':1,'id':1,
            'status':'completed','conclusion':'success',**kwargs}


class Gates(unittest.TestCase):
    def test_exact_successful_main_push_is_accepted(self):
        self.assertEqual(ci.select_run({'workflow_runs':[run()]},'a'*40)['id'],1)
    def test_other_commit_branch_event_and_missing_checks_do_not_count(self):
        for item in (run(head_sha='b'*40),run(head_branch='feature'),run(event='pull_request'),run(status='in_progress')):
            self.assertIsNone(ci.select_run({'workflow_runs':[item]},'a'*40))
        self.assertIsNone(ci.select_run({'workflow_runs':[]},'a'*40))
    def test_every_non_success_conclusion_is_rejected(self):
        for conclusion in ('failure','skipped','cancelled','timed_out','neutral',None):
            with self.subTest(conclusion=conclusion):
                with self.assertRaises(ci.CheckError):
                    ci.select_run({'workflow_runs':[run(conclusion=conclusion)]},'a'*40)
    def test_newer_failure_or_active_attempt_cannot_fall_back_to_old_success(self):
        with self.assertRaises(ci.CheckError):
            ci.select_run({'workflow_runs':[run(),run(run_number=2,conclusion='failure')]},'a'*40)
        self.assertIsNone(ci.select_run({'workflow_runs':[run(),run(run_attempt=2,status='queued')]},'a'*40))
    def test_successful_native_job_allows_optional_signing_skip(self):
        ci.verify_required_job({'jobs':[
            {'name':'Native Android-controles','head_sha':'a'*40,'status':'completed','conclusion':'success'},
            {'name':'AAB signeren en intern publiceren','head_sha':'a'*40,'status':'completed','conclusion':'skipped'},
        ]},'fabelpad-android-ci.yml','a'*40)
    def test_required_job_must_exist_once_on_exact_sha(self):
        good={'name':'verify','head_sha':'a'*40,'status':'completed','conclusion':'success'}
        ci.verify_required_job({'jobs':[good]},'verify.yml','a'*40)
        for jobs in ([],[good,good],[{**good,'name':'other'}],[{**good,'head_sha':'b'*40}]):
            with self.subTest(jobs=jobs):
                with self.assertRaises(ci.CheckError):ci.verify_required_job({'jobs':jobs},'verify.yml','a'*40)
    def test_required_job_skipped_pending_cancelled_failed_or_neutral_is_rejected(self):
        for status,conclusion in [('queued',None),('pending',None),('in_progress',None),
                                  ('completed','skipped'),('completed','cancelled'),('completed','failure'),
                                  ('completed','neutral'),('completed','timed_out')]:
            with self.subTest(status=status,conclusion=conclusion):
                with self.assertRaises(ci.CheckError):
                    ci.verify_required_job({'jobs':[{'name':'verify','head_sha':'a'*40,'status':status,'conclusion':conclusion}]},'verify.yml','a'*40)


if __name__=='__main__':unittest.main()
