---
id: TASK-124
type: Refactor
status: Ready
priority: P0
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-124: Complete transaction-only mutation for remaining commands (TASK-105 follow-up)

## Goal

## Goal

Complete the transaction-only mutation refactoring started in TASK-105. Move direct file writes from start, block, release, reject, heartbeat into the transaction layer. Add remaining ACs: duplicate-note prevention tests, push-failure next-action guidance.

## Background

TASK-105 established dirty-tracking in the transaction layer and refactored claim.ts. Remaining commands still write directly to task files before the transaction.

## Remaining ACs from TASK-105

- [ ] No state-changing command mutates task files outside transaction layer (start, block, release, reject, heartbeat)
- [ ] Duplicate system notes are not produced under retry
- [ ] Transaction failure returns explicit next action

## Scope

- src/commands/start.ts: move updateTaskLock/updateTaskStatus into transaction
- src/commands/block.ts: move direct writes into transaction
- src/commands/release.ts: move direct writes into transaction
- src/commands/reject.ts: move direct writes into transaction
- src/commands/heartbeat.ts: move direct writes into transaction
- tests/: update mocks and assertions for each command
- src/commands/done.ts: verify existing audit flow, add next-action on failure

## Acceptance Criteria

- [ ] No direct writeTaskFile/updateTaskStatus/updateTaskLock in any command outside transaction
- [ ] Duplicate system notes test: claim same task twice, verify 1 note
- [ ] Push failure returns JSON with nextActions (PULL_REBASE_AND_RETRY, RELEASE_TASK_AND_SELECT_NEXT)
- [ ] All existing tests pass with updated mocks

## Acceptance Criteria

- [ ]

## Agent Notes
