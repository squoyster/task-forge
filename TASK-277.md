---
id: TASK-277
type: Bug
status: Verify
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
assignee: 1a3efa0c7b
claimed_at: '2026-06-10 13:26:21'
context_hash: 58d6f9d818aa1c4f
spec_hash: c50e6ded75977d0d
branch: agent/TASK-277-fix-transaction-invariant-validation-to--1a3efa0c7b
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-277
---

# TASK-277: Fix transaction invariant validation to only check affected tasks

## Goal

Transactions use withTaskStateTransaction which validates ALL tasks before committing ANY changes. A single task with an invariant violation (e.g., TASK-221: Done but still has assignee) blocks ALL operations across the entire project — even operations on completely unrelated tasks.

Fix: Scope invariant validation to only the tasks that were actually modified by the transaction, OR make the validation a warning that doesn't block the transaction for unrelated tasks, OR add a pre-flight check that lists blocking issues without aborting.

This is needed because taskforge update will also fail on a dirty state without this fix.

## Acceptance Criteria

- [ ]

## Agent Notes

### 2026-06-10T00:00:00Z System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-277

### 2026-06-10T00:00:00Z System
- Task claimed via taskforge start TASK-277
- Session: 1a3efa0c7b
- Branch: agent/TASK-277-fix-transaction-invariant-validation-to--1a3efa0c7b
