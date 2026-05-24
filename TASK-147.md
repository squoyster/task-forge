---
id: TASK-147
type: Bug
status: Ready
priority: P0
agentRole: Implementer
riskLevel: High
humanInterventionRequired: false
dependsOn:
  - TASK-146
---
# Validate Invariants Before Transaction Commit

## Goal

Prevent invalid task-state commits.

## Acceptance Criteria

- [ ] `withTaskStateTransaction` runs task-state invariant validation after mutation and before commit, aborting the transaction on validation errors.

## Agent Notes
