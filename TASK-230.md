---
id: TASK-230
type: Task
status: In Progress
priority: P0
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
assignee: 318727b9f6
claimed_at: '2026-05-28 03:46:34'
context_hash: 50d25db1ab2dcfd7
branch: agent/TASK-230-implement-quasi-persistent-session-id-st--318727b9f6
---

# TASK-230: Implement quasi-persistent session ID storage for agent recovery

## Goal

Create a mechanism to persist the current agent session ID across restarts so agents can recover their claimed task without relying on ephemeral state.

Current problem: Session ID is stored only in memory/environment. If the agent process restarts, the session is lost and the agent cannot identify which task it was working on. This causes:
- Orphaned worktrees that can't be resumed
- Stale locks that require manual cleanup
- Lost context about in-progress work

Proposed solution: Use a session state file in the worktree directory (.taskforge-session.json) that stores:
- session_id: The unique session identifier
- task_id: The task being worked on
- claimed_at: When the task was claimed
- worktree_path: Absolute path to the worktree
- last_heartbeat: Last heartbeat timestamp

Alternative approaches considered:
1. Environment variable - Won't persist across terminal sessions
2. Git config local to worktree - More complex to read/write
3. File in project root - Doesn't work for multiple concurrent worktrees
4. File in worktree - Best option, survives restarts and is worktree-specific

Implementation:
1. Create SessionState interface and file I/O utilities
2. Write session file when claim/start succeeds
3. Read session file on agent startup to recover context
4. Update heartbeat command to refresh last_heartbeat
5. Add cleanup on done/release to remove session file
6. Add session recovery to resume command

The session file should be in .gitignore so it doesn't get committed.

### Enhanced Resume Command

`taskforge resume` (without args) must identify the most likely task being worked on and provide full recovery context:

1. **Session file recovery**: If `.taskforge-session.json` exists in any worktree, use it to identify the task
2. **Branch session matching**: If no session file, scan for In Progress tasks where `assignee` matches the current branch's session ID
3. **Dirty worktree fallback**: If no session match, find In Progress tasks with worktrees that have uncommitted changes
4. **Ownership check**: If the task is claimed by a different session, report the conflict and offer to unlock
5. **Context display**: Show task goal, acceptance criteria status, last agent notes, and worktree location
6. **Todo list update**: Output structured next actions and AC checks needed to complete the task
7. **JSON output**: Return full recovery context in machine-readable format for agent frameworks

Reconciliation with current architecture:
- Uses existing `checkOutstandingSessionTasks()` for branch-based session matching
- Uses existing `checkUncommittedWorktrees()` for dirty worktree detection
- Uses existing `listWorktrees()` to enumerate active worktrees
- Adds session file as a new recovery source (higher priority than branch matching)
- Maintains invariant: only one In Progress task per session at a time
- Maintains invariant: worktree path stored in task frontmatter stays authoritative

Acceptance criteria should verify:
- Session file written on claim/start
- Session file readable on restart
- Session recovery works in resume command
- Session file cleaned up on done/release
- Multiple worktrees can have independent session files
- `taskforge resume` without args finds the correct task
- Resume displays AC status and next steps
- Resume handles ownership conflicts gracefully
- JSON output includes full recovery context

## Acceptance Criteria

- [ ]

## Agent Notes

### 2026-05-28 System
- Task claimed via taskforge start TASK-230
- Session: 318727b9f6
- Branch: agent/TASK-230-implement-quasi-persistent-session-id-st--318727b9f6
