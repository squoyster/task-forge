---
id: TASK-024
type: Feature
status: Ready
priority: P2
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
---

# TASK-024: Add `claim` Command — Separate Claim Primitive

## Goal

Add `taskforge claim TASK-ID` as a standalone primitive that mutates only task-state (sets `assignee` + `claimed_at`) without creating a worktree or branch. This decouples "I'm taking this task" from "I'm setting up the workspace."

## Background

Currently `taskforge start` claims + creates worktree + creates branch. Agents often need to claim a task first, then set up context, then start work. A separate `claim` command is a lower-level primitive that `start` can call internally.

Per the gap analysis:
```
taskforge next --json    → identify candidate
taskforge claim TASK-ID  → mutate task-state only
taskforge start TASK-ID  → create/resume worktree/branch
```

## Usage

```bash
taskforge claim TASK-023               # Claim task (auto-assign session)
taskforge claim TASK-023 --json         # Structured result
taskforge claim TASK-023 --session abc  # Explicit session ID
```

## Acceptance Criteria

- [ ] `taskforge claim TASK-ID` sets `assignee` and `claimed_at` on the task
- [ ] Refuses if task is already claimed by another session (unless `--force`)
- [ ] Auto-commits and pushes task-state
- [ ] `--json` output follows JSON contract
- [ ] `taskforge start` internally calls `claim` before creating worktree
- [ ] Tests cover: claim, double-claim refusal, force claim, JSON output

## Dependencies

TASK-012 (session locking), TASK-017 (JSON contracts)

## Risk Level

Medium — changes start command flow but should be backward-compatible.

## Continuation Policy

Auto-continue.
