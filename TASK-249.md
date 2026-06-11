---
id: TASK-249
type: Feature
status: Ready
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-249: Install dependencies and build CLI in task worktrees during claim/start

## Goal

When `taskforge claim` or `taskforge start` creates a worktree, the worktree lacks `node_modules` and `dist/`. Running `taskforge` CLI commands from inside the worktree fails because neither the binary nor its dependencies are available. Agents must manually symlink or install, which is fragile and undocumented.

## Acceptance Criteria

- [ ] After `claim` or `start` creates a worktree, `node_modules` is symlinked from the main repo (or installed) so CLI commands work immediately
- [ ] After `claim` or `start`, the `dist/` build output is available (either by symlink or by running the build step)
- [ ] `npx taskforge done TASK-ID` works from inside the worktree directory without manual setup
- [ ] No adverse side effects on existing worktree lifecycle or cleanup

## Agent Notes
