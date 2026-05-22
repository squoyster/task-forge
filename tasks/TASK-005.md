---
id: TASK-005
type: Task
status: Inbox
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-005: Add --cleanup flag to done command for worktree/branch removal

## Goal

Add a `--cleanup` flag to `taskforge done` that removes the worktree and optionally deletes the task branch after marking a task complete.

## Background

Currently `taskforge done` only changes the task status. Worktrees and branches accumulate over time. A `--cleanup` flag (and `--delete-branch` for the branch) keeps the repository clean.

## Scope

Allowed files/directories:
- src/commands/done.ts
- src/core/git.ts (if helper needed)
- tests/

Disallowed files/directories:
- .git/**
- package.json

## Acceptance Criteria

- [ ] `taskforge done TASK-005` marks done without cleanup (existing behavior preserved)
- [ ] `taskforge done --cleanup TASK-005` removes the worktree after marking done
- [ ] `taskforge done --cleanup --delete-branch TASK-005` also removes the remote branch
- [ ] Cleanup is safe (no-op) if worktree doesn't exist
- [ ] Error messages are clear if cleanup fails
- [ ] Unit tests cover cleanup success, branch deletion, and missing worktree

## Test / Verification Command

```bash
npm run build && npm test -- --run && taskforge done --cleanup TASK-005
```

## Expected Output / Behavior

- Status change happens first, then cleanup
- If cleanup fails, status change is preserved (not rolled back)
- Worktree and branch paths are cleared from the task frontmatter
- User sees separate status messages for done + cleanup + branch deletion

## Dependencies

None

## Risk Level

Low

## Continuation Policy

Auto-continue unless a stopping condition occurs.
