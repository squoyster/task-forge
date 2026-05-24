---
id: TASK-161
type: Bug
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---
# Enforce Audit Event Type Schema

## Goal

Prevent arbitrary event names from degrading audit consistency.

## Acceptance Criteria

- [ ] `AuditEventSchema` validates `event` against the defined audit event type registry or an explicitly documented extension namespace rule.

## Agent Notes
