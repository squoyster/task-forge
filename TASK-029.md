---
id: TASK-029
type: Feature
status: Done
priority: P3
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
assignee: 5ac25d0a44
claimed_at: '2026-05-22 07:16:00'
---

# TASK-029: Safe Cleanup with Dry-Run

## Goal

Add `taskforge cleanup TASK-ID` with safety checks and `--dry-run` — refusing to destroy worktrees or branches with uncommitted changes, unpushed commits, or unknown branches unless `--force` is passed.

## Background

The current `done --cleanup` removes worktrees and branches unconditionally. The gap analysis says cleanup should refuse dangerous states:

| State | Default cleanup |
|---|---|
| Clean worktree, merged branch | remove |
| Dirty worktree | refuse |
| Branch ahead of main | refuse unless `--force` |
| Branch not pushed | refuse unless `--force` |
| Unknown task branch | refuse |

## Usage

```bash
taskforge cleanup TASK-023 --dry-run     # Preview what would be removed
taskforge cleanup TASK-023 --apply        # Execute cleanup (fails if unsafe)
taskforge cleanup TASK-023 --force        # Skip safety checks
taskforge cleanup TASK-023 --json          # Structured output
```

## Acceptance Criteria

- [ ] `taskforge cleanup TASK-ID --dry-run` reports what would be removed without mutating
- [ ] `--apply` removes worktree and branch only if safe (clean, pushed, not ahead)
- [ ] Refuses dirty worktrees with a clear message
- [ ] Refuses branches ahead of main with a clear message
- [ ] `--force` skips all safety checks
- [ ] `--json` output includes per-resource status (removed, skipped, reason)
- [ ] Uses `inspect` (TASK-020) for state classification
- [ ] Tests cover: dry-run, clean success, dirty refusal, ahead refusal, force override

## Dependencies

TASK-020 (Worktree Inspection), existing `removeWorktree`/`removeBranch` in git module

## Risk Level

Medium — destructive operation, safety checks are critical.

## Continuation Policy

Auto-continue.

## Agent Notes

### 2026-05-22 System
- Task started via taskforge start TASK-029
- Session: 5ac25d0a44
- Branch: agent/TASK-029-safe-cleanup-with-dry-run--5ac25d0a44
- Worktree: /Volumes/Transcend/devel/worktrees/TASK-029
