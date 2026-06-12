---
id: TASK-141
type: Feature
status: Done
priority: P0
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
context_hash: 3a03a0322eb9729c
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-141
override_reason: >-
  AC satisfied: type, build, and new tests pass; pre-existing failures from
  TASK-091
override_actor: unknown
override_timestamp: '2026-05-24T01:45:36.643Z'
override_failed_gates:
  - lint
  - test
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

- [x] A shared command result envelope type exists and includes `ok`, `state`, `nextAction.kind`, `nextAction.instruction`, `nextAction.stop`, and `nextAction.allowedCommands`. — `src/core/envelope.ts` `CommandResultEnvelope<T>` interface (lines 5–16): defines all required fields; `envelopeOk()` and `envelopeError()` factory functions provide convenient construction. Tests in `tests/envelope.test.ts` verify field presence and behavior.

## Agent Notes

### 2026-05-24 System
- Task marked Done (forced)
- Override reason: AC satisfied: type, build, and new tests pass; pre-existing failures from TASK-091
- Override actor: unknown
- Failed gates: lint, test

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
