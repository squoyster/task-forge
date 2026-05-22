---
id: TASK-042
type: Feature
status: Inbox
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
dependsOn:
  - TASK-040
  - TASK-041
---

# TASK-042: Doctor Agent & Self-Healing Workflow

## Goal

Define the "Doctor" agent role and its self-healing workflow. When a system inconsistency is detected (e.g., by `taskforge doctor`), a privileged doctor agent enters a checkpoint, repairs the state using whatever tools necessary (including raw git), creates bug tasks against TaskForge itself if the inconsistency was caused by a system defect, and releases the checkpoint.

## Background

The TASK-034 incident revealed a gap: an inconsistency (merged code, stale task status) went undetected until `next` recommended a phantom task. The `doctor` command exists but only reports — it can't fix. A doctor agent needs the authority to:

1. Stop all other agents (checkpoint — TASK-041)
2. Fix state directly (privileged capability — TASK-040)
3. File bugs against the system if the root cause is a defect

## Scope

### New/modified files:

- `src/commands/doctor.ts` — add `--fix` mode that repairs detected issues
- `src/commands/checkpoint.ts` — doctor workflow integration
- `.opencode/agent/doctor.md` — doctor agent definition
- `AGENTS.md` — document doctor agent role

### Doctor workflow:

```
1. doctor detects inconsistency (e.g., merged tasks not Done)
2. checkpoint start — "Doctor repair: fixing N stale tasks"
3. For each inconsistency:
   a. Repair state (update task status, clear locks)
   b. If caused by a system defect → create BUG task
4. checkpoint release
5. Report: what was fixed, what bugs were filed
```

### Doctor agent definition:

- Role: "Doctor Agent"
- Capability: `privileged`
- Purpose: Diagnose and repair system inconsistencies, file bugs against TaskForge
- Authority: Raw git access, checkpoint management, direct task-state mutation
- Triggered by: `taskforge doctor` detecting issues, or human request

### `doctor --fix` enhancements:

| Detection | Fix |
|-----------|-----|
| Task In Progress, branch merged to main | Mark task Done, clear lock |
| Task In Progress, worktree missing, no commits ahead | Reset to Ready, clear lock |
| Task In Progress, worktree missing, has unmerged commits | Move to Review |
| Orphan branches (no task file) | Report for manual cleanup |
| Orphan worktrees (no task file) | Report for manual cleanup |

## Acceptance Criteria

- [ ] Doctor agent definition exists in `.opencode/agent/doctor.md`
- [ ] `AGENTS.md` documents doctor role and capability
- [ ] `taskforge doctor --fix` repairs detected inconsistencies (with checkpoint)
- [ ] `doctor --fix` workflow: checkpoint start → fix → create bugs → checkpoint release
- [ ] `doctor --fix` is gated to privileged agents only
- [ ] Doctor can create BUG tasks against TaskForge itself
- [ ] All existing tests pass
- [ ] Tests cover: fix workflow, bug creation for system defects, checkpoint lifecycle

## Dependencies

- **TASK-040**: Agent Capability Levels
- **TASK-041**: Checkpoint Mechanism

## Test / Verification Command

```bash
npm run typecheck && npm run lint && npm run build && npm test -- --run
```

## Risk Level

Low — doctor agent is a human-invoked or scheduled role, not autonomous. Fixes are reversible.
