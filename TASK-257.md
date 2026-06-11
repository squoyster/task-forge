---
id: TASK-257
type: Feature
status: Done
priority: P0
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
context_hash: c920478ff4788012
spec_hash: 3e75b5224b0d1946
---

# TASK-257: ADD LIFECYCLE RECONCILIATION AND INVALID-STATE DETECTION

## Goal

Describe the desired outcome.

## Acceptance Criteria

- [ ]

## Agent Notes

### 2026-06-08T00:00:00Z System
- Cleanup: worktree and branch removed

### 2026-06-08T00:00:00Z System
- Report generated — task moved to Implementation Complete
- Changed files: none
- Commits: none
- AC section: present
- AC has blank items

### 2026-06-08T00:00:00Z System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-257

### 2026-06-08T00:00:00Z System
- Task claimed via taskforge start TASK-257
- Session: 6bd650dc97
- Branch: agent/TASK-257-add-lifecycle-reconciliation-and-invalid--6bd650dc97


## Problem

TaskForge can accumulate contradictory local, remote, task-state, worktree, and pull-request records. The system needs a deterministic way to detect and safely repair these inconsistencies.

## Task Description

Implement a reconciliation engine exposed through `taskforge reconcile` and integrated into `taskforge doctor`.

The engine must compare TaskForge state against repository, remote branch, worktree, and PR provider state, then classify discrepancies as safely repairable, human-decision-required, or destructive.

## Agentic Implementation Prompt

> Build an explicit reconciliation subsystem for TaskForge lifecycle state.
>
> Model reconciliation as observation, classification, and action:
>
> 1. Read TaskForge\'s recorded state.
> 2. Observe local Git, linked worktrees, configured remotes, and PR provider state.
> 3. Compute discrepancies without mutating anything.
> 4. Classify each discrepancy:
>    - safe automatic repair,
>    - explicit human/doctor decision required,
>    - unrecoverable or destructive.
> 5. Apply only deterministic safe repairs when `--fix` is specified.
> 6. Emit a complete audit record.
>
> Reconciliation must never hide data loss, rewrite branches, delete worktrees, or alter PRs merely to make metadata appear consistent.
>
> Provide stable finding codes so agents can reason about results programmatically.

## Required Invalid-State Detections

At minimum: DONE_WITHOUT_PR, DONE_WITH_UNMERGED_PR, DONE_WITH_CONFLICTING_PR, DONE_WITH_FAILED_CHECKS, DONE_SHA_NOT_REACHABLE, SUBMITTED_WITHOUT_PR, SUBMITTED_REMOTE_BRANCH_MISSING, SUBMITTED_SHA_MISMATCH, PR_HEAD_SHA_MISMATCH, PR_BASE_MISMATCH, ACTIVE_TASK_WORKTREE_MISSING, WORKTREE_WITHOUT_ACTIVE_TASK, DIRTY_INACTIVE_WORKTREE, LOCAL_ONLY_COMPLETED_BRANCH, NESTED_WORKTREE, TASK_BRANCH_BASE_CONTAMINATED, TASK_STATE_DIRECTLY_MODIFIED, STALE_GATE_EVIDENCE.

## Scope

**Include:**
- Observation adapters.
- Stable finding taxonomy.
- Dry-run report.
- Safe `--fix` operations.
- Human escalation guidance.
- Integration with `taskforge doctor`.
- Machine-readable output.

**Exclude:**
- Automatic conflict resolution.
- Automatic force-push.
- Automatic deletion of worktrees or branches unless covered by a separately approved cleanup policy.

## Acceptance Criteria

1. Reconciliation is read-only by default.
2. Every finding has: stable code, severity, observed evidence, expected invariant, safe-fix availability, recommended next action.
3. `--fix` applies only deterministic, non-destructive repairs.
4. Reconciliation detects every minimum state listed above.
5. A task incorrectly marked Done is demoted or flagged according to a documented deterministic policy.
6. Reconciliation never fabricates PR metadata.
7. Reconciliation never force-pushes, rebases, deletes, or merges without explicit separate authority.
8. Findings can be filtered by task, repository, severity, and code.
9. `taskforge next` can invoke reconciliation preflight and refuse new work when blocking inconsistencies exist.
10. All repairs generate auditable before/after state.
11. JSON schema is versioned.
12. Exit codes distinguish: clean, warnings, blocking findings, repair failure.

## Required Tests

- One test per finding code.
- Multiple simultaneous discrepancies.
- Provider unavailable.
- Remote unavailable.
- Missing local worktree but valid merged PR.
- Legacy task records.
- Dry run versus `--fix`.
- Idempotent repeated repair.

## Completion Evidence

- Finding catalog.
- Repair safety policy.
- Before/after examples.
- Demonstration that `taskforge next` blocks on unresolved integration contradictions.

## Dependencies

Depends on TASK-255 (Enforce PR-Backed Terminal Task State) and TASK-256 (Make Submission Atomic and Idempotent).

---

_Source: docs/taskforge-agentic-workflow-hardening-tasks.md_
