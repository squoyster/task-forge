---
id: TASK-229
type: Task
status: Implementation Complete
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
assignee: 6bc4775335
claimed_at: '2026-06-15 19:33:13'
context_hash: 86c2d0ddbd80d3ed
spec_hash: 720e20b24cd14e8b
branch: agent/TASK-229-record-worktree-path-in-task-state-durin--6bc4775335
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-229
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

### 2026-06-15T00:00:00Z System
- Report generated — task moved to Implementation Complete
- Changed files: AGENTS.md, dist/chunk-RYDMXDO2.js.map, package-lock.json, src/commands/claim.ts, src/commands/git-facade.ts, src/commands/new.ts, src/commands/resume.ts, src/commands/start.ts, src/commands/sync.ts, src/core/closure-task.ts, src/core/command-result.ts, src/core/command-states.ts, src/core/next-command-maps.ts, src/core/pending-publish.ts, src/core/result-builder.ts, src/core/result-renderer.ts, src/integrations/github/service.ts, src/util/logging.ts, tests/closure-task.test.ts, tests/command-result.test.ts, tests/command-states.test.ts, tests/commands/new.test.ts, tests/git-facade.test.ts, tests/pending-publish.test.ts
- Commits: ba98efd TASK-229: Record worktree path in task-state for claim/resume recovery
- AC section: present
- AC has blank items

### 2026-06-15T00:00:00Z System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-229

### 2026-06-15T00:00:00Z System
- Task claimed via taskforge start TASK-229
- Session: 6bc4775335
- Branch: agent/TASK-229-record-worktree-path-in-task-state-durin--6bc4775335
