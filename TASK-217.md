---
id: TASK-217
type: Task
status: In Progress
priority: P0
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
context_hash: 4b1b24ca887b26ba
---

# TASK-217: Wire command state machines into all lifecycle commands with guidance adapter interface

## Goal

Wire the command state machines (command-states.ts) into all lifecycle commands so every invocation returns a CommandResult with no unhandled states.

Create a GuidanceAdapter interface that takes CommandResult guidance and pushes it to the agent framework's todo list:
- For OpenCode: integrate with todowrite tool to add guidance as todo items
- Interface must be extensible for other agent frameworks (Claude, Cursor, etc.)

Commands to wire:
1. next → nextStateMachine
2. claim → claimStateMachine
3. start → startStateMachine
4. checkpoint → checkpointStateMachine
5. gates → gatesStateMachine
6. submit → submitStateMachine
7. done → doneStateMachine
8. new → newStateMachine

Each command must:
- Build conditions object from runtime state
- Call the appropriate state machine function
- Return the CommandResult (no unhandled branches)
- Pass guidance through the GuidanceAdapter to push to agent todo list
- Display human-readable output to terminal

The GuidanceAdapter interface:
- pushGuidance(result: CommandResult): void
- Implementations: OpenCodeGuidanceAdapter (todowrite), NoOpGuidanceAdapter (CLI only)

## Acceptance Criteria

- [ ] GuidanceAdapter interface created with `pushGuidance(result: CommandResult): void` method
- [ ] NoOpGuidanceAdapter implementation for CLI-only mode
- [ ] OpenCodeGuidanceAdapter implementation using todowrite tool
- [ ] `next` command wired to `nextStateMachine` with conditions built from runtime state
- [ ] `claim` command wired to `claimStateMachine` with conditions built from runtime state
- [ ] `start` command wired to `startStateMachine` with conditions built from runtime state
- [ ] `done` command wired to `doneStateMachine` with conditions built from runtime state
- [ ] `new` command wired to `newStateMachine` with conditions built from runtime state
- [ ] All commands return CommandResult with no unhandled states
- [ ] Guidance displayed in both JSON output and human-readable terminal output
- [ ] All verification gates pass: typecheck, lint, build, test

## Agent Notes

### 2026-05-27 System
- Worktree created manually at /Volumes/Transcend/devel/worktrees/TASK-217
- Branch: agent/TASK-217-wire-command-state-machines
- Session resumed after previous claim push failures

### 2026-05-27 System
- Task unlocked (forced) — previous claim was held by session "4689e8a843"

### 2026-05-27 System
- Task claimed via taskforge start TASK-217
- Session: 4689e8a843
- Branch: agent/TASK-217-wire-command-state-machines-into-all-lif--4689e8a843
