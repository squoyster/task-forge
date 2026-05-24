---
id: TASK-151
type: Test
status: Ready
priority: P0
agentRole: QA
riskLevel: Medium
humanInterventionRequired: false
dependsOn:
  - TASK-147
---
# Add Transaction Tests for Invariant Abort

## Goal

Verify invalid mutations cannot commit.

## Acceptance Criteria

- [ ] Automated tests prove that a transaction producing invalid task-state fails before commit and leaves task-state unchanged.

## Agent Notes
