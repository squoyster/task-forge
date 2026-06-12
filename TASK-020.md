---
id: TASK-020
type: Feature
status: Done
priority: P1
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
---

# TASK-020: Add Worktree Inspection

## Goal

Allow sweep, cleanup, and review operations to classify task state safely. `taskforge inspect TASK-ID` reports worktree, branch, and git status — enabling safe decision-making before destructive operations.

## Background

The Sweeper Protocol (TASK-014) currently resets any task with `claimed_at > 4h` to `Ready` without checking whether the agent's worktree has uncommitted changes or unique commits. This is dangerous — an agent that committed code but did not mark Done would have its work silently destroyed.

Worktree inspection is the essential pre-condition check for sweeper, cleanup, and review operations:

| State | Correct sweep behavior |
|---|---|
| Agent crashed before editing | Reset to Ready |
| Agent has dirty worktree | Do not reset blindly; mark `stale_dirty` |
| Agent committed but did not mark done | Move to Review |
| Branch missing | Reset to Ready |
| Worktree missing | Reset to Ready |
| Worktree clean, no unique commits | Reset to Ready |

## JSON Output Contract

```json
{
  "ok": true,
  "taskId": "TASK-014",
  "worktreeExists": true,
  "branchExists": true,
  "dirty": false,
  "aheadOfMain": 2,
  "behindMain": 0,
  "lastCommit": "abc123def0",
  "claimStale": false,
  "claimAgeHours": 1.5
}
```

## Scope

### New files:

- `src/commands/inspect.ts` — `cmdInspect()` implementation
- `tests/inspect.test.ts` — tests

### Modified files:

- `src/cli.ts` — register `inspect` command
- `src/commands/sweep.ts` — optionally use `inspect` to classify before sweeping (safer default)
- `src/commands/cleanup.ts` — future: use inspect for safe cleanup decisions

## Usage

```bash
taskforge inspect TASK-001              # Human-readable report
taskforge inspect TASK-001 --json        # Machine-parseable (for sweep/cleanup)
taskforge inspect --all                  # Inspect all active tasks
```

## Acceptance Criteria

- [x] Detects whether worktree exists at the expected path
- [x] Detects whether branch exists (local or remote)
- [x] Detects dirty (uncommitted) files in worktree
- [x] Reports commits ahead/behind the main branch
- [x] Reports the last commit hash on the branch
- [x] Reports whether claim is stale (`claimed_at > 4h`)
- [x] Reports claim age in hours
- [x] `--all` flag inspects all tasks with `In Progress` status
- [x] `--json` flag outputs structured result
- [x] Tests cover all detection scenarios (dirty, clean, missing, stale)
- [x] All existing tests pass

## Test / Verification Command

```bash
npm run typecheck && npm run lint && npm run build && npm test -- --run
```

## Dependencies

TASK-014 (Sweeper Protocol) — inspect is a prerequisite for safe sweeping. Should be merged after TASK-014.
TASK-017 (JSON contracts) — output should follow the JSON contract.

## Risk Level

Medium — inspects real git state and file system state; test coverage must be thorough.

## Continuation Policy

Auto-continue unless a stopping condition occurs.

## Agent Notes

### 2026-05-21 | Implementer

- Created `src/commands/inspect.ts` — `cmdInspect()` checks worktree existence, branch existence, dirty status (via `git status --porcelain`), ahead/behind main (via `git rev-list --count`), last commit hash (via `git rev-parse HEAD`), and claim staleness/age.
- Supports `--all` flag to inspect all tasks with `In Progress` status.
- Supports `--json` output following the JSON contract in the task spec.
- Fixed date parsing for `claimed_at`: normalizes space-separated timestamps (used in YAML frontmatter) to ISO 8601 before `Date` parsing, avoiding cross-engine parsing inconsistencies.
- Registered `taskforge inspect <taskId>` command in `src/cli.ts` with `--all` and `--json` options.
- Created `tests/inspect.test.ts` with 10 tests: missing worktree, existing clean worktree, dirty detection, ahead/behind counts, stale claim (5h), fresh claim (1h), JSON output, not-found error, --all flag, --all with no tasks.
- Note: Sweeper integration (using inspect to classify before sweeping) is deferred to a future task.
- Verification gates pass: typecheck (0 errors), lint (0 errors), build (clean), 310 tests pass (30 files).
