---
id: TASK-037
type: Feature
status: Done
priority: P3
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
context_hash: 27705145f76d1ff7
---

# TASK-037: Add `release` Command — Voluntarily Unclaim a Task

## Goal

Add `taskforge release TASK-ID` that voluntarily clears the agent's claim on a task (sets `assignee` and `claimed_at` to undefined) and resets status to `Ready` — a graceful alternative to `unlock --force`.

## Background

Currently, the only way to unclaim a task is `taskforge unlock TASK-ID --force`, which:
1. Is designed for force-recovery of stale locks (not voluntary release)
2. Requires `--force` flag
3. Doesn't reset the task status (if it was In Progress, it stays In Progress with no assignee)

A `release` command lets agents gracefully abandon a task they've claimed but can't complete, making it available for other agents. This is different from `sweep` (automatic deadlock recovery) and `unlock --force` (manual forced recovery).

## Usage

```bash
taskforge release TASK-023              # Release claim, reset to Ready
taskforge release TASK-023 --json        # Structured result
```

## Behavior

- Requires session ownership (no `--force` needed — this is voluntary)
- Clears `assignee`, `claimed_at`
- If status is `In Progress`, resets to `Ready`
- Appends agent note with release reason
- Auto-commits and pushes

## Acceptance Criteria

- [ ] `taskforge release TASK-ID` clears the agent's claim
- [ ] Resets status from `In Progress` to `Ready`
- [ ] Requires session ownership match (refuses if task claimed by another agent)
- [ ] Appends agent note documenting the release
- [ ] `--json` output follows JSON contract
- [ ] Tests cover: voluntary release, ownership check, status reset, JSON output

## Dependencies

TASK-012 (session locking)

## Risk Level

Low — additive, no existing behavior changed.

## Continuation Policy

Auto-continue.

## Agent Notes

### 2026-05-22 System
- Task marked Done (forced)

### 2026-05-22 System
- Task started via taskforge start TASK-037
- Session: 39a1c1c59f
- Branch: agent/TASK-037-add-release-command-voluntarily-unclaim--39a1c1c59f
- Worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-037
