---
id: TASK-036
type: Bug
status: Done
priority: P1
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
spec_hash: 8880dcedfee8946c
---

# TASK-036: Fix Ownership Assertion in `done` and `block` — Respect `--force`

## Goal

Fix `done.ts` and `block.ts` so that `assertTaskOwnership()` is skipped when `--force` is passed, allowing these commands to work from the `main` branch or any non-agent branch.

## Background

When running `taskforge done TASK-023 --force` from the main worktree (on the `main` branch), the command fails with:

```
Cannot determine session ID from branch "main". Expected format: agent/TASK-NNN-<session-id>
```

This happens because `assertTaskOwnership()` is called unconditionally when `task.assignee` is set, regardless of `--force`. The `--force` flag currently only bypasses gate checks and status transition validation, but not ownership.

The same issue exists in `block.ts`.

## Fix

```typescript
// Before:
if (task.assignee) {
  await assertTaskOwnership(task, repoRoot);
}

// After:
if (task.assignee && !force) {
  await assertTaskOwnership(task, repoRoot);
}
```

## Acceptance Criteria

- [ ] `taskforge done TASK-ID --force` works from any branch (including `main`)
- [ ] `taskforge block TASK-ID "reason" --force` works from any branch
- [ ] Without `--force`, ownership assertion still fires (existing behavior preserved)
- [ ] All existing tests pass

## Dependencies

None.

## Risk Level

Medium — changes a security guard, but `--force` already implies "I know what I'm doing."

## Continuation Policy

Auto-continue.

## Agent Notes

### 2026-05-22 System
- Task marked Done (forced)

### 2026-05-22 System
- Task started via taskforge start TASK-036
- Session: 532cdaa306
- Branch: agent/TASK-036-fix-ownership-assertion-in-done-and-bloc--532cdaa306
- Worktree: /Volumes/Transcend/devel/worktrees/TASK-036

### 2026-05-22 System
- Task started via taskforge start TASK-036
- Session: cc24a878b1
- Branch: agent/TASK-036-fix-ownership-assertion-in-done-and-bloc--cc24a878b1
- Worktree: /Volumes/Transcend/devel/worktrees/TASK-036
