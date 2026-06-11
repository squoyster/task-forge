---
id: TASK-030
type: Feature
status: Done
priority: P3
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
spec_hash: 86a53cb9dff0d229
---

# TASK-030: Add `prompt` Command — Agent Execution Packet

## Goal

Add `taskforge prompt TASK-ID` that emits a complete agent execution packet: task body, scope, acceptance criteria, allowed/disallowed files, verification command, current branch/worktree, and relevant project conventions — formatted for immediate consumption by coding agents.

## Background

Per the gap analysis, coding agents need a single output that contains everything required to start work on a task without missing instructions. The `start` command provides some of this, but `prompt` is a focused read-only command that outputs a complete execution context.

## Usage

```bash
taskforge prompt TASK-023                # Human-readable execution packet
taskforge prompt TASK-023 --json          # Machine-parseable context
taskforge prompt TASK-023 --agent opencode # Tailored for specific agent
```

## Output (human-readable)

```
# TASK-023: Update README

## Task Body
...

## Scope
- README.md
- tasks/README.md

## Acceptance Criteria
- [ ] README.md clearly states ...

## Verification Command
npm run typecheck && npm run build

## Workspace
Branch: agent/TASK-023-update-readme--abc123
Worktree: ../worktrees/TASK-023

## Project Conventions
(From AGENTS.md / TASKFORGE.md snippets)
```

## Acceptance Criteria

- [ ] `taskforge prompt TASK-ID` outputs task body, scope, acceptance criteria, verification command
- [ ] Includes workspace info (branch, worktree) if available
- [ ] Includes relevant project conventions from `AGENTS.md` and `TASKFORGE.md`
- [ ] `--json` output includes all fields structured
- [ ] Works for tasks in any status (not just In Progress)
- [ ] Read-only — does not mutate task state
- [ ] Tests cover: full prompt output, JSON format, missing fields handling

## Dependencies

None.

## Risk Level

Low — read-only command, no state mutation.

## Continuation Policy

Auto-continue.

## Agent Notes

### 2026-05-22 System
- Task started via taskforge start TASK-030
- Session: 0951fe637d
- Branch: agent/TASK-030-add-prompt-command-agent-execution-packe--0951fe637d
- Worktree: /Volumes/Transcend/devel/worktrees/TASK-030
