---
id: TASK-014
type: Feature
status: Done
priority: P1
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
---

# TASK-014: Sweeper Protocol — Deadlock Recovery for Stale Agent Locks

## Goal

Automatically recover from agent crashes/disconnects by detecting stale `in_progress` tasks and resetting them to `Ready`. Also rename `lockedBy`/`lockedAt` fields to `assignee`/`claimed_at` to standardize terminology across the system.

## Background

Currently, if an agent locks a task and then crashes, the lock must be manually cleared via `taskforge unlock --force`. In a multi-agent system this is impractical — a crashed agent won't come back to clean up. The Sweeper Protocol automates recovery:

- **Before** looking for new work, scan all tasks with status `in_progress`
- If `claimed_at` is older than 4 hours, reset to `Ready`, clear `assignee`
- Commit and push the state change

## Scope

### Part 1: Field rename (`lockedBy` → `assignee`, `lockedAt` → `claimed_at`)

Allowed files/directories:
- `src/core/task.ts` — schema field names
- `src/core/task-store.ts` — `updateTaskLock`, `clearTaskLock`, `parseTaskFile`, `writeTaskFile`
- `src/core/session.ts` — `assertTaskOwnership`
- `src/commands/start.ts` — lock check messages, field writes
- `src/commands/done.ts` — lock clearing references
- `src/commands/block.ts` — lock clearing references
- `src/commands/unlock.ts` — lock clearing references, user-facing messages
- All test files that reference `lockedBy`/`lockedAt`

### Part 2: Sweeper command

New files:
- `src/commands/sweep.ts` — `cmdSweep()` command
- `tests/sweep.test.ts` — tests

Modified files:
- `src/cli.ts` — register `sweep` command
- `src/core/git.ts` — possibly export helper for committing to task-state

## Acceptance Criteria

- [x] `lockedBy` → `assignee` (string, optional) in TaskSchema
- [x] `lockedAt` → `claimed_at` (string or Date, optional) in TaskSchema
- [x] All existing tests pass with renamed fields
- [x] `taskforge sweep` scans all tasks from the task-state worktree
- [x] `taskforge sweep` identifies tasks with status `in_progress` and `claimed_at` > 4 hours old
- [x] `taskforge sweep` resets those tasks to `status: Ready` and clears `assignee`/`claimed_at`
- [x] `taskforge sweep` commits + pushes state changes to task-state branch
- [x] `taskforge sweep` does not touch tasks with `claimed_at` < 4 hours old
- [ ] `taskforge sweep` does not touch tasks with `assignee` matching the current session (don't self-sweep)
- [x] `taskforge sweep` handles empty state gracefully (no tasks, or no stale tasks)
- [ ] Sweeper logic runs automatically at the start of `taskforge start` and `taskforge next`

## Test / Verification Command

```bash
npm run typecheck && npm run lint && npm run build && npm test -- --run
```

## Dependencies

TASK-013 (task-state branch) — must be merged first. Affects ALL files that reference `lockedBy`/`lockedAt`.

## Risk Level

Medium — field rename touches many files; sweep logic is straightforward but should not accidentally clear active locks.

## Continuation Policy

Auto-continue unless a stopping condition occurs.

## Agent Notes

### 2026-05-22 System
- Task started via taskforge start TASK-014
- Session: 2449205b30
- Branch: agent/TASK-014-sweeper-protocol-deadlock-recovery-for-s--2449205b30
- Worktree: /Volumes/Transcend/devel/worktrees/TASK-014
- Implementation completed:
  - Renamed lockedBy→assignee, lockedAt→claimed_at in: task.ts, task-store.ts, session.ts, start.ts, done.ts, block.ts, unlock.ts, unlock.test.ts
  - Created src/commands/sweep.ts with cmdSweep() — Sweeper Protocol
  - Registered `sweep` command in cli.ts
  - Created tests/sweep.test.ts with 7 tests
  - Key fix: parseClaimedAt must check YYYY-MM-DD HH:MM:SS regex BEFORE Date.parse (Date.parse treats that format as local time, not UTC)
  - claimed_at field schema accepts string | Date (js-yaml auto-parses timestamps to Date objects)
  - All 275 tests pass across 25 test files
