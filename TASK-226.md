---
id: TASK-226
type: Bug
status: Rejected
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
spec_hash: 5f24e7afed2990da
---

# TASK-226: Resolve doctor --fix CLI/doc mismatch and restrict to human/doctor authority

## Goal

## Goal

Documentation references `doctor --fix`, but the CLI registration only exposes `doctor --json`. The implementation function accepts `fix?: boolean` but the option is not registered in Commander. Resolve this mismatch.

## Context

Per `taskforge-control-plane-closure-spec.md` §1.2 Gap C, §4.20, and §9 step 7-8.

## Current State

- `src/commands/doctor.ts` function signature: `cmdDoctor(options?: { json?: boolean; fix?: boolean })`
- Lines 131-139: If `options?.fix` is true, calls `adapter.fix(repoRoot)` to repair agent framework issues
- `src/cli.ts` registration (lines 346-349): only passes `--json`, NOT `--fix`
- Commander silently ignores unrecognized options, so `taskforge doctor --fix` would not actually enable fix mode

## Required Changes

1. Register `--fix` option in `src/cli.ts`:
   ```ts
   .option("--fix", "Attempt automated repair (human/doctor authority only)")
   ```

2. Add authority check before fix operations:
   - Import `resolveAuthority` and `assertCanForce` from `src/core/authority.ts` (created by TASK-221)
   - If authority is `agent`, reject with structured error and `nextActions`

3. Ensure `--fix` creates `.doctor-lock` before repair and removes it after successful repair

4. Update docs to clarify `--fix` is human/doctor-only

## Acceptance Criteria

- [ ] `--fix` option registered in `src/cli.ts` for doctor command
- [ ] `taskforge doctor --fix` rejected for agent authority with structured error
- [ ] `taskforge doctor --fix` works for human authority (via env var)
- [ ] `taskforge doctor --fix` works for doctor authority (via env var)
- [ ] `--fix` creates `.doctor-lock` before repair operations
- [ ] `--fix` removes `.doctor-lock` after successful repair
- [ ] Rejection includes `nextActions` with `taskforge block` option
- [ ] Tests cover `doctor --fix` with agent, human, and doctor authority
- [ ] Documentation updated to clarify `--fix` is human/doctor-only

## Acceptance Criteria

- [ ]

## Agent Notes

### 2026-06-20T00:00:00Z System
- Task rejected: Recalibration - pre-306 task pool retired, superseded by 306+ frontier.
