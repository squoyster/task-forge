---
id: TASK-252
type: Bug
status: In Progress
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
assignee: 31be71bad1
claimed_at: '2026-06-08 05:59:48'
branch: agent/TASK-252-normal-agents-cannot-clean-up-done-task--31be71bad1
---

# TASK-252: Normal agents cannot clean up Done task worktrees without --force

## Goal

After a task is marked Done, the agent may wish to clean up the worktree and branch via `taskforge done TASK-ID --cleanup` or `taskforge cleanup TASK-ID`. However, both paths are blocked for normal agents:

1. `taskforge done TASK-ID --cleanup` fails because `done` cannot transition from "Done" to "Done" (the task is already Done)
2. `taskforge cleanup TASK-ID --force` fails because normal agents cannot use `--force` (requires human or doctor authority)

This creates a dead end where stale worktrees accumulate and agents must resort to direct `git worktree remove` and `git branch -D` commands, violating the "no direct git" policy.

## Acceptance Criteria

- [x] Normal agents can clean up a Done task's worktree and branch without `--force`
- [x] `taskforge done TASK-ID --cleanup` works when the task is already Done (or a separate cleanup path exists)
- [x] OR: `taskforge cleanup TASK-ID` (without `--force`) allows normal agents to clean up their own completed tasks
- [x] No security regression: normal agents cannot use cleanup to interfere with other agents' active tasks

## Agent Notes

### 2026-06-08 System
- Task claimed via taskforge claim TASK-252
- Session: 31be71bad1

### 2026-06-08 Implementer
- **done.ts**: Added early-exit path for already-Done tasks with `--cleanup`/`--delete-branch`. Skips gates, transition validation, AC checks — runs `performCleanup()` directly. Still asserts task ownership to prevent cross-agent interference. Clears claim after cleanup via `withTaskStateTransaction`.
- **cleanup-cmd.ts**: Allow `--apply` without `--force` for terminal-state tasks (Done, Rejected, Deferred). Introduced `canRemove = force || (isTerminal && apply)` for safety-check bypass. Dirty/ahead guards now check `canRemove` instead of `force` only. Force authority check remains for explicit `--force` (doctor/human only).
- **claim.ts**: Removed unused `updated` variable (lint fix).
- **git-facade.ts**: Removed unused imports (lint fix).
- **Gates**: typecheck ✓, lint ✓, build ✓, test ✓ (all 552 tests pass).
- **Security**: Ownership assertion still required for `done --cleanup` on already-Done tasks. Force authority check unchanged for explicit `--force`. Terminal-state apply only removes local worktree/branch — no task-state mutation.
