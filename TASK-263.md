---
id: TASK-263
type: Feature
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-263: ADD SCOPE-CONFORMANCE VALIDATION BEFORE SUBMISSION

## Goal

Describe the desired outcome.

## Acceptance Criteria

- [ ]

## Agent Notes


## Problem

Conflict repair and branch reconstruction can silently introduce unrelated changes. Agents can expand scope without creating a separate task or documenting why the change was required.

## Task Description

Add a pre-submission scope-conformance check that compares the task definition and implementation plan against changed commits, files, and declared behavior.

The system should not attempt semantic certainty, but it should detect suspicious scope expansion and require explicit classification.

## Agentic Implementation Prompt

> Implement a pragmatic scope-conformance gate.
>
> Collect: task description, acceptance criteria, declared implementation plan, changed files, commits since the recorded task base, referenced tasks, dependency metadata.
>
> Produce findings that the agent or reviewer must classify: IN_SCOPE, INCIDENTAL_REQUIRED, OUT_OF_SCOPE.
>
> INCIDENTAL_REQUIRED requires a written justification.
>
> OUT_OF_SCOPE must block submission until the change is removed or a linked follow-up task is created and the repository\'s policy explicitly permits bundling.
>
> The initial implementation may use deterministic heuristics and agent-supplied declarations. Do not claim that an LLM classification alone is an enforcement guarantee.

## Acceptance Criteria

1. Pre-submission output lists all changed files and commits since the recorded base SHA.
2. The check flags commits inherited from unrelated task branches.
3. The agent must classify non-obvious changes.
4. INCIDENTAL_REQUIRED requires recorded justification.
5. OUT_OF_SCOPE blocks submission by default.
6. A linked follow-up task can be created or referenced.
7. Scope decisions are stored with the submitted SHA.
8. Scope evidence becomes stale when HEAD changes.
9. Reviewers can inspect scope classifications.
10. Deterministic branch-contamination checks do not depend on LLM judgment.
11. JSON output supports automation.
12. The system does not silently modify task acceptance criteria to fit the implementation.

## Required Tests

- Only expected files changed.
- Additional test fixture required.
- Unrelated source module changed.
- Inherited commits from another task.
- Follow-up task linkage.
- HEAD changes after classification.
- Explicit stacked dependency.

## Completion Evidence

- Scope finding schema.
- Example in-scope, incidental, and out-of-scope reports.
- Demonstration that unrelated inherited commits block submission.

## Dependencies

Depends on TASK-256 (Make Submission Atomic and Idempotent) and TASK-259 (Prevent Nested Worktrees and Cross-Task Branch Ancestry).

---

_Source: docs/taskforge-agentic-workflow-hardening-tasks.md_
