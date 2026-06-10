---
id: TASK-264
type: Feature
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-264: ADD PREFLIGHT RECONCILIATION TO TASK SELECTION AND AGENT CONTINUATION

## Goal

Describe the desired outcome.

## Acceptance Criteria

- [ ]

## Agent Notes


## Problem

The agent proceeded toward selecting new work while previously completed tasks remained unsubmitted, conflicting, or otherwise unreconciled.

An autonomous continuation policy must prioritize lifecycle closure before starting additional implementation.

## Task Description

Integrate repository and task reconciliation into `taskforge next`, agent continuation, and autonomous task selection.

Agents must resolve or explicitly block outstanding integration defects before beginning unrelated new work.

## Agentic Implementation Prompt

> Add a mandatory preflight to automated task selection and continuation.
>
> Before selecting a new implementation task, TaskForge must check for: impossible lifecycle states, completed but unsubmitted work, submitted tasks without PRs, conflicting PRs, failed required checks, dirty or orphaned managed worktrees, local-only branches, stale gate or scope evidence, tasks waiting for human approval.
>
> Classify findings as: agent-actionable now, waiting for human, blocked by external system, nonblocking informational.
>
> The continuation engine should automatically perform safe agent-actionable closure work before selecting a new task. It should stop at genuine human decision points, such as required approval or destructive recovery.
>
> Do not let an agent claim there is "nothing left" merely because its conversational todo list is empty.

## Acceptance Criteria

1. `taskforge next` runs reconciliation preflight.
2. Blocking lifecycle inconsistencies prevent unrelated new task selection.
3. Agent-actionable closure work is prioritized over new feature work.
4. Tasks awaiting human approval are reported as Merge Ready or equivalent, not Done.
5. Human intervention points are explicit and include the exact requested action.
6. Nonblocking informational findings do not prevent task selection.
7. The continuation engine consumes structured TaskForge state, not prose summaries.
8. The agent cannot declare overall completion while blocking findings remain.
9. JSON output provides: selected action, reason, blocking findings, human intervention requirements, next eligible task.
10. Repeated invocation is stable and does not oscillate between actions.
11. Multi-repository sessions identify the repository containing the blocker.
12. The policy is documented for implementer, reviewer, and planner agents.

## Required Tests

- No blockers; selects ready task.
- Local implementation complete but not submitted.
- Submitted task without PR.
- Conflicting PR.
- Failed checks.
- Merge Ready awaiting human.
- Dirty orphaned worktree.
- Multiple repositories.
- Repeated invocation stability.

## Completion Evidence

- Continuation decision table.
- Example JSON results.
- Demonstration that unresolved PR state blocks unrelated new implementation.

## Dependencies

Depends on TASK-255 (Enforce PR-Backed Terminal Task State), TASK-256 (Make Submission Atomic and Idempotent), and TASK-257 (Add Lifecycle Reconciliation and Invalid-State Detection).

---

_Source: docs/taskforge-agentic-workflow-hardening-tasks.md_
