---
id: TASK-178
type: Bug
status: Done
priority: P0
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
context_hash: 978729792ac0ac73
spec_hash: 5a4cdb510a522e3b
---
# Fix `runGates` Mock in Done Command Tests

## Goal

Fix 11 failing done tests caused by missing `runGates` mock export.

## Context

`cmdDone` calls `runGates()` from `./gates.js` (added in TASK-018). Both `tests/done.test.ts` and `tests/commands/done.test.ts` mock the gates module but don't export `runGates`, causing all done tests to throw:

```
[vitest] No "runGates" export is defined on the "../../src/commands/gates.js" mock
```

## Scope

### `tests/done.test.ts` — 7 tests
- `marks a task as Done without cleanup`
- `removes worktree when --cleanup is used`
- `removes worktree and branch with --cleanup --delete-branch`
- `is safe (no-op) when worktree does not exist`
- `clears worktree and branch from frontmatter after cleanup`
- `handles cleanup gracefully when worktree removal fails`
- `handles branch deletion failure gracefully`

### `tests/commands/done.test.ts` — 4 tests
- `marks a task as Done`
- `accepts force flag for invalid transitions`
- `throws for invalid transition without force`
- `appends agent note when marking Done`

## Acceptance Criteria

- [x] `vi.mock("../../src/commands/gates.js")` in both test files exports a `runGates` function that resolves to `{ passed: true, results: [] }` — `tests/commands/done.test.ts`: added `runGates` to existing gates mock. `tests/done.test.ts`: already had it.
- [x] All 11 previously-failing done tests pass — all 27 done tests (22 + 5) now pass.
- [x] No other tests regress — 451 tests pass, only 3 pre-existing failures remain (TASK-180).

## Test / Verification Command

```bash
npm test -- --run tests/done.test.ts tests/commands/done.test.ts
```

## Dependencies

None.

## Risk Level

Low — test-only fix.

## Agent Notes

### 2026-05-25 System
- Task claimed via taskforge start TASK-178
- Session: acfca4889e
- Branch: agent/TASK-178-task-178--acfca4889e

### 2026-05-25 Implementer
- Added `runGates` mock to `tests/commands/done.test.ts`
- Added `withTaskStateTransaction` mock to `tests/done.test.ts`
- Added `simple-git` mocks (`getCurrentBranch`, `removeWorktree`, `removeBranch`) to `tests/commands/done.test.ts`
- Changed default AC from unchecked (`- [ ]`) to checked (`- [x]`) in both test files' `makeTaskFile` helpers
- Added `reason` to force test in `tests/commands/done.test.ts` that requires it
- All 27 done tests pass (22 + 5). Total: 451/454 tests pass (3 pre-existing failures from TASK-180).

### 2026-05-25 System
- Task marked Done
