---
id: TASK-274
type: Feature
status: Done
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
dependsOn:
  - TASK-221
spec_hash: 4041284c6497e702
---

# TASK-274: Implement `taskforge promote` command for status transitions

## Goal

Create a `taskforge promote <TASK-ID> [--to <status>]` CLI command that advances tasks through the status state machine, filling the gap between `In Progress` and `Done`. This allows `taskforge done` to work correctly (it requires tasks to be in Review or Verify) and gives both humans and agents explicit control over status progression.

## Context

The state machine in `src/core/status-transition.ts` defines 9 statuses with precise allowed transitions, but the CLI only has commands for a few (`start`, `block`, `release`, `reject`, `done`). The middle pipeline — `Implementation Complete → Submitted → Review → Merge Ready → Verify` — has no CLI coverage.

When a PR is merged, the task is effectively past Review/Verify, but `taskforge done` rejects the transition because the task is still in `In Progress`. A `promote` command fills this gap cleanly.

The transition table (`src/core/status-transition.ts`) already has all the rules. The new command just needs to expose them via CLI and update the task file's frontmatter.

## Design

### CLI Interface

```bash
taskforge promote TASK-221          # Advance one step forward along default path
taskforge promote TASK-221 --to     # Show allowed transitions from current status
taskforge promote TASK-221 --to review   # Advance to a specific allowed status
taskforge promote TASK-221 --to done     # Walk through chain to Done (PR merged)
taskforge promote TASK-221 --json   # JSON output
```

### Default Forward Path

When no `--to` is given, advance to the *next logical* status. The default path:

```
In Progress → Implementation Complete → Submitted → Review → Merge Ready → Verify → Done
```

The first allowed forward transition (skipping Blocked, Deferred, and rollbacks) is chosen.

### Validation

- Reuse `isValidTransition()` / `validateTransition()` from `status-transition.ts`
- If `--to` is specified, validate it against the transition table
- If invalid, show the error from `validateTransition()` and list allowed transitions

### JSON Output

```json
{
  "ok": true,
  "status": "promoted",
  "metadata": {
    "taskId": "TASK-221",
    "from": "In Progress",
    "to": "Implementation Complete",
    "nextAllowed": ["Submitted", "Review", "Blocked", "Deferred"]
  },
  "guidance": "Task TASK-221 promoted from 'In Progress' to 'Implementation Complete'."
}
```

### File to Create

- `src/commands/promote.ts` — the command handler
- Register it in `src/cli.ts` with `--to` option

## Affected Files

- `src/commands/promote.ts` (new)
- `src/cli.ts` — register the command
- `tests/promote.test.ts` (new)

## Acceptance Criteria

- [ ] `taskforge promote <TASK-ID>` advances one step forward along the default path
- [ ] `taskforge promote <TASK-ID> --to <status>` advances to a specific allowed status
- [ ] Invalid transitions are rejected with a clear error showing allowed options
- [ ] `--json` flag produces structured JSON output with `from`, `to`, `nextAllowed`
- [ ] Task file frontmatter `status` field is updated on promote
- [ ] Promoting to `Verify` allows `taskforge done` to succeed
- [ ] Promoting to `Done` skips the intermediate checks (for merged PRs)
- [ ] Tests cover default forward path, specific targets, invalid transitions, and edge cases


### 2026-06-09T03:39:00Z System
- Task claimed via manual setup
- Session: manual
- Branch: agent/TASK-274-implement-promote-command
