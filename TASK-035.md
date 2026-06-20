---
id: TASK-035
type: Feature
status: Done
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
spec_hash: 0b54b6d401f29c68
issue: 95
---

# TASK-035: Add `new` Command — Create Arbitrary Task Files

## Goal

Add `taskforge new "Title"` that creates a properly-formatted task Markdown file in `task-state/` with correct frontmatter and auto-incremented ID — replacing the current manual file-writing process.

## Background

Currently, creating a new task requires manually writing a `.md` file with YAML frontmatter in the task-state worktree. There is no CLI command for this — unlike `taskforge deps create-tasks` which creates tasks from dependency findings. Every new task in TASK-023 through TASK-034 was created by hand.

## Usage

```bash
taskforge new "Proactive Git Pull Before Reading Task-State" \
  --type Feature \
  --priority P1 \
  --agent-role Implementer
```

## Acceptance Criteria

- [ ] `taskforge new "Title"` creates a task file with auto-incremented ID (e.g., TASK-035)
- [ ] Accepts `--type` (Feature, Task, Bug, Chore, etc.) — defaults to "Task"
- [ ] Accepts `--priority` (P0-P3) — defaults to "P2"
- [ ] Accepts `--agent-role` — defaults to "Implementer"
- [ ] Accepts `--body` — additional body text beyond the title
- [ ] Writes file to task-state worktree with proper YAML frontmatter
- [ ] Auto-commits and pushes to task-state
- [ ] `--json` output returns the created task ID and file path
- [ ] Tests cover: creation, ID increment, duplicate title handling

## Dependencies

None.

## Risk Level

Low.

## Continuation Policy

Auto-continue.

## Agent Notes

### 2026-05-22 System
- Task started via taskforge start TASK-035
- Session: 43e61b982c
- Branch: agent/TASK-035-add-new-command-create-arbitrary-task-fi--43e61b982c
- Worktree: /Volumes/Transcend/devel/worktrees/TASK-035
