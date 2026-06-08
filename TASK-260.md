---
id: TASK-260
type: Feature
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-260: MAKE CLEANUP INTEGRATION-AWARE AND RECOVERABLE

## Goal

Describe the desired outcome.

## Acceptance Criteria

- [ ]

## Agent Notes


## Problem

Agents can remove worktrees and local branches after only checking that commits were pushed. This eliminates convenient recovery context before PR existence, mergeability, checks, and integration status are known.

## Task Description

Implement policy-driven cleanup for worktrees and branches.

Default cleanup should occur only after successful integration. Cleanup of an open submitted task must require stronger evidence and must preserve a deterministic recovery reference.

## Agentic Implementation Prompt

> Implement safe, lifecycle-aware worktree and branch cleanup.
>
> Cleanup must consume authoritative TaskForge and provider state. It must not infer safety from a clean worktree or successful push alone.
>
> Define cleanup policies for: merged task, open PR, conflicting PR, failed checks, abandoned task, local-only work, remote-only branch, missing worktree, doctor-authorized recovery.
>
> Default behavior: merged tasks may be cleaned automatically after verification, open PRs are retained unless an explicit configured policy permits cleanup, conflicting or failed tasks are retained, abandoned tasks create an archive reference before deletion, local-only or unsubmitted work is never deleted automatically.
>
> Ensure cleanup is resumable and auditable.

## Acceptance Criteria

1. Default cleanup requires a merged PR for code-bearing tasks.
2. Cleanup verifies the remote integration state before deletion.
3. Open-PR cleanup, when explicitly allowed, requires: clean worktree, remote branch exists, remote SHA equals local HEAD, PR exists, PR head SHA equals local HEAD, task metadata is persisted.
4. Conflicting PRs are not automatically cleaned.
5. Failed-check PRs are not automatically cleaned unless policy explicitly allows it.
6. Abandonment creates a recovery reference before deleting local state.
7. Cleanup never deletes a branch containing unpushed commits.
8. Cleanup never deletes a dirty worktree without explicit Doctor/Human destructive authorization.
9. Partial cleanup can be resumed.
10. Cleanup emits before/after audit events.
11. Reconciliation can identify partial or inconsistent cleanup.
12. JSON output reports each retained, archived, removed, or blocked resource.

## Required Tests

- Merged PR cleanup.
- Open PR retained.
- Explicit open-PR cleanup.
- Conflicting PR.
- Dirty worktree.
- Unpushed commit.
- Missing remote branch.
- Abandoned task archive.
- Interrupted cleanup.

## Completion Evidence

- Cleanup decision table.
- Archive-reference format.
- Demonstration that conflicting tasks remain recoverable.

## Dependencies

Depends on TASK-255 (Enforce PR-Backed Terminal Task State), TASK-256 (Make Submission Atomic and Idempotent), and TASK-257 (Add Lifecycle Reconciliation and Invalid-State Detection).

---

_Source: docs/taskforge-agentic-workflow-hardening-tasks.md_
