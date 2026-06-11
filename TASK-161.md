---
id: TASK-161
type: Bug
status: Done
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
context_hash: abc123def456
spec_hash: 73d5d80ba36dc299
---
# Enforce Audit Event Type Schema

## Goal

Prevent arbitrary event names from degrading audit consistency.

## Acceptance Criteria

- [x] `AuditEventSchema` validates `event` against the defined audit event type registry or an explicitly documented extension namespace rule. — `src/core/audit-schema.ts`: changed `event: z.string()` to `event: z.enum(AUDIT_EVENT_TYPES)`. Added missing event types (`tool.execute`, `permission.requested`, `permission.responded`, `session.started`) to registry. `src/core/audit.ts`: updated `createAuditEvent()` and `createTaskEvent()` signatures to use `AuditEventType` instead of `string`. New test file `tests/audit-schema.test.ts`: 6 tests verifying valid events parse, unknown events reject, all registered types accepted, required fields enforced, optional fields accepted.

## Agent Notes

### 2026-05-25 Implementer
- Changed `AuditEventSchema.event` from `z.string()` to `z.enum(AUDIT_EVENT_TYPES)`
- Added missing event types to registry: `tool.execute`, `permission.requested`, `permission.responded`, `session.started`
- Updated `createAuditEvent()` and `createTaskEvent()` to use `AuditEventType` instead of `string`
- Added `tests/audit-schema.test.ts` with 6 tests for schema validation
- Updated existing test using invalid event type `test.event` to use `task.command.started`
- All 465 tests pass (459 + 6 new). Typecheck and build pass.

### 2026-05-25 System
- Task marked Done
