---
id: TASK-122
type: Refactor
status: In Progress
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
assignee: 5ab32932de
claimed_at: '2026-05-23 18:31:28'
context_hash: f3613895c8a77f2e
---

# TASK-122: Add compatibility migration for legacy tasks/ directory

## Goal

Add taskforge migrate-tasks command for legacy main/tasks/*.md to task-state branch migration. Detect legacy tasks/*.md on main, copy/move them into task-state branch after confirmation or --apply. Add audit event for migration. Add warning in doctor if legacy and task-state both contain task files.

## Background

Rationalization Roadmap: TASK-RAT-014

## Acceptance Criteria

- [ ] Legacy tasks can be migrated safely
- [ ] Duplicate task IDs are detected and reported
- [ ] Agents are instructed never to create new main-branch task files
- [ ] If only legacy tasks exist, suggest migration before starting new work

## Agent Notes

### 2026-05-23 System
- Task claimed via taskforge start TASK-122
- Session: 5ab32932de
- Branch: agent/TASK-122-add-compatibility-migration-for-legacy-t--5ab32932de

### 2026-05-23 System
- Task claimed via taskforge start TASK-122
- Session: 5ab32932de
- Branch: agent/TASK-122-add-compatibility-migration-for-legacy-t--5ab32932de
