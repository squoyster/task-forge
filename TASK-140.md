---
id: TASK-140
type: Bug
status: In Progress
priority: P0
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
dependsOn:
  - TASK-139
assignee: 10e694986c
claimed_at: '2026-05-24 01:38:45'
context_hash: 9ee8ade673fccaae
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-140
---
# Add Validate-State Rule for Invalid Done Tasks

## Goal

Make invalid completion fail validation, not just doctor diagnostics.

## Background

`validate-state` should be the stricter state integrity gate used by agents and CI.

## Acceptance Criteria

- [ ] `taskforge validate-state` exits nonzero when any `Done` task has missing, blank, or unchecked acceptance criteria.

## Agent Notes

### 2026-05-24 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-140

### 2026-05-24 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-140

### 2026-05-24 System
- Task claimed via taskforge start TASK-140
- Session: 10e694986c
- Branch: agent/TASK-140-task-140--10e694986c

### 2026-05-24 System
- Task claimed via taskforge start TASK-140
- Session: 10e694986c
- Branch: agent/TASK-140-task-140--10e694986c
