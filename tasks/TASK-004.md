---
id: TASK-004
type: Task
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-004: Add --json flag to summary command for programmatic output

## Goal

Add a `--json` flag to the `taskforge summary` command that outputs project summary information in JSON format for programmatic consumption.

## Background

TASK-003 adds `--json` to `status`. This task does the same for `summary`, which provides a richer view including recommended next action, blocked task reasons, and categorized task lists.

## Scope

Allowed files/directories:
- src/commands/summary.ts
- tests/

Disallowed files/directories:
- .git/**
- src/cli.ts (unless absolutely necessary)
- package.json

## Acceptance Criteria

- [ ] `taskforge summary --json` outputs valid JSON to stdout
- [ ] JSON output includes: total tasks, counts by status, next recommended action, task details per status group
- [ ] `taskforge summary` (without --json) continues to produce human-readable output
- [ ] All existing tests pass
- [ ] Unit tests cover the JSON output format

## Test / Verification Command

```bash
npm run build && npm test -- --run && taskforge summary --json | jq .
```

## Expected Output / Behavior

- JSON structure mirrors human output: summary stats, next action, per-status task lists with id/priority/title
- Human output is unchanged when flag is absent
- JSON output is pure JSON to stdout (no log decorations)

## Dependencies

TASK-003

## Risk Level

Low

## Continuation Policy

Auto-continue unless a stopping condition occurs.
