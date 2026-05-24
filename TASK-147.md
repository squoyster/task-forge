---
id: TASK-147
type: Bug
status: In Progress
priority: P0
agentRole: Implementer
riskLevel: High
humanInterventionRequired: false
dependsOn:
  - TASK-146
assignee: 89dd73bf16
claimed_at: '2026-05-24 02:23:46'
context_hash: 3a03a0322eb9729c
---
# Validate Invariants Before Transaction Commit

## Goal

Prevent invalid task-state commits.

## Acceptance Criteria

- [ ] `withTaskStateTransaction` runs task-state invariant validation after mutation and before commit, aborting the transaction on validation errors.

## Agent Notes

### 2026-05-24 System
- Task claimed via taskforge start TASK-147
- Session: 89dd73bf16
- Branch: agent/TASK-147-task-147--89dd73bf16

### 2026-05-24 System
- Task claimed via taskforge start TASK-147
- Session: 89dd73bf16
- Branch: agent/TASK-147-task-147--89dd73bf16
