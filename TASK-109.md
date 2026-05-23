---
id: TASK-109
type: Refactor
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
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
