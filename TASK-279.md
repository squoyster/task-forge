---
id: TASK-279
type: Bug
status: Ready
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
spec_hash: 5571d11e576257bd
---

# TASK-279: Handle gate-dirtied worktrees in done command

## Goal

The done command requires a clean worktree before marking a task done. However, the gates (runGates) include npm run build which creates dist/ files in the worktree. These gate artifacts make the worktree appear dirty, blocking done.

The worktree must be clean before done can proceed, but gates are the source of dirtiness. This creates a catch-22.

Solutions:
1. Run gates against a temp directory or the main repo, not the worktree
2. Add gate artifacts (dist/) to worktree-level gitignore
3. Allow done to proceed when the only dirtiness comes from expected gate artifacts
4. Add --force flag to bypass worktree dirtiness check in done

## Acceptance Criteria

- [ ]

## Agent Notes
