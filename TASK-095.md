---
id: TASK-095
type: Bug
status: Done
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
context_hash: 8c607774d14d0be5
spec_hash: e01a6b0476281a24
---

# TASK-095: Add cautionary qualifier to unlock --force message

## Goal

## Background

Three commands handle the same situation (task already claimed by another session) with inconsistent messaging quality:

```
claim.ts:87-89  → "Use --force to override (only if you are sure the claim is stale)."
start.ts:93-96  → "Use --force to override (only if you are sure the claim is stale)."
unlock.ts:48-50 → "Use --force to unlock."
```

The unlock message lacks the cautionary qualifier. Since unlock is MORE dangerous (it forcibly clears a lock without the sweeper's safety checks), it should have MORE context, not less.

## Fix

Add the same cautionary qualifier to unlock.ts, matching the pattern in claim.ts and start.ts. Additionally, since unlock is a more destructive operation, consider adding stronger wording about when it is appropriate (only for known-stale locks, not active sessions).

## Scope

- `src/commands/unlock.ts` (~line 48-50)
- `tests/unlock.test.ts` — verify updated message

## Acceptance Criteria

- [ ] unlock --force message includes cautionary qualifier like claim.ts/start.ts
- [ ] Message explains when --force is appropriate (stale claims only)"

## Acceptance Criteria

- [ ]

## Agent Notes

### 2026-05-23 System
- Task marked Done (forced)
- Completed despite gate failures — forced.
- Failed to remove worktree: Command failed with exit code 128: git worktree remove /Volumes/Transcend/devel/worktrees/task-forge/TASK-095

fatal: '/Volumes/Transcend/devel/worktrees/task-forge/TASK-095' contains modified or untracked files, use --force to delete it
- Worktree and branch fields cleared from task frontmatter.

### 2026-05-23 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-095

### 2026-05-23 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-095

### 2026-05-23 System
- Task claimed via taskforge start TASK-095
- Session: a8f6e69dbe
- Branch: agent/TASK-095-add-cautionary-qualifier-to-unlock-force--a8f6e69dbe

### 2026-05-23 System
- Task claimed via taskforge start TASK-095
- Session: a8f6e69dbe
- Branch: agent/TASK-095-add-cautionary-qualifier-to-unlock-force--a8f6e69dbe

### 2026-05-23 02:34 System
- Discovered during TASK-086 (project runtime configuration) — pre-existing test failures and CLI message audit findings.
