---
id: TASK-178
type: Bug
status: In Progress
priority: P0
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
assignee: acfca4889e
claimed_at: '2026-05-25 00:56:45'
context_hash: 978729792ac0ac73
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

- [ ] `vi.mock("../../src/commands/gates.js")` in both test files exports a `runGates` function that resolves to `{ passed: true, results: [] }`
- [ ] All 11 previously-failing done tests pass
- [ ] No other tests regress

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
