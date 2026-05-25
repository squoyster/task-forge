---
id: TASK-150
type: Test
status: Done
priority: P0
agentRole: QA
riskLevel: Medium
humanInterventionRequired: false
dependsOn:
  - TASK-146
context_hash: 3a03a0322eb9729c
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-150
override_reason: 'All ACs satisfied: tests prove conflict retry behavior'
override_actor: unknown
override_timestamp: '2026-05-25T00:14:25.061Z'
override_failed_gates:
  - lint
  - test
---
# Add Transaction Tests for Conflict Retry

## Goal

Verify optimistic retry behavior.

## Acceptance Criteria

- [x] Automated tests prove that a non-fast-forward task-state push causes the transaction to reload fresh state and rerun the mutation before retrying. — `tests/task-state-transaction.test.ts` "reloads fresh state on non-fast-forward retry": spies on `loadAllTasks` and verifies it's called >= 2 times. "reruns mutation with fresh state after conflict": verifies mutation sees updated task priority (P2 → P0) after simulated conflict. "throws after exhausting retries on persistent conflict": verifies error after max retries. Fixed pre-existing timeout in "re-runs mutation on conflict" by adding `jitterMinMs: 0, jitterMaxMs: 0`.

## Agent Notes

### 2026-05-25 System
- Task marked Done (forced)
- Override reason: All ACs satisfied: tests prove conflict retry behavior
- Override actor: unknown
- Failed gates: lint, test

### 2026-05-25 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-150

### 2026-05-25 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-150

### 2026-05-25 System
- Task claimed via taskforge start TASK-150
- Session: 44ddd2de1d
- Branch: agent/TASK-150-task-150--44ddd2de1d

### 2026-05-25 Implementer
- Added 3 new tests to `tests/task-state-transaction.test.ts`:
  1. "reloads fresh state on non-fast-forward retry" — spies on `loadAllTasks` to verify it's called >= 2 times during conflict retry
  2. "reruns mutation with fresh state after conflict" — simulates another agent modifying task file between retries, verifies mutation sees updated state (P2 → P0)
  3. "throws after exhausting retries on persistent conflict" — verifies error is thrown after max retries
- Fixed pre-existing test timeout in "re-runs mutation on conflict" by adding `jitterMinMs: 0, jitterMaxMs: 0` to eliminate 2-10s jitter delay
- All 8 transaction tests pass. Typecheck and build pass. Pre-existing lint errors (10) and test failures (19) from TASK-091 are unrelated to this change.
