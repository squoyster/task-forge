---
id: TASK-143
type: Feature
status: In Progress
priority: P0
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
dependsOn:
  - TASK-142
assignee: 8bbc273d71
claimed_at: '2026-05-24 02:04:15'
context_hash: 3a03a0322eb9729c
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-143
---
# Add Upstream Failure Classification to Gates

## Goal

Support the workflow where a broken test suite or unrelated failure becomes a new bug task.

## Background

Agents need an explicit path when the failing condition is not caused by the current task.

## Implementation Notes

Possible interface:

```bash
taskforge gates --json --classify-upstream "reason text"
```

or a follow-up command:

```bash
taskforge gates classify-upstream TASK-ID --reason "..."
```

Pick the cleanest design consistent with the CLI.

## Acceptance Criteria

- [ ] A gates failure can be explicitly classified as upstream, causing JSON output to emit `nextAction.kind = "CREATE_BUG_TASK_AND_CONTINUE"` with an instruction to create a bug task and continue only if safe.

## Agent Notes

### 2026-05-24 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-143

### 2026-05-24 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-143

### 2026-05-24 System
- Task claimed via taskforge start TASK-143
- Session: 8bbc273d71
- Branch: agent/TASK-143-task-143--8bbc273d71

### 2026-05-24 System
- Task claimed via taskforge start TASK-143
- Session: 8bbc273d71
- Branch: agent/TASK-143-task-143--8bbc273d71
