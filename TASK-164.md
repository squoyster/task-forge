---
id: TASK-164
type: Feature
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---
# Validate Audit JSONL Parseability in Doctor

## Goal

Catch corrupted audit/transcript files.

## Acceptance Criteria

- [ ] `taskforge doctor --json` reports invalid JSONL lines in audit or transcript files with file path and line number.

## Agent Notes
