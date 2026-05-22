---
id: TASK-032
type: Feature
status: Ready
priority: P3
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-032: Add `doctor` Command — Repo and Task-State Health Check

## Goal

Add `taskforge doctor` that runs diagnostic checks on the repository, task-state worktree, and task files — detecting orphan worktrees, stale locks, invalid task files, missing branches, and configuration issues.

## Background

As the task-state and worktree ecosystem grows, agents and operators need a quick way to detect health issues. A `doctor` command consolidates checks that are currently manual.

## Checks

| Check | What it detects |
|---|---|
| Task-state worktree exists | Missing or uninitialized task-state |
| No duplicate task IDs | Conflicting task files |
| No orphan worktrees | Worktrees without corresponding tasks |
| No stale locks | Tasks In Progress with missing/destroyed worktrees |
| Config is valid | Malformed `.taskforge/config.json` |
| All task files parse | Invalid YAML or missing required fields |
| Branches match tasks | Branches without task entries |
| Sweeper recommendations | Tasks that would be swept on next run |

## Usage

```bash
taskforge doctor                    # Full health report
taskforge doctor --json             # Structured diagnostic output
taskforge doctor --fix              # Auto-fix safe issues (orphan cleanup, etc.)
```

## Acceptance Criteria

- [ ] Detects missing or uninitialized task-state
- [ ] Detects orphan worktrees (worktree without task file)
- [ ] Detects stale locks (In Progress with missing worktree)
- [ ] Validates config.json syntax
- [ ] Validates all task files parse cleanly
- [ ] Reports total counts: tasks, worktrees, branches, stale, orphan
- [ ] `--json` output includes all diagnostic data
- [ ] `--fix` cleans up orphans (with confirmation)
- [ ] Tests cover: clean repo, orphan detection, stale lock detection, config validation

## Dependencies

TASK-020 (inspect)

## Risk Level

Low — read-only diagnostic (--fix is opt-in).

## Continuation Policy

Auto-continue.
