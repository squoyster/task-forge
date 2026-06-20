---
id: TASK-008
type: Task
status: Done
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
spec_hash: 86d584c82b7437fb
branch: agent/TASK-008-command-test-coverage
worktree: ../worktrees/TASK-008
issue: 68
---

# TASK-008: Implement command-level test coverage

## Goal

Add comprehensive unit tests for all CLI command implementations (status, summary, next, done, init, block) using mocked file I/O and task data.

## Background

The current test suite covers core logic (scheduler, status transitions, task model, task store, config, errors, paths, exec) but has no tests for the command implementations. This makes refactoring commands risky.

## Scope

Allowed files/directories:
- tests/
- src/commands/ (read-only reference)

Disallowed files/directories:
- src/commands/ (no modifications — testing only)
- .git/**
- package.json

## Acceptance Criteria

- [x] Tests exist for: status, summary, next, done, init, block, sync commands
- [x] Logging output is verifiable (capture log calls or inspect console)
- [x] Edge cases covered: empty task list, missing files, invalid IDs, transition errors
- [x] Sync command tests mock GitHub API calls (no real network)
- [x] All 9 existing test files continue to pass
- [x] No modification to source files (tests only)

## Test / Verification Command

```bash
npm run build && npm test -- --run
```

## Expected Output / Behavior

- Each command module has a corresponding test file: `tests/commands/status.test.ts`, etc.
- Tests use the `makeTaskFile` pattern (temp directories) for file I/O tests
- GitHub API calls are mocked via vi.mock or similar
- Test count increases measurably (target: 50+ new test cases)

## Dependencies

None

## Risk Level

Low

## Continuation Policy

Auto-continue unless a stopping condition occurs.

## Agent Notes

### 2026-05-22 Implementer
- Added 7 command-level test files under tests/commands/ with 52 test cases total
- tests/commands/status.test.ts (9 tests): empty, with tasks, JSON mode, Review/Verify, Blocked, Inbox, Needs Spec, Completed sections
- tests/commands/summary.test.ts (10 tests): empty, various statuses, JSON mode, next-action recommendations
- tests/commands/next.test.ts (10 tests): empty, no actionable, selects In Progress > Ready, selects P0, shows score/goal/file, Verify/Review priority
- tests/commands/done.test.ts (5 tests): basic done, force flag, invalid transition, agent note logging
- tests/commands/init.test.ts (6 tests): creates files/dirs, preserves existing, recreates missing
- tests/commands/block.test.ts (5 tests): marks blocked with reason, invalid transitions, agent note logging
- tests/commands/sync.test.ts (7 tests): creates/updates issues, GitHub disabled, error handling, P0 labels, frontmatter writing
- All tests use temp directories (makeTaskFile pattern) and mock GitHub API calls
- No source files were modified — tests only
- Verification: typecheck, lint, build, all 174 tests pass (18 test files)
