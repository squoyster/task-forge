---
id: TASK-110
type: Refactor
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-110: Make OpenCode an optional AgentProvider

## Goal

## Rationalization Roadmap: TASK-RAT-009

### Objective
Move OpenCode-specific behavior out of core command flows. OpenCodeAgentProvider should provide start instructions, prompt packet formatting, transcript export guidance, and optional detection.

### Acceptance Criteria
- cmdStart does not hardcode opencode
- cmdPrompt uses selected agent provider
- OpenCode transcript guidance is available through provider
- Generic mode remains useful for any CLI coding agent

### Agent next-action rules
- If OpenCode provider selected but command missing, emit next action to install/configure or switch to generic
- Do not block generic workflows because OpenCode is missing

## Acceptance Criteria

- [ ]

## Agent Notes
