---
id: TASK-110
type: Packaging
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-110: Make CLI available as both taskforge and task-forge

## Goal

## Rationalization Roadmap: TASK-RAT-008

### Objective
Allow users and agents to invoke the CLI using either name: taskforge or task-forge.

### Implementation
1. Update package.json bin mapping for both names
2. Ensure help text mentions both names
3. Add smoke test verifying both binaries resolve
4. Update README and generated prompts

### Acceptance Criteria
- Both commands invoke identical CLI behavior
- Documentation uses taskforge as canonical, notes task-forge alias
- Agent prompts accept either command but prefer taskforge

## Acceptance Criteria

- [ ]

## Agent Notes
