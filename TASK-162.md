---
id: TASK-162
type: Refactor
status: Done
priority: P1
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
context_hash: abc123def456
spec_hash: 3cf2f6986219885a
---
# Route Doctor Agent Diagnostics Through Agent Framework Adapter

## Goal

Remove hardcoded OpenCode-specific checks from generic doctor flow.

## Acceptance Criteria

- [x] `taskforge doctor` invokes the configured `AgentFrameworkAdapter.doctor()` for agent-framework-specific diagnostics instead of duplicating OpenCode checks in `cmdDoctor`. — `src/core/agent-framework-adapter.ts`: new `AgentFrameworkAdapter` interface with `doctor()` method, `OpenCodeAgentFrameworkAdapter` implementation (AGENTS.md managed block, opencode.json permissions, audit directory checks), `GenericAgentFrameworkAdapter` (no-op), and `getAgentFrameworkAdapter()` factory. `src/commands/doctor.ts`: refactored to load config, instantiate adapter via `config.agentFramework?.id`, and invoke `adapter.doctor(repoRoot)` instead of hardcoded OpenCode checks. Removed unused `path` import and local `DoctorIssue` interface (now imported from adapter module). New test file `tests/agent-framework-adapter.test.ts`: 14 tests covering GenericAdapter (no issues), OpenCodeAdapter (missing/present AGENTS.md, missing/valid/incomplete opencode.json, audit directory), and factory function. All 479 tests pass. Typecheck, lint, and build pass.

## Agent Notes

### 2026-05-25 Implementer
- Created `src/core/agent-framework-adapter.ts` with `AgentFrameworkAdapter` interface, `OpenCodeAgentFrameworkAdapter`, `GenericAgentFrameworkAdapter`, and `getAgentFrameworkAdapter()` factory
- Refactored `src/commands/doctor.ts` to use adapter instead of hardcoded OpenCode checks (sections 8, 9, 11 removed from doctor, delegated to adapter)
- Removed unused `path` import and local `DoctorIssue` interface from doctor.ts
- Added `tests/agent-framework-adapter.test.ts` with 14 tests
- All 479 tests pass. Typecheck, lint, and build pass.

### 2026-05-25 System
- Task marked Done
