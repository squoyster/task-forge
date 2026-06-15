---
id: TASK-174
type: Feature
status: Done
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
spec_hash: b639206f265b6a09
---
# Add AC Linter for Task Files

## Goal

Allow agents to validate task quality before starting work.

## Acceptance Criteria

- [x] A command exists that scans task files and reports missing, blank, duplicate, or unchecked acceptance criteria without changing task state. — Added `taskforge ac-check [taskId]` command (`src/commands/ac-check.ts`, registered in `src/cli.ts`). Scans all tasks or a specific task. Reports issues via human-readable or JSON output. Added `hasDuplicateAcSections()` detection. Extended `JsonResult` interface for output. 7 tests in `tests/ac-check.test.ts`.

## Agent Notes

### 2026-05-25 Implementer
- Created `src/commands/ac-check.ts` with `cmdAcCheck()` function
- Registered as `taskforge ac-check [taskId]` in CLI
- Detects: missing AC section, blank AC items, unchecked AC items, duplicate AC sections
- Supports `--json` output and scanning all tasks or a specific one
- Added 7 tests in `tests/ac-check.test.ts`
- All 497 tests pass. Typecheck, lint, and build pass.
