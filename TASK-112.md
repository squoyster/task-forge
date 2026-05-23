---
id: TASK-112
type: Refactor
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-112: Make OpenCode an optional AgentProvider

## Goal

## Rationalization Roadmap: TASK-RAT-009\n\n### Objective\nMove OpenCode-specific behavior out of core command flows. OpenCodeAgentProvider provides start instructions, prompt packet formatting, transcript export guidance, and optional detection.\n\n### Acceptance Criteria\n- cmdStart does not hardcode opencode\n- cmdPrompt uses selected agent provider\n- Generic mode remains useful for any CLI coding agent\n- If OpenCode provider selected but command missing, emit next action to install or switch to generic

## Acceptance Criteria

- [ ]

## Agent Notes
