---
id: TASK-108
type: Feature
status: In Progress
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
assignee: 12fd510691
claimed_at: '2026-05-23 17:51:11'
context_hash: f3613895c8a77f2e
---

# TASK-108: Classify gate failures and route agent behavior

## Goal

## Rationalization Roadmap: TASK-RAT-006

### Objective
Improve taskforge gates so agents get actionable classification of build/test/lint failures.

### Failure classes
implementation_failure, upstream_test_failure, environment_failure, missing_dependency, missing_secret, merge_conflict, unknown_failure

### Behavior rules per class
- implementation_failure: Fix implementation and rerun gates
- upstream_test_failure: Create bug task, link current task, continue if safe
- environment_failure: Retry once, then block with details
- missing_secret: Block for human input immediately
- merge_conflict: Resolve if safe; otherwise block

### Acceptance Criteria
- Gate output clearly says whether agent should fix, block, retry, or create bug
- Upstream failure path can create new Bug task
- Created bug links back to current task
- Gate result stored in audit log

## Acceptance Criteria

- [ ]

## Agent Notes

### 2026-05-23 System
- Task claimed via taskforge start TASK-108
- Session: 12fd510691
- Branch: agent/TASK-108-classify-gate-failures-and-route-agent-b--12fd510691

### 2026-05-23 System
- Task claimed via taskforge start TASK-108
- Session: 12fd510691
- Branch: agent/TASK-108-classify-gate-failures-and-route-agent-b--12fd510691
