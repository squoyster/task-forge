---
id: TASK-113
type: Refactor
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-113: Move Dependency Steward into optional plugin

## Goal

## Rationalization Roadmap: TASK-RAT-010\n\n### Objective\nKeep dependency scanning useful but remove it from core. Create src/plugins/dependency-steward/, register commands only when plugin enabled, move package-manager code behind PackageProvider.\n\n### Acceptance Criteria\n- Core does not import package-manager-specific scanner code\n- Dependency plugin can be disabled\n- Findings can still generate TaskForge tasks\n- Missing external scanners produce clear next actions

## Acceptance Criteria

- [ ]

## Agent Notes
