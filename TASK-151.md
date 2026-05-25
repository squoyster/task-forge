---
id: TASK-151
type: Test
status: Done
priority: P0
agentRole: QA
riskLevel: Medium
humanInterventionRequired: false
dependsOn:
  - TASK-147
context_hash: a35e7bbd0e71ac8b
override_reason: >-
  Pre-existing gate failures and task-state invariant violations from other
  tasks
override_actor: unknown
override_timestamp: '2026-05-25T00:18:47.122Z'
override_failed_gates:
  - lint
  - test
---
# Add Transaction Tests for Invariant Abort

## Goal

Verify invalid mutations cannot commit.

## Acceptance Criteria

- [x] Automated tests prove that a transaction producing invalid task-state fails before commit and leaves task-state unchanged. — `tests/task-state-transaction.test.ts` "aborts transaction on DONE_WITH_ASSIGNEE violation": throws before commit when mutation produces Done with assignee. "aborts transaction on READY_WITH_ASSIGNEE violation": throws when mutation produces Ready with assignee. "leaves task-state unchanged after invariant abort": verifies file content is identical after abort. "allows valid mutation to proceed": proves valid mutations still work. Also implemented missing invariant validation in `src/core/task-state-transaction.ts` `withTaskStateTransaction()`: calls `validateTaskState()` after mutation, before commit; throws with violation codes if invalid.

## Agent Notes

### 2026-05-25 System
- Task marked Done (forced)
- Override reason: Pre-existing gate failures and task-state invariant violations from other tasks
- Override actor: unknown
- Failed gates: lint, test
- Worktree removed: /Volumes/Transcend/devel/worktrees/task-forge/TASK-151
- Worktree and branch fields cleared from task frontmatter.

### 2026-05-25 System
- Task marked Done (forced)
- Override reason: All ACs satisfied: invariant validation implemented and tested
- Override actor: unknown
- Failed gates: lint, test

### 2026-05-25 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-151

### 2026-05-25 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-151

### 2026-05-25 System
- Task claimed via taskforge start TASK-151
- Session: b05e0c9bf8
- Branch: agent/TASK-151-task-151--b05e0c9bf8

### 2026-05-25 Implementer
- Implemented missing invariant validation in `src/core/task-state-transaction.ts` `withTaskStateTransaction()`: calls `validateTaskState()` after mutation, before commit; throws with violation codes if invalid (was supposed to be done in TASK-147 but was force-done without implementation)
- Added 4 new tests to `tests/task-state-transaction.test.ts`:
  1. "aborts transaction on DONE_WITH_ASSIGNEE violation" — proves Done+assignee fails before commit
  2. "aborts transaction on READY_WITH_ASSIGNEE violation" — proves Ready+assignee fails before commit
  3. "leaves task-state unchanged after invariant abort" — proves file content is identical after abort
  4. "allows valid mutation to proceed" — proves valid mutations still work
- All 12 transaction tests pass. Typecheck and build pass. Pre-existing lint errors (10) and test failures (19) from TASK-091 are unrelated to this change.
