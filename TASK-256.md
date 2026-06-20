---
id: TASK-256
type: Feature
status: Rejected
priority: P0
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
assignee: 30f7d54c39
claimed_at: '2026-06-08 14:25:50'
context_hash: b516925ba8cef30c
spec_hash: ebc7d5b2ad61b0f4
branch: agent/TASK-256-make-submission-atomic-and-idempotent--30f7d54c39
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-256
---

# TASK-256: MAKE SUBMISSION ATOMIC AND IDEMPOTENT

## Goal

Describe the desired outcome.

## Acceptance Criteria

- [ ]

## Agent Notes

### 2026-06-20T00:00:00Z System
- Task rejected: Recalibration - pre-306 task pool retired, superseded by 306+ frontier.

### 2026-06-08T00:00:00Z System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-256

### 2026-06-08T00:00:00Z System
- Task claimed via taskforge start TASK-256
- Session: 30f7d54c39
- Branch: agent/TASK-256-make-submission-atomic-and-idempotent--30f7d54c39


## Problem

Commit, push, pull-request creation, PR metadata capture, and task-state updates currently behave as separate informal steps. Partial execution leaves TaskForge unable to determine whether work was submitted.

## Task Description

Implement `taskforge submit` as the authoritative, idempotent submission operation for code-bearing tasks.

Submission must checkpoint changes, push the correct branch, create or update the associated pull request, capture provider state, validate branch ancestry, record the submitted SHA, and transition the task to the correct nonterminal lifecycle state.

## Agentic Implementation Prompt

> Implement transactional, idempotent task submission.
>
> Treat submission as a resumable state machine rather than a shell-script sequence. Each step must be safe to retry after process interruption, network failure, provider timeout, or partial success.
>
> The operation must:
>
> 1. Resolve the authoritative task, repository, worktree, branch, base branch, and agent identity.
> 2. Validate ownership and lifecycle preconditions.
> 3. Run or verify configured submission gates.
> 4. Create a TaskForge checkpoint when needed.
> 5. Push the exact task branch without bypassing configured protections.
> 6. Create the PR when absent or reconcile the existing PR when present.
> 7. Record provider-neutral PR metadata and the submitted SHA.
> 8. Query mergeability, checks, and review state.
> 9. Transition to Submitted, In Review, or Merge Ready.
> 10. Emit structured next actions.
>
> Re-running `taskforge submit` must converge on the same remote branch and PR. It must not create duplicate PRs or silently replace unrelated PRs.
>
> Design explicit compensation and recovery behavior for partial failure. Do not claim atomicity by assuming remote Git and provider APIs support a distributed transaction.

## Scope

**Include:**
- Submission state machine.
- Checkpoint integration.
- Remote branch push.
- PR create/update/reconcile.
- Submitted SHA recording.
- Idempotency keys or deterministic PR discovery.
- Partial-failure recovery.
- JSON and human-readable output.

**Exclude:**
- Final merge operation unless already part of TaskForge\'s explicit design.
- General invalid-state reconciliation beyond submission-specific recovery.

## Acceptance Criteria

1. `taskforge submit <task>` performs the complete submission workflow.
2. Submission records: repository identity, task branch, base branch, submitted SHA, remote branch SHA, PR provider, PR identifier, PR URL, PR head SHA, PR base, PR state, mergeability, required-check status.
3. Re-running submission after success does not create another PR.
4. Re-running submission after a partial failure resumes safely.
5. If the remote branch exists but the PR does not, submission creates the PR.
6. If the PR exists but recorded metadata is absent, submission reconciles and records it.
7. If an existing PR points to another task or incompatible branch, submission fails safely.
8. Submission never transitions a task directly to Done.
9. Submission invalidates stale gate evidence when HEAD changes.
10. Submission rejects unrelated inherited commits unless explicitly operating in approved stacked-task mode.
11. JSON output includes a stable result code and required next action.
12. Human-readable output does not equate successful push with successful submission.
13. A provider or network failure leaves sufficient local state to resume deterministically.
14. Audit events are emitted for each externally visible submission step.

## Required Tests

- Fresh submission creates branch and PR.
- Existing remote branch, missing PR.
- Existing PR, missing local metadata.
- Interrupted after push and before PR creation.
- Interrupted after PR creation and before state persistence.
- Duplicate invocation.
- HEAD changed after prior submission.
- PR head mismatch.
- Wrong base branch.
- Conflicting PR.
- Provider API timeout.
- Unauthorized provider operation.

## Completion Evidence

- Submission state diagram.
- Failure/retry matrix.
- Example JSON output for success, partial recovery, conflict, and blocked review.
- Demonstration that repeated submission converges on one PR.

## Dependencies

Depends on TASK-255 (Enforce PR-Backed Terminal Task State).

---

_Source: docs/taskforge-agentic-workflow-hardening-tasks.md_


## Agent Notes

### Implementation Summary

Enhanced cmdSubmit to be the authoritative submission operation:
- Auto-checkpoint uncommitted changes before push
- Push the task branch
- Create PR if absent, reconcile if existing (idempotent)
- Record submitted_sha, PR metadata via withTaskStateTransaction
- Transition task status to Submitted
- JSON and human-readable output
- Add findPullRequestByBranch to GitHub service
