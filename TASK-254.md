---
id: TASK-254
type: Bug
status: Done
priority: P1
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
branch: agent/TASK-254-session-id-churn-breaks-the-distributed--e2a31df025
---

# TASK-254: Session ID churn breaks the distributed mutex lock mechanism

## Goal

Fix the session ID generation so that a single agent produces a single stable session ID across all its invocations. Currently every `claim`/`start` call generates a new random 10-char hex ID, causing the same agent to accumulate multiple sessions. This breaks the mutex lock mechanism because an agent cannot prove it holds the lock — it has a different session ID each time.

## Background

### The mutex design

TaskForge uses a distributed mutex lock to prevent two agents from concurrently modifying the same task. The lock works like this:

1. Agent claims TASK-NNN → gets a session ID (`abc123`)
2. Task is assigned to session `abc123` in task-state
3. Agent's worktree branch is named `agent/TASK-NNN-desc--abc123` — the session ID in the branch name IS the lock key
4. `assertTaskOwnership()` proves the lock by comparing the current branch's embedded session ID against `task.assignee`
5. Another agent cannot prove the lock because its branch has a different session ID

### The bug: session ID churn

Every call to `claim` or `start` generates a brand new session ID. The same physical agent (same machine, same user) gets a different ID each time:

```ts
// src/commands/claim.ts:266
const sessionId = options?.session ?? generateSessionId();

// src/commands/start.ts:39
const sessionId = generateSessionId();
```

Evidence from the agent registry (single machine, single user):

| Task | Sessions | Worktree Path |
|------|----------|---------------|
| TASK-244 | `a34e9e4c25`, `5aa5bf71aa`, `cfbcd1d849`, `62ef43fef2` | same worktree |
| TASK-241 | `94d1b8bb55`, `6141b31587`, `83283a1f28` | same worktree |

### Why this breaks the mutex

When `claim TASK-252` was run from the TASK-244 worktree (branch `...--a34e9e4c25`), it generated a NEW session `31be71bad1` instead of reusing `a34e9e4c25`. This meant:

- TASK-252 was assigned to session `31be71bad1`
- The TASK-252 worktree branch was named `agent/TASK-252-...--31be71bad1`
- Running `done TASK-252` from the TASK-244 worktree failed because `a34e9e4c25` ≠ `31be71bad1`
- Even running `done TASK-252` from the CORRECT worktree (TASK-252's) failed because the nested worktree couldn't resolve the task-state path (TASK-253)

The session ID churn is a distinct bug from the path resolution issue (TASK-253). Even if TASK-253 is fixed, the session churn means an agent cannot reliably assert ownership of tasks it claimed in a previous session.

### What stability means

A single agent (same machine, same cloned repo) should have ONE session ID for its entire lifetime. This could be achieved by:

**Option A: Persist session ID in `.taskforge/session-id`**
- First invocation generates and saves the session ID
- Subsequent invocations read and reuse it
- Deleted `.taskforge/` directory = new identity (acceptable)

**Option B: Reuse session ID from current branch**
- If the current branch already has a session ID (e.g., `agent/TASK-NNN-desc--abc123`), extract and reuse `abc123`
- Only generate a new one if no branch session exists (e.g., running from `main`)
- This naturally gives a stable identity per worktree directory

Option B is simpler and doesn't require a new file. If you're in a task worktree, you reuse that task's session. If you're creating a new task from main, you get a new session (and it stays with you while you work in that worktree).

However, Option A is more robust: it survives switching branches, deleting worktrees, etc. It's the "true" agent identity.

Either option is acceptable, but the bug must be fixed.

## Acceptance Criteria

- [x] `taskforge claim` and `taskforge start` produce a stable session ID for the same agent across multiple invocations
- [x] When already in a worktree with an existing branch session ID, that ID is reused for new claims
- [x] The fix does not change the session ID format (10-char hex) or branch naming convention
- [x] `assertTaskOwnership()` continues to work: a task's `assignee` field matches the calling agent's session ID
- [x] Multiple agents on different machines still get different session IDs (collision-free)
- [x] All existing tests continue to pass (552 tests)

## Scope

**Allowed:**
- `src/commands/claim.ts` — change session ID resolution logic
- `src/commands/start.ts` — change session ID resolution logic
- `src/core/session.ts` — add a `resolveSessionId()` or similar that encapsulates stable session retrieval
- `src/util/paths.ts` or `.taskforge/` — add a session persistence mechanism if Option A is chosen

**Disallowed:**
- Changing the session ID format (must remain 10-char hex)
- Changing the branch naming convention (`agent/TASK-NNN-desc--sessionid`)
- Removing `assertTaskOwnership()` or `checkOutstandingSessionTasks()` — the mutex must remain

## Design Constraints

1. **Multiple agents on different machines must still get different session IDs.** This means the session ID must be random (or at least incorporate randomness). A deterministic hash of hostname+username is NOT sufficient.
2. **Session ID is NOT a security mechanism.** It's a mutex lock identifier. There's no authentication involved.
3. **The fix must work for agents running inside opencode/opencode sessions**, where `process.cwd()` may not be stable and the `.taskforge/` directory might be ephemeral.

## Test / Verification Command

```bash
# 1. Check current session
grep -c "session" .taskforge/session-id 2>/dev/null || echo "no session file yet"

# 2. Run claim twice, verify same session
npx taskforge claim TASK-254 --dry-run
# ... check session ID is stable

# 3. Full test suite
npm run typecheck && npm run lint && npm run build && npm test -- --run
```

## Dependencies

- None (independent fix from TASK-253, though both affect command reliability)

## Risk Level

Medium — the session ID is used as the mutex lock key. If two agents on the same machine somehow share a session file, they'd get the same ID and the mutex would fail. This is acceptable because `.taskforge/` is per-clone and agents should not share clones.

## Human Intervention Required?

No

## Continuation Policy

Auto-continue unless a stopping condition occurs.

## Agent Notes

### 2026-06-08 System
- Task claimed via taskforge claim TASK-254
- Session: e2a31df025

### 2026-06-08 System
- Task created during TASK-252 review to document session ID churn bug discovered in agent registry data

### 2026-06-08 Implementer
- **PR conflict resolution**: Rebuilt branch from origin/main (fb0c7c5), resolving all merge conflicts cleanly. The original branch contained 14 stale TASK-244 commits that caused conflicts with main. The new branch has only 1 commit with the TASK-254 changes.
- **`src/core/session.ts`**: Added `resolveSessionId(repoRoot)` that extracts the session ID from the current branch name via `parseSessionIdFromBranch()`, falling back to `generateSessionId()` only when no branch session exists. This is the core fix.
- **`src/commands/claim.ts`**: Replaced `generateSessionId()` with `await resolveSessionId(repoRoot)` — now reuses the current branch's session ID instead of creating a new one each invocation.
- **`src/commands/start.ts`**: Same change as claim.ts.
- **`src/commands/cleanup-cmd.ts`**: Removed unused `noopResult` import (lint fix).
- **`src/commands/git-facade.ts`**: Removed unused imports (lint fix).
- **`tests/commands/start.test.ts`**: Updated session mock to include `resolveSessionId`; renamed test from "generates a new session ID each invocation" to "reuses existing branch session ID when already in a task worktree".
- **`tests/commands/claim.test.ts`**: Added session mock (`resolveSessionId`, `checkOutstandingSessionTasks`) and `getCurrentBranch` to git mock.
- **Gates**: typecheck ✓, lint ✓, build ✓, test ✓ (all 621 tests pass).
- **Design**: The session ID embedded in the branch name IS the mutex lock key. By reusing it, the same agent naturally holds the same lock across multiple claims. `checkOutstandingSessionTasks()` now correctly prevents an agent from starting a second task while the first is still In Progress.
