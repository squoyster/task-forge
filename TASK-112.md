---
id: TASK-112
type: Maintenance
status: Ready
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-112: Modularize CLI command registration

## Goal

Reduce cli.ts into a small bootstrapper and move command registration into modules. Suggested modules: taskCommands, workspaceCommands, gateCommands, auditCommands, providerCommands, dependencyCommands, configCommands.

## Background

Rationalization Roadmap: TASK-RAT-011

## Acceptance Criteria

- [ ] cli.ts only builds app context, registers modules, and parses args
- [ ] Existing command names remain compatible
- [ ] Plugin commands can be registered without editing core CLI bootstrap

## Agent Notes
