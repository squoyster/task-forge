---
id: TASK-163
type: Feature
status: Done
priority: P1
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
dependsOn:
  - TASK-162
context_hash: abc123def456
---
# Implement Doctor Fix Mode

## Goal

Make `--fix` perform repairs rather than being a no-op.

## Acceptance Criteria

- [x] `taskforge doctor --fix` repairs at least one missing or stale managed agent-framework artifact and reports the repair in both human and JSON output. — `src/core/agent-framework-adapter.ts`: added `DoctorRepair` interface and `fix()` method to `AgentFrameworkAdapter`. `OpenCodeAgentFrameworkAdapter.fix()` repairs missing AGENTS.md, incomplete opencode.json permissions, and creates audit directory. `src/commands/doctor.ts`: calls `adapter.fix(repoRoot)` when `options.fix` is true, adds repairs to `ok` list, includes `repairs` array and count in JSON output, and shows "## Repairs" section in human output. New tests in `tests/agent-framework-adapter.test.ts`: 9 new tests for fix functionality (creates missing AGENTS.md, adds missing managed block, no-repair when valid, creates missing opencode.json, repairs incomplete permissions, creates audit directory, no-repair when everything valid, doctor-after-fix shows no issues). All 488 tests pass.

## Agent Notes

### 2026-05-25 Implementer
- Added `DoctorRepair` interface and `fix()` method to `AgentFrameworkAdapter`
- Implemented `OpenCodeAgentFrameworkAdapter.fix()` to repair AGENTS.md, opencode.json, and audit directory
- Implemented `GenericAgentFrameworkAdapter.fix()` as no-op
- Updated `cmdDoctor` to call `adapter.fix()` when `--fix` is passed
- Added repairs to both human output ("## Repairs" section) and JSON output (`repairs` array)
- Added 9 new tests for fix functionality
- All 488 tests pass. Typecheck, lint, and build pass.

### 2026-05-25 System
- Task marked Done
