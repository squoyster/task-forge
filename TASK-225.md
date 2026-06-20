---
id: TASK-225
type: Task
status: In Progress
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
assignee: 95479e7aec
claimed_at: '2026-06-20 18:42:12'
context_hash: ad8142e125a8fad2
spec_hash: 98c9ecf27c1083f8
branch: agent/TASK-225-add-clidocumentation-consistency-tests--95479e7aec
---

# TASK-225: Add CLI/documentation consistency tests

## Goal

## Goal

Prevent docs from becoming inconsistent with implemented CLI commands by adding automated drift detection tests.

## Context

Per `taskforge-control-plane-closure-spec.md` §7 Agent Prompt 6.

## Current State

- No tests exist that verify CLI/docs consistency
- 48 test files in `tests/` but none check meta-level alignment
- README command table is missing `ac-check`
- `docs/architecture/` directory does not exist (referenced in README)

## Required Tests

Create `tests/cli-docs-consistency.test.ts` with:

1. **CLI → README**: Every command registered in `src/cli.ts` is listed in `README.md` command table
2. **CLI → TASKFORGE.md**: Every command registered in `src/cli.ts` is listed or categorized in `TASKFORGE.md`
3. **README → CLI**: Every command in README command table exists in `src/cli.ts`
4. **CLI → State Machine**: Every command registered in `src/cli.ts` has a `CommandStateRule` entry in the registry
5. **Force authority**: Every command with `--force` option has authority restriction in its implementation
6. **No force recommendation**: Docs do not recommend normal-agent use of `--force`
7. **No raw git bypass**: Docs do not recommend raw git for normal agent workflow

## Implementation Notes

- Parse `src/cli.ts` to extract registered command names (regex or AST)
- Parse `README.md` to extract command table entries
- Parse `TASKFORGE.md` to extract command references
- Import the command-state-machine registry to check coverage
- Search docs for forbidden patterns (`--force` recommendations, raw git bypass)

## Acceptance Criteria

- [ ] Test fails if CLI command is undocumented in README.md
- [ ] Test fails if CLI command is undocumented in TASKFORGE.md
- [ ] Test fails if documented command does not exist in CLI
- [ ] Test fails if command-state-machine entry is missing for a CLI command
- [ ] Test fails if force command lacks authority restriction
- [ ] Test fails if docs recommend normal-agent use of `--force`
- [ ] Test fails if docs recommend raw git bypass for normal agents
- [ ] All tests pass against current codebase (after prerequisite tasks are complete)

## Acceptance Criteria

- [ ]

## Agent Notes

### 2026-06-20T00:00:00Z System
- Task claimed via taskforge start TASK-225
- Session: 95479e7aec
- Branch: agent/TASK-225-add-clidocumentation-consistency-tests--95479e7aec
