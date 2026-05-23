---
id: TASK-123
type: Task
status: In Progress
priority: P0
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
assignee: a5c4e7a1a0
claimed_at: '2026-05-23 14:10:18'
context_hash: 8c607774d14d0be5
---

# TASK-123: Enforce AC-driven implementation discipline in agent guide

## Goal

## Goal

Update AGENTS.md to mandate that agents must enumerate and satisfy all acceptance criteria before marking a task Done, regardless of task queue depth. Agents must not skip ACs or prematurely close tasks under the premise that many tasks are pending — this reasoning greatly increases downstream error costs.

## Required Changes

1. Add an 'Acceptance Criteria Contract' section to AGENTS.md:
   - Before starting: extract ACs from the task file into an explicit checklist
   - During implementation: check off ACs as completed, not inferred
   - Before marking Done: every AC must have a passing test or documented evidence
   - If an AC cannot be satisfied within scope, create a follow-up task and document the dependency

2. Update the 'Verification Gates' section to clarify:
   - 'npm test -- --run' passing without new failures is the floor, not the ceiling
   - Gates prove nothing was broken; AC checklist proves everything was built

3. Add 'Mandatory Deliverables per Task' reinforcement:
   - Update task file agent notes with which ACs were satisfied and how
   - If force-closing, document which ACs remain and create follow-up tasks

4. Add anti-pattern: 'Throughput over correctness' — do NOT skip ACs because there are many pending tasks

## Acceptance Criteria

- [ ] AGENTS.md contains explicit AC-driven workflow instructions
- [ ] Document warns against throughput-prioritization anti-pattern
- [ ] No change to existing command behavior

## Acceptance Criteria

- [ ]

## Agent Notes

### 2026-05-23 System
- Task claimed via taskforge start TASK-123
- Session: a5c4e7a1a0
- Branch: agent/TASK-123-enforce-ac-driven-implementation-discipl--a5c4e7a1a0

### 2026-05-23 System
- Task claimed via taskforge start TASK-123
- Session: a5c4e7a1a0
- Branch: agent/TASK-123-enforce-ac-driven-implementation-discipl--a5c4e7a1a0
