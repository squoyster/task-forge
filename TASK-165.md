---
id: TASK-165
type: Refactor
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
---
# Replace Direct gh Usage in PR Command

## Goal

Remove hard dependency on GitHub CLI from the task git facade.

## Acceptance Criteria

- [ ] `cmdPr` no longer directly executes `gh` and instead delegates PR creation to a configured provider abstraction or emits a manual PR next action when no provider is configured.

## Agent Notes
