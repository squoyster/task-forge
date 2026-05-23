---
id: TASK-096
type: Bug
status: Ready
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-096: Add clarifying context to doctor-lock warnings in claim and start

## Goal

## Background

When the doctor-lock is active, commands emit a warning. But the quality varies:

```
next.ts:34-35   → logWarn("System is in doctor recovery mode: X") + logInfo("All agents are paused until recovery is complete.")
claim.ts:60     → logWarn("System is in doctor recovery mode: X")  — no clarifying context
start.ts:64     → logWarn("System is in doctor recovery mode: X")  — text mode adds context, JSON mode does not
```

An agent seeing only the bare warning has no idea what to do — should they wait? Retry? Force through? The clarifying message from next.ts makes it clear: pause and wait for recovery to complete.

## Fix

Add "All agents are paused until recovery is complete." to the doctor-lock output in:
- `claim.ts` line 60 (both text and JSON modes)
- `start.ts` line 64 (JSON mode only — text mode already has it)

## Scope

- `src/commands/claim.ts` (~line 57-63)
- `src/commands/start.ts` (~line 61-66)

## Acceptance Criteria

- [ ] Doctor-lock warning in claim.ts includes clarifying "All agents are paused" message
- [ ] Doctor-lock warning in start.ts includes clarifying message in both text and JSON modes
- [ ] All three commands (next, claim, start) emit consistent doctor-lock messaging"

## Acceptance Criteria

- [ ]

## Agent Notes

### 2026-05-23 02:34 System
- Discovered during TASK-086 (project runtime configuration) — pre-existing test failures and CLI message audit findings.
