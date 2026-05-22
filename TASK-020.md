---
id: TASK-020
type: Feature
status: Ready
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

- [ ] Detects whether worktree exists at the expected path
- [ ] Detects whether branch exists (local or remote)
- [ ] Detects dirty (uncommitted) files in worktree
- [ ] Reports commits ahead/behind the main branch
- [ ] Reports the last commit hash on the branch
- [ ] Reports whether claim is stale (`claimed_at > 4h`)
- [ ] Reports claim age in hours
- [ ] `--all` flag inspects all tasks with `In Progress` status
- [ ] `--json` flag outputs structured result
- [ ] Tests cover all detection scenarios (dirty, clean, missing, stale)
- [ ] All existing tests pass

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