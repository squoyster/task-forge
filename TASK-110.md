---
id: TASK-110
type: Refactor
status: In Progress
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
assignee: f8d0213c7b
claimed_at: '2026-05-23 17:57:15'
context_hash: f3613895c8a77f2e
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

### 2026-05-23 System
- Task claimed via taskforge start TASK-110
- Session: f8d0213c7b
- Branch: agent/TASK-110-make-opencode-an-optional-agentprovider--f8d0213c7b

### 2026-05-23 System
- Task claimed via taskforge start TASK-110
- Session: f8d0213c7b
- Branch: agent/TASK-110-make-opencode-an-optional-agentprovider--f8d0213c7b
