---
id: TASK-233
type: Task
status: In Progress
priority: P0
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
dependsOn: []
assignee: d5aa02494e
claimed_at: '2026-05-28 14:35:55'
context_hash: 2e5b856e34b7e389
branch: agent/TASK-233-record-all-taskforge-cli-invocations-wit--d5aa02494e
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-233
---

# TASK-233: Record all taskforge CLI invocations with parameters and return values in per-task audit log

## Goal

Every `taskforge` command invocation must be recorded in the per-task audit log (NDJSON transcript) with: the command name, all parameters/flags, the return value (exit code, stdout/stderr or JSON output), and the agent identifier (session ID) prefixed on each line. This gives full visibility into what commands were executed for a task, in what order, and what they returned.

## Context

Currently agents have no visibility into which taskforge commands were run during a task's lifecycle. The audit log exists (`logs/taskforge/tasks/TASK-NNN/transcript.jsonl`) but only records high-level events like "task claimed" or "task marked Done". Individual CLI invocations (e.g., `taskforge checkpoint -m "fix bug"`, `taskforge gates`, `taskforge submit`) are not recorded.

## Design

- Wrap the CLI entry point (`src/cli.ts`) to capture every command invocation
- Record: `{ timestamp, agentSession, command, args, exitCode, result, duration }`
- Write to the per-task transcript NDJSON file via `appendTaskTranscript()`
- The agent session ID comes from the current branch (parsed via `parseSessionIdFromBranch`) or `TASKFORGE_ACTOR` env var
- For commands that operate on a specific task (start, done, claim, checkpoint, submit, gates, etc.), write to that task's transcript
- For global commands (next, status, summary), write to a global audit log

## Acceptance Criteria

- [ ] All taskforge CLI invocations are captured at the entry point in `cli.ts`
- [ ] Each invocation record includes: command name, args/flags, exit code, result output, duration, and agent session identifier
- [ ] Agent identifier (session ID or TASKFORGE_ACTOR value) prefixes each audit line in human-readable form
- [ ] Per-task commands write to the task's NDJSON transcript file (`logs/taskforge/tasks/TASK-NNN/transcript.jsonl`)
- [ ] Global commands (next, status, summary) write to a global audit log
- [ ] Audit records are committed to task-state branch as part of the transaction
- [ ] `taskforge timeline` command displays the invocation history alongside existing events
- [ ] Tests added covering: invocation capture, agent ID prefixing, per-task vs global routing, JSON output capture

## Agent Notes

### 2026-05-28 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-233

### 2026-05-28 System
- Task claimed via taskforge start TASK-233
- Session: d5aa02494e
- Branch: agent/TASK-233-record-all-taskforge-cli-invocations-wit--d5aa02494e
