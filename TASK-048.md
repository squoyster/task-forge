---
id: TASK-048
type: Refactor
status: Done
priority: P0
agentRole: Implementer
riskLevel: High
humanInterventionRequired: false
dependsOn:
  - TASK-045
context_hash: 27705145f76d1ff7
spec_hash: 9d5ee97818c3c2a5
issue: 108
---

# TASK-048: Replace `jitteredPush` With Transactional CAS Reapply

## Goal

Replace the low-level `jitteredPush()` with true transactional compare-and-reapply semantics. Current `jitteredPush` commits locally first, then rebases on conflict — meaning the conflict callback sees the caller's already-committed mutation, not clean remote state.

## Correct Flow

```
fetch fresh state → capture HEAD → apply mutation in memory → validate → commit → push
if rejected: discard local → reload fresh → re-apply mutation → retry
```

## Migration Scope

Migrate at minimum: `claim`, `start`, `sweep`, doctor-lock creation/removal.

## Acceptance Criteria

- [ ] Transactional CAS/reapply path exists (builds on TASK-045)
- [ ] `jitteredPush()` deprecated for high-risk commands
- [ ] Mutation re-applied to fresh state on conflict (not rebased)
- [ ] Aborts cleanly if preconditions no longer hold
- [ ] Tests cover conflict/retry semantics
- [ ] All existing tests pass

## Dependencies

TASK-045.

## Risk Level

High.

## Agent Notes

### 2026-05-22 System
- Task marked Done (forced)
- Completed despite gate failures — forced.
- Worktree removed: /Volumes/Transcend/devel/worktrees/task-forge/TASK-048
- Worktree and branch fields cleared from task frontmatter.

### 2026-05-22 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-048

### 2026-05-22 System
- Task claimed via taskforge start TASK-048
- Session: 87a05333d2
- Branch: agent/TASK-048-replace-jitteredpush-with-transactional--87a05333d2
