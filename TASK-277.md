---
id: TASK-277
type: Bug
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-277: Fix transaction invariant validation to only check affected tasks

## Goal

Transactions use withTaskStateTransaction which validates ALL tasks before committing ANY changes. A single task with an invariant violation (e.g., TASK-221: Done but still has assignee) blocks ALL operations across the entire project — even operations on completely unrelated tasks.

Fix: Scope invariant validation to only the tasks that were actually modified by the transaction, OR make the validation a warning that doesn't block the transaction for unrelated tasks, OR add a pre-flight check that lists blocking issues without aborting.

This is needed because taskforge update will also fail on a dirty state without this fix.

## Acceptance Criteria

- [ ]

## Agent Notes
