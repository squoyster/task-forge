---
id: TASK-005
type: Task
status: Done
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
spec_hash: ba3db048494d2218
branch: agent/TASK-005-cleanup-done-flag
worktree: ../worktrees/TASK-005
---

# TASK-005: Add --cleanup flag to done command for worktree/branch removal

## Goal

Add a `--cleanup` flag to `taskforge done` that removes the worktree and optionally deletes the task branch after marking a task complete.

## Background

Currently `taskforge done` only changes the task status. Worktrees and branches accumulate over time. A `--cleanup` flag (and `--delete-branch` for the branch) keeps the repository clean.

## Scope

Allowed files/directories:
- src/commands/done.ts
- src/core/git.ts (if helper needed)
- tests/

Disallowed files/directories:
- .git/**
- package.json

## Acceptance Criteria

- [x] `taskforge done TASK-005` marks done without cleanup (existing behavior preserved)
- [x] `taskforge done --cleanup TASK-005` removes the worktree after marking done
- [x] `taskforge done --cleanup --delete-branch TASK-005` also removes the remote branch
- [x] Cleanup is safe (no-op) if worktree doesn't exist
- [x] Error messages are clear if cleanup fails
- [x] Unit tests cover cleanup success, branch deletion, and missing worktree

## Test / Verification Command

```bash
npm run build && npm test -- --run && taskforge done --cleanup TASK-005
```

## Expected Output / Behavior

- Status change happens first, then cleanup
- If cleanup fails, status change is preserved (not rolled back)
- Worktree and branch paths are cleared from the task frontmatter
- User sees separate status messages for done + cleanup + branch deletion

## Dependencies

None

## Risk Level

Low

## Continuation Policy

Auto-continue unless a stopping condition occurs.

## Agent Notes

### 2026-05-22 Implementer
- Implemented --cleanup and --delete-branch flags for taskforge done command
- Modified src/core/git.ts: made removeWorktree safe (no-op if missing), added removeBranch function with optional remote deletion
- Modified src/commands/done.ts: added DoneOptions interface, cleanup logic with safe error handling that preserves status on cleanup failure
- Modified src/cli.ts: added --cleanup and --delete-branch options (--delete-branch implies --cleanup)
- Added tests/done.test.ts: 10 test cases covering all acceptance criteria
- Verification: typecheck, lint, build, all 132 tests pass (12 test files)
