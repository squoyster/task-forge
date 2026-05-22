---
id: TASK-028
type: Feature
status: In Progress
priority: P3
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
assignee: 0152c675b7
claimed_at: '2026-05-22 07:12:37'
---

# TASK-028: Add Per-Task Event Log (NDJSON)

## Goal

Add a machine-auditable NDJSON event log per task, recording lifecycle events (claimed, worktree_created, gates_passed, blocked, heartbeat, done) with timestamps and actor identity.

## Background

Agent Notes in Markdown are useful for human review but not structured enough for automation. The gap analysis recommends:

```
../task-state/events/TASK-023.ndjson
```

Events:

```json
{"ts":"2026-05-21T23:00:00Z","actor":"agent:implementer","event":"claimed","session":"abc123def0"}
{"ts":"2026-05-21T23:03:00Z","actor":"agent:implementer","event":"worktree_created","path":"../worktrees/TASK-023"}
{"ts":"2026-05-21T23:21:00Z","actor":"agent:implementer","event":"gates_passed","typecheck":true,"lint":true,"build":true,"test":true}
{"ts":"2026-05-22T00:05:00Z","actor":"agent:implementer","event":"done"}
```

## Scope

### New files:

- `src/core/event-log.ts` — `appendEvent()`, `readEvents()` helpers
- `tests/event-log.test.ts`

### Modified files:

- All lifecycle commands that should emit events: `start.ts`, `done.ts`, `block.ts`, `heartbeat.ts`, `gates.ts`, `unlock.ts`, etc.

## Acceptance Criteria

- [ ] `appendEvent(taskId, event)` appends an NDJSON line to `task-state/events/TASK-ID.ndjson`
- [ ] Events include `ts` (ISO 8601), `actor`, and `event` type
- [ ] `readEvents(taskId)` returns parsed event array
- [ ] All lifecycle commands append events: claim, start, block, heartbeat, unlock, gates, done
- [ ] Events directory is auto-created on first write
- [ ] Tests cover: append, read, missing file, concurrency-safe writes

## Dependencies

None.

## Risk Level

Low — additive, no existing behavior changed.

## Continuation Policy

Auto-continue.

## Agent Notes

### 2026-05-22 System
- Task started via taskforge start TASK-028
- Session: 0152c675b7
- Branch: agent/TASK-028-add-per-task-event-log-ndjson--0152c675b7
- Worktree: /Volumes/Transcend/devel/worktrees/TASK-028
