---
id: TASK-229
type: Task
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
spec_hash: 720e20b24cd14e8b
---

# TASK-229: Record worktree path in task-state during claim/start

## Goal

Add code to the claim and start commands that writes the worktree location to the task-state entry when a task is claimed. This enables agents to find their worktree after restarts and prevents orphaned worktrees.

Current problem: When an agent session restarts, there's no authoritative record of where the worktree was created. The task-state file doesn't store the worktree path, so 'taskforge resume' cannot locate it and 'taskforge start' fails with push errors.

Implementation:
1. After successful worktree creation in start.ts, write the absolute worktree path to the task frontmatter (e.g., 'worktree: /path/to/worktree')
2. After claim.ts creates a worktree, also record the path
3. Update the task schema to include the worktree field if not already present
4. Add a 'worktree' field to the JSON output of claim and start commands
5. Update resume command to read the worktree path from task-state and validate it exists

Acceptance criteria should verify:
- Worktree path is written to task-state on claim/start
- Path is readable by resume command
- Path appears in JSON output
- Schema validation includes the field

## Acceptance Criteria

- [ ]

## Agent Notes
