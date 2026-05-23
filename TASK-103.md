---
id: TASK-103
type: Feature
status: Ready
priority: P0
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-103: Implement per-task agentic audit logs

## Goal

## Rationalization Roadmap: TASK-RAT-004

### Objective
Add durable per-task audit logs for agentically performed work. Must be generic — OpenCode /export should be supported through an adapter, but the audit model must not depend on OpenCode.

### Required audit model
- AuditEvent schema: id, taskId, timestamp, actor, source (cli/agent/provider/system), eventType, command, statusBefore/After, summary, data
- Event types: task.created/claimed/started/heartbeat/blocked/released/rejected/completed/transitioned, workspace/created/removed, git.command.*, gate.*, bug.created_from_failure, transcript.*, provider.sync.*

### Storage
Location must be explicit in config and documented. Default: either ../task-state/audit/TASK-NNN/ or .taskforge/audit/TASK-NNN/

### CLI commands
- taskforge audit TASK-NNN --json
- taskforge timeline TASK-NNN
- taskforge transcript TASK-NNN
- taskforge transcript attach TASK-NNN --file path/to/export.md --provider opencode
- taskforge transcript request TASK-NNN

### Acceptance Criteria
- Every state-changing command writes at least one audit event
- Gate command writes pass/fail events
- Transcript attachment is supported generically
- taskforge audit TASK-ID --json returns structured events
- taskforge timeline TASK-ID returns concise human-readable timeline
- Audit write failure is visible and produces next-action guidance

### Agent next-action rules
- At task completion, agent must attach or reference session transcript
- If transcript export unavailable, agent must record audit event stating why
- If audit write fails, agent must stop before marking task done

## Acceptance Criteria

- [ ]

## Agent Notes
