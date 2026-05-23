---
id: TASK-120
type: Safety
status: Ready
priority: P2
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
---

# TASK-120: Add strict/warn/offline failure policy

## Goal

Stop silently degrading in multi-agent coordination paths. FailurePolicy: strict | warn | offline. Defaults: claim/start/done = strict, status/list = warn, --offline = offline.

## Background

Rationalization Roadmap: TASK-RAT-012

## Acceptance Criteria

- [ ] Config parse/push/pull failures are visible
- [ ] Agent receives clear next action
- [ ] Offline mode is explicit

## Agent Notes
