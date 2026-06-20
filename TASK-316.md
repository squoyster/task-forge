---
id: TASK-316
type: Task
status: Inbox
priority: P3
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-316: Resolve pre-existing DUPLICATE_TASK_SECTIONS warnings (48 warnings, 46 tasks)

## Type
Task

## Status
Inbox

## Priority
P3

## Human Owner
Optional.

## Agent Role
Implementer

## Goal
Eliminate the 48 `DUPLICATE_TASK_SECTIONS` warnings so `taskforge validate-state --strict` passes cleanly (0 errors, 0 warnings).

## Background
Filed as a follow-up from TASK-315 (Slimming Refactor 09 — final gate pass). TASK-315 cleared the 36 refactor-attributable `DONE_WITH_ASSIGNEE`/`DONE_WITH_CLAIM` errors but left these warnings untouched because they predate the slimming refactor entirely:

- The `DUPLICATE_TASK_SECTIONS` validator rule was added in commit ab0da91 (TASK-288, 2026-06-10), which normalized the then-recent malformed tasks.
- The 46 flagged tasks (TASK-030, TASK-091..098, TASK-101..102, TASK-123..124, TASK-220..227, TASK-235..239, TASK-242, TASK-255..266, TASK-269, TASK-272..273, TASK-293..298) are older template-drift debt from before the validator existed. None are from the slimming-refactor window (TASK-307..315).

Two patterns exist (analyzed during TASK-315):
- **Case A — empty header immediately followed by an identical header** (~19 files, mostly `## Goal` empty + filled). Mechanical: remove the empty duplicate.
- **Case B — two distinct bodies** (~27 files, e.g. TASK-091, TASK-101's `Acceptance Criteria`). Requires content judgment: merge or remove the stale draft.

## Scope
Allowed files/directories:
- `../task-state/TASK-*.md` (the 46 flagged task files only)

Disallowed files/directories:
- `src/**` (no code changes — validator is correct)
- Any non-flagged task file

## Acceptance Criteria
- [ ] `taskforge validate-state --strict` reports `0 error(s), 0 warning(s)`.
- [ ] No task loses real content (Case B merges preserve the authoritative section body).
- [ ] Each edit is committed individually with a clear message (`TASK-316: dedupe <section> in TASK-NNN`), or batched per logical group.

## Test / Verification Command
```bash
taskforge validate-state --strict --json
```

## Expected Output / Behavior
`"error": "0 error(s), 0 warning(s) found (strict mode)."` and `"ok": true`.

## Dependencies
None (TASK-315 is complete; this is standalone debt cleanup).

## Risk Level
Low

## Risks
Case B edits risk dropping a stale-but-referenced acceptance criterion. Mitigation: diff each edit; prefer merging two bodies over dropping one. The validator only requires unique section headers, so renaming a duplicate (e.g. `## Acceptance Criteria (legacy)`) is also acceptable if both bodies must be preserved.

## Human Intervention Required?
No

## Continuation Policy
Auto-continue unless a stopping condition occurs.

## Agent Notes
Discovered during TASK-315 (QA of slimming refactor). The refactor itself is clean — these warnings are pre-existing. TASK-315's Result documents the boundary.

## Result

## Links
- Issue:
- Project Item:
- PR:
- Branch:
- Worktree:
- CI:
- Test Log:
