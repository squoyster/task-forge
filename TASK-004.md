---
id: TASK-004
type: Task
status: Done
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
spec_hash: c2dfa06c7e134fdb
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

## Agent Notes

### 2026-05-21 System
- Task started

### 2026-05-21 System
- Added `--json` flag to `taskforge summary` command
- JSON output includes: generated timestamp, total, byStatus counts, nextAction, and per-task id/title/priority/role/status
- Human-readable output unchanged when flag not provided
- 7 new tests cover JSON format, empty state, next action logic, and decoration-free output
- All verification gates pass: typecheck, lint, build, 122 tests

## Result

Task completed successfully. `taskforge summary --json` outputs valid JSON with `generated`, `total`, `byStatus`, `nextAction`, and `tasks` keys. Existing human-readable output is unchanged.

## Links
- Issue:
- Project Item:
- PR:
- Branch:
- Worktree:
- CI:
- Test Log:
