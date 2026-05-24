---
id: TASK-146
type: Bug
status: Ready
priority: P0
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
---
# Capture Base HEAD in Task-State Transactions

## Goal

Make transaction conflict detection explicit.

## Acceptance Criteria

- [ ] `withTaskStateTransaction` records the task-state branch base HEAD before mutation and includes that base HEAD in transaction diagnostics or audit metadata.

## Agent Notes
