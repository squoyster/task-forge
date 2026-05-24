---
id: TASK-148
type: Feature
status: Ready
priority: P0
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
dependsOn:
  - TASK-147
---
# Auto-Emit Audit Event for Every Task-State Transaction

## Goal

Make task-state mutation auditable by default.

## Acceptance Criteria

- [ ] Every successful `withTaskStateTransaction` appends at least one structured audit event describing the transaction name, changed task IDs, actor/session if known, and resulting commit SHA if available.

## Agent Notes
