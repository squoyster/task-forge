---
id: TASK-158
type: Security
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
dependsOn:
  - TASK-152
---
# Add Recursive Secret Redaction for Audit Events

## Goal

Prevent audit logs from storing credentials.

## Acceptance Criteria

- [ ] Audit plugin redaction recursively replaces values for keys matching token, secret, password, api key, private key, credential, or authorization before writing JSONL.

## Agent Notes
