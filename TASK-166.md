---
id: TASK-166
type: Bug
status: Done
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
dependsOn:
  - TASK-165
context_hash: abc123def456
spec_hash: 54ad96c63129cb45
---
# Emit Audit Event for PR Command

## Goal

Ensure PR creation attempts are traceable.

## Acceptance Criteria

- [x] `taskforge pr TASK-ID` appends a task transcript event for PR creation success, failure, or manual-provider-required outcome. — `src/core/audit-schema.ts`: added `github.pr.failed` event type. `src/commands/git-facade.ts`: `cmdPr` now emits `github.pr.created` on success (with PR number and URL in metadata), `github.pr.failed` on API failure (with error message), and `github.pr.manual` when GitHub is not configured. All outcomes append to task transcript via `appendTaskTranscript()`. All 495 tests pass.

## Agent Notes

### 2026-05-25 Implementer
- Added `github.pr.failed` audit event type
- Wrapped PR creation in try/catch to emit failure event
- All three outcomes (success, failure, manual) now emit audit events
- All 495 tests pass. Typecheck, lint, and build pass.

### 2026-05-25 System
- Task marked Done
