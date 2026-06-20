---
id: TASK-251
type: Documentation
status: Rejected
priority: P3
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
spec_hash: b51846a443dd3ddf
---

# TASK-251: Update AGENTS.md workflow instructions to reference task-state branch not tasks/ dir

## Goal

The workflow instructions in `AGENTS.md` say "Read the current task file under `tasks/`". However, the legacy `tasks/` directory was removed (TASK-044). Task files now live on the `task-state` branch, checked out at a separate worktree path. The instructions in `AGENTS.md` and/or the system prompt are stale and mislead agents.

## Acceptance Criteria

- [ ] `AGENTS.md` is updated to reference the `task-state` branch worktree as the source of task files, not the `tasks/` directory
- [ ] The instruction "Update task file with agent notes via `appendAgentNote()`" is updated to reference the actual mechanism (CLI command after TASK-250 is implemented, or direct edit guidance)
- [ ] Any other references to `tasks/` files in agent-facing docs are corrected
- [ ] The `.agent/task.idx` index is updated if it references the old location

## Agent Notes

### 2026-06-20T00:00:00Z System
- Task rejected: Recalibration - pre-306 task pool retired, superseded by 306+ frontier.
