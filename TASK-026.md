---
id: TASK-026
type: Feature
status: Done
priority: P2
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
assignee: 825b0d9041
claimed_at: '2026-05-22 06:58:31'
---

# TASK-026: Safe Sweep with Dry-Run and Worktree Classification

## Goal

Integrate `taskforge inspect` into `taskforge sweep` so the sweeper classifies stale worktrees before resetting them. Add a `--dry-run` flag so agents/operators can preview sweep actions without mutating state.

## Background

The gap analysis identified that the current sweeper blindly resets any task with `claimed_at > 4h` to `Ready`, regardless of worktree state. This is dangerous — an agent that committed code but didn't mark Done would lose work.

The `inspect` command (TASK-020) already provides the necessary classification data. The sweeper should use it to make informed decisions:

| State | Sweep behavior |
|---|---|
| Agent crashed, no edits | Reset to Ready |
| Agent has dirty worktree | Log warning, do NOT reset; optionally mark `stale_dirty` |
| Agent committed but not done | Move to Review |
| Branch missing | Reset to Ready |
| Worktree missing | Reset to Ready |
| Worktree clean, no unique commits | Reset to Ready |

## Usage

```bash
taskforge sweep                 # Run with classification (safe default)
taskforge sweep --dry-run        # Preview what would happen
taskforge sweep --force          # Skip classification, reset all stale
taskforge sweep --json           # Structured output of actions taken
```

## Acceptance Criteria

- [ ] `taskforge sweep` calls `inspect` on each stale task before deciding action
- [ ] Dirty worktrees are NOT reset — logged with warning
- [ ] Worktrees with commits ahead of main are moved to `Review` instead of `Ready`
- [ ] `--dry-run` reports what *would* happen without mutating state
- [ ] `--force` skips classification and resets all stale tasks (current behavior)
- [ ] `--json` output includes per-task classification and action taken
- [ ] Tests cover: dry-run, dirty skip, ahead-of-main → Review, force override

## Dependencies

TASK-014 (Sweeper Protocol), TASK-020 (Worktree Inspection)

## Risk Level

Medium — changes core sweeper behavior but makes it safer.

## Continuation Policy

Auto-continue.

## Agent Notes

### 2026-05-22 System
- Task started via taskforge start TASK-026
- Session: 825b0d9041
- Branch: agent/TASK-026-safe-sweep-with-dry-run-and-worktree-cla--825b0d9041
- Worktree: /Volumes/Transcend/devel/worktrees/TASK-026
