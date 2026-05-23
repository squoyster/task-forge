---
id: TASK-114
type: Safety
status: Ready
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-114: Add strict/warn/offline failure policy

## Goal

## Rationalization Roadmap: TASK-RAT-012

### Objective
Stop silently degrading in multi-agent coordination paths. FailurePolicy: strict | warn | offline. Defaults: claim/start/done = strict, status/list = warn, --offline = offline.

### Acceptance Criteria
- Config parse/push/pull failures are visible
- Agent receives clear next action
- Offline mode is explicit

## Acceptance Criteria

- [ ]

## Agent Notes
