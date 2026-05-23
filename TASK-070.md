---
id: TASK-070
type: Feature
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-070: Add TaskForge git facade commands

## Goal

Add taskforge diff/checkpoint/submit/pr TASK-ID to replace direct git for normal agents. diff: read-only diff in worktree. checkpoint: commit with trailers (Task/TaskForge-Managed). submit: push only task branch, refuse force/main/task-state. pr: create/update PR via GitHub sync. Validate task/worktree/session ownership. Emit audit events.

## Acceptance Criteria

- [ ]

## Agent Notes
