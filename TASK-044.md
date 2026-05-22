---
id: TASK-044
type: Chore
status: Ready
priority: P3
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-044: Remove Legacy `tasks/` Directory from Main

## Goal

Remove the deprecated `tasks/` directory from the `main` branch. Task files have lived on the `task-state` branch since TASK-013, and `tasks/README.md` already carries a deprecation notice. The old task files on main are stale copies that create confusion.

## Scope

- Remove `tasks/*.md` files from `main` (keep `tasks/README.md` or move its deprecation note to root)
- Update `README.md` Structure section to remove the `tasks/` line
- Ensure `taskforge init` doesn't reference `tasks/`

## Acceptance Criteria

- [ ] No `tasks/*.md` task files remain on `main`
- [ ] README structure diagram updated
- [ ] All existing tests pass
- [ ] `taskforge init` still works (doesn't depend on `tasks/`)

## Risk Level

Low — cleanup only, no functional change.

## Continuation Policy

Auto-continue.
