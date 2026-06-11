---
id: TASK-034
type: Feature
status: Done
priority: P1
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
---

# TASK-034: Proactive Git Pull Before Reading Task-State

## Goal

Prevent stale reads of task-state by pulling the shared `task-state` worktree before any command reads task files. This eliminates the race window where two agents read stale state and only discover the conflict after a push rejection.

## Background

Currently, no command pulls the task-state worktree before reading. The only pull happens **reactively** inside `jitteredPush` when a push is rejected as non-fast-forward. This means:

1. `taskforge next` may recommend a task already claimed by another agent
2. `taskforge start` may create a worktree from stale main, then abort during push (wasting time and leaving orphan worktrees)
3. `taskforge sweep` may miss tasks that were just claimed or reset
4. `taskforge claim` may attempt to claim an already-claimed task

The fix: pull task-state proactively before any read, so commands see the latest shared state.

## Scope

### New/modified files:

- `src/core/git.ts` — add `pullTaskState()` helper that does `git pull --rebase origin task-state` in the task-state worktree (idempotent, no-op if not a git repo or remote unreachable)
- `src/commands/next.ts` — call `pullTaskState()` before `loadAllTasks()` and `sweepStaleTasks()`
- `src/commands/start.ts` — call `pullTaskState()` before `sweepStaleTasks()` and `loadTaskById()`
- `src/commands/claim.ts` — call `pullTaskState()` before `sweepStaleTasks()` and `loadTaskById()`
- `src/commands/sweep.ts` (or `src/core/sweeper.ts`) — call `pullTaskState()` before scanning

### Optionally updated:

- Other commands that read task-state: `done`, `block`, `unlock`, `inspect`, `heartbeat` (lower priority — these operate on a specific task ID that the agent already owns)

## Acceptance Criteria

- [x] `pullTaskState()` pulls `origin/task-state` into the task-state worktree via `git pull --rebase`
- [x] Gracefully handles: no remote, no git repo, network errors (logs warning, proceeds)
- [x] `taskforge next` pulls before scanning tasks
- [x] `taskforge start` pulls before claiming and creating worktree
- [x] `taskforge claim` pulls before claiming
- [x] `taskforge sweep` pulls before scanning
- [x] Adds no measurable latency on fast networks (pull is fast when up-to-date)
- [x] All existing tests pass (mock `pullTaskState` as needed)
- [x] Tests cover: pull-before-read ordering, graceful failure on no remote

## Test / Verification Command

```bash
npm run typecheck && npm run lint && npm run build && npm test -- --run
```

## Dependencies

None — uses existing git infrastructure.

## Risk Level

Medium — changes the read path of every core command. Must be graceful (never blocks operations on network failure).

## Continuation Policy

Auto-continue unless a stopping condition occurs.

## Agent Notes

### 2026-05-22 System
- Task started via taskforge start TASK-034
- Session: 2710298d6d
- Branch: agent/TASK-034-proactive-git-pull-before-reading-task-s--2710298d6d
- Worktree: /Volumes/Transcend/devel/worktrees/TASK-034

### 2026-05-22 Implementer
- Verified all acceptance criteria are met — `pullTaskState()` is implemented and called in next/start/claim/sweep
- Fixed lint error: removed unused `logSub` import from `src/commands/doctor.ts`
- Fixed test mocks: `jitteredPush` in `claim.test.ts` changed from `vi.fn()` (returns undefined/falsy) to `vi.fn().mockResolvedValue(true)` so JSON output test passes
- Fixed duplicate `pullTaskState` mock keys in `done.test.ts` and `cleanup.test.ts`
- All 337 tests pass across 34 test files
- All 4 verification gates pass: typecheck, lint, build, test
- CHANGELOG.md updated with TASK-034 entry
- Task marked Done
