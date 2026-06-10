---
id: TASK-176
type: Documentation
status: Done
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
spec_hash: 110fd470f238db28
---
# Add Documentation for Command Next-Action Semantics

## Goal

Make agent command interpretation stable and learnable.

## Acceptance Criteria

- [x] Documentation exists that enumerates all supported `nextAction.kind` values, their meanings, whether agents may continue, and the expected follow-up commands. — Created `docs/next-action-semantics.md` with table of all 7 nextAction values (priority cascade from summary.ts), decision flow diagram, agent continuation rules, JSON output format, and integration with `taskforge next`.

## Agent Notes

### 2026-05-25 Implementer
- Created `docs/next-action-semantics.md` documenting all nextAction values
- Covers: 7 priority levels, continuation rules, follow-up commands, JSON output, summary vs next comparison
- All 497 tests pass. Typecheck, lint, and build pass.
