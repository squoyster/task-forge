# TaskForge Implementation Task Set — Agent Framework Policy + OpenCode Integration

> Status: Historical implementation task set. Use `docs/workflow.md`, `AGENTS.md`, and `.opencode/agents/*.md` for the current operating contract.

## Numbering note

The highest TaskForge task number observed from the repository metadata available here is `TASK-045`, from the branch `agent/TASK-045-centralize-task-state-mutation-through-t--6336b86a8c`. This task set therefore starts at `TASK-046`.

## Epic: TaskForge Agent Operating System

### Goal

Extend TaskForge so `taskforge init` establishes the complete local operating contract for agentic coding inside a TaskForge-managed project.

The resulting system must:

- Install or patch `AGENTS.md`.
- Install framework-specific agent configuration, starting with OpenCode.
- Prevent normal agents from direct `git` usage.
- Prevent normal agents from directly mutating `../task-state`.
- Allow controlled doctor-mode recovery.
- Install local git hooks as a backstop.
- Capture per-task/per-session audit transcripts.
- Keep the design extensible to other agent frameworks.

---

# TASK-046: Add agent framework initialization architecture

## Type

Feature

## Priority

P1

## Agent Role

Implementer

## Risk Level

Medium

## Goal

Create an adapter-based initialization subsystem so `taskforge init` can install agent-framework-specific policy files.

## Background

TaskForge currently initializes task-state and worktree structure. It needs a pluggable system for installing agent-facing policy and config for frameworks such as OpenCode, Claude Code, Codex, or generic CLI agents.

## Requirements

Create a new subsystem, likely under:

```text
src/agent-frameworks/
  types.ts
  registry.ts
  generic.ts
  opencode.ts
```

Define an interface similar to:

```ts
export interface AgentFrameworkAdapter {
  id: string;
  displayName: string;
  detect(projectRoot: string): Promise<AgentFrameworkDetection>;
  plan(ctx: AgentFrameworkInitContext): Promise<GeneratedFilePlan>;
  apply(ctx: AgentFrameworkInitContext): Promise<void>;
  doctor(ctx: AgentFrameworkDoctorContext): Promise<Diagnostic[]>;
}
```

Support at minimum:

```text
generic
opencode
```

## CLI impact

Extend `taskforge init` with:

```bash
taskforge init --agent-framework opencode
taskforge init --agent-framework generic
taskforge init --agent-framework auto
taskforge init --policy permissive
taskforge init --policy managed
taskforge init --policy locked-down
taskforge init --dry-run
taskforge init --repair
```

Default:

```bash
taskforge init --agent-framework auto --policy managed
```

## Policy profiles

Implement these profiles:

| Profile | Direct git | Direct task-state edits | Hooks | Audit |
|---|---:|---:|---:|---:|
| `permissive` | ask | deny | optional | basic |
| `managed` | deny except doctor | deny | yes | yes |
| `locked-down` | deny except doctor | deny | yes | strict |

## Acceptance Criteria

- `taskforge init --agent-framework opencode --dry-run` shows generated/updated files without writing.
- `taskforge init --agent-framework generic --dry-run` works.
- Unknown framework IDs fail with a clear error.
- `auto` detects OpenCode if `opencode.json` or `.opencode/` exists; otherwise falls back to `generic`.
- Unit tests cover adapter selection, profile selection, and dry-run planning.
- Existing `taskforge init` behavior still works.

---

# TASK-047: Add managed block patching for AGENTS.md

## Type

Feature

## Priority

P1

## Agent Role

Implementer

## Risk Level

Low

## Goal

Make `taskforge init` create or patch `AGENTS.md` with a managed TaskForge agent policy block.

## Requirements

Add a managed block:

```md
<!-- TASKFORGE:BEGIN managed-agent-policy -->
...
<!-- TASKFORGE:END managed-agent-policy -->
```

If `AGENTS.md` does not exist, create it.

If it exists:

- Preserve existing user content.
- Insert the managed block near the top after the title if no block exists.
- Replace only the managed block if it already exists.
- Never duplicate the block.

## Required AGENTS.md content

The generated block must state:

- This repo is TaskForge-managed.
- Normal agents must use TaskForge lifecycle commands.
- Normal agents must not run `git` directly.
- Normal agents must not edit `../task-state/*.md`.
- Normal agents must not edit legacy `tasks/*.md`.
- Task-state changes must flow through TaskForge commands.
- Doctor mode is the only recovery path.
- Doctor mode requires `taskforge doctor --lock`.
- Normal agents must stop when doctor lock exists.

Include allowed commands:

```bash
taskforge next
taskforge start TASK-ID
taskforge resume TASK-ID
taskforge heartbeat TASK-ID
taskforge inspect TASK-ID
taskforge diff TASK-ID
taskforge gates --json
taskforge checkpoint TASK-ID --message "..."
taskforge submit TASK-ID
taskforge done TASK-ID
taskforge block TASK-ID "reason"
taskforge release TASK-ID
taskforge doctor --check
```

## Acceptance Criteria

- Running `taskforge init` twice does not duplicate content.
- Existing non-managed `AGENTS.md` content remains intact.
- Managed block updates when the policy profile changes.
- Tests cover create, insert, replace, and idempotency.

---

# TASK-048: Generate OpenCode project configuration

## Type

Feature

## Priority

P1

## Agent Role

Implementer

## Risk Level

Medium

## Goal

Generate or merge `opencode.json` so normal OpenCode agents are constrained to TaskForge-controlled workflows.

## Requirements

For `--agent-framework opencode`, generate or merge:

```text
opencode.json
```

The generated config must:

- Allow safe read/build/test commands.
- Allow TaskForge commands.
- Deny direct `git *` for normal agents.
- Deny direct editing of `../task-state/**`.
- Deny editing of legacy `tasks/**`.
- Deny editing `.git/**`.
- Allow `../worktrees/**`.
- Add a `doctor` agent with elevated but ask-gated git diagnostics/repair permissions.

## Baseline normal-agent policy

Generate equivalent config:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "permission": {
    "*": "ask",
    "edit": {
      "*": "allow",
      "../task-state/**": "deny",
      "tasks/**": "deny",
      ".git/**": "deny",
      "../worktrees/**/.git/**": "deny"
    },
    "bash": {
      "*": "ask",
      "pwd": "allow",
      "ls *": "allow",
      "cat *": "allow",
      "rg *": "allow",
      "grep *": "allow",
      "find *": "allow",
      "npm install": "ask",
      "npm run *": "allow",
      "npm test *": "allow",
      "taskforge *": "allow",
      "npm run dev -- *": "allow",
      "git *": "deny",
      "sed *../task-state*": "deny",
      "perl *../task-state*": "deny",
      "python *../task-state*": "deny",
      "node *../task-state*": "deny",
      "tee *../task-state*": "deny",
      "echo *../task-state*": "deny",
      "rm *../task-state*": "deny",
      "mv *../task-state*": "deny",
      "cp *../task-state*": "deny"
    },
    "external_directory": {
      "../task-state/**": "allow",
      "../worktrees/**": "allow"
    }
  }
}
```

## Doctor agent policy

Add an `agent.doctor.permission` section that:

Allows:

```text
taskforge doctor *
taskforge inspect *
taskforge audit *
git status *
git diff *
git log *
git show *
git fetch *
```

Ask-gates:

```text
git pull *
git commit *
git push *
git reset *
git rebase *
```

Denies:

```text
git push --force*
```

## Merge behavior

If `opencode.json` exists:

- Preserve unrelated provider/model/theme/settings config.
- Merge/replace only TaskForge-managed permission sections.
- Do not clobber user providers.

Use a namespaced marker if needed:

```json
{
  "taskforge": {
    "managed": true,
    "policyVersion": 1
  }
}
```

## Acceptance Criteria

- Generated `opencode.json` is valid JSON.
- Existing provider config is preserved.
- Normal agents have `git *` denied.
- Doctor agent has ask-gated git repair permissions.
- Tests cover fresh generation, merge into existing config, and profile variations.

---

# TASK-049: Generate OpenCode agent files

## Type

Feature

## Priority

P2

## Agent Role

Implementer

## Risk Level

Low

## Goal

Generate `.opencode/agents/*.md` role files for TaskForge workflows.

## Files

Create:

```text
.opencode/agents/implementer.md
.opencode/agents/reviewer.md
.opencode/agents/qa.md
.opencode/agents/doctor.md
```

## Required behavior

Each file should be generated as a managed file or contain a managed block.

### `implementer.md`

Must instruct the agent to:

- Start Ready work with `taskforge start TASK-ID`; resume existing work with `taskforge resume TASK-ID`.
- Work only in the assigned worktree.
- Use `taskforge checkpoint` instead of direct git commits.
- Use `taskforge submit` instead of direct git push.
- Use `taskforge done` only after gates pass.
- Stop on doctor lock.

### `reviewer.md`

Must instruct the agent to:

- Use `taskforge inspect`.
- Review diffs via `taskforge diff`.
- Avoid direct mutation unless explicitly tasked.
- Prefer comments/findings over edits.

### `qa.md`

Must instruct the agent to:

- Run verification gates.
- Report failures through TaskForge notes.
- Avoid changing production code unless explicitly tasked.

### `doctor.md`

Must instruct the agent to:

- Run `taskforge doctor --check` first.
- Acquire doctor lock before repair.
- Avoid force push.
- Minimize direct task-state edits.
- Release doctor lock only after `taskforge validate-state --strict --json` passes and stale agents are recovered.

## Acceptance Criteria

- Files are created under `.opencode/agents/`.
- Re-running init updates managed content idempotently.
- Doctor file includes elevated recovery protocol.
- Tests verify generated files exist and include required commands.

---

# TASK-050: Add OpenCode audit plugin generation

## Type

Feature

## Priority

P1

## Agent Role

Implementer

## Risk Level

Medium

## Goal

Generate an OpenCode plugin that captures per-session and per-task audit transcripts.

## File

```text
.opencode/plugins/taskforge-audit.ts
```

## Requirements

The plugin should listen to OpenCode events where available:

- session created
- session diff
- session error
- tool execute before
- tool execute after
- file edited
- permission asked
- permission replied

The plugin should write JSONL audit events to:

```text
logs/taskforge/sessions/<session-id>.jsonl
logs/taskforge/tasks/<TASK-ID>/transcript.jsonl
```

## Task ID resolution

Resolve task ID in this order:

1. `TASKFORGE_TASK_ID` environment variable.
2. Current branch name matching `TASK-*`, `FEATURE-*`, `BUG-*`, etc.
3. Current working directory path under `../worktrees/<TASK-ID>`.
4. Unknown task bucket:

```text
logs/taskforge/tasks/UNKNOWN/transcript.jsonl
```

## Event shape

Use a stable event shape:

```json
{
  "timestamp": "2026-05-22T22:10:11.123Z",
  "event": "tool.execute.before",
  "taskId": "TASK-123",
  "sessionId": "abc123",
  "agent": "implementer",
  "cwd": "/path/to/worktree",
  "tool": "bash",
  "summary": "npm test -- --run",
  "metadata": {}
}
```

## Redaction

Redact likely secrets:

- env var values containing `TOKEN`
- env var values containing `SECRET`
- env var values containing `PASSWORD`
- `.env` file contents
- GitHub tokens
- OpenAI/API keys

## Acceptance Criteria

- Plugin file is generated.
- Plugin creates audit directories as needed.
- Events are written as JSONL.
- Secret redaction has unit tests.
- Missing task ID does not crash the plugin.
- Plugin can be disabled with config:

```json
{
  "taskforge": {
    "audit": false
  }
}
```

---

# TASK-051: Add OpenCode guard plugin generation

## Type

Feature

## Priority

P1

## Agent Role

Implementer

## Risk Level

Medium

## Goal

Generate an OpenCode guard plugin that acts as a runtime backstop if static OpenCode permissions are missing, stale, or bypassed.

## File

```text
.opencode/plugins/taskforge-guard.ts
```

## Requirements

The guard plugin should inspect tool execution attempts and block or warn on:

- `git *` by non-doctor agents.
- Direct shell writes to `../task-state`.
- Direct edits under `../task-state/**`.
- Direct edits under `tasks/**`.
- Any command while `.doctor-lock` exists, unless agent is doctor or command is allowed read-only status/doctor check.
- Force push attempts.

## Policy behavior

For `managed` profile:

- Block normal-agent violations.
- Allow doctor diagnostics.
- Ask-gate doctor repairs.

For `permissive` profile:

- Warn or ask instead of hard block where feasible.

For `locked-down` profile:

- Hard block all violations.

## Acceptance Criteria

- Plugin is generated for OpenCode projects.
- Guard behavior is configurable by policy profile.
- Tests cover command classification:
  - allowed build/test
  - denied git
  - denied task-state edit
  - allowed doctor git status
  - denied force push

---

# TASK-052: Add TaskForge git facade commands

## Type

Feature

## Priority

P1

## Agent Role

Implementer

## Risk Level

High

## Goal

Add TaskForge commands that replace direct git usage for normal agents.

## Commands

Implement:

```bash
taskforge diff TASK-ID
taskforge checkpoint TASK-ID --message "..."
taskforge submit TASK-ID
taskforge pr TASK-ID
```

Optional:

```bash
taskforge branch TASK-ID
taskforge changed TASK-ID
taskforge log TASK-ID
```

## Behavior

### `taskforge diff TASK-ID`

Shows current worktree diff for the task.

Equivalent to safe read-only git diff, but routed through TaskForge.

### `taskforge checkpoint TASK-ID --message "..."`

Creates a commit on the task branch.

Must:

- Verify current worktree matches the task.
- Refuse if task is not assigned to current session unless `--force` or doctor mode.
- Refuse if on `main`.
- Refuse if on `task-state`.
- Include commit trailers:

```text
Task: TASK-ID
Agent-Session: <sessionId>
TaskForge-Managed: true
```

### `taskforge submit TASK-ID`

Pushes the task branch.

Must:

- Refuse force push.
- Refuse pushing `main`.
- Refuse pushing `task-state`.
- Push only the task branch.
- Append audit event.

### `taskforge pr TASK-ID`

Creates or updates a PR if GitHub sync is configured.

Must:

- Use existing GitHub config.
- Link PR number into task state via TaskForge transaction layer.
- Avoid direct task-state mutation.

## Acceptance Criteria

- Normal workflows no longer need direct `git`.
- Commands validate task/worktree/session ownership.
- Commit trailers are added.
- Audit events are emitted.
- Tests cover wrong branch, wrong task, unclaimed task, dirty diff, successful checkpoint, successful submit mock.

---

# TASK-053: Install git hooks via TaskForge init

## Type

Feature

## Priority

P1

## Agent Role

Implementer

## Risk Level

Medium

## Goal

Generate and install local git hooks as a backstop against direct git misuse.

## Files

```text
.taskforge/hooks/pre-commit
.taskforge/hooks/pre-push
.taskforge/hooks/post-commit
```

## Init behavior

When enabled:

```bash
taskforge init --install-hooks
```

Run:

```bash
git config core.hooksPath .taskforge/hooks
```

## `pre-commit`

Must block:

- Commit on `task-state` unless `TASKFORGE_INTERNAL=1` or `TASKFORGE_DOCTOR=1`.
- Commit on `main` from agent-managed worktree.
- Staged changes under `tasks/*.md`.
- Staged changes to `.git` paths.
- Commits missing `TaskForge-Managed: true` trailer when in an agent branch, if feasible.

## `pre-push`

Must block:

- Push to `main` from agent context.
- Push to `task-state` unless `TASKFORGE_INTERNAL=1`.
- Force push.
- Push of unrecognized branch from agent context.

## `post-commit`

Should append a git commit audit event to:

```text
logs/taskforge/audit/git.jsonl
```

## Acceptance Criteria

- Hooks are generated with executable permissions.
- `core.hooksPath` is set.
- Hooks are idempotently updated.
- Hooks can be checked with:

```bash
taskforge doctor hooks
```

- Tests cover hook file generation and expected block/allow cases using temp repos.

---

# TASK-054: Add TaskForge audit service

## Type

Feature

## Priority

P1

## Agent Role

Implementer

## Risk Level

Medium

## Goal

Create a core audit service used by TaskForge commands, hooks, and generated plugins.

## Suggested files

```text
src/core/audit.ts
src/core/audit-schema.ts
src/commands/audit.ts
src/commands/transcript.ts
```

## Requirements

Implement:

```ts
appendAuditEvent(event: AuditEvent): Promise<void>
appendTaskTranscript(taskId: string, event: AuditEvent): Promise<void>
readTaskAudit(taskId: string): Promise<AuditEvent[]>
summarizeTaskAudit(taskId: string): Promise<TaskAuditSummary>
```

## Event types

Support:

```text
task.command.started
task.command.completed
task.command.failed
task.state.changed
git.commit
git.push
tool.execute.before
tool.execute.after
file.edited
permission.asked
permission.replied
doctor.lock.created
doctor.lock.released
doctor.fix.applied
verification.started
verification.completed
verification.failed
```

## CLI commands

Add:

```bash
taskforge audit TASK-ID
taskforge transcript TASK-ID
taskforge transcript TASK-ID --json
taskforge timeline TASK-ID
```

## Storage

Use JSONL:

```text
logs/taskforge/audit/events.jsonl
logs/taskforge/tasks/<TASK-ID>/transcript.jsonl
logs/taskforge/sessions/<SESSION-ID>.jsonl
```

## Acceptance Criteria

- TaskForge commands emit audit events.
- JSONL append is safe and creates directories.
- Invalid/corrupt JSONL lines are skipped with warning.
- `taskforge transcript TASK-ID` produces readable output.
- `--json` produces machine-readable output.
- Tests cover event append/read/filter/summarize.

---

# TASK-055: Add doctor diagnostics for agent policy

## Type

Feature

## Priority

P2

## Agent Role

Implementer

## Risk Level

Low

## Goal

Extend `taskforge doctor` to validate agent policy installation.

## Commands

Add:

```bash
taskforge doctor agent-policy
taskforge doctor opencode
taskforge doctor hooks
taskforge doctor audit
```

## Checks

### `doctor agent-policy`

Validate:

- `AGENTS.md` has managed TaskForge block.
- Policy version is current.
- Profile in config matches generated files.

### `doctor opencode`

Validate:

- `opencode.json` exists for OpenCode projects.
- `git *` denied for normal agents.
- `../task-state/**` denied for edit.
- Doctor agent exists.
- Doctor agent denies force push.
- `.opencode/plugins/taskforge-audit.ts` exists if audit enabled.
- `.opencode/plugins/taskforge-guard.ts` exists if guard enabled.

### `doctor hooks`

Validate:

- `.taskforge/hooks/*` exist.
- Hooks are executable.
- `git config core.hooksPath` points to `.taskforge/hooks`.

### `doctor audit`

Validate:

- audit directories exist.
- audit files are writable.
- JSONL parse check passes on recent logs.

## Fix behavior

With:

```bash
taskforge doctor agent-policy --fix
```

Repair missing/stale generated files using the current init profile.

## Acceptance Criteria

- Doctor checks report clear pass/warn/fail output.
- `--json` output is supported.
- `--fix` repairs missing generated files.
- Tests cover missing config, stale policy, missing hooks, non-executable hooks.

---

# TASK-056: Add TaskForge config schema for agent integration

## Type

Feature

## Priority

P1

## Agent Role

Implementer

## Risk Level

Low

## Goal

Extend `.taskforge/config.json` and config schema to store agent integration settings.

## Required config shape

```json
{
  "agentFramework": {
    "id": "opencode",
    "policy": "managed",
    "installHooks": true,
    "audit": true,
    "guard": true,
    "policyVersion": 1
  }
}
```

## Requirements

- Add zod schema validation.
- Provide defaults.
- Make config available to init, doctor, audit, hooks, and generated plugin templates.
- Support future frameworks without schema churn.

## Acceptance Criteria

- Existing configs without `agentFramework` still load.
- Defaults are applied.
- Invalid policy values fail clearly.
- Tests cover config load, defaulting, validation, and save.

---

# TASK-057: Add template rendering utility

## Type

Chore

## Priority

P2

## Agent Role

Implementer

## Risk Level

Low

## Goal

Create a small template rendering utility for generated agent config, hooks, plugins, and Markdown.

## Suggested files

```text
src/core/templates.ts
src/templates/
  agents/
  opencode/
  hooks/
```

## Requirements

- Render simple string templates with typed context.
- Avoid adding a heavy templating dependency unless justified.
- Support line-ending normalization.
- Support managed block replacement.
- Support executable file mode for hooks.

## Acceptance Criteria

- All generated files use the template utility.
- Tests cover variable replacement, managed block replacement, and idempotency.
- No large new dependency unless documented.

---

# TASK-058: Add integration tests for init-generated OpenCode policy

## Type

Test

## Priority

P1

## Agent Role

QA Agent

## Risk Level

Medium

## Goal

Add tests proving the generated OpenCode integration enforces the intended policy structurally.

## Test cases

Create temp project, run:

```bash
taskforge init --agent-framework opencode --policy managed --install-hooks --audit
```

Verify:

- `AGENTS.md` exists.
- `opencode.json` exists.
- `.opencode/agents/doctor.md` exists.
- `.opencode/plugins/taskforge-audit.ts` exists.
- `.opencode/plugins/taskforge-guard.ts` exists.
- `.taskforge/hooks/pre-commit` exists and executable.
- `.taskforge/hooks/pre-push` exists and executable.
- `.taskforge/config.json` includes agent framework config.
- Running init twice produces no duplicate managed blocks.
- Existing unrelated `opencode.json` provider config is preserved.

## Acceptance Criteria

- Tests pass in CI.
- Tests do not require OpenCode binary to be installed.
- Tests do not require network access.
- Tests use temp directories.

---

# TASK-059: Update documentation for agent framework initialization

## Type

Documentation

## Priority

P2

## Agent Role

Documentation Agent

## Risk Level

Low

## Goal

Document the new TaskForge agent integration system.

## Files to update

```text
README.md
TASKFORGE.md
AGENTS.md
docs/
```

Add a new doc:

```text
docs/agent-framework-integration.md
```

## Documentation must explain

- Why agents should not use git directly.
- Why task-state must not be edited directly.
- How `taskforge init --agent-framework opencode` works.
- OpenCode normal-agent policy.
- Doctor-mode policy.
- Git hooks.
- Audit/transcript logs.
- How to repair policy with `taskforge doctor`.
- How future framework adapters should work.

## Acceptance Criteria

- README quick start includes new init options.
- TASKFORGE.md reflects `taskforge init` as policy installer.
- AGENTS.md generated block is documented.
- New docs include example command flow.
- Docs do not claim hooks are a hard security boundary.

---

# TASK-060: Remove or narrow any existing direct-git guidance for normal agents

## Type

Refactor

## Priority

P1

## Agent Role

Implementer

## Risk Level

Low

## Goal

Eliminate conflicting instructions that tell normal agents they may use git directly.

## Background

Existing guidance allows direct git push/pull on agent branches. The new model should route normal-agent git operations through TaskForge facade commands.

## Requirements

Search docs and agent instructions for:

```text
git push
git pull
git commit
git worktree
git checkout
git branch
```

Update guidance:

- Normal agents use `taskforge checkpoint`, `taskforge submit`, `taskforge diff`, `taskforge start`, `taskforge done`.
- Doctor agent may use selected git commands under doctor protocol.
- Humans may still use git normally unless project policy says otherwise.

## Acceptance Criteria

- No normal-agent docs recommend direct git.
- Doctor-specific direct git guidance is clearly isolated.
- TaskForge facade commands are referenced instead.
- Tests/docs updated as needed.

---

# Suggested implementation order

1. `TASK-056` — config schema.
2. `TASK-057` — template utility.
3. `TASK-046` — adapter architecture.
4. `TASK-047` — AGENTS.md managed block.
5. `TASK-048` — OpenCode config.
6. `TASK-049` — OpenCode agents.
7. `TASK-053` — hooks.
8. `TASK-054` — audit service.
9. `TASK-050` — audit plugin.
10. `TASK-051` — guard plugin.
11. `TASK-052` — git facade commands.
12. `TASK-055` — doctor diagnostics.
13. `TASK-058` — integration tests.
14. `TASK-060` — remove conflicting git guidance.
15. `TASK-059` — docs.

# MVP cut

If you want the smallest useful slice:

1. `TASK-056`
2. `TASK-046`
3. `TASK-047`
4. `TASK-048`
5. `TASK-053`
6. `TASK-055`

That gives you:

- `taskforge init --agent-framework opencode --policy managed`
- `AGENTS.md` policy
- `opencode.json` permissions
- doctor agent permission split
- hooks
- doctor validation

Audit/transcripts and git facade can follow immediately after.
