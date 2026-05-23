---
id: TASK-121
type: Refactor
status: Ready
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-121: Improve GitHub provider hygiene and compatibility

## Goal

Split GitHub provider into github-client, github-issues-provider, github-projects-v2-provider. Support user and org-owned Projects v2.

## Background

Rationalization Roadmap: TASK-RAT-013

## Acceptance Criteria

- [ ] GitHub provider is isolated
- [ ] GitHub issue body references task-state source of truth
- [ ] GitHub Projects v2 works for configured owner type or fails with clear next action

## Agent Notes
