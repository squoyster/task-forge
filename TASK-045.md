---
id: TASK-045
type: Feature
status: Ready
priority: P0
agentRole: Implementer
riskLevel: High
humanInterventionRequired: false
dependsOn:
---

# TASK-045: Centralize Task-State Mutation Through Transactional Control Layer

## Goal

Introduce a single transaction boundary for all task-state mutations so commands no longer directly edit task Markdown files and independently commit/push changes. Create the architecture for controlled mutation, optimistic retry, invariant validation hooks, event logging, and eventual branch-protected/broker-backed state management.

## Background

Currently, commands and core modules directly call low-level mutation helpers:
- `updateTaskStatus()`, `updateTaskLock()`, `clearTaskLock()`
- `writeTaskFile()`, `appendAgentNote()`
- `commitAndPushTaskState()`, `jitteredPush()`

This creates multiple mutation paths with inconsistent behavior. The system needs one authoritative path:
```
withTaskStateTransaction(...)
  → pull latest task-state
  → capture base HEAD
  → load fresh state
  → apply mutation
  → validate invariants
  → append event
  → write materialized Markdown state
  → commit → push
  → on conflict: reset/reload/reapply mutation
```

## Scope

### New file:
- `src/core/task-state-transaction.ts`

### Key API:
```typescript
export async function withTaskStateTransaction<T>(
  options: TaskStateTransactionOptions,
  mutate: (tx: TaskStateTransaction) => Promise<T> | T,
): Promise<T>
```

## Acceptance Criteria

- [ ] Transaction core exists in `src/core/task-state-transaction.ts`
- [ ] Pulls latest task-state before mutation
- [ ] Captures base HEAD
- [ ] Validates state via invariant hooks before commit
- [ ] Appends event-log entry for every mutation
- [ ] On non-fast-forward conflict: reloads fresh state, re-runs mutation
- [ ] Supports retry with jittered backoff
- [ ] Does not swallow push failures silently
- [ ] At least one command or test uses the transaction layer
- [ ] Tests cover: success, conflict-retry, invariant failure abort, no-op
- [ ] All existing tests pass

## Dependencies

None.

## Risk Level

High

## Continuation Policy

Auto-continue.
