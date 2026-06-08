---
id: TASK-252
type: Bug
status: Ready
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-252: Normal agents cannot clean up Done task worktrees without --force

## Goal

After a task is marked Done, the agent may wish to clean up the worktree and branch via `taskforge done TASK-ID --cleanup` or `taskforge cleanup TASK-ID`. However, both paths are blocked for normal agents:

1. `taskforge done TASK-ID --cleanup` fails because `done` cannot transition from "Done" to "Done" (the task is already Done)
2. `taskforge cleanup TASK-ID --force` fails because normal agents cannot use `--force` (requires human or doctor authority)

This creates a dead end where stale worktrees accumulate and agents must resort to direct `git worktree remove` and `git branch -D` commands, violating the "no direct git" policy.

## Acceptance Criteria

- [ ] Normal agents can clean up a Done task's worktree and branch without `--force`
- [ ] `taskforge done TASK-ID --cleanup` works when the task is already Done (or a separate cleanup path exists)
- [ ] OR: `taskforge cleanup TASK-ID` (without `--force`) allows normal agents to clean up their own completed tasks
- [ ] No security regression: normal agents cannot use cleanup to interfere with other agents' active tasks

## Agent Notes
