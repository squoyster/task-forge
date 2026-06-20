---
id: TASK-023
type: Documentation
status: Done
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
spec_hash: 4b0dee71207c6d26
issue: 83
---

# TASK-023: Update README/tasks Docs to Mark task-state as Authoritative

## Goal

Update project documentation so agents and humans never accidentally work from stale `tasks/` on main. `README.md` and any remaining `tasks/` docs must clearly state that `../task-state/` is the single source of truth for task files.

## Background

The gap analysis flagged that `README.md` still says `tasks/` is where tasks live, but `TASKFORGE.md` and the codebase treat `../task-state/` as authoritative. This creates confusion — agents reading both may modify the wrong directory.

## Scope

### Modified files:

- `README.md` — update task location description
- `tasks/README.md` — add deprecation/legacy notice (if it exists)

## Acceptance Criteria

- [x] `README.md` clearly states task files live in `../task-state/`, not `tasks/` on main
- [x] Any `tasks/README.md` contains a legacy notice directing readers to `../task-state/`
- [x] No misleading language remains about `tasks/` being authoritative

## Dependencies

None.

## Risk Level

Low

## Continuation Policy

Auto-continue.

## Agent Notes

### 2026-05-22 System
- Task started via taskforge start TASK-023
- Session: df3163ec20
- Branch: agent/TASK-023-update-readmetasks-docs-to-mark-task-sta--df3163ec20
- Worktree: /Volumes/Transcend/devel/worktrees/TASK-023

### 2026-05-22 Implementer
- `README.md` already correctly identifies task-state as authoritative and tasks/ as legacy — verified no changes needed.
- Updated `tasks/README.md` with a prominent deprecation banner directing to task-state as authoritative source.
- Updated file naming section to reference `task-state/` instead of `tasks/`.
- Verified `taskforge start` workflow works end-to-end: claimed task, created worktree/branch, assigned session.
- Noted: `taskforge done` from main worktree fails ownership check when not on the agent branch — the ownership assertion in done.ts is not guarded by `--force`. This is a minor discoverability issue for single-branch workflows.
