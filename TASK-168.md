---
id: TASK-168
type: Bug
status: Done
priority: P1
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
context_hash: abc123def456
spec_hash: 13a10fc50ace0572
---
# Fail Clearly on Invalid Config Instead of Returning Defaults

## Goal

Prevent silent misconfiguration.

## Background

`loadConfig()` currently catches all parse/validation failures and returns defaults. This hides invalid policy values.

## Acceptance Criteria

- [x] `loadConfig()` surfaces invalid JSON or schema validation errors clearly instead of silently returning default config, except in an explicit documented fallback mode. — `src/core/config.ts`: `loadConfig()` now throws descriptive errors for invalid JSON (`Invalid JSON in config file <path>: <message>`) and schema validation failures (`Invalid config schema in <path>: <message>`). Returns `DEFAULT_CONFIG` only when config file does not exist. Updated test in `tests/config.test.ts`: replaced "returns DEFAULT_CONFIG on invalid JSON" with "throws on invalid JSON" and added "throws on invalid schema" test. All 496 tests pass.

## Agent Notes

### 2026-05-25 Implementer
- Changed `loadConfig()` to throw errors on invalid JSON or schema validation
- Returns DEFAULT_CONFIG only when config file does not exist
- Added tests for both error cases
- All 496 tests pass. Typecheck, lint, and build pass.

### 2026-05-25 System
- Task marked Done
