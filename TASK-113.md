---
id: TASK-113
type: Packaging
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-113: Make CLI available as both taskforge and task-forge

## Goal

Allow users and agents to invoke the CLI using either name: taskforge or task-forge. Update package.json bin mapping for both names, ensure help text mentions both names, add smoke test verifying both binaries resolve.

## Background

Rationalization Roadmap: TASK-RAT-008

## Acceptance Criteria

- [ ] Both commands invoke identical CLI behavior
- [ ] Documentation uses taskforge as canonical and notes task-forge alias
- [ ] Agent prompts accept either command but prefer taskforge internally

## Agent Notes
