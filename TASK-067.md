---
id: TASK-067
type: Feature
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-067: Add TaskForge audit service

## Goal

Create core audit service (src/core/audit.ts, audit-schema.ts) used by commands, hooks, and plugins. Implement appendAuditEvent, appendTaskTranscript, readTaskAudit, summarizeTaskAudit. Support event types: task.command.*, task.state.changed, git.commit, git.push, tool.execute.*, file.edited, permission.*, doctor.*, verification.*. CLI: taskforge audit/transcript/timeline TASK-ID with --json. JSONL storage in logs/taskforge/.

## Acceptance Criteria

- [ ]

## Agent Notes
