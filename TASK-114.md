---
id: TASK-114
type: Maintainability
status: Ready
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-114: Modularize CLI command registration

## Goal

## Rationalization Roadmap: TASK-RAT-011\n\n### Objective\nReduce cli.ts into a small bootstrapper. Move command registration into modules with CliModule interface (id + register).\n\n### Suggested modules\ntaskCommands, workspaceCommands, gateCommands, auditCommands, providerCommands, dependencyCommands, configCommands\n\n### Acceptance Criteria\n- cli.ts only builds app context, registers modules, and parses args\n- Existing command names remain compatible\n- Plugin commands can be registered without editing core CLI

## Acceptance Criteria

- [ ]

## Agent Notes
