---
id: TASK-141
type: Feature
status: Ready
priority: P0
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
---
# Add Command Next-Action Envelope Type

## Goal

Define a standard command feedback contract that tells agents what to do next.

## Background

The CLI currently reports success/failure, but does not consistently direct agent behavior.

## Implementation Notes

Define a reusable result shape similar to:

```ts
interface CommandResultEnvelope<T = unknown> {
  ok: boolean;
  state: string;
  data?: T;
  nextAction: {
    kind: string;
    instruction: string;
    stop: boolean;
    allowedCommands: string[];
  };
}
```

## Acceptance Criteria

- [ ] A shared command result envelope type exists and includes `ok`, `state`, `nextAction.kind`, `nextAction.instruction`, `nextAction.stop`, and `nextAction.allowedCommands`.

## Agent Notes
