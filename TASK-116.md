---
id: TASK-116
type: Documentation
status: Ready
priority: P0
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-116: Document command next-action semantics and state-transition outcomes

## Goal

## Rationalization Roadmap: TASK-RAT-017

### Objective
Document the command-output contract for driving agent behavior. Every agent-facing command should have deterministic next-action guidance.

### Required docs
docs/architecture/next-action-model.md, docs/commands/agent-facing-commands.md, docs/commands/state-transition-matrix.md

### Acceptance Criteria
- Agent authors can determine what to do next solely from command output
- JSON output has stable documented schema
- Each state transition has documented expected next action
- Includes examples for failing tests, broken harness, missing secret, push rejection, dirty worktree, stale claim

## Acceptance Criteria

- [ ]

## Agent Notes
