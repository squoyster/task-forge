---
id: TASK-218
type: Task
status: In Progress
priority: P0
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
assignee: 45283ca690
claimed_at: '2026-05-28 02:25:35'
context_hash: 9ee05952d2d2a685
branch: agent/TASK-218-make-claim-create-worktree-and-return-wo--45283ca690
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-218
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

### 2026-05-28 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-218

### 2026-05-28 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-218

### 2026-05-28 System
- Task claimed via taskforge start TASK-218
- Session: 45283ca690
- Branch: agent/TASK-218-make-claim-create-worktree-and-return-wo--45283ca690
