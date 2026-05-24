---
id: TASK-149
type: Refactor
status: Ready
priority: P0
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
dependsOn:
  - TASK-147
---
# Add Dirty-Task Write Set to Transactions

## Goal

Reduce conflict surface and avoid rewriting unrelated task files.

## Acceptance Criteria

- [ ] `withTaskStateTransaction` writes only task files that were explicitly modified in the transaction dirty set.

## Agent Notes
