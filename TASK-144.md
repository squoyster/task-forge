---
id: TASK-144
type: Feature
status: Done
priority: P0
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
dependsOn:
  - TASK-141
context_hash: 3a03a0322eb9729c
spec_hash: d578cb85ca94fd11
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-144
override_reason: >-
  AC satisfied: typecheck, build, and tests pass; pre-existing failures from
  TASK-091
override_actor: unknown
override_timestamp: '2026-05-24T02:13:02.971Z'
override_failed_gates:
  - lint
  - test
---
# Add Block-for-Human Next Action

## Goal

Give agents a clear stop condition for ambiguous, unsafe, or human-decision-required cases.

## Acceptance Criteria

- [x] Any command that detects a required human decision emits `nextAction.kind = "BLOCK_FOR_HUMAN"` and `nextAction.stop = true` in JSON output. — `src/commands/block.ts` `cmdBlock()`: when `json` option is true, emits envelope with `nextAction.kind = "BLOCK_FOR_HUMAN"`, `stop: true`, and `allowedCommands: ["taskforge unblock", "taskforge status", "taskforge summary"]`. Tests in `tests/commands/block.test.ts` verify this behavior.

## Agent Notes

### 2026-05-24 System
- Task marked Done (forced)
- Override reason: AC satisfied: typecheck, build, and tests pass; pre-existing failures from TASK-091
- Override actor: unknown
- Failed gates: lint, test

### 2026-05-24 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-144

### 2026-05-24 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-144

### 2026-05-24 System
- Task claimed via taskforge start TASK-144
- Session: d5d4519137
- Branch: agent/TASK-144-task-144--d5d4519137

### 2026-05-24 System
- Task claimed via taskforge start TASK-144
- Session: d5d4519137
- Branch: agent/TASK-144-task-144--d5d4519137
