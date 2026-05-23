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

## Rationalization Roadmap: TASK-RAT-012\n\n### Objective\nStop silently degrading in multi-agent coordination paths.\n\n### Required policy\nFailurePolicy type: strict | warn | offline. Defaults: claim/start/done/release/block = strict, status/list/summary = warn, explicit --offline = offline.\n\n### Acceptance Criteria\n- Config parse/push/pull failures are visible\n- Agent receives clear next action\n- Offline mode is explicit

## Acceptance Criteria

- [ ]

## Agent Notes
