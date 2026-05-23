---
id: TASK-062
type: Feature
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-062: Add agent framework initialization architecture

## Goal

Create an adapter-based initialization subsystem so taskforge init can install agent-framework-specific policy files. Define AgentFrameworkAdapter interface (detect, plan, apply, doctor) in src/agent-frameworks/. Support generic and opencode adapters at minimum. Extend taskforge init with --agent-framework (opencode/generic/auto) and --policy (permissive/managed/locked-down). Default: --agent-framework auto --policy managed.

## Acceptance Criteria

- [ ]

## Agent Notes
