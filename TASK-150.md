---
id: TASK-150
type: Test
status: Ready
priority: P0
agentRole: QA
riskLevel: Medium
humanInterventionRequired: false
dependsOn:
  - TASK-146
---
# Add Transaction Tests for Conflict Retry

## Goal

Verify optimistic retry behavior.

## Acceptance Criteria

- [ ] Automated tests prove that a non-fast-forward task-state push causes the transaction to reload fresh state and rerun the mutation before retrying.

## Agent Notes
