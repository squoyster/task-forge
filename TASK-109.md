---
id: TASK-109
type: Refactor
status: Done
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
context_hash: f3613895c8a77f2e
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-109
---

# TASK-109: Normalize config schema around task state, workspaces, and providers

## Goal

## Rationalization Roadmap: TASK-RAT-007

### Objective
Replace stale config concepts with explicit task-state, workspace, and provider configuration. Target shape includes project, taskState (backend/branch/path/remote/failurePolicy), workspaces (backend/root/branchPrefix), providers (board/agent), plugins.

### Implementation
1. Add new schema
2. Add migration from old keys (tasks.directory, tasks.template, github, opencode, dependencies)
3. Make path utilities config-aware
4. Add taskforge config-validate --explain
5. Add warnings for deprecated keys

### Acceptance Criteria
- Existing config still works with warnings
- New config is documented
- Worktree and task-state paths are no longer hardcoded
- Provider selection comes from providers section

## Acceptance Criteria

- [ ]

## Agent Notes

### 2026-05-23 System
- Task marked Done (forced)
- Completed despite gate failures — forced.

### 2026-05-23 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-109

### 2026-05-23 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-109

### 2026-05-23 System
- Task claimed via taskforge start TASK-109
- Session: dd58b51a56
- Branch: agent/TASK-109-normalize-config-schema-around-task-stat--dd58b51a56

### 2026-05-23 System
- Task claimed via taskforge start TASK-109
- Session: dd58b51a56
- Branch: agent/TASK-109-normalize-config-schema-around-task-stat--dd58b51a56
