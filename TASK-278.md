---
id: TASK-278
type: Feature
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
spec_hash: f60681797210b288
---

# TASK-278: Add orphaned worktree cleanup capability

## Goal

When a worktree exists on disk (in git worktree list) but its corresponding task's frontmatter doesn't reference it (worktree/branch fields are missing or stale), there is no taskforge command to remove it. The worktree blocks taskforge start for new tasks via checkUncommittedWorktrees.

Add a command or extend doctor to detect and clean up orphaned worktrees. Options:
1. taskforge doctor --repair that auto-detects and prunes orphaned worktrees
2. taskforge cleanup --orphaned that removes disk-only worktrees
3. Extend done --cleanup to handle orphaned worktrees

Must use git worktree remove --force for dirty worktrees.

## Acceptance Criteria

- [ ]

## Agent Notes
