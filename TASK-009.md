---
id: TASK-009
type: Task
status: Done
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
branch: agent/TASK-009-github-projects-sync
worktree: ../worktrees/TASK-009
---

# TASK-009: GitHub Projects board sync for status columns

## Goal

Extend `taskforge sync` to synchronize task status with GitHub Project (v2) board columns, enabling a visual project board that reflects task status.

## Background

`taskforge sync` currently handles GitHub Issues (labels and body). GitHub Projects (v2) provides a Kanban board view. Syncing status to project columns gives a visual board while keeping the task files as the source of truth.

## Scope

Allowed files/directories:
- src/commands/sync.ts
- src/integrations/github/ (new project service or extend existing)
- src/core/config.ts (project board configuration)
- tests/

Disallowed files/directories:
- .git/**
- package.json

## Acceptance Criteria

- [x] `taskforge sync` syncs task status to GitHub Project board columns
- [x] Project board is configured via `.taskforge/config.json` (projectNumber, statusField, column mapping)
- [x] New tasks are added to the project board
- [x] Status changes update the board column
- [x] Sync is idempotent (re-running doesn't duplicate items)
- [x] Error handling for missing board permissions or invalid project number
- [x] Unit tests with mocked GitHub Project (v2) API calls

## Test / Verification Command

```bash
npm run build && npm test -- --run && taskforge sync
```

## Expected Output / Behavior

- Existing `sync` behavior (issue labels/body) is unchanged
- Project board sync happens after issue sync
- Each task's project item status field is updated to match the task status→column mapping
- Config supports: `projectNumber` (required), status field name (default: "Status"), and option column overrides

## Dependencies

None

## Risk Level

Low

## Continuation Policy

Auto-continue unless a stopping condition occurs.

## Agent Notes

### 2026-05-21 Implementer
- Added `projects` config section to ConfigSchema (statusField, columnMapping)
- Created `src/integrations/github/projects.ts` — GitHub Projects v2 (GraphQL) API service module with:
  - `getProjectNodeId()`, `getIssueNodeId()`, `getStatusFieldInfo()`
  - `findProjectItemId()` for idempotent sync
  - `addProjectItem()`, `updateItemStatus()`
  - `syncTaskToProject()` high-level orchestrator
- Extended `cmdSync` in `src/commands/sync.ts` to call project board sync after issue sync
- Config mapping: `github.projectNumber` enables it, `github.projects.columnMapping` maps task statuses to column names
- Project sync only runs when `projectNumber` is configured — existing issue-only sync is unchanged
- Tests: 19 unit tests for projects module (mocked GraphQL), 4 new integration tests in sync.test.ts
- Verification: typecheck, lint, build, 254 tests pass (22 test files)
