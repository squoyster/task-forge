---
id: TASK-218
type: Task
status: Ready
priority: P0
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-218: Make claim create worktree and return workspace path in all task commands

## Goal

Currently `taskforge claim` only sets assignee/claimed_at but does NOT create a worktree. The agent has no workspace to work in after claiming.

Fix:
1. `taskforge claim` should create a worktree (like `start` does) and return the worktree path
2. Every command that touches a task should return the relevant worktree path in its output so the agent always knows where to work
3. If a worktree already exists, return the existing path instead of creating a duplicate
4. JSON output from all task commands should include `workspace: { worktree, branch }` field
5. Terminal output should always display the worktree path after claiming/starting

Commands to update: claim, start, next, resume, status (for active tasks), summary

## Acceptance Criteria

- [ ]

## Agent Notes
