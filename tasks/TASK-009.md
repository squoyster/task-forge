---
id: TASK-009
type: Task
status: Inbox
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
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

- [ ] `taskforge sync` syncs task status to GitHub Project board columns
- [ ] Project board is configured via `.taskforge/config.json` (projectNumber, statusField, column mapping)
- [ ] New tasks are added to the project board
- [ ] Status changes update the board column
- [ ] Sync is idempotent (re-running doesn't duplicate items)
- [ ] Error handling for missing board permissions or invalid project number
- [ ] Unit tests with mocked GitHub Project (v2) API calls

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
