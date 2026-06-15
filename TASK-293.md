---
id: TASK-293
type: Bug
status: Verify
priority: P0
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
assignee: 2f2abaf446
claimed_at: '2026-06-15 05:20:32'
context_hash: c325879bc50725fa
branch: agent/TASK-293-fix-submit-no-op-when-task-branch-is-ahe--2f2abaf446
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-293
---

# TASK-293: Fix submit no-op when task branch is ahead or remote branch is missing

## Goal

## Goal
Make `taskforge submit TASK-ID` accurately detect and act on branch publication state instead of returning `No changes to submit` while a task branch has local commits, lacks an upstream branch, or has no GitHub PR.

## Background
During TASK-224, `taskforge submit TASK-224` repeatedly returned success with `No changes to submit. Continue working on the task.` even though the branch was not present on GitHub and no PR existed. This forced manual `gh pr create` and explicit branch push recovery.

## Acceptance Criteria
- [ ] `submit` does not return a no-op when the task branch is ahead of its upstream, lacks an upstream, or has no matching remote branch.
- [ ] `submit` distinguishes all of these states in structured diagnostics: local branch ahead, missing upstream, missing remote head, missing PR, already submitted and current.
- [ ] When safe, `submit` pushes the task branch and proceeds to PR creation/update; when not safe, it returns explicit recovery commands.
- [ ] The no-op path is only used when the remote branch already points at the local HEAD and task submission metadata/PR state are consistent.
- [ ] Tests cover branch-ahead, missing-remote-branch, missing-PR, stale-submitted-metadata, and true-clean-noop cases.
- [ ] JSON and markdown outputs include valid next commands and do not claim success while required publication work remains.

## Evidence
Observed in TASK-224: `taskforge submit TASK-224` returned no-op even though `gh pr list --head ...` returned `[]`, `gh pr create` failed with missing head branch, and a manual branch push was required before PR #48 could be created.

## Acceptance Criteria

- [ ]

## Agent Notes

### 2026-06-15T00:00:00Z System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-293

### 2026-06-15T00:00:00Z System
- Task claimed via taskforge start TASK-293
- Session: 2f2abaf446
- Branch: agent/TASK-293-fix-submit-no-op-when-task-branch-is-ahe--2f2abaf446

### 2026-06-12T00:00:00Z System
- Field(s) updated via taskforge update: acceptanceCriteria
