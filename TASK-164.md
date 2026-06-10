---
id: TASK-164
type: Feature
status: Done
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
context_hash: abc123def456
spec_hash: abdddc3f5e008057
---
# Validate Audit JSONL Parseability in Doctor

## Goal

Catch corrupted audit/transcript files.

## Acceptance Criteria

- [x] `taskforge doctor --json` reports invalid JSONL lines in audit or transcript files with file path and line number. — `src/core/audit.ts`: added `validateJsonlFiles()` function that recursively finds all `.jsonl` files under `logs/taskforge/`, parses each line, and returns `JsonlValidationIssue[]` with `filePath`, `line`, `content`, and `reason` ("parse_error" or "schema_error"). `src/commands/doctor.ts`: calls `validateJsonlFiles(repoRoot)` and reports issues as warnings with code `JSONL_CORRUPT`, including relative file path and line number. Issues appear in both human output and JSON output. New tests in `tests/audit.test.ts`: 6 tests for `validateJsonlFiles` (valid files return no issues, parse errors reported, schema errors reported, correct line numbers for multiple errors, empty for non-existent directory, finds JSONL in nested task directories). All 494 tests pass.

## Agent Notes

### 2026-05-25 Implementer
- Added `validateJsonlFiles()` function to `src/core/audit.ts` that recursively scans all `.jsonl` files
- Returns `JsonlValidationIssue[]` with filePath, line number, content snippet, and reason
- Updated `cmdDoctor` to call `validateJsonlFiles()` and report issues as warnings
- Added 6 new tests for JSONL validation
- All 494 tests pass. Typecheck, lint, and build pass.

### 2026-05-25 System
- Task marked Done
