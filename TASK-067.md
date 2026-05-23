---
id: TASK-067
type: Feature
status: In Progress
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
assignee: 40e4e48127
claimed_at: '2026-05-23 00:53:00'
context_hash: 6eb8f67de42c153d
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-067
---

# TASK-067: Add TaskForge audit service

## Goal

Create core audit service (src/core/audit.ts, audit-schema.ts) used by commands, hooks, and plugins. Implement appendAuditEvent, appendTaskTranscript, readTaskAudit, summarizeTaskAudit. Support event types: task.command.*, task.state.changed, git.commit, git.push, tool.execute.*, file.edited, permission.*, doctor.*, verification.*. CLI: taskforge audit/transcript/timeline TASK-ID with --json. JSONL storage in logs/taskforge/.

## Acceptance Criteria

- [ ]

## Agent Notes

### 2026-05-23 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-067

### 2026-05-23 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-067

### 2026-05-23 System
- Task claimed via taskforge start TASK-067
- Session: 40e4e48127
- Branch: agent/TASK-067-add-taskforge-audit-service--40e4e48127

### 2026-05-23 System
- Task claimed via taskforge start TASK-067
- Session: 40e4e48127
- Branch: agent/TASK-067-add-taskforge-audit-service--40e4e48127
