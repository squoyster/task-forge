---
id: TASK-179
type: Bug
status: Done
priority: P0
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
spec_hash: c5764d3fd8a1ea25
---
# Update Done Tests After `--force` Removal

## Goal

Update 5 done tests that relied on `--force` behavior after TASK-177 removes it.

## Context

TASK-177 removes `--force` from `taskforge done`. These tests expect force override to succeed but will now fail because guards always run:

- `accepts force option for invalid transitions` — expects force to bypass status transition check
- `allows force done when AC section is missing` — expects force to bypass AC section check
- `allows force done when AC items are blank` — expects force to bypass blank AC check
- `allows force done when AC items are unchecked` — expects force to bypass unchecked AC check
- `records structured override metadata on force done with reason` — expects override metadata fields

## Scope

In `tests/done.test.ts`:
- Tests that expect `--force` to succeed should now expect rejection (throw or JSON error)
- `records structured override metadata` — remove entirely (override metadata no longer written)
- Update test names to reflect new expected behavior (e.g., `rejects done when AC section is missing`)

## Acceptance Criteria

- [x] Tests that previously expected `--force` success now expect rejection with correct error code — Completed as part of TASK-177: `tests/done.test.ts` and `tests/commands/done.test.ts` updated
- [x] Override metadata test is removed (feature no longer exists) — Removed in TASK-177
- [x] All done tests pass — 16 tests in `tests/done.test.ts`, 5 in `tests/commands/done.test.ts`; all 490 tests pass
- [x] No other tests regress — Full test suite passes

## Test / Verification Command

```bash
npm test -- --run tests/done.test.ts
```

## Dependencies

TASK-177 (must be done first — removes `--force` from implementation).

## Risk Level

Low — test-only update.

## Agent Notes

### 2026-05-25 Implementer
- All ACs satisfied as part of TASK-177 implementation
- Test name cleanup: removed "without force" from test name in `tests/done.test.ts`
- All 490 tests pass
