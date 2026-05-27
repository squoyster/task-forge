---
id: TASK-216
type: Task
status: Ready
priority: P0
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-216: Define and implement command state machines for agentic workflow

## Goal

Define a state machine for each taskforge command that models the happy path and all error cases. The state machine must represent the proper agentic workflow for taking a task through its lifecycle: next → claim → start → work → checkpoint → gates → submit/pr → done.

Each command invocation must have explicit states:
- **Happy path**: return structured guidance for next step
- **Known error states**: return specific recovery guidance with machine-readable error codes
- **Unknown/unhandled states**: direct agent to create new task, request human input if action cannot be cleanly inferred

Commands to model:
1. `taskforge next` — task selection state machine
2. `taskforge claim` — claim state machine  
3. `taskforge start` — workspace creation state machine
4. `taskforge checkpoint` — commit state machine
5. `taskforge submit` — PR creation state machine
6. `taskforge gates` — verification state machine
7. `taskforge done` — completion state machine
8. `taskforge new` — task creation state machine

Key states to handle across commands:
- Uncommitted worktree changes (dirty state detection)
- Session ownership validation
- Doctor lock pauses
- Dependency blocks
- Stale claim recovery
- Push/transaction failures
- Gate failures with classification

Implementation:
- Create `src/core/command-states.ts` with state definitions and transition functions
- Each command returns a `CommandResult` with: state, nextAction, guidance, errorCode (if applicable)
- Wire into all lifecycle commands
- Add tests for all state transitions

## Acceptance Criteria

- [ ]

## Agent Notes
