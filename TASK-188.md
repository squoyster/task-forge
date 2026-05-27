---
id: TASK-188
type: Task
status: Ready
priority: P0
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-188: Fix taskforge new to use transactional push with proper error handling

## Goal

taskforge new uses commitAndPushTaskState which silently swallows all errors. If push fails, the task is never committed to remote and the agent never knows. Additionally, new does not use withTaskStateTransaction so there are no CAS retry semantics for concurrent task creation. Fix: migrate new to use withTaskStateTransaction and propagate errors clearly.

## Acceptance Criteria

- [ ]

## Agent Notes
