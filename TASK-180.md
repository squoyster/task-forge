---
id: TASK-180
type: Bug
status: In Progress
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
assignee: 6f4e0b34bc
claimed_at: '2026-05-25 01:01:53'
context_hash: 56975070d7558a37
---
# Fix Pre-existing Sweep and Claim Test Failures (TASK-091)

## Goal

Fix 3 pre-existing test failures from TASK-091 that were never resolved.

## Context

These tests have been failing since TASK-091 and were force-done over:

### `tests/sweep.test.ts` — 2 failures

1. **`recovers multiple stale tasks`** — asserts `status: "In Progress"` with YAML quotes, but gray-matter writes `status: In Progress` without quotes for simple values. Fix: change assertion to `toContain('status: In Progress')` (no quotes).

2. **`commits and pushes state changes with jittered retry`** — spies on `jitteredPush` but sweeper was migrated to `withTaskStateTransaction` in TASK-057. Fix: update test to verify transaction behavior instead of `jitteredPush`.

### `tests/claim.test.ts` — 1 failure

3. **`supports --json output`** — fails with push retry issues. The test mock for `execa` doesn't properly handle the claim flow's push attempt. Fix: update mock to resolve push on first attempt.

## Acceptance Criteria

- [ ] `tests/sweep.test.ts` "recovers multiple stale tasks" passes (fix YAML quote assertion)
- [ ] `tests/sweep.test.ts` "commits and pushes state changes with jittered retry" passes (update for transaction layer)
- [ ] `tests/claim.test.ts` "supports --json output" passes (fix execa mock)
- [ ] All sweep and claim tests pass
- [ ] No other tests regress

## Test / Verification Command

```bash
npm test -- --run tests/sweep.test.ts tests/claim.test.ts
```

## Dependencies

None.

## Risk Level

Low — test-only fix.

## Agent Notes

### 2026-05-25 System
- Task claimed via taskforge start TASK-180
- Session: 6f4e0b34bc
- Branch: agent/TASK-180-task-180--6f4e0b34bc
