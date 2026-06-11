---
id: TASK-270
type: Task
status: Done
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
spec_hash: e11dec2593c439df
---

# TASK-270: Align config settings under opencode section

## Goal

Move guard, audit, policy, policyVersion from top-level and agentFramework section into opencode section of .taskforge/config.json

## Acceptance Criteria

- [x] Settings stored in opencode section of .taskforge/config.json
- [x] Schema reads from config.opencode.*
- [x] All consumers use config.opencode.*
- [x] opencode.json no longer emits taskforge block
- [x] All 735 tests pass
- [x] npm run typecheck, build, lint pass without errors

## Agent Notes
