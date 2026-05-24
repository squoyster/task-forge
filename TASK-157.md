---
id: TASK-157
type: Bug
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---
# Fix Task-ID Resolution Regex in OpenCode Audit Plugin

## Goal

Ensure task ID detection actually works.

## Acceptance Criteria

- [ ] The generated OpenCode audit plugin correctly extracts `TASK-123` from branches like `agent/TASK-123-example` and worktree paths like `/worktrees/task-forge/TASK-123`.

## Agent Notes
