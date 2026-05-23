---
id: TASK-101
type: Feature
status: Ready
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-101: Add audit log to taskforge init command

## Goal

## Goal
Record all steps of taskforge init to an audit log (logs/taskforge/audit/init-YYYY-MM-DD.jsonl). Each entry records timestamp, step name, outcome, detail (with credentials elided), and duration from session start.

## Scope
- src/core/init-audit.ts
- src/commands/init.ts

## Acceptance Criteria
- [ ] InitAuditLog class records timestamped entries
- [ ] Credentials elided from audit output (ghp_, gho_, github_pat_, API keys, hex tokens)
- [ ] Audit file written to logs/taskforge/audit/init-YYYY-MM-DD.jsonl
- [ ] Audit summary printed at end of init ('X steps: N success, M warnings, K errors')

## Acceptance Criteria

- [ ]

## Agent Notes
