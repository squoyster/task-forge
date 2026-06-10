---
id: TASK-022
type: Feature
status: Done
priority: P0
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
spec_hash: 527ef8902125f469
---

# TASK-022: Run Sweeper Automatically Before Task Selection and Claiming

## Goal

Fix the incomplete implementation of the Sweeper Protocol — the sweeper must run automatically inside both `taskforge next` and `taskforge start`, not just when manually invoked.

## What Was Missed

The TaskForge specification says:

> This protocol runs automatically inside `taskforge start` and `taskforge next`, and can also be invoked explicitly via `taskforge sweep`.

However, the current code does not satisfy that requirement.

### Current `cmdNext()` problem

`src/commands/next.ts` loads tasks and selects the next task directly without running the sweeper first. Stale `In Progress` tasks remain stale and may block work selection.

### Current `cmdStart()` problem

`src/commands/start.ts` loads the target task immediately without running the sweeper first. An agent may fail to start a task that should have been recovered first.

### Current `cmdSweep()` limitation

`src/commands/sweep.ts` contains the sweep logic directly inside the CLI command. This makes it awkward to reuse. The correct design is to extract the core sweep behavior into a reusable core module.

## Design

Extract reusable sweep logic into `src/core/sweeper.ts`. The CLI command becomes a thin wrapper. Both `next` and `start` call the core logic before their main operations.

Intended flow:

```
taskforge next
  → sweep stale claims
  → reload task state
  → select next actionable task

taskforge start TASK-123
  → sweep stale claims
  → reload TASK-123
  → validate status / ownership
  → claim / create worktree / push task-state

taskforge sweep
  → run same reusable sweep logic
  → print human-readable result
```

## Core Sweeper API

```typescript
export interface SweepOptions {
  now?: Date;
  staleThresholdMs?: number;
  skipAssignee?: string;
  commit?: boolean;
}

export interface SweptTask {
  id: string;
  previousAssignee: string;
  claimedAt: string | Date;
  ageMs: number;
  filePath: string;
}

export interface SweepResult {
  scanned: number;
  stale: SweptTask[];
  changed: number;
  pushed: boolean;
}

export async function sweepStaleTasks(
  repoRoot: string,
  options?: SweepOptions,
): Promise<SweepResult>
```

## Required Behavior

### Stale detection

A task is stale if: `status === "In Progress"` AND `assignee` exists AND `claimed_at` exists AND `claimed_at` is older than 4 hours.

### Recovery

For each stale task: set status to `Ready`, clear `assignee`/`claimed_at`, append agent note, commit and push state changes (with jittered push).

### Self-sweep

Support an optional `skipAssignee`/`currentSession` option in the core sweeper. If provided, tasks claimed by that session are skipped.

### Non-stale behavior

Do not touch: tasks not `In Progress`, tasks with no assignee, tasks with no claimed_at, tasks younger than 4 hours.

## Command Changes

### `taskforge next`

Before selecting the next task:
1. Run `sweepStaleTasks(...)` with `commit: true`
2. Reload tasks
3. Call `selectNextTask(tasks)`

### `taskforge start TASK-ID`

Before loading the task:
1. Run `sweepStaleTasks(...)` with `commit: true`
2. Load the task by ID
3. Proceed with existing validation, worktree, lock, status update, note, and `jitteredPush()` flow

### `taskforge sweep`

Refactor to call `sweepStaleTasks(...)` and render results.

## Acceptance Criteria

- [x] `taskforge sweep` still works manually
- [x] Sweeper logic lives in `src/core/sweeper.ts`, not only inside `cmdSweep()`
- [x] `taskforge next` automatically sweeps stale claims before selecting work
- [x] `taskforge start TASK-ID` automatically sweeps stale claims before loading/claiming
- [x] Task state is reloaded after sweeping before selection/claim decisions
- [x] Stale `In Progress` tasks older than 4 hours are reset to `Ready`
- [x] `assignee` and `claimed_at` are cleared on swept tasks
- [x] Swept tasks receive an agent/system note
- [x] Fresh claims are not touched
- [x] Non-`In Progress` tasks are not touched
- [x] Tests cover core sweeper behavior and auto-invocation from `next` and `start`
- [x] All verification gates pass

## Files Likely to Change

```
src/core/sweeper.ts          # new reusable sweep logic
src/commands/sweep.ts        # thin CLI wrapper
src/commands/next.ts         # run sweeper before selection
src/commands/start.ts        # run sweeper before load/claim
tests/sweep.test.ts          # update existing tests
tests/commands/next.test.ts  # add / adjust tests
```

## Non-Goals

- Do not change canonical status values
- Do not convert statuses to snake_case
- Do not redesign the task lifecycle
- Do not change lock field names
- Do not implement worktree dirty-state sweeper
- Do not add new dependencies
- Do not change GitHub sync or dependency steward behavior

## Test / Verification Command

```bash
npm run typecheck && npm run lint && npm run build && npm test -- --run
```

## Dependencies

TASK-014 (Sweeper Protocol) — must be merged first.
TASK-015 (Jittered retries) — jitteredPush is used for state propagation.

## Risk Level

Medium — refactors existing sweep logic into new module; changes `next` and `start` entry points.

## Agent Notes

### 2026-05-21 Implementer

- Implemented TASK-022: Run Sweeper Automatically Before Task Selection and Claiming
- Created `src/core/sweeper.ts` with reusable `sweepStaleTasks()` function
- Refactored `src/commands/sweep.ts` to use core sweeper (now thin wrapper)
- Updated `src/commands/next.ts` to run sweeper before task selection
- Updated `src/commands/start.ts` to run sweeper before task loading/claiming
- Added `tests/commands/start.test.ts` for sweeper auto-invocation in start
- Updated `tests/commands/next.test.ts` to verify sweeper auto-invocation
- All verification gates pass: typecheck, lint, build, 286 tests

## Continuation Policy

Auto-continue unless a stopping condition occurs.
