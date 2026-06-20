---
id: TASK-019
type: Feature
status: Done
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
spec_hash: b16f6e288cf1236d
issue: 79
---

# TASK-019: Add Heartbeat / Lease Refresh

## Goal

Prevent long-running valid work from being swept by the Sweeper Protocol. The `taskforge heartbeat TASK-ID` command updates `claimed_at` to reset the 4-hour stale timer.

## Background

The Sweeper Protocol (TASK-014) automatically resets tasks with `claimed_at` older than 4 hours back to `Ready`. For tasks that legitimately take longer than 4 hours (complex features, multi-session work), agents need a way to extend the lease.

A heartbeat command lets agents signal "still working" without producing code changes. This is analogous to lease refresh in distributed locking systems (etcd, ZooKeeper).

## Scope

### New files:

- `src/commands/heartbeat.ts` — `cmdHeartbeat()` implementation
- `tests/heartbeat.test.ts` — tests

### Modified files:

- `src/cli.ts` — register `heartbeat` command
- `src/core/sweep.ts` — optionally add `lease_expires_at` field support for stricter checking

## Usage

```bash
taskforge heartbeat TASK-001          # Extend lease (requires session ownership)
taskforge heartbeat TASK-001 --force    # Extend lease even without ownership match
taskforge heartbeat TASK-001 --json     # Structured result
```

## Acceptance Criteria

- [x] `taskforge heartbeat TASK-ID` reads the task, updates `claimed_at` to current UTC
- [x] Requires session ownership match (branch session must match `assignee`) unless `--force`
- [x] Auto-commits and pushes the task-state change
- [x] `--json` support for machine-parseable output
- [x] Appends agent note with heartbeat event
- [x] Heartbeat can be called on `In Progress` tasks only (not Ready/Done/Blocked)
- [x] All existing tests pass

## Test / Verification Command

```bash
npm run typecheck && npm run lint && npm run build && npm test -- --run
```

## Dependencies

TASK-014 (Sweeper Protocol) — heartbeat is the counterpart to sweep. Must be merged first.
TASK-017 (JSON contracts) — `--json` output should follow the JSON contract.

## Risk Level

Low — simple mutation command that updates a timestamp.

## Continuation Policy

Auto-continue unless a stopping condition occurs.

## Agent Notes

### 2026-05-21 | Implementer

- Created `src/commands/heartbeat.ts` — `cmdHeartbeat()` updates `claimed_at` to current UTC time, extending the Sweeper lease.
- Enforces session ownership via `assertTaskOwnership()` unless `--force` is passed.
- Validates task status is `In Progress` — rejects heartbeat on Ready/Done/Blocked tasks.
- Supports `--json` output following the JSON contract.
- Appends agent note with heartbeat event including previous lease time.
- Registered `taskforge heartbeat <taskId>` command in `src/cli.ts` with `--force` and `--json` options.
- Created `tests/heartbeat.test.ts` with 7 tests: lease renewal, status validation, ownership enforcement, force override, JSON output, not-found error, agent note.
- Verification gates pass: typecheck (0 errors), lint (0 errors), build (clean), 300 tests pass (29 files).
- Note: The `src/core/sweep.ts` modification for `lease_expires_at` mentioned in scope is deferred — the heartbeat effectively extends the lease by updating `claimed_at`, which resets the 4h sweeper window without needing an additional field.
