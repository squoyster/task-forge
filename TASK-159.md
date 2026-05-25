---
id: TASK-159
type: Bug
status: Done
priority: P1
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
dependsOn:
  - TASK-152
context_hash: 6293e97a7b29e75c
---
# Stop Silently Swallowing Audit Write Failures

## Goal

Make audit failure visible.

## Acceptance Criteria

- [x] Audit write failures are reported through a visible diagnostic path unless audit failure suppression is explicitly enabled in config. — `src/core/audit-plugin.ts` `generateAuditPlugin()`: `writeAuditEvent()` catch block now logs `console.error` with `[taskforge-audit] Failed to write audit event: <message>` unless `TASKFORGE_SUPPRESS_AUDIT_FAILURES=true` env var is set. Tests in `tests/plugins.test.ts`: "generated plugin reports write failures visibly" verifies console.error call, "generated plugin supports audit failure suppression via env var" verifies TASKFORGE_SUPPRESS_AUDIT_FAILURES check.

## Agent Notes

### 2026-05-25 System
- Task claimed via taskforge start TASK-159
- Session: 5f3875c365
- Branch: agent/TASK-159-task-159--5f3875c365

### 2026-05-25 Implementer
- Updated `writeAuditEvent()` in generated audit plugin to log errors via `console.error` instead of silently swallowing exceptions
- Added `TASKFORGE_SUPPRESS_AUDIT_FAILURES` env var check to allow opt-out of failure reporting
- Added 2 tests verifying visible error reporting and suppression support
- All 18 plugin tests pass. Typecheck and build pass.

### 2026-05-25 System
- Task marked Done
