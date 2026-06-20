---
id: TASK-017
type: Feature
status: Done
priority: P0
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
spec_hash: d9c1d138f49a2158
issue: 77
---

# TASK-017: Add Lifecycle JSON Contracts

## Goal

Every agent-facing command supports `--json` output with a consistent, parseable contract. JSON output must contain no log decorations, no colored text, and no mixed stderr/stdout except errors.

## Background

Currently, only `status`, `summary`, and `list` support `--json`. Agent-facing lifecycle commands (`next`, `start`, `done`, `block`, `unlock`, `sweep` and new commands like `claim`, `heartbeat`, `gates`, `inspect`) must all emit structured JSON when `--json` is passed.

Without this, agents must parse human-readable colored output, which is fragile and agent-implementation-specific.

## JSON Contract

Successful response:

```json
{
  "ok": true,
  "task": {
    "id": "TASK-014",
    "status": "in_progress",
    "statusLabel": "In Progress",
    "priority": "P1",
    "title": "Sweeper Protocol — Deadlock Recovery"
  },
  "workspace": {
    "branch": "agent/TASK-014-sweeper--abc123def0",
    "worktree": "../worktrees/TASK-014"
  },
  "next": {
    "command": "cd ../worktrees/TASK-014 && npm install"
  }
}
```

Error response (when `--json` is passed):

```json
{
  "ok": false,
  "error": "Task TASK-999 not found",
  "code": "TASK_NOT_FOUND"
}
```

## Scope

### Existing commands to add `--json`:

- `src/commands/next.ts` — add `JsonResult` output
- `src/commands/start.ts` — add workspace info to JSON output
- `src/commands/done.ts` — add task result to JSON output
- `src/commands/block.ts` — add blocked info to JSON output
- `src/commands/unlock.ts` — add unlock result to JSON output
- `src/commands/sweep.ts` — add sweep results to JSON output

### Shared utilities:

- `src/util/json-result.ts` — NEW: `JsonResult`, `jsonError()`, `jsonOk()` helpers
- `src/util/logging.ts` — ensure logging helpers respect `--json` mode (suppress colored output)

### Integration:

- `src/cli.ts` — pass `--json` option and mode to commands

## Acceptance Criteria

- [x] All lifecycle commands accept `--json` flag
- [x] Successful JSON output follows the `{ ok: true, task: {...} }` contract
- [x] Error JSON output follows the `{ ok: false, error: "...", code: "..." }` contract
- [x] JSON output contains no ANSI color codes, no log decorations
- [x] Errors are written to stdout (not stderr) when `--json` is active
- [x] Existing human-readable output is unchanged without `--json`
- [x] Tests verify stdout purity with `--json` flag
- [x] All existing tests pass

## Test / Verification Command

```bash
npm run typecheck && npm run lint && npm run build && npm test -- --run
```

## Dependencies

TASK-021 (harden status semantics) — JSON contract uses canonical status values via `statusToJson()`.

## Risk Level

Low — `--json` is additive; existing behavior is unchanged when flag is absent.

## Agent Notes

### 2026-05-21 Implementer

- Created `src/util/json-result.ts` with `JsonResult` types, `jsonOk()`, `jsonError()`, `buildJsonTask()`, `printJson()`, and `statusToJson()` helpers
- Added `--json` flag to lifecycle commands: `next`, `start`, `done`, `block`, `unlock`, `sweep`
- Updated `src/cli.ts` to wire `--json` option to all lifecycle commands
- JSON output follows the spec contract: `{ ok: true, task: { id, status, statusLabel, priority, title }, workspace: { branch, worktree }, next: { command } }`
- Error output follows: `{ ok: false, error: "...", code: "..." }`
- Existing human-readable output is unchanged without `--json`
- `statusToJson()` converts canonical status values to snake_case for JSON output (e.g., "In Progress" → "in_progress")
- All verification gates pass: typecheck, lint (0 errors), build, 286 tests

## Continuation Policy

Auto-continue unless a stopping condition occurs.
