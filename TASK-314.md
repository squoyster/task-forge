---
id: TASK-314
type: Task
status: Ready
priority: P1
agentRole: Planner
riskLevel: Low
humanInterventionRequired: false
spec_hash: b6f602239189fa2e
---

# TASK-314: Slimming Refactor 08: Rewrite workflow.md + AGENTS.md chain
## Goal
Rewrite docs/workflow.md Control Plane and Prohibited Substitutions; update AGENTS.md chain to reflect the new git-owns-code model.

## Background
See specs/taskforge-slimming-refactor.md §Documentation Rewrite.

## Scope
- docs/workflow.md: rewrite Prohibited Substitutions table (git commit/push/pr now correct; gates before push).- Update Control Plane invariant: TaskForge owns task state + worktree lifecycle; git owns code; hooks bridge.- Root AGENTS.md: TaskForge Managed Policy block (remove checkpoint/submit references).- src/commands/AGENTS.md + src/core/AGENTS.md: drop git-facade row, update ownership tables.

## Acceptance Criteria
- workflow.md Prohibited Substitutions table matches new model.- No references to checkpoint/submit/pr as required commands.- AGENTS.md ownership tables accurate.- Invariant statement present.

## Test / Verification Command
Manual review; grep for stale checkpoint/submit references in docs

## Expected Output / Behavior
Docs reflect git-direct + hook-enforcement model.

## Dependencies
TF-SLIM-06 (commands removed)

## Risks
Known risks.

## Continuation Policy
Auto-continue unless a stopping condition occurs.

## Agent Notes

## Result

## Links
- Issue:
- Project Item:
- PR:
- Branch:
- Worktree:
- CI:
- Test Log:
