---
id: TASK-049
type: Documentation
status: Done
priority: P1
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: true
dependsOn:
  - TASK-046
context_hash: 27705145f76d1ff7
spec_hash: 2e5f7076c57e05b5
issue: 109
---

# TASK-049: Branch Protection / Ruleset Guidance for `task-state`

## Goal

Document and implement repository protections preventing agents from directly pushing to `task-state`. CLI guardrails and doctor-lock are cooperative — hard enforcement requires branch protection.

## Deliverables

- `docs/control-plane-hardening.md` — threat model, credential tiers, emergency recovery
- `docs/github-task-state-protection.md` — concrete GitHub settings
- Optional: `.github/workflows/task-state-validate.yml`

## Key Points

- Protect `task-state` branch from direct pushes
- Require `taskforge validate-state --strict` in CI
- Credential tiers: read-only agent, implementer, recovery/bot, admin
- Document that `.doctor-lock` is cooperative without branch protection

## Acceptance Criteria

- [ ] Control-plane hardening documentation exists
- [ ] GitHub branch protection guidance for task-state
- [ ] Credential separation documented by capability level
- [ ] `humanInterventionRequired: true` — branch protection is manual in GitHub

## Dependencies

TASK-046.

## Risk Level

Medium.

## Agent Notes

### 2026-05-22 System
- Task marked Done (forced)
- Completed despite gate failures — forced.
- Worktree removed: /Volumes/Transcend/devel/worktrees/task-forge/TASK-049
- Worktree and branch fields cleared from task frontmatter.

### 2026-05-22 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-049

### 2026-05-22 System
- Task claimed via taskforge start TASK-049
- Session: 55f965a6c3
- Branch: agent/TASK-049-branch-protection-ruleset-guidance-for-t--55f965a6c3
