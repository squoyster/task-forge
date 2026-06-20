---
id: TASK-309
type: Task
status: Done
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
completed_at: '2026-06-20 08:00:00'
spec_hash: 23f07735eb0a794c
branch: agent/TASK-309-rewrite-hooks-prepush
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-309
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

Done. Pre-push is now the enforcement boundary; pre-push bash delegating to `taskforge _hook`; post-commit audit removed.

- `hook-logic.ts runPrePushLogic`: gate-stamp check (commit_sha == pushed sha, all gates passed) + branch-ownership check (branch session == task.assignee; blocks abandoned-session branches after re-claim). Non-task branches blocked unless in `push.allowedBranches`. Injectable options for tests.
- `hook.ts cmdHook`: loads config for expectedGates + allowedBranches.
- `config.ts`: added `push.allowedBranches` (string[], default []).
- `hooks.ts`: bash generators rewritten as thin delegators (`exec taskforge _hook`), fail-open if taskforge missing; post-commit removed; installGitHooks writes only pre-commit + pre-push; checkHooks requires both.

Tests: hooks.test.ts (delegation, no post-commit, 2-hook check); hook.test.ts pre-push coverage (stamp missing/mismatch, ownership mismatch/match/fail-open, non-task allowed/blocked). 822 tests pass; typecheck/lint/build clean.

## Links
- Issue:
- Project Item:
- PR:
- Branch:
- Worktree:
- CI:
- Test Log:
