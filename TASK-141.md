---
id: TASK-141
type: Feature
status: In Progress
priority: P0
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
assignee: '7512307550'
claimed_at: '2026-05-24 01:43:30'
context_hash: 3a03a0322eb9729c
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-141
---
# Add Command Next-Action Envelope Type

## Goal

Define a standard command feedback contract that tells agents what to do next.

## Background

The CLI currently reports success/failure, but does not consistently direct agent behavior.

## Implementation Notes

Define a reusable result shape similar to:

```ts
interface CommandResultEnvelope<T = unknown> {
  ok: boolean;
  state: string;
  data?: T;
  nextAction: {
    kind: string;
    instruction: string;
    stop: boolean;
    allowedCommands: string[];
  };
}
```

## Acceptance Criteria

- [ ] A shared command result envelope type exists and includes `ok`, `state`, `nextAction.kind`, `nextAction.instruction`, `nextAction.stop`, and `nextAction.allowedCommands`.

## Agent Notes

### 2026-05-24 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-141

### 2026-05-24 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-141

### 2026-05-24 System
- Task claimed via taskforge start TASK-141
- Session: 7512307550
- Branch: agent/TASK-141-task-141--7512307550

### 2026-05-24 System
- Task claimed via taskforge start TASK-141
- Session: 7512307550
- Branch: agent/TASK-141-task-141--7512307550
