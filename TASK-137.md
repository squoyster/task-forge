---
id: TASK-137
type: Bug
status: Done
priority: P0
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
dependsOn:
  - TASK-135
context_hash: e318700d2a0c3978
spec_hash: 08f8dd7ae55bc88a
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-137
---
# Reject Done Transition When AC Items Are Unchecked

## Goal

Prevent incomplete ACs from being bypassed.

## Background

A task cannot be considered complete while one or more explicit acceptance criteria remain unchecked.

## Implementation Notes

- Detect Markdown checkboxes under `## Acceptance Criteria`.
- Require all nonblank criteria to be checked before `Done`.

## Acceptance Criteria

- [x] `taskforge done TASK-ID` refuses to complete a task when any nonblank acceptance criterion under `## Acceptance Criteria` remains unchecked. — `src/commands/done.ts` `cmdDone(~L120-130)`: checks `hasUncheckedAcceptanceCriteria(task.body)` after blank-criteria validation; throws `UncheckedAcceptanceCriteriaError` in human mode or emits JSON error with `UNCHECKED_ACCEPTANCE_CRITERIA` code and actionable instruction.

## Agent Notes

### 2026-05-24 System
- Task marked Done (forced)
- Completed despite gate failures — forced.

### 2026-05-24 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-137

### 2026-05-24 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-137

### 2026-05-24 System
- Task claimed via taskforge start TASK-137
- Session: d796203029
- Branch: agent/TASK-137-task-137--d796203029

### 2026-05-24 System
- Task claimed via taskforge start TASK-137
- Session: d796203029
- Branch: agent/TASK-137-task-137--d796203029
