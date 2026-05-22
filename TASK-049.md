---
id: TASK-049
type: Documentation
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: true
dependsOn:
  - TASK-046
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
