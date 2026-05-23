---
id: TASK-062
type: Feature
status: In Progress
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
assignee: c549be761b
claimed_at: '2026-05-23 00:37:27'
context_hash: 6eb8f67de42c153d
---

# TASK-062: Add agent framework initialization architecture

## Goal

Create an adapter-based initialization subsystem so taskforge init can install agent-framework-specific policy files. Define AgentFrameworkAdapter interface (detect, plan, apply, doctor) in src/agent-frameworks/. Support generic and opencode adapters at minimum. Extend taskforge init with --agent-framework (opencode/generic/auto) and --policy (permissive/managed/locked-down). Default: --agent-framework auto --policy managed.

## Acceptance Criteria

- [ ]

## Agent Notes

### 2026-05-23 System
- Task claimed via taskforge start TASK-062
- Session: c549be761b
- Branch: agent/TASK-062-add-agent-framework-initialization-archi--c549be761b

### 2026-05-23 System
- Task claimed via taskforge start TASK-062
- Session: c549be761b
- Branch: agent/TASK-062-add-agent-framework-initialization-archi--c549be761b
