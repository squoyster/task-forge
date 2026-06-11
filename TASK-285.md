---
id: TASK-285
type: Bug
status: Submitted
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
assignee: 32511141ee
claimed_at: '2026-06-11 11:06:00'
context_hash: 24c64b5cba799406
spec_hash: bbabd2f1fea8e17f
branch: agent/TASK-285-add-mergeability-preflight-to-submit-aga--32511141ee
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-285
---
# TASK-285: Add mergeability preflight to submit against origin/main
## Goal
Make `taskforge submit TASK-ID` verify that the task branch can merge cleanly with the current `origin/main` before reporting success.

## Background
TASK-284 was successfully submitted from TaskForge's perspective while still carrying a real add/add merge conflict against `origin/main`.

## Scope
Allowed files/directories:
- submit mergeability checks
- remote comparison logic
- focused submit and mergeability tests

Disallowed files/directories:
- unrelated PR workflow redesign

## Acceptance Criteria
- [ ] `taskforge submit TASK-ID` fetches or compares against the current `origin/main` merge base before returning success.
- [ ] If the branch has a real merge conflict with `origin/main`, submit returns a failure or blocked result with explicit guidance instead of a misleading success/no-op.
- [ ] Add regression coverage for the add/add conflict case observed in `src/commands/update.ts` during TASK-284.
- [ ] The command output clearly distinguishes `submitted`, `already submitted`, and `submitted but not mergeable` states.
- [ ] Typecheck and focused submit/mergeability tests pass.

## Test / Verification Command
```bash
npm run typecheck
npm run lint
```

## Expected Output / Behavior
Submit success implies both push success and a merge-clean branch against the intended base.

## Dependencies
None

## Risks
Remote comparison logic can be slow or flaky if fetch and merge-base handling are weak.

## Continuation Policy
Auto-continue unless a stopping condition occurs.

## Agent Notes

### 2026-06-11T00:00:00Z System
- Report generated — task moved to Implementation Complete
- Changed files: src/commands/git-facade.ts, tests/git-facade.test.ts
- Commits: fc370ba Merge origin/main and resolve submit mergeability conflicts, bf9190f Fix merge-tree preflight for current Git, 73ab3b8 Add submit mergeability preflight against origin/main
- AC section: present
- AC has unchecked items

### 2026-06-11T00:00:00Z System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-285

### 2026-06-11T00:00:00Z System
- Task claimed via taskforge start TASK-285
- Session: 32511141ee
- Branch: agent/TASK-285-add-mergeability-preflight-to-submit-aga--32511141ee

### 2026-06-10T00:00:00Z System
- Task updated via taskforge update
- title set to "Add mergeability preflight to submit against origin/main"
- type set to "Bug"
- priority set to "P1"
- agentRole set to "Implementer"
- riskLevel set to "Low"
- humanInterventionRequired set to "false"
- section goal updated (134 chars)
- section background updated (138 chars)
- section scope updated (185 chars)
- section acceptanceCriteria updated (591 chars)
- section testCommand updated (42 chars)
- section expectedOutput updated (92 chars)
- section dependencies updated (4 chars)
- section risks updated (87 chars)
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
