---
id: TASK-102
type: Feature
status: In Progress
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
assignee: e48843f322
claimed_at: '2026-05-23 12:20:20'
---

# TASK-102: Add branch protection automation script for init workflow

## Goal

## Goal
Create scripts/setup-branch-protection.sh that automates GitHub branch protection configuration via gh api. Supports dry-run mode. Can be invoked from taskforge init or CI.

## Scope
- scripts/setup-branch-protection.sh
- docs/github-task-state-protection.md

## Acceptance Criteria
- [ ] Script configures main branch protection (PR required, 1 approval, no force push, linear history)
- [ ] Script configures task-state branch protection (no PR required, no force push, linear history, required status check)
- [ ] DRY_RUN=true previews without applying
- [ ] Requires GITHUB_TOKEN with admin:repo scope
- [ ] Syntax-validated with bash -n

## Acceptance Criteria

- [ ]

## Agent Notes

### 2026-05-23 System
- Task claimed via taskforge claim TASK-102
- Session: e48843f322
