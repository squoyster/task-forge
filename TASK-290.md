---
id: TASK-290
type: Bug
status: Implementation Complete
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
assignee: 717dcfc105
claimed_at: '2026-06-11 02:28:59'
context_hash: 24c64b5cba799406
spec_hash: b439075742f4fc49
branch: agent/TASK-290-clear-terminal-state-ownership-metadata--717dcfc105
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-290
---

# TASK-290: Clear terminal-state ownership metadata

## Goal

Goal: Clear active ownership metadata when tasks enter terminal states like Done or Rejected.

Background: Terminal tasks currently retain assignee and claimed_at, which makes closed work look actively owned and confuses workflow state.

Scope:
- terminal state transition logic
- focused lifecycle tests
- no unrelated workflow refactors

Acceptance Criteria:
- Terminal transitions clear assignee and claimed_at.
- Terminal transitions preserve or clear branch/worktree according to current policy, but ownership fields are not left behind.
- Add regression coverage for Done and Rejected terminal transitions.
- typecheck, lint, and focused lifecycle tests pass.

Test / Verification Command:
```bash
npm run typecheck
npm run lint
```

Expected Output / Behavior: Tasks in Done or Rejected no longer appear actively claimed.

Dependencies: None

Risks: Over-clearing historical context if cleanup reaches beyond ownership fields.

Continuation Policy: Auto-continue unless a stopping condition occurs.

## Acceptance Criteria

- [ ]

## Agent Notes

### 2026-06-11T00:00:00Z System
- Report generated — task moved to Implementation Complete
- Changed files: .agent/file.idx, .agent/spec.idx, .agent/task.idx, .agent/tf.ctx, .gitignore, .opencode/agents/deps.md, .opencode/agents/doctor.md, .opencode/agents/implementer.md, .opencode/agents/intake.md, .opencode/agents/planner.md, .opencode/agents/qa.md, .opencode/agents/reviewer.md, .taskforge-session.json, .taskforge/agent-registry.json, AGENTS.md, TASKFORGE.md, Volumes/Shares/mmmm/relocated/xdg-config/opencode/opencode.jsonc, dist/agent-files-XPIYCK4G.js, dist/agent-files-XPIYCK4G.js.map, dist/agents-md-A3PFT5FN.js, dist/agents-md-A3PFT5FN.js.map, dist/audit-plugin-TS6NRRLX.js, dist/audit-plugin-TS6NRRLX.js.map, dist/chunk-46G2ACH2.js, dist/chunk-46G2ACH2.js.map, dist/chunk-4P6LV6YT.js, dist/chunk-4P6LV6YT.js.map, dist/chunk-5JWCMI7A.js, dist/chunk-5JWCMI7A.js.map, dist/chunk-ACDCJVXE.js, dist/chunk-ACDCJVXE.js.map, dist/chunk-AYOSERB3.js, dist/chunk-AYOSERB3.js.map, dist/chunk-F6MGWUO6.js, dist/chunk-F6MGWUO6.js.map, dist/chunk-GFCBVGVF.js, dist/chunk-GFCBVGVF.js.map, dist/chunk-OPCWHN3N.js, dist/chunk-OPCWHN3N.js.map, dist/chunk-R243K2GI.js, dist/chunk-R243K2GI.js.map, dist/chunk-SNMMMNDR.js, dist/chunk-SNMMMNDR.js.map, dist/cli.d.ts, dist/cli.js, dist/cli.js.map, dist/git-JJNIPTTS.js, dist/git-JJNIPTTS.js.map, dist/guard-plugin-ZBHNJXZY.js, dist/guard-plugin-ZBHNJXZY.js.map, dist/hooks-OXD7KHEY.js, dist/hooks-OXD7KHEY.js.map, dist/opencode-NBJAFWWW.js, dist/opencode-NBJAFWWW.js.map, dist/opencode-config-Q5FF63TP.js, dist/opencode-config-Q5FF63TP.js.map, dist/validate-state-MI4DZKEZ.js, dist/validate-state-MI4DZKEZ.js.map, docs/agent-framework-integration.md, docs/architecture/command-return-contract.md, docs/architecture/command-state-machine-and-invariants.md, docs/control-plane-hardening.md, docs/deployment/container-runtime.md, docs/github-task-state-protection.md, docs/next-action-semantics.md, docs/workflow.md, logs/taskforge/audit/events.jsonl, logs/taskforge/audit/git.jsonl, logs/taskforge/audit/invocations.jsonl, logs/taskforge/tasks/TASK-227/transcript.jsonl, logs/taskforge/tasks/TASK-232/transcript.jsonl, logs/taskforge/tasks/TASK-270/transcript.jsonl, logs/taskforge/tasks/TASK-271/transcript.jsonl, opencode.json, package.json, scripts/taskforge, specs/AGENTS.md, specs/README.md, specs/TASKFORGE.md, specs/control-plane-hardening.md, specs/task-forge-ac-repair-task-pack.md, specs/task-forge-prescriptive-command-output-task-pack.md, specs/taskforge-agent-policy-tasks.md, specs/taskforge-control-plane-closure-spec.md, src/cli.ts, src/commands/agents.ts, src/commands/doctor.ts, src/commands/git-facade.ts, src/commands/init.ts, src/commands/list.ts, src/commands/new.ts, src/commands/next.ts, src/commands/promote.ts, src/commands/reject.ts, src/commands/start.ts, src/commands/summary.ts, src/commands/update.ts, src/core/agent-files.ts, src/core/agents-md.ts, src/core/command-result.ts, src/core/command-states.ts, src/core/git.ts, src/core/hooks.ts, src/core/state-validator.ts, src/core/task-document.ts, src/core/task-state-transaction.ts, src/core/task-store.ts, src/core/task.ts, tests/command-result.test.ts, tests/commands/init.test.ts, tests/commands/list.test.ts, tests/commands/next.test.ts, tests/commands/start.test.ts, tests/commands/summary.test.ts, tests/commands/update.test.ts, tests/hooks.test.ts, tests/promote.test.ts, tests/reject.test.ts, tests/task-document.test.ts, tests/task-state-transaction.test.ts, tests/task-store.test.ts, tests/validate-state.test.ts
- Commits: eb542b3 Clear ownership metadata on terminal transitions
- AC section: present
- AC has blank items

### 2026-06-11T00:00:00Z System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-290

### 2026-06-11T00:00:00Z System
- Task claimed via taskforge start TASK-290
- Session: 717dcfc105
- Branch: agent/TASK-290-clear-terminal-state-ownership-metadata--717dcfc105
