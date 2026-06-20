---
id: TASK-025
type: Feature
status: Done
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
spec_hash: 6a3e300dd76b7734
issue: 85
---

# TASK-025: Add Structured Blocker Fields

## Goal

Extend the `taskforge block` command and task frontmatter with structured blocker metadata: `blocked_reason`, `blocked_by`, `blocked_since`, and blocker category — enabling agents and operators to understand *why* a task is blocked without reading arbitrary prose.

## Background

The gap analysis identifies blocker categories as a gap for agentic workflows:

| Category | Meaning |
|---|---|
| `human_decision` | policy/product choice |
| `test_failure` | agent cannot resolve after attempts |
| `merge_conflict` | conflict requires owner judgment |
| `missing_secret` | credentials/token unavailable |
| `unsafe_operation` | destructive operation requires approval |
| `ambiguous_spec` | acceptance criteria insufficient |

Current `block` command takes a free-text reason — useful but not machine-parseable.

## Usage

```bash
taskforge block TASK-023 "Need decision on sweep behavior" \
  --category human_decision \
  --blocked-by human \
  --json
```

## Acceptance Criteria

- [x] `block` command accepts `--category` (enum of above values)
- [x] `block` command accepts `--blocked-by` (human/agent/bot)
- [x] Frontmatter stores `blocked_reason`, `blocked_by`, `blocked_since` (auto-set to now), and `block_category`
- [x] `taskforge list --status Blocked` and `taskforge status` show blocker metadata
- [x] `--json` output includes blocker fields
- [x] Backward-compatible: existing `block <id> <reason>` still works (category defaults to `unspecified`)

## Dependencies

TASK-017 (JSON contracts)

## Risk Level

Low — additive fields, existing behavior unchanged.

## Continuation Policy

Auto-continue.

## Agent Notes

### 2026-05-22 System
- Task started via taskforge start TASK-025
- Session: 716af96673
- Branch: agent/TASK-025-add-structured-blocker-fields--716af96673
- Worktree: /Volumes/Transcend/devel/worktrees/TASK-025

### 2026-05-22 Implementer
- Added `BlockCategory` and `BlockedBy` enums to `src/core/task.ts`
- Extended `TaskSchema` with `blocked_reason`, `blocked_by`, `blocked_since`, `block_category` fields
- Updated `task-store.ts` to read/write all new blocker fields via gray-matter frontmatter
- Updated `block.ts` to accept `--category` (human_decision, test_failure, merge_conflict, missing_secret, unsafe_operation, ambiguous_spec) and `--blocked-by` (human, agent, bot) options
- `block.ts` writes structured metadata to task frontmatter and includes category in agent notes
- Updated `list.ts` to display blocker metadata in both human-readable and JSON output
- Registered new options in `src/cli.ts` for the block command
- Added 3 new tests for structured blocker fields; all 322 tests pass (31 files)
- Backward-compatible: existing `block <id> <reason>` works unchanged, defaults to `unspecified` category/blocked_by
- Verification: typecheck (0), lint (0), build (clean), 322 tests pass
