---
id: TASK-093
type: Bug
status: In Progress
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
assignee: 61fad21b00
claimed_at: '2026-05-23 11:30:22'
context_hash: 8c607774d14d0be5
---

# TASK-093: Fix claim-json and sweep assertion test failures

## Goal

## Background
3 test failures in the assertion layer:

1. `tests/claim.test.ts > cmdClaim > supports --json output` — `expected false to be true`. The JSON output `ok` field is `false` when push fails in tests that run without a real git remote.

2. `tests/sweep.test.ts > cmdSweep > recovers multiple stale tasks` — expects `status: "In Progress"` in the task file but the format differs (quotes missing in YAML).

3. `tests/sweep.test.ts > cmdSweep > commits and pushes state changes with jittered retry` — `jitteredPush` spy receives 0 calls, meaning the sweep path doesn't invoke the push function as expected.

## Scope
- `tests/claim.test.ts`
- `tests/sweep.test.ts`
- Possibly `src/commands/claim.ts` or `src/core/sweeper.ts`

## Acceptance Criteria
- [ ] All 3 tests pass when run with `npm test -- --run`
- [ ] JSON output test correctly reports status when git remote is unavailable
- [ ] Sweep test assertions match actual YAML output format
- [ ] Sweep test push spy is correctly wired

## Acceptance Criteria

- [ ]

## Agent Notes

### 2026-05-23 System
- Task claimed via taskforge start TASK-093
- Session: 61fad21b00
- Branch: agent/TASK-093-fix-claim-json-and-sweep-assertion-test--61fad21b00

### 2026-05-23 System
- Task claimed via taskforge start TASK-093
- Session: 61fad21b00
- Branch: agent/TASK-093-fix-claim-json-and-sweep-assertion-test--61fad21b00

### 2026-05-23 02:34 System
- Discovered during TASK-086 (project runtime configuration) — pre-existing test failures and CLI message audit findings.
