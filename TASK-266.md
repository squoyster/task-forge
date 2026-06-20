---
id: TASK-266
type: Documentation
status: Rejected
priority: P2
agentRole: Planner
riskLevel: Low
humanInterventionRequired: false
spec_hash: c1fb7304a870c063
---

# TASK-266: RECORD ARCHITECTURE DECISION FOR AGENTIC REPOSITORY CONTROL

## Goal

Describe the desired outcome.

## Acceptance Criteria

- [ ]

## Agent Notes

### 2026-06-20T00:00:00Z System
- Task rejected: Recalibration - pre-306 task pool retired, superseded by 306+ frontier.


## Problem

Lifecycle semantics, authority boundaries, repository mutation rules, and recovery responsibilities are cross-cutting architectural decisions. Without a durable architecture record, code, prompts, and documentation will drift.

## Task Description

Create an Architecture Decision Record defining TaskForge\'s authoritative control model for agentic repository work.

## Agentic Implementation Prompt

> Write an ADR that records the final architecture for: task lifecycle states, definition of Done, authority of TaskForge versus raw Git, PR provider abstraction, worktree topology, branch provenance, submission idempotency, reconciliation, cleanup, human/doctor overrides, audit requirements, agent continuation and stopping points.
>
> The ADR must distinguish architectural invariants from GitHub-specific implementation details.
>
> Link the ADR from agent-development documentation and ensure every affected command references the same terminology.

## Acceptance Criteria

1. ADR defines authoritative lifecycle states.
2. ADR defines Done for code-bearing and non-code tasks.
3. ADR defines permitted mutation authorities.
4. ADR defines recovery and override authorities.
5. ADR defines required audit evidence.
6. ADR defines provider-neutral PR concepts.
7. ADR defines normal versus stacked branch behavior.
8. ADR defines cleanup safety policy.
9. ADR defines agent stopping points and human intervention points.
10. Existing documentation is linked or updated to avoid contradictory guidance.
11. Terms used in CLI help, prompts, and domain code match the ADR.
12. The ADR includes rejected alternatives and trade-offs.

## Completion Evidence

- ADR file.
- Documentation cross-reference list.
- Terminology consistency check.

## Dependencies

Tasks 255-265 may proceed in parallel; ADR should reflect finalized decisions.

---

_Source: docs/taskforge-agentic-workflow-hardening-tasks.md_
