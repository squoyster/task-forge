---
id: TASK-015
type: Feature
status: In Progress
priority: P1
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
assignee: f2b07d4831
claimed_at: '2026-05-22 03:06:44'
---

# TASK-015: Jittered Retries for Optimistic Concurrency

## Goal

Make task claiming robust in a multi-agent environment by adding jittered retry logic when `git push` fails due to a non-fast-forward rejection on the `task-state` branch.

## Background

When two agents attempt to claim a task simultaneously, one will succeed in pushing to the `task-state` branch and the other will get a non-fast-forward rejection. The current code simply fails. The prompt describes a more resilient flow:

1. Agent updates frontmatter (`assignee`, `claimed_at`, `status`)
2. Agent commits and tries to push
3. If push rejected (non-fast-forward): catch, `git pull --rebase`, wait 2-10s random jitter, re-check task status, retry or drop

This pattern is well-known in optimistic concurrency systems (like Kubernetes controllers or etcd) and prevents split-brain.

## Scope

Modified files:
- `src/commands/start.ts` — add jittered retry loop around the claiming step
- `src/core/git.ts` — add `jitteredPush()` helper that implements the retry/rebase/jitter pattern
- `src/commands/sweep.ts` — apply same jittered push pattern to sweep writes
- Tests for jittered push behavior

## Acceptance Criteria

- [ ] `jitteredPush()` helper exists in `git.ts`
- [ ] `jitteredPush()` catches non-fast-forward push rejections
- [ ] On rejection, executes `git pull --rebase` in the task-state worktree
- [ ] Waits a random 2-10 second jitter period before retrying
- [ ] Re-reads the task status after rebase
- [ ] If another agent already claimed the task: aborts cleanly with a message
- [ ] If task is still available: retries the push (up to 3 retries max)
- [ ] `taskforge start` uses `jitteredPush()` for its claiming step
- [ ] `taskforge sweep` uses `jitteredPush()` for its state changes
- [ ] All existing tests continue to pass

## Test / Verification Command

```bash
npm run typecheck && npm run lint && npm run build && npm test -- --run
```

## Dependencies

TASK-014 (Sweeper Protocol + field rename) — must be merged first.

## Risk Level

Low — the jittered retry logic is a safety net around existing push operations. No behavior change in the success path.

## Continuation Policy

Auto-continue unless a stopping condition occurs.

## Agent Notes

### 2026-05-22 System
- Task started via taskforge start TASK-015
- Session: f2b07d4831
- Branch: agent/TASK-015-jittered-retries-for-optimistic-concurre--f2b07d4831
- Worktree: /Volumes/Transcend/devel/worktrees/TASK-015
