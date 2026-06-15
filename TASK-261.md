---
id: TASK-261
type: Feature
status: Implementation Complete
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
assignee: dd85c550bb
claimed_at: '2026-06-08 14:34:41'
context_hash: b516925ba8cef30c
spec_hash: 454f17d014cd1c66
branch: agent/TASK-261-replace-direct-task-state-editing-with-s--dd85c550bb
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-261
---

# TASK-261: REPLACE DIRECT TASK-STATE EDITING WITH SUPPORTED COMMANDS

## Goal

Describe the desired outcome.

## Acceptance Criteria

- [ ]

## Agent Notes

### 2026-06-08T00:00:00Z System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-261

### 2026-06-08T00:00:00Z System
- Task claimed via taskforge start TASK-261
- Session: dd85c550bb
- Branch: agent/TASK-261-replace-direct-task-state-editing-with-s--dd85c550bb


## Problem

Agents resorted to importing unstable internal build chunks and directly editing Markdown task-state files because supported CLI operations were missing or unclear.

Direct file mutation bypasses locking, validation, audit, schema evolution, and concurrency controls.

## Task Description

Provide complete supported commands for routine task-state updates and make managed state files non-authoritative as an agent editing interface.

## Agentic Implementation Prompt

> Inventory every legitimate task-state mutation agents currently need, then expose stable TaskForge commands or APIs for those mutations.
>
> At minimum provide supported operations for:
>
> - adding an implementation note,
> - recording gate results,
> - attaching or reconciling PR metadata,
> - recording blockers,
> - updating task status through validated transitions,
> - recording completion evidence,
> - associating agent identity and worktree,
> - recovering partially persisted submission state.
>
> Commands must use the same transaction, locking, validation, audit, and schema layers as all other TaskForge operations.
>
> Task-state Markdown or serialized files may remain human-readable, but agents must not need to edit them directly. Internal generated build chunks are not a public API and must never be recommended as a mutation mechanism.

## Suggested Commands

```bash
taskforge note <task> --role Implementer --message "..."
taskforge record-gates <task> --report <file>
taskforge attach-pr <task> --pr <provider-id>
taskforge block <task> --reason "..."
taskforge evidence add <task> --type test-report --file <file>
taskforge reconcile <task>
```

Exact command names may change if the existing CLI architecture suggests a better consistent design.

## Acceptance Criteria

1. All routine task-state mutations used by agents have supported CLI/API operations.
2. Commands acquire task-state locks.
3. Commands validate schema and lifecycle transitions.
4. Commands emit audit events.
5. Commands support JSON input/output where appropriate.
6. Direct task-state edits in managed sessions are rejected or detected.
7. The documentation explicitly states that generated build chunks and internal modules are not public mutation APIs.
8. Concurrent updates are serialized or conflict-detected.
9. Failed writes are atomic and do not leave partially valid state.
10. Existing human-readable task files remain synchronized with authoritative state.
11. Commands return stable result and error codes.
12. Agent prompts and help text reference only supported commands.

## Required Tests

- Each supported mutation.
- Concurrent note and status update.
- Invalid transition.
- Schema validation failure.
- Interrupted write.
- Direct file edit detection.
- Audit event generation.
- JSON round trip.

## Completion Evidence

- Mutation command inventory.
- Public API boundary documentation.
- Demonstration that no internal chunk import or direct file edit is necessary.

## Dependencies

Depends on TASK-258 (Enforce the TaskForge Mutation Boundary).

---

_Source: docs/taskforge-agentic-workflow-hardening-tasks.md_


## Agent Notes

### Implementation Summary

Added gap-filling mutation commands:
- block: Block a task with reason/category via cmdBlockTask
- record-gates: Record gate results via cmdRecordGates
- evidence: Add completion evidence via cmdEvidenceAdd
- reconcile: Reconcile task state via cmdReconcile

All use withTaskStateTransaction. Registered in CLI. 744 tests passing.
