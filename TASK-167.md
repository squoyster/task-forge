---
id: TASK-167
type: Bug
status: Done
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
context_hash: abc123def456
---
# Validate Ownership in Diff Command

## Goal

Make all task worktree commands enforce the same ownership discipline.

## Acceptance Criteria

- [x] `taskforge diff TASK-ID` validates task/worktree/session ownership before reading the task worktree diff. — `src/commands/git-facade.ts`: added `assertTaskOwnership(task, repoRoot)` call to `cmdDiff` before accessing worktree. All 495 tests pass.

## Agent Notes

### 2026-05-25 Implementer
- Added `assertTaskOwnership()` call to `cmdDiff` to enforce ownership discipline
- All 495 tests pass. Typecheck, lint, and build pass.

### 2026-05-25 System
- Task marked Done
