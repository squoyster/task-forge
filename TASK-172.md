---
id: TASK-172
type: Chore
status: Done
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
spec_hash: 2078b3aca7c0f7a5
---
# Add task-forge CLI Alias

## Goal

Support both compact and hyphenated command names.

## Acceptance Criteria

- [x] `package.json` exposes both `taskforge` and `task-forge` as CLI binaries pointing to the same built entrypoint. — Added `"task-forge": "./dist/cli.js"` to bin field in `package.json`. Verified both `node dist/cli.js --version` and `npx task-forge --version` output `0.1.0`.

## Agent Notes

### 2026-05-25 Implementer
- Added `task-forge` bin alias to `package.json`
- Both `taskforge` and `task-forge` resolve to same entrypoint
- All 490 tests pass. Typecheck, lint, and build pass.

### 2026-05-25 System
- Task claimed via taskforge claim TASK-172
- Session: c995746c8a
