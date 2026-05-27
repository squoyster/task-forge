---
id: TASK-187
type: Task
status: Ready
priority: P0
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-187: Fix taskforge new to use transactional push and add uncommitted-worktree detection

## Goal

Two issues: 1) taskforge new uses commitAndPushTaskState which silently swallows push errors — if push fails, task exists locally but not on remote, causing agents to be unable to claim newly created tasks. Fix: use withTaskStateTransaction for durable CAS push. 2) When an agent has uncommitted changes in their worktree, taskforge should detect this and return explicit guidance: if current task is not blocked, tell agent to complete it first; if current task is blocked, tell agent to commit changes then accept next task that resolves the block, or continue with next available task. These states must be explicitly returned as output under non-happy path conditions.

## Acceptance Criteria

- [ ]

## Agent Notes
