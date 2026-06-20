---
id: TASK-296
type: Bug
status: Rejected
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
spec_hash: 1a414e2dc74cd9fe
---

# TASK-296: Report PR mergeability after creation and return repair actions

## Goal

## Goal
Make TaskForge PR/submission workflow verify the created or existing pull request mergeability and return explicit repair steps when GitHub reports conflicts.

## Background
During TASK-224, PR #48 was created only after manual branch publication. Immediately after creation, `gh pr view` reported `mergeable: CONFLICTING`; after fetching and merging latest `main`, the PR became `MERGEABLE`. The workflow did not provide a clean TaskForge-driven next action for this state.

## Acceptance Criteria
- [ ] After PR creation or PR lookup, TaskForge checks GitHub mergeability when credentials/network are available.
- [ ] If GitHub reports `CONFLICTING`, output includes explicit safe recovery steps: fetch latest main, merge/rebase into the task branch, run gates, checkpoint, submit/update PR.
- [ ] If mergeability is unknown or pending, output distinguishes that from confirmed conflicts.
- [ ] `taskforge submit` and `taskforge pr` do not report a clean terminal/success state while the PR is confirmed conflicting.
- [ ] Tests cover mergeable, conflicting, unknown/pending, and GitHub API unavailable states.
- [ ] Documentation or command guidance clarifies that PR creation is not sufficient; mergeability and checks must also be green before task completion.

## Evidence
Observed in TASK-224: PR #48 existed but initially reported `CONFLICTING`; manual fetch/merge/gates were required before GitHub showed it ready to merge.

## Acceptance Criteria

- [ ]

## Agent Notes

### 2026-06-20T00:00:00Z System
- Task rejected: Backlog cleared to focus queue on TaskForge Slimming Refactor (TASK-307..315). Superseded, descoped, or obsoleted by refactor per specs/taskforge-slimming-refactor.md. Task record retained as historical reference; re-evaluate post-refactor.
