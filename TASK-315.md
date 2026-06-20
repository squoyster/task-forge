---
id: TASK-315
type: Task
status: Ready
priority: P1
agentRole: QA
riskLevel: Low
humanInterventionRequired: false
---

# TASK-315: Slimming Refactor 09: Full gate pass + end-to-end walkthrough
## Goal
Verify the complete refactor: all gates pass, validate-state --strict passes, and an end-to-end task lifecycle works under the new hook-enforced model.

## Background
See specs/taskforge-slimming-refactor.md §Execution Task Breakdown (final task).

## Scope
- npm run typecheck (zero errors); npm run build (clean, no warnings); npm run lint (zero errors); npm test -- --run (all pass).- taskforge validate-state --strict --json passes.- End-to-end: taskforge start TASK -> git work/commit -> taskforge gates (clean tree, stamps) -> git push (pre-push enforces stamp+ownership) -> gh pr create -> taskforge done (records merge SHA, cleanup).- Confirm an abandoned-then-reclaimed task flows correctly.

## Acceptance Criteria
- All 4 gates green.- validate-state --strict passes.- E2E lifecycle completes without facade commands.- Push blocked correctly when stamp missing/stale.- Abandonment+reclaim path works.

## Test / Verification Command
taskforge gates --json; taskforge validate-state --strict --json

## Expected Output / Behavior
Clean build, valid state, working E2E under new model.

## Dependencies
TF-SLIM-01 through TF-SLIM-08 all complete

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
