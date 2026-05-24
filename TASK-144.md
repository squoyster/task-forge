---
id: TASK-144
type: Feature
status: In Progress
priority: P0
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
dependsOn:
  - TASK-141
assignee: d5d4519137
claimed_at: '2026-05-24 02:10:35'
context_hash: 3a03a0322eb9729c
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-144
---
# Add Block-for-Human Next Action

## Goal

Give agents a clear stop condition for ambiguous, unsafe, or human-decision-required cases.

## Acceptance Criteria

- [x] Any command that detects a required human decision emits `nextAction.kind = "BLOCK_FOR_HUMAN"` and `nextAction.stop = true` in JSON output. — `src/commands/block.ts` `cmdBlock()`: when `json` option is true, emits envelope with `nextAction.kind = "BLOCK_FOR_HUMAN"`, `stop: true`, and `allowedCommands: ["taskforge unblock", "taskforge status", "taskforge summary"]`. Tests in `tests/commands/block.test.ts` verify this behavior.

## Agent Notes

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
