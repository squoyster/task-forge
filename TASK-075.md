---
id: TASK-075
type: Feature
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-075: Extend config schema for agent framework integration

## Goal

Add agentFramework section to .taskforge/config.json with zod validation. Shape: agentFramework.id (opencode|generic), .policy (permissive|managed|locked-down), .installHooks, .audit, .guard, .policyVersion. Apply sensible defaults. Make config available to init, doctor, audit, hooks, and generated plugin templates. Support future frameworks without schema churn. Existing configs without agentFramework must load with defaults. Invalid policy values fail clearly. AC: config load, defaulting, validation, save all tested.

## Acceptance Criteria

- [ ]

## Agent Notes
