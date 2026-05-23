---
id: TASK-066
type: Feature
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-066: Install git hooks via TaskForge init

## Goal

Generate and install .taskforge/hooks/pre-commit, pre-push, post-commit as backstop against direct git misuse. pre-commit: block commits on task-state/main, block staged tasks/*.md. pre-push: block push to main/task-state from agents, block force push. post-commit: append git audit event. Set git config core.hooksPath. Install with taskforge init --install-hooks.

## Acceptance Criteria

- [ ]

## Agent Notes
