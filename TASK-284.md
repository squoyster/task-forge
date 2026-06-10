---
id: TASK-284
type: Feature
status: Implementation Complete
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
assignee: e94f2aef13
claimed_at: '2026-06-10 22:31:05'
context_hash: 24c64b5cba799406
branch: agent/TASK-284-implement-structured-taskdocument-model--e94f2aef13
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-284
---
# TASK-284: Implement structured TaskDocument model and restore task update command
## Goal
Introduce a structured TaskDocument layer for task markdown with addressable sections, canonical rendering, and a spec hash derived from editable task content.

## Background
Relevant context, constraints, prior decisions, and links.

## Scope
Allowed files/directories:
- src/core/**
- src/commands/**
- tests/**

Disallowed files/directories:
- unrelated runtime artifacts

## Acceptance Criteria
- [ ] Task markdown is parsed and rendered through a TaskDocument model with canonical section handling.
- [ ] `taskforge new` accepts structured section input and markdown file import.
- [ ] `taskforge update` updates editable task fields while rejecting read-only workflow-owned fields.
- [ ] Task files persist a `spec_hash` derived from editable spec content.
- [ ] `taskforge init --repair` archives divergent legacy `main/tasks` task files into `task-state` for historical preservation.
- [ ] Typecheck, lint, and focused tests pass.

## Test / Verification Command
```bash
npm run typecheck
npm run lint
npm test -- --run tests/task-document.test.ts tests/task-store.test.ts tests/commands/update.test.ts tests/commands/init.test.ts
```

## Expected Output / Behavior
Structured task editing and legacy-task repair work without allowing external mutation of workflow-owned fields.

## Dependencies
None

## Risks
Serialization changes can churn task markdown if they leak into ordinary lifecycle commands.

## Continuation Policy
Auto-continue unless a stopping condition occurs.

## Agent Notes

### 2026-06-10T00:00:00Z System
- Report generated — task moved to Implementation Complete
- Changed files: none
- Commits: none
- AC section: present
- AC has unchecked items

### 2026-06-10T00:00:00Z System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-284

### 2026-06-10T00:00:00Z System
- Task claimed via taskforge start TASK-284
- Session: e94f2aef13
- Branch: agent/TASK-284-implement-structured-taskdocument-model--e94f2aef13

### 2026-06-10T00:00:00Z System
- Task updated via taskforge update
- title set to "Implement structured TaskDocument model and restore task update command"
- type set to "Feature"
- priority set to "P1"
- agentRole set to "Implementer"
- riskLevel set to "Low"
- humanInterventionRequired set to "false"
- section goal updated (159 chars)
- section background updated (58 chars)
- section scope updated (130 chars)
- section acceptanceCriteria updated (539 chars)
- section testCommand updated (171 chars)
- section expectedOutput updated (112 chars)
- section dependencies updated (4 chars)
- section risks updated (92 chars)
- section continuationPolicy updated (49 chars)
### 2026-06-10T00:00:00Z System
- Task updated via taskforge update
- section acceptanceCriteria updated (3 chars)

## Result

## Links
- Issue:
- Project Item:
- PR:
- Branch:
- Worktree:
- CI:
- Test Log:
