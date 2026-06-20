---
id: TASK-298
type: Bug
status: Rejected
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
spec_hash: 87c76b3df2634d68
---

# TASK-298: Fix taskforge new body/template section duplication

## Goal

## Goal
Make `taskforge new --body` compose supplied markdown with the task template without duplicating canonical sections or leaving blank acceptance criteria.

## Background
While creating TASK-224 follow-up tasks, each task created with `--body` contained duplicate `## Goal` and duplicate `## Acceptance Criteria` sections, including a trailing empty `- [ ]` item from the default template. `taskforge update --field acceptanceCriteria` did not remove the duplicate sections.

## Acceptance Criteria
- [ ] `taskforge new --body` parses supplied markdown sections and maps them into canonical task document sections instead of appending them after empty defaults.
- [ ] If the supplied body already includes `## Goal`, `## Background`, or `## Acceptance Criteria`, the generated task contains exactly one of each section.
- [ ] Blank default acceptance criteria are omitted when real acceptance criteria are supplied.
- [ ] `taskforge update` can normalize an existing duplicated task document without direct task-state edits.
- [ ] Tests cover body with full sections, body with plain prose only, body with acceptance criteria only, and update normalization of a duplicated document.
- [ ] `ac-check` reports no duplicate-section or blank-checkbox issues for newly generated tasks with structured bodies.

## Evidence
Observed in TASK-293 through TASK-297 after using `taskforge new --body`: duplicate `## Goal`, duplicate `## Acceptance Criteria`, and an empty `- [ ]` remained in the task markdown.

## Acceptance Criteria

- [ ]

## Agent Notes

### 2026-06-20T00:00:00Z System
- Task rejected: Backlog cleared to focus queue on TaskForge Slimming Refactor (TASK-307..315). Superseded, descoped, or obsoleted by refactor per specs/taskforge-slimming-refactor.md. Task record retained as historical reference; re-evaluate post-refactor.

### 2026-06-12T00:00:00Z System
- Field(s) updated via taskforge update: acceptanceCriteria
