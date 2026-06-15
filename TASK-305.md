---
id: TASK-305
type: Feature
status: Verify
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
assignee: f31a56bbad
claimed_at: '2026-06-15 20:24:22'
context_hash: 86c2d0ddbd80d3ed
spec_hash: 1048ed25ba7ee839
branch: agent/TASK-305-add-durable-agent-identity-boilerplate-t--f31a56bbad
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-305
---

# TASK-305: Add Durable Agent Identity boilerplate to AGENTS.md
## Goal
Add the following boilerplate section to AGENTS.md under the TaskForge Managed Policy section (or as a new top-level section):

## Durable Agent Identity

Agents MUST NOT rely on conversation memory, summaries, or prompt text as the source of truth for identity. Identity MUST be stored in durable project state and rehydrated into context before every model invocation.

### Required IDs

Use separate IDs for each entity type:

- agentId: stable identity of the agent/runtime
- sessionId: current conversational/model session
- runId: one execution attempt
- taskId: durable work item, when applicable
- claimId: task ownership record, when applicable

IDs MUST be typed. Prefer UUIDv7 or ULID.

### Source of Truth

The durable state file or database is authoritative. Prompt-visible identity is only a projection.

Recommended project paths: .taskforge/agents/<agentId>.json, .taskforge/sessions/<sessionId>.json, .taskforge/runs/<runId>.json

### Runtime Requirements

Before every model invocation, the agent runtime MUST:
1. Load identity from durable state.
2. Validate repo, worktree, task, and claim scope.
3. Inject identity into model context.
4. Refuse identity-sensitive work if required identity is missing or inconsistent.

### Write Requirements

The agent MUST include agentId, sessionId, and runId in task claims, checkpoints, logs, summaries, handoff notes, and PR/submission metadata when available.

### Regeneration Rule

The agent MUST NOT regenerate agentId when durable state exists. A new agentId is allowed only when initializing a new agent identity or explicitly forking an existing one.

### Subagents and Handoffs

Subagents MUST receive their own agentId and inherit parent linkage explicitly. Handoff notes MUST include source and target identity fields.

## Background
Relevant context, constraints, prior decisions, and links.

## Scope
Allowed files/directories:
-

Disallowed files/directories:
-

## Acceptance Criteria
1. Durable Agent Identity section is added to AGENTS.md with all required subsections
2. Required IDs (agentId, sessionId, runId, taskId, claimId) are documented
3. Source of Truth, Runtime Requirements, Write Requirements, Regeneration Rule, and Subagents/Handoffs subsections are present
4. AGENTS.md renders correctly (no broken frontmatter or syntax errors)

## Test / Verification Command
grep -c 'Durable Agent Identity' AGENTS.md && grep -c 'agentId' AGENTS.md && grep -c 'sessionId' AGENTS.md && grep -c 'runId' AGENTS.md && grep -c 'taskId' AGENTS.md && grep -c 'claimId' AGENTS.md

## Expected Output / Behavior
Describe expected result.

## Dependencies
None

## Risks
Large boilerplate addition to AGENTS.md may push the doc over recommended length; consider whether this should be a separate child AGENTS.md or an appendix

## Continuation Policy
Auto-continue unless a stopping condition occurs.

## Agent Notes

### 2026-06-15T00:00:00Z System
- Report generated — task moved to Implementation Complete
- Changed files: none
- Commits: none
- AC section: present

### 2026-06-15T00:00:00Z System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-305

### 2026-06-15T00:00:00Z System
- Task claimed via taskforge start TASK-305
- Session: f31a56bbad
- Branch: agent/TASK-305-add-durable-agent-identity-boilerplate-t--f31a56bbad

## Result

## Links
- Issue:
- Project Item:
- PR:
- Branch:
- Worktree:
- CI:
- Test Log:
