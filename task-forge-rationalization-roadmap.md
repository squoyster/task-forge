# TaskForge Rationalization Roadmap

## Purpose

This file is a consolidated implementation roadmap for rationalizing `task-forge` into a tight, maintainable, git-first agentic development coordination system.

The desired end state:

- `git` is the only hard operational dependency.
- GitHub, OpenCode, package managers, issue trackers, and scanners are optional providers/adapters.
- Task state is durable, auditable, and safe for multiple distributed agents.
- Every agentic task has an audit trail and transcript export path.
- CLI commands return explicit, machine-readable and human-readable next-action guidance.
- Agents can continue work automatically except at explicit human-intervention gates.
- The CLI is invocable as both `taskforge` and `task-forge`.

---

## Architectural Principles

### 1. Git-first core

TaskForge core should depend conceptually on:

- Git repository identity
- Git branches
- Git worktrees
- Git commits
- Git push/pull/rebase behavior
- Markdown task files

It should not require GitHub, `gh`, OpenCode, npm, pnpm, yarn, OSV, Snyk, Trivy, Syft, Linear, Jira, or Plane.

### 2. Providers at the edge

External systems must be represented as explicit providers:

- `BoardProvider`: GitHub Issues/Projects, Linear, Jira, Plane, repo-native Markdown
- `AgentProvider`: OpenCode, generic shell agent, Codex, Aider, future adapters
- `GitProvider` / `GitPort`: native git CLI implementation
- `PackageProvider`: npm, pnpm, yarn, Maven, Gradle, Cargo, etc.
- `AuditSink`: local files, git-tracked logs, external observability sink

Core services should depend on interfaces, not specific providers.

### 3. Agent-directed CLI

Every state-changing or diagnostic command should tell the agent what to do next.

Examples:

- Test failed because implementation is wrong → fix implementation, rerun gates.
- Test failed because upstream test harness is broken → create bug task, link blocker, continue if safe.
- Push rejected → pull/rebase/retry or select another task.
- Task blocked by missing secret → block task with `missing_secret`, stop for human input.
- Worktree dirty during cleanup → preserve work, refuse destructive cleanup unless explicitly forced.

The CLI should not merely report state. It should drive the agentic workflow.

### 4. Auditability is a first-class feature

Where work is performed agentically, TaskForge should maintain per-task audit logs:

- Command invocations
- State transitions
- Agent decisions
- Gate results
- Test/build/lint outcomes
- Generated completion reports
- Blocker decisions
- Links to transcript exports
- Optional captured session transcripts, such as OpenCode `/export`

Audit should be generic. OpenCode transcript export is one provider-specific source, not the audit model itself.

---

## Target Architecture

```text
src/
  core/
    domain/
      task.ts
      task-status.ts
      task-transition.ts
      audit-event.ts
      next-action.ts
    services/
      task-state-service.ts
      claim-service.ts
      workspace-service.ts
      sweeper-service.ts
      gate-service.ts
      audit-service.ts
      next-action-service.ts
    ports/
      git-port.ts
      task-state-store.ts
      board-provider.ts
      agent-provider.ts
      package-provider.ts
      audit-sink.ts

  infrastructure/
    git/
      cli-git-port.ts
    storage/
      markdown-task-state-store.ts
      file-audit-sink.ts
    config/
      config-loader.ts
      config-schema.ts

  providers/
    board/
      markdown/
      github/
    agent/
      generic/
      opencode/
    package/
      npm/
      pnpm/
      yarn/

  cli/
    main.ts
    command-registry.ts
    output/
      json-result.ts
      human-result.ts
    modules/
      task-commands.ts
      workspace-commands.ts
      gate-commands.ts
      audit-commands.ts
      dependency-commands.ts
      provider-commands.ts
```

---

## Standard Task Prompt Format

Each task below is written as an agentic implementation prompt. Agents should treat each prompt as an execution contract.

Each task should result in:

- Focused code changes
- Tests for changed behavior
- Documentation updates where user-facing behavior changes
- A completion report using `taskforge report <TASK-ID>` or equivalent
- Audit events for all significant state transitions

---

# P0 Roadmap Tasks

## TASK-RAT-001 — Introduce core ports and provider boundaries

**Priority:** P0  
**Type:** Refactor  
**Risk:** Medium  
**Agent role:** Architect / Implementer

### Objective

Separate TaskForge core from concrete integrations. GitHub, OpenCode, and package-manager behavior must move behind explicit provider interfaces.

### Background

Current implementation has GitHub sync, OpenCode instructions, package-manager scanning, and git execution coupled into command/core flows. This prevents TaskForge from being a minimal git-first system with optional adapters.

### Required design

Create core ports:

```ts
export interface BoardProvider {
  id: string;
  capabilities(): BoardProviderCapabilities;
  syncTask(task: ParsedTask): Promise<ExternalTaskRef>;
  updateTask(task: ParsedTask, ref: ExternalTaskRef): Promise<void>;
  syncStatus(task: ParsedTask, ref: ExternalTaskRef): Promise<void>;
}

export interface AgentProvider {
  id: string;
  renderStartInstructions(ctx: TaskExecutionContext): string[];
  renderPromptPacket(ctx: TaskExecutionContext): string;
  detectTranscriptExport?(): Promise<TranscriptExport | null>;
}

export interface GitPort {
  revParseTopLevel(cwd: string): Promise<string>;
  currentBranch(cwd: string): Promise<string>;
  worktreeList(cwd: string): Promise<GitWorktree[]>;
  worktreeAdd(cwd: string, path: string, branch: string, createBranch: boolean): Promise<void>;
  worktreeRemove(cwd: string, path: string): Promise<void>;
  addAll(cwd: string): Promise<void>;
  commit(cwd: string, message: string): Promise<boolean>;
  pullRebase(cwd: string, remote: string, branch: string): Promise<void>;
  push(cwd: string, remote: string, branch: string): Promise<void>;
}

export interface AuditSink {
  append(event: AuditEvent): Promise<void>;
  readByTask(taskId: string): Promise<AuditEvent[]>;
}
```

### Implementation steps

1. Create `src/core/ports/` interfaces.
2. Create provider registry for board and agent providers.
3. Move GitHub sync behind `GitHubBoardProvider` without changing external behavior.
4. Move OpenCode-specific output behind `OpenCodeAgentProvider`.
5. Add `GenericAgentProvider` as default fallback.
6. Ensure `src/core` has no imports from `src/integrations/github` or provider-specific modules.

### Acceptance criteria

- Core compiles without GitHub-specific imports.
- Existing GitHub sync behavior still works when GitHub provider is enabled.
- Generic Markdown-only mode works with no GitHub config.
- Tests prove provider selection is config-driven.

### Agent next-action rules

- If provider boundary changes break existing commands, preserve command names and adapt internals.
- If provider config is ambiguous, add validation errors with suggested config snippets.
- If GitHub behavior cannot be fully preserved in this task, create a follow-up compatibility bug and continue with provider isolation.

---

## TASK-RAT-002 — Consolidate git execution behind native `GitPort`

**Priority:** P0  
**Type:** Refactor  
**Risk:** Medium  
**Agent role:** Implementer

### Objective

Make `git` the only required operational substrate. Remove direct core dependency on `simple-git` and `execa` by routing all git execution through a single native CLI implementation.

### Required design

Implement:

```text
src/infrastructure/git/cli-git-port.ts
```

Use Node built-ins:

- `child_process.spawn` or `execFile`
- explicit `cwd`
- captured stdout/stderr
- structured error type with exit code and stderr

### Implementation steps

1. Implement `CliGitPort`.
2. Replace direct `simple-git` and `execa` usage in core services.
3. Centralize non-fast-forward detection.
4. Centralize git command logging to audit events where task context exists.
5. Keep wrapper functions temporarily only as compatibility facades if necessary.
6. Remove `simple-git` and `execa` from runtime dependencies after tests pass.

### Acceptance criteria

- No direct `simple-git` or `execa` imports remain in core code.
- Worktree add/remove/list works.
- Commit no-op is handled without error.
- Push rejection classification is tested.
- Pull/rebase failure returns actionable next-action guidance.

### Agent next-action rules

- If a git command fails due to non-fast-forward, CLI response must advise: pull/rebase/retry or select another task.
- If a git command fails due to missing remote, CLI response must distinguish offline/local-only mode from distributed-agent unsafe mode.
- If a worktree command fails due to dirty state, never delete data automatically.

---

## TASK-RAT-003 — Rewrite task-state mutation to use transactions only

**Priority:** P0  
**Type:** Correctness / Refactor  
**Risk:** High  
**Agent role:** Senior Implementer

### Objective

Eliminate mixed direct writes and transaction writes. All task-state mutations must go through a single transaction abstraction with optimistic concurrency, jittered retry, dirty tracking, audit events, and clear failure behavior.

### Problem

Current start/claim flows mutate files directly before transaction commit. This can produce duplicated notes, partial local state, and inconsistent retry behavior.

### Required design

Transaction API should support:

```ts
await taskState.transaction("start TASK-123", async tx => {
  const task = tx.requireTask("TASK-123");
  tx.assertStatus(task.id, ["Ready", "In Progress"]);
  tx.claimTask(task.id, sessionId);
  tx.setBranch(task.id, branchName);
  tx.setContextHash(task.id, contextHash);
  tx.appendSystemNote(task.id, notes);
  tx.appendAuditEvent(task.id, "task.claimed", data);
});
```

### Implementation steps

1. Add dirty-task tracking to transaction implementation.
2. Ensure only dirty task files are rewritten.
3. Make notes part of the same transaction write.
4. Make audit event append part of the same command flow.
5. Rewrite `start`, `claim`, `done`, `block`, `release`, `heartbeat`, `reject`, and `new` to use transactions.
6. Add tests for duplicate-note prevention.
7. Add tests for push rejection retry.
8. Add tests for failed claim leaving no local task mutation.

### Acceptance criteria

- No state-changing command mutates task files outside transaction layer.
- Failed durable claim does not leave task marked in progress locally.
- Duplicate system notes are not produced under retry.
- Transaction failure returns explicit next action.

### Agent next-action rules

- If transaction push fails after retries, agent must not continue implementation work on that task.
- If task was claimed by another agent during retry, command must instruct agent to run `taskforge next`.
- If transaction detects invalid state, command must instruct agent whether to block, release, or inspect.

---

## TASK-RAT-004 — Implement per-task agentic audit logs

**Priority:** P0  
**Type:** Feature / Auditability  
**Risk:** Medium  
**Agent role:** Implementer

### Objective

Add durable per-task audit logs for agentically performed work.

This must be generic. OpenCode `/export` should be supported through an adapter, but the audit model must not depend on OpenCode.

### Required audit model

Create:

```ts
export interface AuditEvent {
  id: string;
  taskId: string;
  timestamp: string;
  actor: string;
  source: "cli" | "agent" | "provider" | "system";
  eventType: string;
  command?: string;
  statusBefore?: string;
  statusAfter?: string;
  summary: string;
  data?: Record<string, unknown>;
}
```

Recommended event types:

```text
task.created
task.claimed
task.started
task.heartbeat
task.blocked
task.released
task.rejected
task.completed
task.transitioned
workspace.created
workspace.removed
git.command.started
git.command.completed
git.command.failed
gate.started
gate.passed
gate.failed
gate.upstream_failure_detected
bug.created_from_failure
transcript.attached
transcript.export_requested
transcript.export_failed
provider.sync.started
provider.sync.completed
provider.sync.failed
```

### Storage

Default local file sink:

```text
../task-state/audit/TASK-123/events.ndjson
../task-state/audit/TASK-123/transcripts/<timestamp>-<provider>.md
```

Alternative acceptable path if simpler:

```text
.taskforge/audit/TASK-123/events.ndjson
.taskforge/audit/TASK-123/transcripts/<timestamp>-<provider>.md
```

But the chosen location must be explicit in config and documented.

### CLI commands

Add or complete:

```bash
taskforge audit TASK-123 --json
taskforge timeline TASK-123
taskforge transcript TASK-123
taskforge transcript attach TASK-123 --file path/to/export.md --provider opencode
taskforge transcript request TASK-123
```

### OpenCode integration

Add `OpenCodeAgentProvider` support for transcript export guidance:

- Detect whether OpenCode transcript export is available if practical.
- If not directly callable, emit instruction: run `/export`, save transcript, then run `taskforge transcript attach ...`.
- Do not bake OpenCode into core audit model.

### Acceptance criteria

- Every state-changing command writes at least one audit event.
- Gate command writes pass/fail events.
- Transcript attachment is supported generically.
- `taskforge audit TASK-ID --json` returns structured events.
- `taskforge timeline TASK-ID` returns concise human-readable timeline.
- Audit write failure is visible and produces next-action guidance.

### Agent next-action rules

- At task completion, agent must attach or reference session transcript if work was performed agentically.
- If transcript export is unavailable, agent must record an audit event stating why.
- If audit write fails, agent must stop before marking task done unless `--force-no-audit` is explicitly used.

---

## TASK-RAT-005 — Add explicit CLI next-action guidance model

**Priority:** P0  
**Type:** Feature / Agent UX  
**Risk:** Medium  
**Agent role:** Architect / Implementer

### Objective

Every command that agents use should return explicit guidance about what the agent should do next.

This should be both human-readable and machine-readable.

### Required model

Create:

```ts
export interface NextAction {
  code: string;
  priority: "must" | "should" | "may";
  actor: "agent" | "human" | "system";
  command?: string;
  reason: string;
  blocksContinuation: boolean;
}

export interface CommandResult<T = unknown> {
  ok: boolean;
  command: string;
  data?: T;
  error?: CommandError;
  nextActions: NextAction[];
  auditEventIds?: string[];
}
```

### Required command behavior

Commands should emit `nextActions` in JSON mode and a clear `Next:` section in human mode.

Example JSON:

```json
{
  "ok": false,
  "command": "gates",
  "error": {
    "code": "TEST_FAILED",
    "message": "npm test failed"
  },
  "nextActions": [
    {
      "code": "FIX_IMPLEMENTATION_AND_RERUN_GATES",
      "priority": "must",
      "actor": "agent",
      "command": "taskforge gates",
      "reason": "Verification failed and appears related to changed code.",
      "blocksContinuation": true
    }
  ]
}
```

### Required next-action codes

Start with these:

```text
RUN_NEXT_TASK
READ_TASK_SPEC
ENTER_WORKTREE
RUN_GATES
FIX_IMPLEMENTATION_AND_RERUN_GATES
CREATE_BUG_FOR_UPSTREAM_FAILURE
BLOCK_FOR_HUMAN_DECISION
BLOCK_FOR_MISSING_SECRET
RESOLVE_MERGE_CONFLICT
PULL_REBASE_AND_RETRY
RELEASE_TASK_AND_SELECT_NEXT
ATTACH_TRANSCRIPT
CREATE_COMPLETION_REPORT
SUBMIT_FOR_REVIEW
STOP_FOR_HUMAN_REVIEW
CLEANUP_WORKTREE
```

### Acceptance criteria

- `next`, `start`, `claim`, `gates`, `block`, `done`, `release`, `sweep`, `cleanup`, `report`, `sync`, and dependency commands emit next-action guidance.
- JSON output has a stable `nextActions` array.
- Human output has a stable `Next:` section.
- Tests cover at least success, test failure, push conflict, blocked task, and missing provider scenarios.

### Agent next-action rules

- Agents must treat `blocksContinuation: true` as a stop unless the next action names a safe continuation command.
- Agents may proceed automatically only when the top `must` action is executable without human input.
- Human gates must be explicit, not inferred from prose.

---

# P1 Roadmap Tasks

## TASK-RAT-006 — Classify gate failures and route agent behavior

**Priority:** P1  
**Type:** Feature / Workflow  
**Risk:** Medium  
**Agent role:** Implementer / QA

### Objective

Improve `taskforge gates` so agents get actionable classification of build/test/lint failures.

### Required failure classes

```text
implementation_failure
upstream_test_failure
environment_failure
missing_dependency
missing_secret
merge_conflict
unknown_failure
```

### Behavior rules

| Failure class | Agent action |
|---|---|
| `implementation_failure` | Fix implementation and rerun gates |
| `upstream_test_failure` | Create bug task, link current task, continue if current task can still be verified another way |
| `environment_failure` | Retry once, then block with environment details |
| `missing_dependency` | Install if allowed; otherwise block or create setup task |
| `missing_secret` | Block for human input immediately |
| `merge_conflict` | Resolve if safe; otherwise block |
| `unknown_failure` | Inspect logs, retry once, then block or create bug |

### Implementation steps

1. Capture structured command result for each gate.
2. Add heuristic classifiers based on exit code, stderr, known patterns, and changed files.
3. Add `--classify-only` option if useful.
4. Add `--create-bug-on-upstream-failure` option.
5. Add audit events for gate start/pass/fail/classification.
6. Return next-action guidance.

### Acceptance criteria

- Gate output clearly says whether agent should fix, block, retry, or create bug.
- Upstream failure path can create a new Bug task.
- Created bug links back to current task.
- Gate result is stored in audit log.

### Agent next-action rules

- If classification is `implementation_failure`, do not create a bug task; fix the code.
- If classification is `upstream_test_failure`, create a bug task and continue only if a safe alternative verification path exists.
- If classification is `missing_secret`, stop for human input.

---

## TASK-RAT-007 — Normalize config schema around task state, workspaces, and providers

**Priority:** P1  
**Type:** Refactor  
**Risk:** Low  
**Agent role:** Implementer

### Objective

Replace stale config concepts with explicit task-state, workspace, and provider configuration.

### Target config shape

```json
{
  "project": {
    "name": "task-forge",
    "defaultBranch": "main"
  },
  "taskState": {
    "backend": "git-branch",
    "branch": "task-state",
    "path": "../task-state",
    "remote": "origin",
    "failurePolicy": "strict"
  },
  "workspaces": {
    "backend": "git-worktree",
    "root": "../worktrees/{repoName}",
    "branchPrefix": "agent"
  },
  "providers": {
    "board": {
      "id": "markdown",
      "enabled": true
    },
    "agent": {
      "id": "generic",
      "enabled": true
    }
  },
  "plugins": {
    "dependencySteward": {
      "enabled": false
    }
  }
}
```

### Implementation steps

1. Add new schema.
2. Add migration from old keys:
   - `tasks.directory`
   - `tasks.template`
   - `github`
   - `opencode`
   - `dependencies`
3. Make path utilities config-aware.
4. Add `taskforge config-validate --explain`.
5. Add warnings for deprecated keys.

### Acceptance criteria

- Existing config still works with warnings.
- New config is documented.
- Worktree and task-state paths are no longer hardcoded.
- Provider selection comes from `providers` section.

### Agent next-action rules

- If config has deprecated keys, migrate or warn; do not silently ignore.
- If config is invalid, stop before mutating task state.

---

## TASK-RAT-008 — Make CLI available as both `taskforge` and `task-forge`

**Priority:** P1  
**Type:** Packaging / UX  
**Risk:** Low  
**Agent role:** Implementer

### Objective

Allow users and agents to invoke the CLI using either name:

```bash
taskforge
task-forge
```

### Implementation steps

1. Update package bin mapping:

```json
{
  "bin": {
    "taskforge": "./dist/cli.js",
    "task-forge": "./dist/cli.js"
  }
}
```

2. Ensure help text mentions both names.
3. Add test or smoke script verifying both binaries resolve after build/link.
4. Update README and generated prompts.

### Acceptance criteria

- Both commands invoke identical CLI behavior.
- Documentation uses `taskforge` as canonical and notes `task-forge` alias.
- Agent prompts accept either command but prefer `taskforge` internally for brevity.

### Agent next-action rules

- If a shell reports `taskforge` missing, try `task-forge` before failing.
- If both are missing, instruct user/agent to run package link/install step.

---

## TASK-RAT-009 — Make OpenCode an optional `AgentProvider`

**Priority:** P1  
**Type:** Refactor / Integration  
**Risk:** Low  
**Agent role:** Implementer

### Objective

Move OpenCode-specific behavior out of core command flows.

### Required behavior

`OpenCodeAgentProvider` should provide:

- start instructions
- prompt packet formatting
- transcript export guidance
- optional detection of available OpenCode command

`GenericAgentProvider` should provide equivalent generic instructions without naming OpenCode.

### Acceptance criteria

- `cmdStart` does not hardcode `opencode`.
- `cmdPrompt` uses selected agent provider.
- OpenCode transcript guidance is available through provider.
- Generic mode remains useful for any CLI coding agent.

### Agent next-action rules

- If OpenCode provider is selected but command is missing, emit next action to install/configure OpenCode or switch to generic provider.
- Do not block generic workflows because OpenCode is missing.

---

## TASK-RAT-010 — Move Dependency Steward into optional plugin

**Priority:** P1  
**Type:** Refactor  
**Risk:** Low  
**Agent role:** Implementer

### Objective

Keep dependency scanning and remediation useful, but remove it from the core architecture.

### Implementation steps

1. Create plugin module:

```text
src/plugins/dependency-steward/
```

2. Register dependency commands only when plugin is enabled or always as an optional module that checks provider availability.
3. Move package-manager-specific code behind `PackageProvider`.
4. Keep task creation via core task intake service.
5. Emit next-action guidance for findings.

### Acceptance criteria

- Core does not import package-manager-specific scanner code.
- Dependency plugin can be disabled.
- Findings can still generate TaskForge tasks.
- Missing external scanners produce clear next actions, not vague warnings.

### Agent next-action rules

- If scanner is missing, create setup task or report unavailable scanner based on policy.
- If vulnerability is critical/high, create remediation task unless one already exists.
- If update is major or license/security-sensitive, require human review.

---

# P2 Roadmap Tasks

## TASK-RAT-011 — Modularize CLI command registration

**Priority:** P2  
**Type:** Maintainability  
**Risk:** Low  
**Agent role:** Implementer

### Objective

Reduce `cli.ts` into a small bootstrapper and move command registration into modules.

### Target design

```ts
export interface CliModule {
  id: string;
  register(program: Command, ctx: AppContext): void;
}
```

Suggested modules:

```text
taskCommands
workspaceCommands
gateCommands
auditCommands
providerCommands
dependencyCommands
configCommands
```

### Acceptance criteria

- `cli.ts` only builds app context, registers modules, and parses args.
- Existing command names remain compatible.
- Plugin commands can be registered without editing core CLI bootstrap.

### Agent next-action rules

- Preserve backward compatibility for command names.
- Do not change behavior and modularize in the same commit unless necessary.

---

## TASK-RAT-012 — Add strict/warn/offline failure policy

**Priority:** P2  
**Type:** Safety / UX  
**Risk:** Medium  
**Agent role:** Implementer

### Objective

Stop silently degrading in multi-agent coordination paths.

### Required policy

```ts
type FailurePolicy = "strict" | "warn" | "offline";
```

Recommended defaults:

| Command class | Default policy |
|---|---|
| claim/start/done/release/block | strict |
| status/list/summary | warn |
| local-only diagnostics | warn |
| explicit `--offline` commands | offline |

### Acceptance criteria

- Config parse failures are visible.
- Push/pull failures are visible.
- Agent receives clear next action.
- Offline mode is explicit.

### Agent next-action rules

- In strict mode, do not proceed with implementation if durable task-state sync fails.
- In offline mode, annotate audit log that coordination is degraded.
- If remote is unavailable, suggest retry or offline mode, depending on command.

---

## TASK-RAT-013 — Improve GitHub provider hygiene and compatibility

**Priority:** P2  
**Type:** Provider cleanup  
**Risk:** Low  
**Agent role:** Implementer

### Objective

Clean up GitHub provider internals after provider boundary exists.

### Implementation steps

1. Split GitHub provider into:

```text
github-client.ts
github-issues-provider.ts
github-projects-v2-provider.ts
```

2. Remove duplicate interface definitions.
3. Support user-owned and organization-owned Projects v2.
4. Replace hardcoded legacy `tasks/TASK-ID.md` issue text with task-state-aware source description.
5. Add provider-specific tests with mocked GitHub client.

### Acceptance criteria

- GitHub provider is isolated.
- GitHub issue body references `task-state` source of truth.
- GitHub Projects v2 works for configured owner type or fails with clear next action.

### Agent next-action rules

- If GitHub token is missing, do not block Markdown-only operation.
- If GitHub sync fails, preserve local task-state and emit retry guidance.

---

## TASK-RAT-014 — Add compatibility migration for legacy `tasks/`

**Priority:** P2  
**Type:** Migration / Safety  
**Risk:** Low  
**Agent role:** Implementer

### Objective

Avoid ambiguity between legacy `main/tasks/*.md` and new `task-state` branch files.

### Implementation steps

1. Add `taskforge migrate-tasks` command.
2. Detect legacy `tasks/*.md` on main.
3. Copy/move them into task-state branch after confirmation or `--apply`.
4. Add audit event for migration.
5. Add warning in `doctor` if legacy and task-state both contain task files.

### Acceptance criteria

- Legacy tasks can be migrated safely.
- Duplicate task IDs are detected.
- Agents are instructed never to create new main-branch task files.

### Agent next-action rules

- If duplicate task IDs exist, stop and require human decision unless exact content match.
- If only legacy tasks exist, suggest migration before starting new work.

---

# Agentic Workflow Rules To Encode In CLI

## Command result contract

Every agent-facing command should produce:

```text
Result: success/failure
State: relevant task/workspace/provider state
Audit: event IDs or audit path
Next: explicit next action(s)
```

JSON mode must include:

```json
{
  "ok": true,
  "command": "start TASK-123",
  "data": {},
  "nextActions": [],
  "auditEventIds": []
}
```

## Test/gate failure behavior

```text
IF gates fail because implementation is wrong:
  agent fixes implementation
  agent reruns gates
  agent does not create blocker task

IF gates fail because upstream test suite is broken:
  agent creates Bug task
  agent links bug to current task
  agent continues only if current task can be verified safely another way

IF gates fail because environment is broken:
  agent retries once if safe
  agent blocks task if persistent

IF gates fail because secret or credential is missing:
  agent blocks immediately for human input
```

## Human-intervention gates

Agents must stop for human input when:

- Required secret is missing.
- Destructive operation is needed.
- Task scope is ambiguous.
- Legal/security/product decision is required.
- External provider authentication is missing and cannot be bypassed.
- Verification requires subjective human acceptance.
- Merge conflict cannot be resolved mechanically.

## Automatic continuation allowed when:

- Next action is executable.
- No human gate is present.
- Task remains within scope.
- Verification can be run locally.
- Audit log is writable.
- Durable task-state coordination is healthy or explicit offline mode is active.


---

# Documentation Roadmap Tasks

## TASK-RAT-015 — Document the extension architecture and provider methodology

**Priority:** P0  
**Type:** Documentation / Architecture  
**Risk:** Low  
**Agent role:** Architect / Documentation Agent

### Objective

Create the canonical user-facing and implementer-facing documentation for TaskForge extension points. Users and extension authors must be able to understand what can be extended, which interfaces are stable, how providers are registered, and what constraints providers must obey.

### Required documentation

Create or update:

```text
docs/architecture/extension-model.md
docs/providers/README.md
docs/providers/board-provider.md
docs/providers/agent-provider.md
docs/providers/git-port.md
docs/providers/package-provider.md
docs/providers/audit-sink.md
docs/providers/next-action-provider.md
docs/examples/provider-minimal-board.md
docs/examples/provider-minimal-agent.md
```

### Required content

Document these interfaces and concepts:

- `BoardProvider`
- `AgentProvider`
- `GitPort`
- `TaskStateStore`
- `PackageProvider`
- `AuditSink`
- `NextAction` / command guidance model
- Provider registry and provider selection from config
- Provider capability declarations
- Provider error semantics
- Provider test expectations
- Security and safety constraints for providers
- Compatibility expectations for future non-GitHub board systems
- Compatibility expectations for future non-OpenCode agent frameworks

### Extension methodology

The documentation must define the correct process for adding an extension:

1. Identify the relevant port/interface.
2. Implement the provider in `src/providers/<category>/<provider-id>/`.
3. Register the provider in the provider registry.
4. Add config schema support under `providers.<category>.<provider-id>`.
5. Add tests using the provider contract test suite.
6. Add user documentation and a minimal config example.
7. Verify Markdown + git-only mode still works.

### Acceptance criteria

- New contributor can implement a minimal board provider from docs alone.
- New contributor can implement a minimal agent provider from docs alone.
- Docs explicitly state that GitHub and OpenCode are optional adapters, not core requirements.
- Docs include at least one minimal provider skeleton for each major extension category.
- Docs define which interfaces are stable, experimental, and internal.
- Docs include troubleshooting for missing provider dependencies.

### Agent next-action rules

- If an interface is not yet implemented, document the intended interface and mark it `proposed`.
- If code and docs conflict, create a follow-up task to reconcile them and cite the conflict.
- Do not document provider behavior as stable unless tests enforce it.

---

## TASK-RAT-016 — Add provider contract tests and documentation examples

**Priority:** P1  
**Type:** Test / Documentation  
**Risk:** Medium  
**Agent role:** QA / Implementer

### Objective

Create reusable contract tests for extension points so provider authors can validate correctness without knowing the internals of TaskForge.

### Required implementation

Create contract test helpers for:

- `BoardProvider`
- `AgentProvider`
- `GitPort`
- `PackageProvider`
- `AuditSink`

Each contract test suite should verify minimum required behavior, error semantics, and capability reporting.

### Documentation requirements

Update provider docs to show how to run provider contract tests:

```bash
task-forge provider test board <provider-id>
task-forge provider test agent <provider-id>
```

or the closest implemented command if provider-test CLI support is deferred.

### Acceptance criteria

- At least one built-in provider passes each relevant contract test.
- Documentation includes examples of passing and failing contract tests.
- Provider authors have a clear checklist before submitting a new extension.

### Agent next-action rules

- If provider-test CLI is not yet available, create a follow-up task and provide direct test invocation instructions.
- If a built-in provider fails a contract test, fix the provider or create a blocking bug task if the issue is out of scope.

---

## TASK-RAT-017 — Document command next-action semantics and state-transition outcomes

**Priority:** P0  
**Type:** Documentation / Specification  
**Risk:** Low  
**Agent role:** Architect / Documentation Agent

### Objective

Document the command-output contract used to drive agent behavior. Every agent-facing command should have deterministic next-action guidance for success, failure, blocked, retryable, and human-intervention outcomes.

### Required documentation

Create or update:

```text
docs/architecture/next-action-model.md
docs/commands/agent-facing-commands.md
docs/commands/state-transition-matrix.md
```

### Required content

Document:

- `NextAction` schema
- human-readable vs JSON output expectations
- retryable vs terminal failure classification
- gate failure classification
- test failure handling
- upstream/tooling failure handling
- blocker creation rules
- bug task creation rules
- continuation rules
- human-intervention stop rules
- examples for `start`, `claim`, `gates`, `done`, `block`, `release`, `sweep`, `cleanup`, `sync`, `deps scan`

### Acceptance criteria

- Agent authors can determine what to do next solely from command output.
- JSON output has a stable documented schema.
- Each state transition has a documented expected next action.
- Documentation includes examples for failing tests, broken test harness, missing secret, push rejection, dirty worktree, stale claim, and provider unavailable.

### Agent next-action rules

- If command behavior lacks implementation, document target behavior and create a follow-up implementation task.
- If current command behavior is ambiguous, mark it as ambiguous and propose the desired deterministic output.

---

## TASK-RAT-018 — Document audit log and transcript extension model

**Priority:** P0  
**Type:** Documentation / Architecture  
**Risk:** Low  
**Agent role:** Architect / Documentation Agent

### Objective

Create authoritative documentation for per-task audit logs, transcript capture, transcript imports, and provider-specific transcript export adapters such as OpenCode `/export`.

### Required documentation

Create or update:

```text
docs/architecture/audit-model.md
docs/audit/per-task-audit-logs.md
docs/audit/transcript-import.md
docs/providers/audit-sink.md
docs/providers/agent-transcript-provider.md
```

### Required content

Document:

- Audit event schema
- Event categories
- Per-task audit file layout
- Transcript attachment model
- Transcript import/export flow
- OpenCode `/export` adapter behavior
- Generic transcript import format
- Redaction expectations
- Git-tracked vs local-only audit policy
- Tamper-evidence expectations
- How audit logs relate to task notes and completion reports

### Acceptance criteria

- Users understand where audit logs live and how to inspect them.
- Agent framework authors understand how to attach transcripts.
- OpenCode is documented as one transcript source, not the audit model itself.
- Docs include example audit events and a sample transcript attachment manifest.

### Agent next-action rules

- If audit implementation is incomplete, document the target model and mark incomplete parts as pending implementation.
- If transcript capture risks committing secrets, document redaction and local-only modes.

---

## TASK-RAT-019 — Add documentation index and user extension guide

**Priority:** P1  
**Type:** Documentation / UX  
**Risk:** Low  
**Agent role:** Documentation Agent

### Objective

Create a navigable documentation entry point that explains TaskForge concepts, extension points, and the correct extension path.

### Required documentation

Create or update:

```text
docs/README.md
docs/getting-started.md
docs/extending-taskforge.md
docs/configuration.md
docs/troubleshooting.md
```

### Required content

Include:

- System overview
- Git-only minimal setup
- GitHub provider setup
- OpenCode provider setup
- Provider-neutral task workflow
- Extension guide
- Interface stability policy
- Configuration reference
- Troubleshooting provider dependencies
- Troubleshooting task-state/worktree problems

### Acceptance criteria

- A new user can understand TaskForge without reading source code.
- An extension author can locate every extension-point document from `docs/README.md`.
- Config examples distinguish core config from provider config.
- README links to the documentation index.

### Agent next-action rules

- If documentation duplicates README content, consolidate by linking rather than copying.
- If the docs reveal stale behavior in README or TASKFORGE.md, create a follow-up docs sync task.

---

# Suggested Execution Order

1. `TASK-RAT-004` — per-task audit logs
2. `TASK-RAT-005` — next-action guidance model
3. `TASK-RAT-003` — transaction-only task-state mutation
4. `TASK-RAT-001` — provider ports and boundaries
5. `TASK-RAT-002` — native git `GitPort`
6. `TASK-RAT-006` — gate failure classification
7. `TASK-RAT-007` — config normalization
8. `TASK-RAT-008` — `taskforge` and `task-forge` binary alias
9. `TASK-RAT-009` — OpenCode provider
10. `TASK-RAT-010` — dependency steward plugin
11. `TASK-RAT-011` — modular CLI registration
12. `TASK-RAT-012` — strict/warn/offline failure policy
13. `TASK-RAT-015` — extension architecture and provider methodology docs
14. `TASK-RAT-017` — next-action and state-transition docs
15. `TASK-RAT-018` — audit and transcript docs
16. `TASK-RAT-013` — GitHub provider cleanup
17. `TASK-RAT-016` — provider contract tests and examples
18. `TASK-RAT-019` — documentation index and extension guide
19. `TASK-RAT-014` — legacy task migration

Rationale: audit and next-action guidance should land early because they improve every subsequent agent task. Transaction correctness should land before broad provider work because it protects distributed-agent safety.

---

# Definition of Done For This Roadmap

TaskForge is rationalized when:

- Core can run in Markdown + git-only mode.
- GitHub can be disabled without breaking core commands.
- OpenCode can be disabled or replaced by a generic agent provider.
- Every task mutation is transactional and audited.
- Every agent-facing command gives explicit next-action guidance.
- Per-task audit logs and transcript attachments exist.
- Gate failures are classified into actionable categories.
- CLI works as both `taskforge` and `task-forge`.
- Dependency steward is optional and provider-based.
- Config reflects the actual architecture: task-state branch, worktrees, providers, plugins.
- All public extension points and interfaces are documented with examples.
- Provider authors have a documented extension methodology and contract-test expectations.
- Audit logs, transcript attachment, and next-action command semantics are documented.

---

# High-Level Implementation Prompt For Agents

Use this prompt when assigning the rationalization roadmap to an implementation agent:

```text
You are working on TaskForge, a git-first agentic software development coordination tool.

Your goal is to rationalize the architecture for clarity, simplicity, maintainability, auditability, and provider neutrality.

Hard constraints:
- Git is the only required operational dependency.
- GitHub must be optional and implemented as a provider.
- OpenCode must be optional and implemented as an agent provider.
- Package-manager and dependency-scanner behavior must be optional plugin/provider behavior.
- All task-state mutations must be transactional.
- Agentic work must produce per-task audit logs.
- Commands must return explicit next-action guidance for agents.
- The CLI must be invocable as both `taskforge` and `task-forge`.

Before changing code:
1. Read TASKFORGE.md.
2. Read this roadmap.
3. Inspect the current command and core implementation.
4. Select exactly one task from this roadmap.
5. Implement only that task unless a small prerequisite is unavoidable.

During implementation:
- Preserve existing CLI compatibility unless the task explicitly changes it.
- Add tests for changed behavior.
- Add audit events for state transitions.
- Add next-action output for agent-facing command outcomes.
- If a failure is caused by upstream broken tests/tooling, create a Bug task and continue only if safe.
- If human input is required, block the task explicitly with category and reason.

Before completion:
- Run typecheck, lint, build, and tests where available.
- Attach or reference any agent transcript if work was performed agentically.
- Generate a completion report.
- Mark task ready for review only after verification or explicit documented exception.
```
