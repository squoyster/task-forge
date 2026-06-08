---
id: TASK-255
type: Feature
status: Ready
priority: P0
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-255: ENFORCE PR-BACKED TERMINAL TASK STATE

## Goal

Describe the desired outcome.

## Acceptance Criteria

- [ ]

## Agent Notes


## Problem

TaskForge currently permits code-bearing tasks to reach `Done` without proving that the implementation was submitted, reviewed, merged, and reachable from the configured integration branch.

This creates contradictory states in which task metadata claims completion while the actual repository state remains unintegrated, conflicting, or absent from the remote.

## Task Description

Redefine and enforce terminal lifecycle semantics for code-bearing tasks.

A code-bearing task must not transition to `Done` unless TaskForge verifies the associated pull request was merged and the submitted implementation SHA is reachable from the configured integration branch.

Introduce or formalize intermediate states so that agents can stop correctly when implementation is complete but integration is not.

## Agentic Implementation Prompt

> Implement authoritative completion semantics for TaskForge code-bearing tasks.
>
> Begin by locating every code path that can transition a task to `Done`, including CLI commands, internal services, direct state transitions, workflow automation, and recovery commands.
>
> Define one centralized completion policy and route all transitions through it. Do not duplicate completion rules across commands.
>
> The policy must distinguish:
>
> - implementation locally complete,
> - branch submitted,
> - pull request open,
> - pull request mergeable,
> - pull request awaiting review,
> - pull request merged,
> - terminal task completion.
>
> For code-bearing tasks, require verified pull-request integration before `Done`. For non-code tasks, support a configurable completion policy that does not require a pull request.
>
> Maintain backward compatibility only where it does not preserve invalid lifecycle semantics. Add migration or reconciliation behavior for existing tasks already marked `Done` without integration evidence.
>
> Use provider abstractions rather than embedding GitHub-specific assumptions into the domain model. GitHub may be the first implementation, but lifecycle state must remain provider-neutral.

## Scope

**Include:**
- Domain lifecycle state definitions.
- Centralized transition policy.
- Validation of PR state, base branch, head SHA, merged state, checks, and integration reachability.
- Compatibility handling for non-code tasks.
- Migration or invalid-state reporting for legacy task records.
- CLI and API error messages that explain unmet preconditions.

**Exclude:**
- Full PR submission orchestration (handled by Task 2).
- Raw Git command interception (handled by Task 4).
- General reconciliation engine (handled by Task 3).

## Acceptance Criteria

1. Code-bearing tasks cannot enter `Done` without a recorded pull request.
2. The pull request must target the configured integration branch.
3. The pull request\'s submitted head SHA must equal the task\'s recorded submitted SHA.
4. The pull request must be in a merged state.
5. The submitted SHA or resulting merge commit must be reachable from the current remote integration branch.
6. Required checks must have passed according to the configured repository policy.
7. A mergeable PR awaiting human approval transitions to or remains Merge Ready.
8. An open PR under review transitions to or remains In Review.
9. A pushed branch without a PR transitions to or remains Implementation Complete or Submitted, according to the finalized model, but never Done.
10. Non-code tasks can use an explicit completion policy that does not require a PR.
11. All commands that can mark a task complete invoke the same policy implementation.
12. Invalid legacy Done states are detected and reported with deterministic remediation guidance.
13. State transition failures return structured machine-readable error codes in JSON mode.
14. Human-readable errors identify each unmet completion precondition.

## Required Tests

- Unit tests for every allowed and rejected transition.
- Integration test: pushed branch, no PR.
- Integration test: open PR, mergeable, checks passing.
- Integration test: open PR with conflicts.
- Integration test: merged PR with mismatched recorded SHA.
- Integration test: merged PR not targeting configured base.
- Integration test: merged PR and reachable SHA.
- Regression test proving no alternate CLI path can bypass the policy.
- Non-code task completion test.

## Completion Evidence

- Lifecycle state diagram.
- Central policy location and API.
- Test matrix showing every transition.
- Demonstration that a task cannot reach Done from only a clean worktree and pushed branch.

## Note on TASK-232

TASK-232 ("Require clean worktree and pushed branch in done command before marking task Done") covers some completion preconditions. This task supersedes TASK-232 for code-bearing tasks: Done now requires verified PR integration, not merely a clean worktree and pushed branch. TASK-232\'s worktree/branch checks remain as necessary preconditions but are no longer sufficient.

---

_Source: docs/taskforge-agentic-workflow-hardening-tasks.md_
