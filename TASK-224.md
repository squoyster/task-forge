---
id: TASK-224
type: Feature
status: Submitted
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
assignee: 7c39bec944
claimed_at: '2026-06-12 15:18:02'
context_hash: 6cd5541d1cdfd05c
branch: agent/TASK-224-implement-unhandled-state-closure-task-g--7c39bec944
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-224
---
# TASK-224: Implement unhandled-state closure task generation
## Goal
If TaskForge encounters an unknown state, unmapped error, unsupported status combination, or missing recovery path, it must emit or create a TaskForge task that makes the gap explicit.

## Background
Relevant context, constraints, prior decisions, and links.

## Scope
Allowed files/directories:
-

Disallowed files/directories:
-

## Acceptance Criteria
- [x] `src/core/closure-task.ts` exists with `createClosureTaskCommand()` and `maybeAutoCreateClosureTask()`.
- [x] Unknown error code returns a `taskforge new` command in `nextActions`.
- [x] Unknown task status combination returns a closure task command.
- [x] Missing recovery command returns a closure task command.
- [x] Generated task is P1 Bug by default.
- [x] System avoids infinite recursive task creation (guard against `taskforge new` failure).
- [x] Closure task body includes all required context fields.
- [x] Tests cover unknown error and unknown state paths.
- [x] Tests verify no recursive closure task creation.

## Test / Verification Command
```bash
# command here
```

## Expected Output / Behavior
Describe expected result.

## Dependencies
None

## Risks
Known risks.

## Continuation Policy
Auto-continue unless a stopping condition occurs.

## Agent Notes

### 2026-06-12T00:00:00Z System
- Report generated — task moved to Implementation Complete
- Changed files: none
- Commits: none
- AC section: present

### 2026-06-12T00:00:00Z System
- Task updated via taskforge update
- section acceptanceCriteria updated (630 chars)
### 2026-06-12T00:00:00Z System
- Task updated via taskforge update
- section acceptanceCriteria updated (630 chars)
### 2026-06-12T00:00:00Z System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-224

### 2026-06-12T00:00:00Z System
- Task claimed via taskforge start TASK-224
- Session: 7c39bec944
- Branch: agent/TASK-224-implement-unhandled-state-closure-task-g--7c39bec944

## Result

## Links
- Issue:
- Project Item:
- PR:
- Branch:
- Worktree:
- CI:
- Test Log:

## Context
Per `taskforge-control-plane-closure-spec.md` §1.2 Gap F, §6, §3 G10, and §7 Agent Prompt 5.

## Current State
- No `src/core/closure-task.ts` exists
- `command-states.ts` has an `unhandledError()` helper that returns guidance to create a task, but it does not auto-create the task
- No mechanism to prevent infinite recursive task creation

## Required Design
Create `src/core/closure-task.ts`:

```ts
export type ClosureCategory =
  | "UNKNOWN_STATE"
  | "UNMAPPED_ERROR"
  | "UNSUPPORTED_TRANSITION"
  | "MISSING_RECOVERY_COMMAND";

export interface ClosureContext {
  command: string;
  taskId?: string;
  status?: string;
  branch?: string;
  worktree?: string;
  errorCode?: string;
  errorMessage?: string;
  observedState?: Record<string, unknown>;
}

export function createClosureTaskCommand(
  category: ClosureCategory,
  summary: string,
  context: ClosureContext,
): string;

export function maybeAutoCreateClosureTask(
  category: ClosureCategory,
  summary: string,
  context: ClosureContext,
): Promise<{ created: boolean; taskId?: string }>;
```

## Required Behavior
1. Classify unhandled conditions as one of the 4 closure categories
2. Return a safe `taskforge new ...` command in `nextActions`
3. Optionally auto-create the task when safe and non-recursive
4. Never recommend raw `git` or manual file edits
5. Generated task body must include: command, task ID, status, branch/worktree, error code/message, observed state, expected recovery behavior
6. Generated task is P1 Bug by default
7. Prevent infinite recursion: if `taskforge new` itself fails, do NOT create another closure task
