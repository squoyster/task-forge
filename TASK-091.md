---
id: TASK-091
type: Bug
status: Ready
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-091: Fix done-test git-repo-not-found failures

## Goal

## Background
`npm test -- --run` produces 11 test failures across `tests/done.test.ts` (8) and `tests/commands/done.test.ts` (3) with the error: `fatal: not a git repository (or any of the parent directories): .git`. These tests use `cmdDone` which internally calls `withTaskStateTransaction`/commit-and-push helpers. The tests run in temp dirs (via `mkdtempSync`) that don't have git repos initialized.

## Scope
- `tests/done.test.ts`
- `tests/commands/done.test.ts`
- Possibly `src/core/task-state-transaction.ts` or test helpers

## Acceptance Criteria
- [ ] All 11 done-related tests pass when run with `npm test -- --run`
- [ ] Tests can run in temp dirs without requiring a real git repo
- [ ] No change to production code behavior

## Acceptance Criteria

- [ ]

## Agent Notes

### 2026-05-23 02:34 System
- Discovered during TASK-086 (project runtime configuration) — pre-existing test failures and CLI message audit findings.
