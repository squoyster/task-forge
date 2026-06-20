---
id: TASK-311
type: Task
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
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

## Links
- Issue:
- Project Item:
- PR:
- Branch:
- Worktree:
- CI:
- Test Log:
