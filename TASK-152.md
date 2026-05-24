---
id: TASK-152
type: Feature
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
dependsOn:
  - TASK-141
---
# Add Generic Transcript Provider Interface

## Goal

Decouple per-task agentic audit logs from OpenCode.

## Background

OpenCode is the presumptive target, but transcript capture should be generic.

## Acceptance Criteria

- [ ] A generic `TranscriptProvider` or equivalent interface exists for importing or appending session transcript events independent of OpenCode.

## Agent Notes
