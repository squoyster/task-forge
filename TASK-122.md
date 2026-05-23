---
id: TASK-122
type: Refactor
status: Ready
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
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
