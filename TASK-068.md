---
id: TASK-068
type: Feature
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-068: Add OpenCode audit plugin generation

## Goal

Generate .opencode/plugins/taskforge-audit.ts that captures per-session and per-task audit transcripts as JSONL. Listen to session/tool/file/permission events. Resolve TASK-ID from env var, branch name, or worktree path. Redact tokens/secrets/passwords. Write to logs/taskforge/sessions/ and logs/taskforge/tasks/. Configurable via taskforge.audit setting.

## Acceptance Criteria

- [ ]

## Agent Notes
