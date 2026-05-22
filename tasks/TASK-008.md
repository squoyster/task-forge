---
id: TASK-008
type: Task
status: Inbox
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
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

- [ ] Tests exist for: status, summary, next, done, init, block, sync commands
- [ ] Logging output is verifiable (capture log calls or inspect console)
- [ ] Edge cases covered: empty task list, missing files, invalid IDs, transition errors
- [ ] Sync command tests mock GitHub API calls (no real network)
- [ ] All 9 existing test files continue to pass
- [ ] No modification to source files (tests only)

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
