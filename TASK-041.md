---
id: TASK-041
type: Bug
status: Done
priority: P1
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
spec_hash: 024a63f747eec202
issue: 101
---

# TASK-041: Qualify Worktree Paths with Project Name

## Goal

Prevent worktree naming collisions when multiple projects share the same parent directory. Currently worktrees are placed at `../worktrees/TASK-NNN`, which would collide if two projects (`task-forge` and `other-project`) both have a `TASK-001`.

## Background

The current layout:
```
/Volumes/Transcend/devel/
  task-forge/              ← main repo
  worktrees/TASK-001/       ← collision risk!
  other-project/
  worktrees/TASK-001/       ← same name, different project!
```

This is fine for a single project but breaks when multiple repos share the parent directory.

## Fix

Qualify worktree paths with the repo name:
```
/Volumes/Transcend/devel/
  task-forge/
  worktrees/task-forge/TASK-001/
  other-project/
  worktrees/other-project/TASK-001/
```

Changes needed:
- `src/util/paths.ts` — `getWorktreesDir()` and `getWorktreePath()` should include the repo directory name
- `src/core/git.ts` — worktree creation/removal already uses `getWorktreePath()`, so path changes cascade

## Acceptance Criteria

- [ ] `getWorktreePath(repoRoot, taskId)` includes project name: `../worktrees/<project>/TASK-NNN`
- [ ] `getWorktreesDir(repoRoot)` returns `../worktrees/<project>/`
- [ ] `taskforge start` creates worktrees under the qualified path
- [ ] `taskforge inspect` resolves the qualified path
- [ ] `taskforge cleanup` resolves the qualified path
- [ ] `taskforge done --cleanup` removes from the qualified path
- [ ] All existing tests pass

## Dependencies

TASK-013 (task-state paths)

## Risk Level

Medium — changes the worktree path resolution that multiple commands depend on.

## Continuation Policy

Auto-continue.

## Agent Notes

### 2026-05-22 System
- Task marked Done (forced)

### 2026-05-22 System
- Task started via taskforge start TASK-041
- Session: edea019545
- Branch: agent/TASK-041-qualify-worktree-paths-with-project-name--edea019545
- Worktree: /Volumes/Transcend/devel/worktrees/TASK-041
