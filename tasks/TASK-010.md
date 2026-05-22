---
id: TASK-010
type: Task
status: Inbox
priority: P3
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-010: Add task search and filtering capabilities

## Goal

Implement a `taskforge list` command and/or `--filter` flag on `status` for searching and filtering tasks by status, priority, type, and text search.

## Background

As the task count grows, finding specific tasks becomes difficult. A search/filter capability lets users quickly find tasks matching criteria — useful for both humans and agents inspecting the board.

## Scope

Allowed files/directories:
- src/commands/ (new list.ts, or extend status.ts)
- src/cli.ts (add list command)
- tests/

Disallowed files/directories:
- .git/**
- package.json

## Acceptance Criteria

- [ ] `taskforge list` shows all tasks in a compact table format
- [ ] `taskforge list --status Ready` filters by status
- [ ] `taskforge list --priority P1` filters by priority
- [ ] `taskforge list --type Bug` filters by task type
- [ ] `taskforge list --search "keyword"` filters by text match in title/body
- [ ] `taskforge list --json` outputs filtered results as JSON
- [ ] Filters can be combined (AND logic)
- [ ] Unit tests cover each filter and combinations

## Test / Verification Command

```bash
npm run build && npm test -- --run
```

## Expected Output / Behavior

- Table output: ID, Status, Priority, Type, Title (truncated)
- JSON output: array of matching tasks with full details
- No filters = show all tasks
- Empty results show "No tasks matching criteria"
- Flag names follow CLI conventions (--status, --priority, --type, --search)

## Dependencies

None

## Risk Level

Low

## Continuation Policy

Auto-continue unless a stopping condition occurs.
