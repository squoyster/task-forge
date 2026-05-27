---
id: TASK-220
type: Bug
status: Ready
priority: P0
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-220: Implement validate-state --strict flag with non-zero exit on warnings

## Goal

## Goal

Implement the `--strict` flag for `taskforge validate-state` so that it exits with a non-zero status when there are any warnings or errors. This is critical because the CI workflow at `.github/workflows/task-state-validate.yml` already passes `--strict` but Commander silently ignores it.

## Context

Per `taskforge-control-plane-closure-spec.md` and `control-plane-hardening.md` §Strict validation. The CI workflow depends on this behavior for branch protection enforcement.

## Current State

- `src/commands/validate-state.ts` accepts `strict` in its type signature but never reads it
- `src/cli.ts` does NOT register `--strict` as a Commander option
- The function never calls `process.exit()` or throws — always exits 0
- CI runs `node dist/cli.js validate-state --strict --json` but `--strict` is silently ignored

## Required Changes

1. Register `--strict` option in `src/cli.ts` for the `validate-state` command
2. In `cmdValidateState()`, when `strict` is true:
   - Treat warnings as failures
   - Exit with non-zero status (call `process.exit(1)` or throw a `ValidationError`)
3. In JSON mode with `--strict`:
   - Set `ok: false` when warnings exist
   - Include `nextActions` pointing to `taskforge doctor --json`
4. In human mode with `--strict`:
   - Print warnings as errors
   - Include recovery guidance

## Acceptance Criteria

- [ ] `--strict` option registered in `src/cli.ts` for `validate-state`
- [ ] `taskforge validate-state --strict` exits non-zero when warnings exist
- [ ] `taskforge validate-state --strict --json` returns `ok: false` when warnings exist
- [ ] `taskforge validate-state` (without --strict) still exits 0 on warnings only
- [ ] JSON output includes `nextActions` with recovery guidance when strict fails
- [ ] CI workflow `.github/workflows/task-state-validate.yml` correctly fails on state invariant warnings
- [ ] Tests cover strict mode with errors, warnings, and clean state

## Acceptance Criteria

- [ ]

## Agent Notes
