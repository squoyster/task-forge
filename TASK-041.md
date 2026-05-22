---
id: TASK-041
type: Feature
status: Inbox
priority: P1
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
dependsOn:
  - TASK-040
---

# TASK-041: Checkpoint Mechanism — Global Agent Stop Signal

## Goal

Add a global checkpoint mechanism that signals all running agents to pause. During a checkpoint, only privileged agents may mutate state. Non-privileged agents that encounter an active checkpoint must either exit or wait.

## Background

When the system detects an inconsistency (e.g., a task merged to main without `done` being called), a privileged "doctor" agent needs exclusive access to repair the state. Without a checkpoint, other agents may continue reading/writing task-state and compound the problem.

The checkpoint is a lightweight signal — a marker file or git ref in task-state — that every `taskforge` command checks before proceeding.

## Scope

### New/modified files:

- `src/core/checkpoint.ts` — checkpoint state management (isActive, start, release)
- `src/commands/checkpoint.ts` — CLI commands: `checkpoint start`, `checkpoint release`, `checkpoint status`
- `src/cli.ts` — register checkpoint subcommands
- `src/commands/next.ts` — check checkpoint before returning tasks; if active, return checkpoint task or empty
- `src/commands/start.ts` — check checkpoint before claiming; refuse if active and not privileged
- `src/commands/claim.ts` — same check
- `src/commands/done.ts` — same check

### Checkpoint storage:

Option A: Marker file (`checkpoint.lock` in task-state directory)
Option B: Git ref or tag
Option C: Special marker task with a reserved status

Recommend Option A — simplest, no git dependency, works offline.

### Checkpoint file format:

```json
{
  "active": true,
  "started_by": "<session-id>",
  "started_at": "<iso-timestamp>",
  "reason": "Doctor repair: fixing stale task state"
}
```

### Behavior by command:

| Command | Checkpoint active + normal agent | Checkpoint active + privileged agent |
|---------|----------------------------------|--------------------------------------|
| `next` | Return checkpoint task or empty result | Normal operation |
| `start` | Refuse: "Checkpoint active. Try again after doctor completes." | Allowed |
| `claim` | Refuse | Allowed |
| `done` | Refuse | Allowed (to finish current work) |
| `block` | Refuse | Allowed |
| `unlock` | Refuse | Allowed |
| `sweep` | Refuse | Allowed |
| `sync` | Refuse | Allowed |
| `checkpoint start` | Refuse | Allowed |
| `checkpoint release` | Refuse | Allowed |
| `status`/`summary`/`list` | Allowed (read-only) | Allowed |

## Acceptance Criteria

- [ ] `isCheckpointActive()` returns true when checkpoint file exists with `active: true`
- [ ] `startCheckpoint(sessionId, reason)` creates checkpoint file, commits + pushes to task-state
- [ ] `releaseCheckpoint()` removes or sets `active: false`, commits + pushes
- [ ] `taskforge checkpoint status` reports active/inactive and reason
- [ ] `taskforge checkpoint start` requires privileged capability (TASK-040)
- [ ] `taskforge checkpoint release` requires privileged capability
- [ ] `taskforge next` detects active checkpoint, returns empty or checkpoint info
- [ ] `taskforge start` refuses during active checkpoint for normal agents
- [ ] Read-only commands (status, summary, list) work during checkpoint
- [ ] Checkpoint state is stored in task-state (shared via git push, all agents see it)
- [ ] All existing tests pass
- [ ] Tests cover: checkpoint detection, command gating, privileged bypass, release

## Dependencies

- **TASK-040**: Agent Capability Levels (for gating checkpoint operations)

## Test / Verification Command

```bash
npm run typecheck && npm run lint && npm run build && npm test -- --run
```

## Risk Level

Medium — blocks all agents during checkpoint. Must be reliable (checkpoint file never corrupted) and recoverable (manual override if doctor crashes).
