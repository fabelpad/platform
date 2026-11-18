#!/usr/bin/env python3
"""Require the original successful main-push workflow on one exact commit."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time


class CheckError(Exception):
    pass


REQUIRED_JOBS = {
    "verify.yml": "verify",
    "fabelpad-android-ci.yml": "Native Android-controles",
}


def verify_required_job(payload, workflow, sha):
    matches = [job for job in payload.get("jobs", []) if job.get("name") == REQUIRED_JOBS[workflow]]
    if (len(matches) != 1 or matches[0].get("head_sha") != sha
            or matches[0].get("status") != "completed" or matches[0].get("conclusion") != "success"):
        raise CheckError("De verplichte CI-job ontbreekt of is niet voltooid en geslaagd; een overgeslagen job telt niet mee.")


def select_run(payload, sha):
    runs = [run for run in payload.get("workflow_runs", [])
            if run.get("head_sha") == sha and run.get("head_branch") == "main"
            and run.get("event") == "push"]
    if not runs:
        return None
    latest = max(runs, key=lambda run: (run["run_number"], run.get("run_attempt", 1)))
    if latest.get("status") != "completed":
        return None
    if latest.get("conclusion") != "success":
        raise CheckError("De vereiste main-pushcontrole is niet geslaagd; ontbrekend, overgeslagen en mislukt tellen niet mee.")
    return latest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sha", required=True)
    parser.add_argument("--workflow", required=True, choices=("verify.yml", "fabelpad-android-ci.yml"))
    parser.add_argument("--wait-seconds", type=int, default=0)
    parser.add_argument("--github-output", type=Path)
    args = parser.parse_args()
    try:
        if os.environ.get("GITHUB_REPOSITORY") != "fabelpad/platform":
            raise CheckError("Deze releasecontrole is uitsluitend voor fabelpad/platform.")
        if not re.fullmatch(r"[a-f0-9]{40}", args.sha) or not 0 <= args.wait_seconds <= 1500:
            raise CheckError("Een volledige commit-SHA en een begrensde wachttijd zijn vereist.")
        deadline = time.monotonic() + args.wait_seconds
        while True:
            command = ["gh", "api", "--method", "GET",
                       f"repos/fabelpad/platform/actions/workflows/{args.workflow}/runs",
                       "-f", "branch=main", "-f", "event=push", "-f", f"head_sha={args.sha}",
                       "-F", "per_page=100"]
            result = subprocess.run(command, check=False, capture_output=True, text=True, timeout=60)
            if result.returncode:
                raise CheckError("GitHub CI-status kon niet worden opgehaald; controleer Actions-leesrechten.")
            run = select_run(json.loads(result.stdout), args.sha)
            if run:
                job_command = ["gh", "api", "--method", "GET",
                               f"repos/fabelpad/platform/actions/runs/{run['id']}/jobs",
                               "-f", "filter=latest", "-F", "per_page=100"]
                jobs = subprocess.run(job_command, check=False, capture_output=True, text=True, timeout=60)
                if jobs.returncode:
                    raise CheckError("De verplichte jobs van de CI-run konden niet worden gecontroleerd.")
                verify_required_job(json.loads(jobs.stdout), args.workflow, args.sha)
                if args.github_output:
                    with args.github_output.open("a", encoding="utf-8") as output:
                        output.write(f"run_id={run['id']}\n")
                print(f"Bevestigd: {args.workflow}, main-pushrun {run['id']}, SHA {args.sha}.")
                return 0
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise CheckError("De vereiste succesvolle main-pushcontrole ontbreekt of loopt nog.")
            time.sleep(min(20, remaining))
    except (CheckError, OSError, ValueError, KeyError, TypeError, subprocess.TimeoutExpired) as error:
        print(f"CI-vrijgave geweigerd: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
