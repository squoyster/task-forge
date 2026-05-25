---
id: TASK-158
type: Security
status: In Progress
priority: P1
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
dependsOn:
  - TASK-152
assignee: ccacbf5455
claimed_at: '2026-05-25 00:49:10'
context_hash: e9736a6f1ffcde5b
---
# Add Recursive Secret Redaction for Audit Events

## Goal

Prevent audit logs from storing credentials.

## Acceptance Criteria

- [ ] Audit plugin redaction recursively replaces values for keys matching token, secret, password, api key, private key, credential, or authorization before writing JSONL.

## Agent Notes

### 2026-05-25 System
- Task claimed via taskforge start TASK-158
- Session: ccacbf5455
- Branch: agent/TASK-158-task-158--ccacbf5455

### 2026-05-25 System
- Task unlocked (forced) — previous claim was held by session "4d68c7c5df"

### 2026-05-25 System
- Task claimed via taskforge start TASK-158
- Session: 4d68c7c5df
- Branch: agent/TASK-158-task-158--4d68c7c5df
