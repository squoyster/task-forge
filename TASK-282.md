---
id: TASK-282
type: Bug
status: In Progress
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
assignee: 37059d1b67
claimed_at: '2026-06-11 12:14:19'
context_hash: 6cd5541d1cdfd05c
branch: agent/TASK-282-fix-symlinked-taskforge-launcher-path-re--37059d1b67
---
# TASK-282: Fix symlinked taskforge launcher path resolution
## Goal
Ensure the repo-local `scripts/taskforge` launcher works when installed as a symlink in a global PATH location such as `~/.local/bin`.

## Background
Global deployment via symlink must resolve the real checkout root rather than the symlink location.

## Scope
Allowed files/directories:
- launcher resolution logic
- install or deployment helpers
- focused launcher tests

Disallowed files/directories:
- unrelated runtime behavior

## Acceptance Criteria
- [ ] Running `taskforge --help` from a symlinked install resolves the repository root correctly.
- [ ] The launcher finds `src/cli.ts` relative to the real checkout rather than the symlink location.
- [ ] Add a regression test or equivalent validation for symlinked launcher execution.
- [ ] The task passes `typecheck`, `lint`, and the launcher smoke check.

## Test / Verification Command
```bash
npm run typecheck
npm run lint
```

## Expected Output / Behavior
The launcher behaves the same whether invoked directly or through a symlink on PATH.

## Dependencies
None

## Risks
Path resolution changes can break local and global invocation modes if not covered.

## Continuation Policy
Auto-continue unless a stopping condition occurs.

## Agent Notes

### 2026-06-11T00:00:00Z System
- Task claimed via taskforge start TASK-282
- Session: 37059d1b67
- Branch: agent/TASK-282-fix-symlinked-taskforge-launcher-path-re--37059d1b67

### 2026-06-10T00:00:00Z System
- Task updated via taskforge update
- title set to "Fix symlinked taskforge launcher path resolution"
- type set to "Bug"
- priority set to "P2"
- agentRole set to "Implementer"
- riskLevel set to "Low"
- humanInterventionRequired set to "false"
- section goal updated (134 chars)
- section background updated (99 chars)
- section scope updated (171 chars)
- section acceptanceCriteria updated (359 chars)
- section testCommand updated (42 chars)
- section expectedOutput updated (84 chars)
- section dependencies updated (4 chars)
- section risks updated (83 chars)
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
