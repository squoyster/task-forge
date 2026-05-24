---
id: TASK-162
type: Refactor
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
---
# Route Doctor Agent Diagnostics Through Agent Framework Adapter

## Goal

Remove hardcoded OpenCode-specific checks from generic doctor flow.

## Acceptance Criteria

- [ ] `taskforge doctor` invokes the configured `AgentFrameworkAdapter.doctor()` for agent-framework-specific diagnostics instead of duplicating OpenCode checks in `cmdDoctor`.

## Agent Notes
