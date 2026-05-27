---
id: TASK-232
type: Task
status: Ready
priority: P0
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
dependsOn: []
---

# TASK-232: Require clean worktree and pushed branch in done command before marking task Done

## Goal

The `taskforge done` command must refuse to mark a task Done if the worktree has uncommitted/dirty files or the branch has unpushed commits. This is a control-plane invariant: Done means the work is complete, committed, and pushed. Allowing Done with dirty worktrees creates invisible technical debt and broken state.

## Context

Multiple tasks (TASK-077, TASK-083, TASK-086, TASK-099, and dozens more) were marked Done despite having dirty worktrees with uncommitted files. The `cmdDone` function validates gates, status transition, ownership, control-file hash, and acceptance criteria — but never checks whether the worktree is clean or the branch is pushed.

## Acceptance Criteria

- [ ] `cmdDone` rejects with a clear error when the task's worktree has uncommitted/dirty files
- [ ] `cmdDone` rejects with a clear error when the task's branch has unpushed commits (ahead of remote)
- [ ] Error messages include actionable guidance: how to commit, how to push, and how to proceed
- [ ] JSON output includes structured `nextActions` with recovery commands
- [ ] State machine in `command-states.ts` gets new states for `WORKTREE_DIRTY` and `BRANCH_UNPUSHED`
- [ ] Invariant documented in TASKFORGE.md under a "Done Command Invariants" section
- [ ] Invariant documented in AGENTS.md as a mandatory pre-condition for calling `taskforge done`
- [ ] Tests added covering: dirty worktree rejection, unpushed branch rejection, clean worktree acceptance, `--force` bypass (human/doctor only)

## Agent Notes

