---
id: TASK-289
type: Feature
status: Verify
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
assignee: 3f169d55ff
claimed_at: '2026-06-11 00:11:40'
context_hash: 24c64b5cba799406
spec_hash: 18fa5c459febd832
branch: agent/TASK-289-archive-terminal-audit-history-into-task--3f169d55ff
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-289
---
# TASK-289: Archive terminal audit history into task-state and ignore live audit logs
## Goal
Move durable task audit history into task-state at terminal lifecycle transitions and keep live audit log files out of source-control dirt for active task worktrees.

## Background
TaskForge is a generic task-control plane for arbitrary repositories and languages. Lifecycle commands must remain framework-agnostic and must not trigger Node/npm-specific build behavior or regenerate language-specific artifacts such as dist bundles as a side effect of transitions.

## Scope
Allowed files/directories:
- terminal lifecycle operations
- audit history persistence
- live audit log tracking rules
- focused lifecycle and audit tests

Disallowed files/directories:
- project-specific build orchestration

## Acceptance Criteria
- [ ] Terminal lifecycle operations such as `done`, `reject`, and equivalent terminal transitions append relevant audit history or summarized command history into the task record in task-state.
- [ ] Live audit log files that continue to mutate during normal CLI usage no longer keep active task worktrees dirty by default.
- [ ] If live audit logs remain on disk, they are ignored from source control or otherwise excluded from task cleanliness gates.
- [ ] No lifecycle command triggers language- or framework-specific build artifact generation as a side effect of task transitions.
- [ ] The completion path preserves enough audit detail for humans and agents to reconstruct task history after terminalization.
- [ ] Add regression coverage for the TASK-284 blocker where `checkpoint`, `submit`, or `done` dirtied tracked artifacts and blocked starting the next task.
- [ ] Typecheck and focused lifecycle/audit tests pass.

## Test / Verification Command
```bash
npm run typecheck
npm run lint
```

## Expected Output / Behavior
Terminal lifecycle history remains durable in task-state, while live runtime logs stop poisoning worktree cleanliness.

## Dependencies
None

## Risks
Moving audit persistence to terminal transitions can lose context if summary extraction is too shallow.

## Continuation Policy
Auto-continue unless a stopping condition occurs.

## Agent Notes

### 2026-06-11T00:00:00Z System
- Report generated — task moved to Implementation Complete
- Changed files: none
- Commits: none
- AC section: present
- AC has unchecked items

### 2026-06-11T00:00:00Z System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-289

### 2026-06-11T00:00:00Z System
- Task claimed via taskforge start TASK-289
- Session: 3f169d55ff
- Branch: agent/TASK-289-archive-terminal-audit-history-into-task--3f169d55ff

### 2026-06-10T00:00:00Z System
- Task updated via taskforge update
- title set to "Archive terminal audit history into task-state and ignore live audit logs"
- type set to "Feature"
- priority set to "P1"
- agentRole set to "Implementer"
- riskLevel set to "Low"
- humanInterventionRequired set to "false"
- section goal updated (165 chars)
- section background updated (283 chars)
- section scope updated (224 chars)
- section acceptanceCriteria updated (926 chars)
- section testCommand updated (42 chars)
- section expectedOutput updated (118 chars)
- section dependencies updated (4 chars)
- section risks updated (103 chars)
- section continuationPolicy updated (49 chars)
- section agentNotes updated (0 chars)
- section result updated (0 chars)
- section links updated (70 chars)

## Result

## Links
- Issue:
- Project Item:
- PR:
- Branch:
- Worktree:
- CI:
- Test Log:
