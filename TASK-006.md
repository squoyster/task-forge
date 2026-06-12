---
id: TASK-006
type: Task
status: Done
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
branch: agent/TASK-006-dependency-tracking
worktree: ../worktrees/TASK-006
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

- [x] TaskSchema has optional `dependsOn: string[]` field
- [x] Tasks with unmet dependencies are excluded from `selectNextTask()`
- [x] `taskforge next` shows dependency info (what's blocking, what depends on this)
- [x] `status` shows dependency chains (blocked by, blocking)
- [x] Circular dependency detection logs a warning
- [x] Existing task files without dependsOn are parsed correctly (backward compatible)
- [x] Unit tests cover dependency filtering, circular detection, and backward compat

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

## Agent Notes

### 2026-05-21 Implementer
- Merged agent/TASK-006-dependency-tracking into main
- All verification gates passed (typecheck, lint, build, 141 tests)
- Added dependsOn: string[] optional field to TaskSchema in src/core/task.ts
- Updated src/core/task-store.ts: dependsOn frontmatter parsing and serialization
- Updated src/core/scheduler.ts: added hasUnmetDependencies(), getDependents(), detectCircularDependencies(), warnOnCircularDependencies(); updated selectNextTask() to filter out dependency-blocked tasks
- Updated src/commands/next.ts: shows Waiting on/Blocks dependency info for the selected task
- Updated src/commands/status.ts: added Dependency-Blocked section, dependency info in Active/Review/Verify entries, JSON output includes dependsOn/blockedBy/blockedDependents
- Updated tests/task.test.ts: 3 new tests for dependsOn field validation
- Updated tests/scheduler.test.ts: expanded from 8 to 23 tests covering dependency filtering, circular detection, dependents lookup
- Updated tests/task-store.test.ts: 1 new test for dependsOn write/read roundtrip
- Verification: typecheck, lint, build, all 141 tests pass (11 test files)
