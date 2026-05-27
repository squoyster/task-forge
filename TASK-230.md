---
id: TASK-230
type: Task
status: Ready
priority: P0
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
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

Acceptance criteria should verify:
- Session file written on claim/start
- Session file readable on restart
- Session recovery works in resume command
- Session file cleaned up on done/release
- Multiple worktrees can have independent session files

## Acceptance Criteria

- [ ]

## Agent Notes
