---
id: TASK-255
type: Feature
status: Rejected
priority: P0
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
context_hash: 98789b0cbdd97405
spec_hash: 268fb385a4c2fd7c
branch: agent/TASK-255-enforce-pr-backed-terminal-task-state--91cc2a34aa
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-255
---

# TASK-255: ENFORCE PR-BACKED TERMINAL TASK STATE

## Goal

Describe the desired outcome.

## Acceptance Criteria

- [ ]

## Agent Notes

### 2026-06-20T00:00:00Z System
- Task rejected: Recalibration - pre-306 task pool retired, superseded by 306+ frontier.

### 2026-06-08T00:00:00Z Implementer
- ## Implementation Summary
- 
- Implemented TASK-255: Enforce PR-Backed Terminal Task State.
- 
- ### Changes Made
- 
- 1. **New lifecycle statuses**: Added `Implementation Complete`, `Submitted`, and `Merge Ready` intermediate states to the task status model. Updated status-constants.ts, status-transition.ts, and all related validation.
- 
- 2. **New task fields**: Added `submitted_sha`, `submitted_at`, `pr_merged`, `pr_head_sha`, `pr_base_branch`, and `code_task` fields to the Task schema in task.ts and task-store.ts.
- 
- 3. **Centralized completion policy** (`src/core/completion-policy.ts`): Created a unified policy module with `checkCompletionEligibility()` that enforces PR-backed verification for code-bearing tasks. Checks include: PR recorded, PR targets integration branch, SHA match, PR merged, SHA reachable, and required checks passing. Includes `isCodeTask()` for non-code task classification.
- 
- 4. **PR verification provider** (`src/core/pr-verifier.ts`): Implemented `GitHubPullRequestVerifier` class with checkMerged, getHeadSha, checkReachable, and checkRequiredChecks methods using Octokit.
- 
- 5. **Updated `done` command**: Integrated completion policy check after standard gates, rejecting `Done` for code-bearing tasks without verified PR integration. Non-code tasks (Documentation, Chore, Research, etc.) bypass PR checks.
- 
- 6. **Updated `report --complete` command**: Changed target status from `Review` to `Implementation Complete` to match the new lifecycle flow.
- 
- 7. **New lifecycle transitions**:
-    - In Progress → Implementation Complete (implementation done)
-    - Implementation Complete → Submitted (branch pushed)
-    - Submitted → Review (PR created)
-    - Review → Merge Ready (PR mergeable, checks passing)
-    - Merge Ready → Verify (PR merged)
-    - Verify → Done (SHA reachable, verified)
- 
- 8. **Tests**: 49 new tests in tests/completion-policy.test.ts covering all AC scenarios including non-code tasks, missing PR, wrong base branch, SHA mismatch, PR not merged, SHA not reachable, checks failing, and full happy path. Updated 24 existing tests for new transition rules.
- 
- ### Verification
- - Typecheck: passed
- - Lint: 0 errors (19 pre-existing warnings)
- - Build: passed
- - Tests: 58 test files, 670 tests, all passed

### 2026-06-08T00:00:00Z System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-255

### 2026-06-08T00:00:00Z System
- Task claimed via taskforge start TASK-255
- Session: 91cc2a34aa
- Branch: agent/TASK-255-enforce-pr-backed-terminal-task-state--91cc2a34aa


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
