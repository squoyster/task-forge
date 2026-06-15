---
id: TASK-250
type: Feature
status: Ready
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
spec_hash: 848a7858fdda5d58
---

# TASK-250: Add CLI command to append agent notes to task files

## Goal

The `appendAgentNote()` function exists in `src/core/task-store.ts` and is called internally by several commands (`done`, `block`, `release`, `heartbeat`, etc.), but there is no standalone CLI command for agents to add notes to a task file. Agents are forced to either edit the task-state branch file directly or wait for a lifecycle event to append notes.

## Acceptance Criteria

- [ ] A new CLI command `taskforge note <TASK-ID> <message>` (or similar) appends an agent note to the task file
- [ ] The note includes an ISO timestamp and the agent role (e.g., "Agent", "System") automatically
- [ ] The change is pushed to the `task-state` branch via the transactional layer
- [ ] The command validates the task exists and is in an appropriate status
- [ ] `taskforge note --help` shows clear usage documentation

## Agent Notes
