---
id: TASK-311
type: Task
status: Done
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
assignee: 61e7aaf23d
claimed_at: '2026-06-20 09:55:00'
completed_at: '2026-06-20 10:05:00'
spec_hash: 48be7df9a777fe24
branch: agent/TASK-311-done-records-sha
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-311
---

# TASK-311: Slimming Refactor 05: Done records merge SHA as closeout
## Goal
Make done.ts the single closeout point by recording the PR merge SHA (or HEAD) as submitted_sha, replacing what submit used to do.

## Background
See specs/taskforge-slimming-refactor.md §Done as the Single Closeout. submit is being removed; Done must capture final SHA.

## Scope
- done.ts: after gates+AC pass, resolve final SHA via GitHubPullRequestVerifier (PR merge commit) or HEAD.- Write submitted_sha + submitted_at to task frontmatter.- Adjust completion-policy.ts: drop NO_SUBMITTED_SHA tension since Done records+verifies in one step.- Existing worktree/branch cleanup proceeds unchanged.

## Acceptance Criteria
- Done writes submitted_sha when PR exists (merge commit).- Done writes HEAD sha when no PR.- completion-policy no longer requires a separate submit step.- Gates+AC still enforced at Done.

## Test / Verification Command
npm test -- --run (done tests); npm run typecheck

## Expected Output / Behavior
Done captures final SHA; submit dependency removed.

## Dependencies
TF-SLIM-01

## Risks
Known risks.

## Continuation Policy
Auto-continue unless a stopping condition occurs.

## Agent Notes

## Result

Done. `done` is the single closeout point — it records the final SHA, replacing `submit`.

- `done.ts`: before completion-eligibility, resolve final SHA (PR-backed+merged → merge commit via `verifier.checkMerged`; else HEAD via `headSha`) and write `submitted_sha`/`submitted_at`. Re-loads the task fresh first so it doesn't clobber `--force` override metadata.
- `completion-policy.ts`: dropped obsolete AC 3 head==submitted mismatch (submitted is now the merge commit); kept presence check (NO_SUBMITTED_SHA). Gated AC 5 reachability on `task.pr` so no-PR HEAD closeouts aren't blocked.

Tests: done.test.ts (records submitted_sha/submitted_at); updated 2 obsolete SHA-mismatch tests to the new model. 881 tests pass; typecheck/lint/build clean.

## Links
- Issue:
- Project Item:
- PR:
- Branch:
- Worktree:
- CI:
- Test Log:
