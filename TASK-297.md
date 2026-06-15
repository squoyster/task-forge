---
id: TASK-297
type: Bug
status: Review
priority: P0
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
assignee: 0f439c05c4
claimed_at: '2026-06-15 05:47:43'
context_hash: c325879bc50725fa
spec_hash: 1a64cf4c0c2cc56a
branch: agent/TASK-297-make-taskforge-new-atomic-and-recoverabl--0f439c05c4
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-297
---

# TASK-297: Make taskforge new atomic and recoverable when task-state push fails

## Goal

## Goal
Make `taskforge new` atomic, idempotent, and recoverable when it creates a local task-state file but cannot publish task-state to the remote.

## Background
While creating TASK-224 follow-up tasks, `taskforge new` created TASK-293 through TASK-296 locally but returned `PUSH_FAILED`, warning that tasks may not be visible to other agents. The recovery guidance said to run `taskforge submit`, which is a code-branch submission command and not clearly correct for publishing task-state.

## Acceptance Criteria
- [ ] `taskforge new` records whether task-state publication succeeded and includes the new task ID even on push failure.
- [ ] Failed task-state publication has an explicit recovery command that is valid for task-state, not code-branch `taskforge submit` unless that command truly handles task-state publication.
- [ ] Re-running `taskforge new` after a partial local create does not create duplicates; it can resume/publish the existing local task or reports the existing task ID.
- [ ] A doctor/recovery command can publish pending local task-state changes safely.
- [ ] Tests cover successful create+push, local-create/push-fail, retry after partial create, and duplicate-title/id collision behavior.
- [ ] JSON output includes taskId, task path, publication status, and recovery steps.

## Evidence
Observed while creating TASK-224 remediation tasks: `TASK-293`, `TASK-294`, `TASK-295`, and `TASK-296` were created locally but each returned `PUSH_FAILED` with only generic guidance.

## Acceptance Criteria

- [ ]

## Agent Notes

### 2026-06-15T00:00:00Z System
- Report generated — task moved to Implementation Complete
- Changed files: dist/chunk-RYDMXDO2.js.map, src/commands/new.ts, src/commands/start.ts, src/commands/sync.ts, src/core/closure-task.ts, src/core/command-result.ts, src/core/command-states.ts, src/core/next-command-maps.ts, src/core/pending-publish.ts, src/core/result-builder.ts, src/core/result-renderer.ts, src/util/logging.ts, tests/closure-task.test.ts, tests/command-result.test.ts, tests/command-states.test.ts, tests/commands/new.test.ts, tests/pending-publish.test.ts
- Commits: 189a26d TASK-297: Make taskforge new atomic and recoverable when task-state push fails
- AC section: present
- AC has unchecked items

### 2026-06-15T00:00:00Z System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-297

### 2026-06-15T00:00:00Z System
- Task claimed via taskforge start TASK-297
- Session: 0f439c05c4
- Branch: agent/TASK-297-make-taskforge-new-atomic-and-recoverabl--0f439c05c4

### 2026-06-12T00:00:00Z System
- Field(s) updated via taskforge update: priority
