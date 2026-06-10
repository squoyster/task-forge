---
id: TASK-171
type: Documentation
status: Done
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
spec_hash: b2981af951685e62
---
# Add Extension Methodology Checklist

## Goal

Tell users how to add new integrations correctly.

## Acceptance Criteria

- [x] The extension documentation includes a checklist for adding a new provider without modifying core domain logic. — Added "Extension Methodology Checklist" section to `docs/agent-framework-integration.md` with 6-step checklist (adapter implementation, registration, audit events, generated files, tests, documentation) and explicit rules about what to modify vs. not modify.

## Agent Notes

### 2026-05-25 Implementer
- Added comprehensive checklist to `docs/agent-framework-integration.md`
- Checklist covers: adapter implementation, registration, audit events, generated files, tests, documentation
- Includes explicit rules: do not modify core domain logic (task.ts, task-store.ts, status-transition.ts, commands)
- All 490 tests pass. Typecheck, lint, and build pass.
