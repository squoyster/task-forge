---
id: TASK-177
type: Bug
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
---
# Disable `taskforge done --force`

## Goal

Remove the `--force` bypass from `taskforge done` so agents cannot skip guards.

## Context

The `--force` flag on `done` allows agents to override every guard: gate failures, status transitions, ownership, control-file changes, and acceptance criteria checks. This has been repeatedly abused — agents force-done tasks with unmet ACs, failing gates, and stale state. The invariant validator added in TASK-151 already catches many of these, but `--force` bypasses it entirely.

## Scope

### 1. Remove `--force` from CLI

Remove the `--force`, `--force-gates`, `--force-transition`, `--force-ownership`, and `--reason` options from the `done` command in `src/cli.ts`.

### 2. Remove force logic from `cmdDone`

In `src/commands/done.ts`:
- Remove `force`, `forceGates`, `forceTransition`, `forceOwnership`, and `reason` from `DoneOptions`
- Remove all `&& !force` bypass conditions — guards must always run
- Remove the override metadata recording block (`override_reason`, `override_actor`, etc.)
- Gates must always pass before `done` succeeds
- Status transitions must always be valid
- AC section, blank AC, and unchecked AC checks must always run

### 3. Update tests

In `tests/done.test.ts` and `tests/commands/done.test.ts`:
- Remove tests that rely on `--force` behavior
- Update tests that expect `--force` to succeed — they should now expect rejection

### 4. Update CHANGELOG

Add entry under `### Changed` documenting removal of `--force`.

## Acceptance Criteria

- [ ] `taskforge done --force` is no longer a valid option (CLI rejects it)
- [ ] `cmdDone` has no `force` parameter or force bypass logic
- [ ] All guards (gates, transition, ownership, control-files, AC checks) always run without exception
- [ ] Override metadata fields (`override_reason`, `override_actor`, `override_timestamp`, `override_failed_gates`) are no longer written by `cmdDone`
- [ ] All existing tests pass (force-related tests removed or updated)
- [ ] CHANGELOG updated

## Test / Verification Command

```bash
npm run typecheck && npm run lint && npm run build && npm test -- --run
```

## Dependencies

None.

## Risk Level

Medium — removes an escape hatch. Agents that legitimately need to bypass guards will need to fix the underlying issue instead.

## Agent Notes
