---
id: TASK-177
type: Bug
status: Done
priority: P1
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
spec_hash: e1b97eb4353e7147
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

- [x] `taskforge done --force` is no longer a valid option (CLI rejects it) — `src/cli.ts`: removed `--force`, `--force-gates`, `--force-transition`, `--force-ownership`, `--reason` options from done command
- [x] `cmdDone` has no `force` parameter or force bypass logic — `src/commands/done.ts`: `DoneOptions` has only `cleanup`, `deleteBranch`, `json`; all `&& !force` conditions removed
- [x] All guards (gates, transition, ownership, control-files, AC checks) always run without exception — `src/commands/done.ts`: gates throw if failed, transition throws if invalid, ownership asserted if locked, control-hash checked, AC section/blank/unchecked all throw
- [x] Override metadata fields (`override_reason`, `override_actor`, `override_timestamp`, `override_failed_gates`) are no longer written by `cmdDone` — removed override metadata recording block and JSON override output
- [x] All existing tests pass (force-related tests removed or updated) — `tests/done.test.ts`: 16 tests pass (6 force tests removed/converted to rejection tests); `tests/commands/done.test.ts`: 5 tests pass (1 force test converted to rejection test); all 490 tests pass
- [x] CHANGELOG updated — Added entry under `### Changed` in `CHANGELOG.md`

## Agent Notes

### 2026-05-25 Implementer
- Removed all force options from CLI (`src/cli.ts`) and `cmdDone` (`src/commands/done.ts`)
- Removed override metadata recording and JSON override output
- Updated tests: `tests/done.test.ts` (16 tests), `tests/commands/done.test.ts` (5 tests)
- All 490 tests pass. Typecheck, lint, and build pass.
