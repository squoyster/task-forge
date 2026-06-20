---
id: TASK-262
type: Feature
status: Rejected
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
spec_hash: 79ea5d767f3af1fe
---

# TASK-262: PERSIST STRUCTURED GATE EVIDENCE BY COMMIT SHA

## Goal

Describe the desired outcome.

## Acceptance Criteria

- [ ]

## Agent Notes

### 2026-06-20T00:00:00Z System
- Task rejected: Backlog cleared for TaskForge Slimming Refactor focus.


## Problem

Agents reported warning-bearing lint output as "clean," and shell pipelines could obscure the actual exit code. Gate status was represented conversationally rather than as durable, SHA-bound evidence.

## Task Description

Implement TaskForge-owned gate execution and evidence storage.

Gate evidence must be structured, bound to the exact commit SHA, invalidated when the implementation changes, and reported precisely.

## Agentic Implementation Prompt

> Implement a structured quality-gate subsystem used by checkpoint, submit, review, and completion policy.
>
> Execute configured commands directly through a process API or a shell mode that preserves the authoritative exit status. Do not rely on truncated pipeline output as proof of success.
>
> Record for each gate:
>
> - gate identifier,
> - command or runner,
> - start/end time,
> - duration,
> - exit code,
> - stdout/stderr artifact references,
> - warning count when available,
> - test totals and failures when available,
> - commit SHA,
> - environment fingerprint,
> - required versus advisory status.
>
> A passing gate with warnings must be reported as pass_with_warnings, not clean.
>
> Any change to HEAD must invalidate prior required gate evidence unless the gate explicitly supports a broader cache key.

## Acceptance Criteria

1. Gate evidence is stored against an exact commit SHA.
2. Changing HEAD invalidates stale required evidence.
3. Required and advisory gates are distinguished.
4. Results support at least: pass, pass_with_warnings, fail, error, skipped, stale.
5. Shell pipelines cannot mask the authoritative process exit code.
6. Test counts and warning counts are captured where parsers are configured.
7. Submission and completion policy consume structured evidence, not conversational claims.
8. Human-readable output states exact warning and failure counts.
9. JSON output uses a versioned schema.
10. Logs can be truncated for display without losing full artifact evidence.
11. Gate retries are auditable.
12. Agent prompts prohibit saying "all gates clean" when warnings exist.

## Required Tests

- Pass without warnings.
- Pass with warnings.
- Nonzero exit hidden behind a shell pipeline.
- Test failure.
- Parser failure with command success.
- HEAD changed after gates.
- Advisory failure.
- Required failure.
- Interrupted gate.

## Completion Evidence

- Gate result schema.
- Example outputs.
- Demonstration that stale gate evidence blocks submission or completion as configured.

## Dependencies

Depends on TASK-256 (Make Submission Atomic and Idempotent).

---

_Source: docs/taskforge-agentic-workflow-hardening-tasks.md_
