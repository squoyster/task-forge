---
id: TASK-111
type: Refactor
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-111: Move Dependency Steward into optional plugin

## Goal

## Rationalization Roadmap: TASK-RAT-010

### Objective
Keep dependency scanning useful but remove it from core architecture. Create src/plugins/dependency-steward/, register commands only when plugin enabled, move package-manager code behind PackageProvider.

### Acceptance Criteria
- Core does not import package-manager-specific scanner code
- Dependency plugin can be disabled
- Findings can still generate TaskForge tasks
- Missing external scanners produce clear next actions

### Agent next-action rules
- If scanner missing, create setup task or report unavailable scanner
- If vulnerability is critical/high, create remediation task unless already exists
- If update is major or security-sensitive, require human review

## Acceptance Criteria

- [ ]

## Agent Notes
