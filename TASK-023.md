---
id: TASK-023
type: Docs
status: Ready
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
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

- [ ] `README.md` clearly states task files live in `../task-state/`, not `tasks/` on main
- [ ] Any `tasks/README.md` contains a legacy notice directing readers to `../task-state/`
- [ ] No misleading language remains about `tasks/` being authoritative

## Dependencies

None.

## Risk Level

Low

## Continuation Policy

Auto-continue.
