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

- [x] Audit plugin redaction recursively replaces values for keys matching token, secret, password, api key, private key, credential, or authorization before writing JSONL. — `src/core/audit-plugin.ts` `redactSecrets()`: recursive function that traverses objects/arrays, checks keys against SECRET_PATTERNS (TOKEN, SECRET, PASSWORD, API_KEY, PRIVATE_KEY, CREDENTIAL, AUTHORIZATION, etc.), replaces matching values with `[REDACTED]`. `writeAuditEvent()`: calls `redactSecrets(event)` before `JSON.stringify`. Tests in `tests/plugins.test.ts`: "generated redaction is recursive" verifies recursive call, "generated redaction covers all secret patterns" verifies all patterns present, "generated writeAuditEvent applies redaction before writing" verifies redaction is applied.

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

### 2026-05-25 Implementer
- Replaced shallow `redactSecrets()` with recursive version that traverses nested objects and arrays
- Added SECRET_PATTERNS constant covering: TOKEN, SECRET, PASSWORD, API_KEY, PRIVATE_KEY, CREDENTIAL, AUTHORIZATION, AUTH_TOKEN, ACCESS_KEY
- `writeAuditEvent()` now calls `redactSecrets(event)` before JSON.stringify
- Added 3 tests verifying recursive redaction, pattern coverage, and pre-write application
- All 13 plugin tests pass. Typecheck and build pass.
