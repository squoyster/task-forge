---
id: TASK-168
type: Bug
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
---
# Fail Clearly on Invalid Config Instead of Returning Defaults

## Goal

Prevent silent misconfiguration.

## Background

`loadConfig()` currently catches all parse/validation failures and returns defaults. This hides invalid policy values.

## Acceptance Criteria

- [ ] `loadConfig()` surfaces invalid JSON or schema validation errors clearly instead of silently returning default config, except in an explicit documented fallback mode.

## Agent Notes
