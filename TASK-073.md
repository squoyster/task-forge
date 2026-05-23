---
id: TASK-073
type: Refactor
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-073: Remove conflicting direct-git guidance for normal agents

## Goal

Eliminate instructions telling normal agents they may use git directly. Search docs and AGENTS.md for git push/pull/commit/worktree/checkout/branch references. Replace with taskforge facade commands (checkpoint, submit, diff, start, done). Doctor agent may use selected git commands under doctor protocol. Humans may still use git normally.

## Acceptance Criteria

- [ ]

## Agent Notes
