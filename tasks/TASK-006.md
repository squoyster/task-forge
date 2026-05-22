---
id: TASK-006
type: Task
status: Inbox
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-006: Add task dependency tracking to schema and scheduler

## Goal

Add a `dependsOn` field to the task schema so tasks can declare dependencies on other tasks. Update the scheduler to skip tasks with unmet dependencies and surface dependency info in `next` and `status`.

## Background

Tasks often depend on other tasks (e.g., TASK-004 depends on TASK-003). Currently this is documented only in the markdown body. Formalizing it in the schema allows the scheduler to automatically avoid starting tasks with unmet dependencies and lets `status` show dependency chains.

## Scope

Allowed files/directories:
- src/core/task.ts (add dependsOn to TaskSchema)
- src/core/scheduler.ts (filter out tasks with unmet dependencies)
- src/commands/next.ts (show dependency info)
- src/commands/status.ts (show dependency info)
- src/core/task-store.ts (handle dependsOn serialization)
- tests/

Disallowed files/directories:
- .git/**
- package.json

## Acceptance Criteria

- [ ] TaskSchema has optional `dependsOn: string[]` field
- [ ] Tasks with unmet dependencies are excluded from `selectNextTask()`
- [ ] `taskforge next` shows dependency info (what's blocking, what depends on this)
- [ ] `status` shows dependency chains (blocked by, blocking)
- [ ] Circular dependency detection logs a warning
- [ ] Existing task files without dependsOn are parsed correctly (backward compatible)
- [ ] Unit tests cover dependency filtering, circular detection, and backward compat

## Test / Verification Command

```bash
npm run build && npm test -- --run
```

## Expected Output / Behavior

- `dependsOn` is optional, default undefined
- Format: `dependsOn: ["TASK-003", "TASK-004"]` in frontmatter
- Scheduler treats tasks with unresolved dependencies the same as Blocked
- `next` command shows "Waiting on: TASK-003, TASK-004" when relevant
- Circular dependency detection runs on task load, warns but doesn't crash

## Dependencies

None

## Risk Level

Low

## Continuation Policy

Auto-continue unless a stopping condition occurs.
