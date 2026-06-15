---
id: TASK-235
type: Task
status: Ready
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
spec_hash: a79d0306bcb1166a
---

# TASK-235: Add task-state validation for duplicate markdown sections

## Goal

The task-state currently allows duplicate markdown sections (e.g., two '## Acceptance Criteria' or '## Goal' headers). TASK-219 had duplicate Goal and AC sections, causing done validation failures.

## Required Changes

1. Add validation to `validate-state` command that detects duplicate top-level markdown sections (`## `) in task files
2. Report duplicates as warnings with the task ID and section name
3. Add a test case for duplicate section detection
4. Update the task file template to prevent accidental duplication

## Acceptance Criteria

- [ ] `validate-state` detects duplicate `## ` sections in task files
- [ ] Warnings include task ID and the duplicated section name
- [ ] Test coverage for duplicate section detection
- [ ] Task template does not produce duplicate sections

## Acceptance Criteria

- [ ]

## Agent Notes
