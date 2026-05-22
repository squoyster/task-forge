---
id: TASK-010
type: Task
status: Done
priority: P3
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
branch: agent/TASK-010-search-filter-list
worktree: ../worktrees/TASK-010
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

- [x] `taskforge list` shows all tasks in a compact table format
- [x] `taskforge list --status Ready` filters by status
- [x] `taskforge list --priority P1` filters by priority
- [x] `taskforge list --type Bug` filters by task type
- [x] `taskforge list --search "keyword"` filters by text match in title/body
- [x] `taskforge list --json` outputs filtered results as JSON
- [x] Filters can be combined (AND logic)
- [x] Unit tests cover each filter and combinations

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

## Agent Notes

### 2026-05-22 Implementer
- Created src/commands/list.ts: new `taskforge list` command with --status, --priority, --type, --search, --json filters
- Updated src/cli.ts: registered list command with all filter options
- Added tests/commands/list.test.ts: 17 test cases (8 filterTests + 9 cmdList) covering all filters, combinations, JSON output, edge cases
- filterTasks() supports AND-combined filters with case-insensitive text search
- Verification: typecheck, lint, build, all 138 tests pass (12 test files)
