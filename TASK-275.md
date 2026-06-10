---
id: TASK-275
type: Task
status: Done
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
pr: 29
---


# TASK-275: Fix MCP captureStdout for Node 24 getter-only process.stdout

## Goal

Describe the desired outcome.

## Acceptance Criteria

- [x]  starts without crashing
- [x] MCP tool invocations (next, status, start, done, checkpoint, gates) return results instead of throwing
- [x] All existing tests still pass (744 tests)

## Agent Notes

### 2026-06-10T00:00:00Z System
- Task marked Done

### 2026-06-10T00:00:00Z System
- Report generated — task moved to Implementation Complete
- Changed files: .taskforge-session.json, dist/cli.js, dist/cli.js.map, src/commands/mcp.ts
- Commits: cd41887 fix: replace process.stdout assignment with Object.defineProperty in captureStdout
- AC section: present
- AC has blank items

### 2026-06-10T00:00:00Z System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-275

### 2026-06-10T00:00:00Z System
- Task claimed via taskforge start TASK-275
- Session: 88cbb3df47
- Branch: agent/TASK-275-fix-mcp-capturestdout-for-node-24-getter--88cbb3df47
