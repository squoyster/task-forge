---
id: TASK-267
type: Feature
status: Implementation Complete
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
assignee: 7c30c62341
claimed_at: '2026-06-08 14:18:53'
context_hash: b516925ba8cef30c
spec_hash: 0e6eddfe02fd63fc
branch: agent/TASK-267-add-taskforge-update-command-for-task-fi--7c30c62341
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-267
---

# TASK-267: Add TaskForge update command for task fields

## Goal

Create a `taskforge update` CLI command that allows agents to modify task fields (body, priority, type, status, acceptance criteria, etc.) through the proper transaction, locking, validation, audit, and schema layers — eliminating the need for direct task-state file editing.

## Problem

During the TASK-255..TASK-266 task creation session, 12 tasks were generated from a specification document. The `taskforge new` command created basic frontmatter but could not accept the full body content. A Node.js script had to be written to append body text to each file — bypassing TaskForge's own locking, validation, audit, and transaction layers.

This is a concrete example of the gap identified in TASK-261 ("Replace Direct Task-State Editing with Supported Commands"). Agents currently have no supported CLI command to:

- Append or replace a task's body/markdown content
- Update frontmatter fields (priority, type, dependsOn, etc.)
- Add acceptance criteria and completion evidence sections
- Record structured metadata

Without `taskforge update`, agents either write direct-to-file (bypassing all safeguards) or write brittle scripts that import internal build chunks.

## Task Description

Implement a `taskforge update <taskId>` command that can modify any writable task field through the standard TaskForge transaction layer.

The command should accept field-value pairs and support both replacing and appending to markdown sections.

## Suggested Interface

```bash
# Update frontmatter fields
taskforge update TASK-255 --field priority --value P1
taskforge update TASK-255 --field type --value "Feature"
taskforge update TASK-255 --field dependsOn --value "TASK-001,TASK-002"

# Append or replace body sections
taskforge update TASK-255 --body "## Additional Notes\n\nNew content here..."
taskforge update TASK-255 --append-body "## Additional Notes\n\nNew content here..."

# Update acceptance criteria (mark as checked/unchecked)
taskforge update TASK-255 --ac "1" --check

# JSON mode for structured updates
taskforge update TASK-255 --json --field priority --value P0
```

Exact option names may change to match existing CLI conventions.

## Scope

**Include:**
- Transactional writes through `withTaskStateTransaction`
- Field validation (enum values for type, priority, status, etc.)
- Schema validation before write
- Audit event emission for each mutation
- JSON output with stable result codes
- Support for at minimum: priority, type, status, dependsOn, body (replace), body (append)
- Idempotent updates (repeating the same change is a no-op)
- Concurrent-safety through existing task-state locking

**Exclude:**
- Creating new tasks (handled by `new`)
- Deleting tasks
- Transitioning terminal states (handled by lifecycle commands)
- Complex section editing (goal, scope, etc.) beyond body append/replace

## Acceptance Criteria

1. `taskforge update <taskId> --field <name> --value <val>` updates a frontmatter field.
2. Valid field values are enforced (e.g., priority must be P0-P3, type must be valid enum).
3. Unknown fields are rejected with a clear error.
4. `--body` replaces the entire body content after frontmatter.
5. `--append-body` appends text to the existing body.
6. All mutations go through `withTaskStateTransaction`.
7. Each mutation emits an audit event with field name, old value, and new value.
8. JSON output includes updated task and changed fields.
9. Concurrent updates are serialized or conflict-detected.
10. Failed writes leave no partially-updated state.
11. Read-only fields (id, createdAt, etc.) cannot be modified.
12. Help text lists all supported fields and their value formats.

## Required Tests

- Update priority.
- Update type with invalid value (rejected).
- Update status to invalid transition (rejected).
- Replace body.
- Append to body.
- Multiple field updates in one invocation.
- Idempotent repeat (no-op).
- Concurrent update conflict.
- Audit event content verification.
- JSON output schema.

## Completion Evidence

- Command implementation in `src/commands/update-task.ts`
- Registered in CLI module.
- Passing test suite for all ACs.
- Demonstration that agents no longer need to edit task-state files directly or import build chunks.

## Dependencies

TASK-261 (Replace Direct Task-State Editing with Supported Commands) — this task implements one of the specific commands that TASK-261 calls for. The two tasks overlap in scope; this task provides the concrete implementation of a general-purpose mutation command.

---

_Source: discovered during TASK-255..TASK-266 bulk task creation session_

## Agent Notes

### 2026-06-08T00:00:00Z Implementer
- ## Implementation Summary
- 
- Implemented taskforge update command.
- 
- ### Changes Made
- 
- 1. **New command** (`src/commands/update-task.ts`): `taskforge update <taskId>` supports --field/--value (priority, type, status, dependsOn, agentRole, riskLevel, humanInterventionRequired), --body (replace), --append-body (append), and --json output.
- 
- 2. **Field validation**: Priority P0-P3, type enum, status values, riskLevel, humanInterventionRequired boolean. Read-only fields (id, assignee, etc.) are rejected.
- 
- 3. **Transactional**: All mutations go through withTaskStateTransaction with audit notes.
- 
- 4. **CLI registered**: In cli.ts with help text.
- 
- 5. **Tests**: 12 tests covering all AC scenarios.
- 
- ### Verification
- - Typecheck: passed
- - Tests: 60 files, 745 tests, all passed

### 2026-06-08T00:00:00Z System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-267

### 2026-06-08T00:00:00Z System
- Task claimed via taskforge start TASK-267
- Session: 7c30c62341
- Branch: agent/TASK-267-add-taskforge-update-command-for-task-fi--7c30c62341
