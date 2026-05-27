---
id: TASK-031
type: Feature
status: Done
priority: P3
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-031: Add `resume` Command — Re-enter Existing Task Workspace

## Goal

Add `taskforge resume TASK-ID` that re-enters an existing task workspace: validates the worktree exists, checks out the correct branch, and prints the agent start instructions — without claiming or creating anything new.

## Background

Agents sometimes need to return to a task after interruption. `taskforge start` claims and creates, which is wrong for re-entry. `resume` is the counterpart: it validates existing state and provides re-entry context.

## Usage

```bash
taskforge resume TASK-023           # Re-enter, print workspace instructions
taskforge resume TASK-023 --json     # Structured output with workspace paths
```

## Behavior

- Checks the task exists and is claimed by current session
- Verifies worktree exists at expected path
- Verifies branch exists
- Prints `cd` and agent instructions (like `start` but without claiming)
- Refuses if task is not In Progress

## Acceptance Criteria

- [ ] `taskforge resume TASK-ID` validates worktree and branch exist
- [ ] Prints workspace context and agent instructions
- [ ] Refuses if task is not `In Progress`
- [ ] Refuses if worktree is missing (suggest `start` instead)
- [ ] `--json` output follows JSON contract with workspace details
- [ ] Does not mutate task state (no claim, no status change)

## Dependencies

TASK-012 (session locking), TASK-020 (inspect)

## Risk Level

Low — read-only validation command.

## Continuation Policy

Auto-continue.

## Agent Notes

### 2026-05-22 System
- Task started via taskforge start TASK-031
- Session: 9214c40c70
- Branch: agent/TASK-031-add-resume-command-re-enter-existing-tas--9214c40c70
- Worktree: /Volumes/Transcend/devel/worktrees/TASK-031
