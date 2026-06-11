---
id: TASK-180
type: Bug
status: Done
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
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

- [x] `tests/sweep.test.ts` "recovers multiple stale tasks" passes — fixed YAML quote assertion (gray-matter quotes values with spaces, so `status: "In Progress"` is correct).
- [x] `tests/sweep.test.ts` "commits and pushes state changes with jittered retry" passes — updated to verify `withTaskStateTransaction` instead of deprecated `jitteredPush`.
- [x] `tests/claim.test.ts` "supports --json output" passes — added `withTaskStateTransaction` mock with actual file persistence, fixed console.log capture.
- [x] All sweep and claim tests pass — 9 sweep tests + 9 claim tests = 18 tests pass.
- [x] No other tests regress — all 454 tests pass.

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

### 2026-05-25 Implementer
- Fixed YAML status assertions in sweep tests (gray-matter quotes values with spaces)
- Updated sweep test to verify `withTaskStateTransaction` instead of deprecated `jitteredPush`
- Added `withTaskStateTransaction` mock to sweep and claim tests with actual file persistence
- Fixed claim JSON output test to properly capture `console.log` output
- All 454 tests now pass (was 451/454)

### 2026-05-25 System
- Task marked Done
