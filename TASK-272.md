---
id: TASK-272
type: Bug
status: Done
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
context_hash: c920478ff4788012
branch: agent/TASK-272-fix-mcp-capturestdout-crash-in-strict-mo--78ddab2c8c
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-272
---

# TASK-272: Fix MCP captureStdout crash in strict mode on Node 24

## Goal

## Goal

Fix the MCP server crash when handling tool invocations by replacing the illegal `process.stdout = capture` assignment with `Object.defineProperty`.

## Problem

The `captureStdout` function in `src/commands/mcp.ts` tries to reassign `process.stdout` to a custom Writable stream:

```typescript
(process as unknown as Record<string, unknown>).stdout = capture;
```

In Node.js v24, `process.stdout` is defined as a getter-only property. TypeScript compiles with `"use strict"` by default, and in strict mode, assigning to a getter-only property throws:

```
TypeError: Cannot set property stdout of #<process> which has only a getter
```

This breaks every MCP tool handler (taskforge_next, taskforge_status, taskforge_start, taskforge_done, etc.).

## Fix

Replace the assignment with `Object.defineProperty` to temporarily swap the getter, adding a no-op setter to prevent the strict-mode error.

## Acceptance Criteria

1. `taskforge mcp` starts without crashing
2. MCP tool invocations (next, status, start, done, checkpoint, gates) return results instead of throwing
3. All existing tests still pass

## Required Tests

- Existing test suite continues to pass (737 tests)

## Completion Evidence

- `src/commands/mcp.ts` updated with `Object.defineProperty` approach
- Tests pass

## Acceptance Criteria

- [ ]

## Agent Notes

### 2026-06-08T00:00:00Z System
- Task marked Done

### 2026-06-08T00:00:00Z System
- Report generated — task moved to Implementation Complete
- Changed files: none
- Commits: none
- AC section: present

### 2026-06-08T00:00:00Z System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-272

### 2026-06-08T00:00:00Z System
- Task claimed via taskforge start TASK-272
- Session: 78ddab2c8c
- Branch: agent/TASK-272-fix-mcp-capturestdout-crash-in-strict-mo--78ddab2c8c
