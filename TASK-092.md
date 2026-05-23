---
id: TASK-092
type: Bug
status: Ready
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-092: Fix task-state-transaction conflict re-run timeout

## Goal

## Background
`tests/task-state-transaction.test.ts > withTaskStateTransaction > re-runs mutation on conflict` times out at 5000ms. The test uses a mock conflict scenario that appears to busy-wait or never resolves.

## Scope
- `tests/task-state-transaction.test.ts`
- Possibly `src/core/task-state-transaction.ts`

## Acceptance Criteria
- [ ] Test `re-runs mutation on conflict` passes within the default timeout
- [ ] Conflict retry logic is correctly simulated in the test

## Acceptance Criteria

- [ ]

## Agent Notes

### 2026-05-23 02:34 System
- Discovered during TASK-086 (project runtime configuration) — pre-existing test failures and CLI message audit findings.
