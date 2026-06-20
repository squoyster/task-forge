---
id: TASK-309
type: Task
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
spec_hash: 23f07735eb0a794c
---

# TASK-309: Slimming Refactor 03: Rewrite hooks.ts (pre-push enforcement)
## Goal
Rewrite src/core/hooks.ts to enforce gate-stamp and branch-ownership checks on pre-push, simplify pre-commit, and remove post-commit audit.

## Background
See specs/taskforge-slimming-refactor.md §Hook Contract. Pre-push is the enforcement boundary.

## Scope
- pre-push: protected-branch guard (keep); gate-stamp check (commit_sha==local_sha, all gates passed); branch-ownership check (parse session from agent/* branch, compare to task.assignee).- pre-commit: keep existing guards + block edits to gate-stamp.json.- post-commit: remove git.jsonl audit writing (git is the audit).- Hooks delegate to taskforge _hook (from TF-SLIM-02).- Bypass via TASKFORGE_INTERNAL/TASKFORGE_DOCTOR only.

## Acceptance Criteria
- pre-push blocks push when stamp missing/mismatched with clear guidance.- pre-push blocks push when branch session != task.assignee.- post-commit no longer writes audit.- Non-task branches blocked unless in push.allowedBranches.

## Test / Verification Command
npm test -- --run (hook tests with temp git repo); npm run typecheck; npm run build

## Expected Output / Behavior
Hooks enforce stamps and ownership; audit removed.

## Dependencies
TF-SLIM-02 (_hook internals + stamp)

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
