---
id: TASK-307
type: Task
status: Implementation Complete
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
assignee: 61e7aaf23d
claimed_at: '2026-06-20 06:47:16'
context_hash: 86c2d0ddbd80d3ed
spec_hash: e46359db69cb851c
branch: agent/TASK-307-slimming-refactor-01-discard-task-306-an--61e7aaf23d
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-307
---

# TASK-307: Slimming Refactor 01: Discard TASK-306 and confirm clean main
## Goal
Establish a clean starting point for the TaskForge slimming refactor by discarding the in-progress TASK-306 worktree (which extends the very commands being removed).

## Background
TASK-306 extended git-facade.ts (checkpoint/submit/pr/diff) with branch-behind validation, SHA recording, and PR auto-creation. A code review found 4 bugs and 5 structural issues. Since this refactor removes those facade commands entirely, TASK-306's work is moot. See specs/taskforge-slimming-refactor.md.

## Scope
- Run 'taskforge done TASK-306 --delete-branch' (or discard) to remove the worktree and branch.- Verify main is clean: 'git status' clean, no stray TASK-306 artifacts.- Confirm specs/taskforge-slimming-refactor.md exists on main.

## Acceptance Criteria
- TASK-306 worktree removed.- Branch deleted.- 'git status' on main is clean.- Slimming refactor spec present.

## Test / Verification Command
git worktree list (no TASK-306 entry); git branch --list (no TASK-306 branch); test -f specs/taskforge-slimming-refactor.md

## Expected Output / Behavior
Clean main, no TASK-306 traces, spec file present.

## Dependencies
None (first task).

## Risks
Known risks.

## Continuation Policy
Auto-continue unless a stopping condition occurs.

## Agent Notes

### 2026-06-20T00:00:00Z System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-307

### 2026-06-20T00:00:00Z System
- Task claimed via taskforge start TASK-307
- Session: 61e7aaf23d
- Branch: agent/TASK-307-slimming-refactor-01-discard-task-306-an--61e7aaf23d

## Result

## Links
- Issue:
- Project Item:
- PR:
- Branch:
- Worktree:
- CI:
- Test Log:
