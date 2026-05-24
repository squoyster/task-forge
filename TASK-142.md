---
id: TASK-142
type: Feature
status: In Progress
priority: P0
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
dependsOn:
  - TASK-141
assignee: 433cf297b9
claimed_at: '2026-05-24 01:45:48'
context_hash: 3a03a0322eb9729c
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-142
---
# Make Gates Emit Fix-Current-Task Next Action on Test Failure

## Goal

Tell agents to fix local failures before moving on.

## Background

When a gate fails because of the current task, the agent should repair the issue and rerun gates.

## Acceptance Criteria

- [x] `taskforge gates --json` emits `nextAction.kind = "FIX_CURRENT_TASK"` when any configured gate fails and no upstream-failure override is supplied. — `src/commands/gates.ts` `cmdGates()`: when `json` is true and `passed` is false, emits envelope with `nextAction.kind = "FIX_CURRENT_TASK"`, `stop: true`, `allowedCommands: ["taskforge gates"]`. Tests in `tests/gates.test.ts` verify this behavior.

## Agent Notes

### 2026-05-24 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-142

### 2026-05-24 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-142

### 2026-05-24 System
- Task claimed via taskforge start TASK-142
- Session: 433cf297b9
- Branch: agent/TASK-142-task-142--433cf297b9

### 2026-05-24 System
- Task claimed via taskforge start TASK-142
- Session: 433cf297b9
- Branch: agent/TASK-142-task-142--433cf297b9
