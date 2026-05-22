---
id: TASK-019
type: Feature
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
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

- [ ] `taskforge heartbeat TASK-ID` reads the task, updates `claimed_at` to current UTC
- [ ] Requires session ownership match (branch session must match `assignee`) unless `--force`
- [ ] Auto-commits and pushes the task-state change
- [ ] `--json` support for machine-parseable output
- [ ] Appends agent note with heartbeat event
- [ ] Heartbeat can be called on `In Progress` tasks only (not Ready/Done/Blocked)
- [ ] All existing tests pass

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
