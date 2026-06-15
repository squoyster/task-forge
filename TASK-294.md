---
id: TASK-294
type: Bug
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
spec_hash: 809208ff5d8be20d
---

# TASK-294: Make taskforge pr authenticate predictably or fall back to gh

## Goal

## Goal
Make `taskforge pr TASK-ID` reliably create pull requests when GitHub CLI authentication is available, or fail with an explicit auth recovery path when neither TaskForge GitHub credentials nor `gh` credentials are usable.

## Background
During TASK-224, `taskforge pr TASK-224` attempted GitHub API PR creation and failed with `401 Requires authentication`, while `gh auth status` showed a valid authenticated GitHub CLI session with `repo` scope. The workflow required manual `gh pr create` fallback.

## Acceptance Criteria
- [ ] `taskforge pr` performs a clear authentication preflight before attempting PR creation.
- [ ] If TaskForge API credentials are unavailable but `gh` is authenticated, `taskforge pr` either uses `gh` as an explicit fallback or returns a valid next command that uses `gh pr create` with all required arguments.
- [ ] If no usable authentication exists, output includes a concrete recovery command such as `gh auth login` or required config/env names.
- [ ] JSON output distinguishes API-auth failure from network failure, missing remote branch, and duplicate PR.
- [ ] Tests cover authenticated API path, missing API token with authenticated `gh`, missing all auth, and duplicate-existing-PR behavior.
- [ ] The command does not leave task-state claiming PR creation succeeded when the PR was not created.

## Evidence
Observed in TASK-224: `taskforge pr TASK-224` failed with GitHub API 401 while `gh auth status` succeeded for account `squoyster`; manual `gh pr create` was required after branch publication.

## Acceptance Criteria

- [ ]

## Agent Notes
