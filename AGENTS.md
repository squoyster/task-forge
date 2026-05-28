# TaskForge — Agent Guide

This file provides operational instructions for coding agents working on the TaskForge project itself.

## Master Agent Directive

**You are operating under the TaskForge control plane.**

TaskForge is the mandatory workflow interface. You must not invent workflow steps. You must not bypass TaskForge with raw git or direct task-file edits. You must select exactly one next command from the valid next actions returned by each command. If no agent-allowed command applies, stop and follow recovery guidance.

### Absolute Rules

1. **TaskForge is the only workflow interface.** Use TaskForge commands for all task lifecycle operations.
2. **Never use `--force`.** Force is reserved for human intervention and doctor-mode recovery.
3. **Never edit task-state files directly.** All task-state mutations flow through the TaskForge transaction layer.
4. **Never carry hidden context between tasks.** Merge relevant context into todo items, then perform context cleanup.
5. **Never infer your own workflow.** Select from the returned `validNextCommands` after each command.

## Mandatory Startup Sequence

Before beginning any work, run these commands in order:

```bash
taskforge doctor --json          # Verify system health
taskforge validate-state --json  # Verify task-state invariants
taskforge next --json            # Find the next actionable task
```

If any command reports issues:
- `doctor` findings → run `taskforge doctor --fix` (doctor-mode only) or block for human
- `validate-state` errors → run `taskforge doctor` or create a bug task
- `next` reports outstanding task → complete or release it first

## Acceptance Criteria Contract

Acceptance criteria (ACs) define the contract between the task author and the implementer. **Satisfying ACs is the implementer's primary obligation.** Throughput, task queue depth, or urgency do not excuse skipped ACs.

### Before Writing Code

1. Read the task file and extract every `- [ ]` item from the Acceptance Criteria section into an explicit checklist.
2. If ACs are missing or ambiguous, **block the task** with category `ambiguous_spec` and request clarification. Do not guess.
3. Map each AC to the specific files or modules it will touch.

### During Implementation

1. Work through the checklist — do not jump ahead.
2. When you believe an AC is satisfied, mark it with **explicit traceability**:
   - **Source file** (e.g., `src/commands/claim.ts`)
   - **Identifier** — a function name, test name, exported constant, or approximate line number that can be located even if line numbers shift (e.g., `auditCommand()`, `test "reports json output"`, `~L140`)
   - **Rationale** — one sentence on how the code satisfies the AC
   - This traceability lets agents and reviewers quickly determine whether every AC was addressed without reading the entire diff.
3. If an AC cannot be satisfied within scope:
   - Document why in the task file agent notes
   - Create a follow-up task with the remaining AC
   - Add the follow-up task ID as `dependsOn` on the current task if it blocks completion

### Before Marking Done

Follow the **End-of-Work Sequence** (see above) before running `taskforge done`.

1. Every AC must have **evidence of satisfaction** recorded in the task file's Acceptance Criteria section, including the source file and identifier.
2. The completed checklist in the task file must be parseable by any agent or reviewer — do not bury evidence in prose, use structured checkmarks:
   ```
   - [x] AC description — `src/commands/claim.ts` `auditCommand(~L142)`: writes task.command.completed event
   ```
3. If an AC cannot be satisfied: document in agent notes which ACs are unmet and why, and create follow-up tasks. **Do not use `--force`** — it is not available to normal agents.
4. The verification gates (`typecheck`, `lint`, `build`, `test`) prove you did not *break* anything. The AC checklist proves you *built* everything.

#### Mandatory Pre-conditions for `taskforge done`

Before running `taskforge done`, agents MUST ensure:

- **No uncommitted files**: All changes in the worktree are committed. `git status` must show a clean working tree.
- **Branch is pushed**: The task branch is pushed to remote. `git status` must not show "ahead of origin".
- **Gates pass**: `npm run typecheck && npm run lint && npm run build && npm test -- --run` all succeed.
- **ACs are checked**: Every acceptance criterion in the task file is marked `[x]` with evidence.

`taskforge done` enforces these invariants programmatically and will reject the operation if any are violated. Do not attempt to bypass these checks.

### Anti-Pattern: Throughput Over Correctness

Do NOT reason: *"There are N pending tasks, so I'll move fast and skip some ACs."* This is actively harmful:

- Skipped ACs compound — each downstream task inherits the gap
- Errors from missing ACs cost more to fix later than the time saved now
- Force-closing tasks creates invisible debt that blocks other agents

**Correctness over velocity. Every time.**

## Forbidden Raw Git Commands

The following git commands are **forbidden** for task workflow operations. Use TaskForge equivalents instead:

| Forbidden Command | Reason | Use Instead |
|---|---|---|
| `git commit` | Bypasses TaskForge audit trail and transaction layer | `taskforge checkpoint <TASK-ID> -m "message"` |
| `git push` | Bypasses TaskForge jittered push and PR workflow | `taskforge submit <TASK-ID>` |
| `git worktree add` | Bypasses TaskForge worktree setup and branch naming | `taskforge start <TASK-ID>` |
| `git worktree remove` | Bypasses TaskForge safety checks | `taskforge cleanup <TASK-ID> --apply` |
| `git branch -D` | Bypasses TaskForge branch lifecycle management | `taskforge done <TASK-ID> --delete-branch` |
| `git checkout` / `git switch` | Breaks worktree isolation | Work within your assigned worktree only |
| `gh pr create` | Bypasses TaskForge PR creation with proper metadata | `taskforge pr <TASK-ID>` |

**Exception:** Doctor agents may use selected git commands under doctor protocol. TaskForge internals may use git. Normal coding agents may not bypass the TaskForge command surface.

## Force Restriction Directive

**Never use `--force`.** Force is reserved for:
1. Human operators (via `TASKFORGE_ACTOR=human`)
2. Doctor-mode recovery (via `TASKFORGE_ACTOR=doctor`)
3. A recovery task explicitly created by doctor mode and authorized for force use

If force appears necessary, use one of:

```bash
taskforge doctor --json
```

```bash
taskforge block <TASK-ID> "Force operation requires human or doctor-mode authorization" --category unsafe_operation --blocked-by human
```

```bash
taskforge new "Handle unclosed TaskForge error state: <ERROR-CODE>" --type Bug --priority P1 --status Ready --body "Observed unhandled state from command <COMMAND>. Error code: <ERROR-CODE>. Error message: <MESSAGE>. Define invariant, recovery path, valid next commands, tests, and documentation."
```

## Unknown State Closure Rule

If TaskForge does not provide a valid next action, or you encounter an unhandled state:

1. **Do not guess or proceed.**
2. Create a new task describing the unexpected state:

```bash
taskforge new "Handle unclosed TaskForge state: <summary>" --type Bug --priority P1 --status Ready --body "<details>"
```

3. Block the current task if unable to continue:

```bash
taskforge block <TASK-ID> "Unhandled state requires human triage: <details>" --category unsafe_operation --blocked-by human
```

## End-of-Work Sequence

When completing implementation work on a task, follow this sequence:

```bash
taskforge diff <TASK-ID>                # Review all changes
taskforge gates                         # Run verification gates
taskforge checkpoint <TASK-ID> -m "..." # Commit changes
taskforge submit <TASK-ID>              # Push task branch
taskforge pr <TASK-ID>                  # Create pull request
taskforge report <TASK-ID> --complete   # Generate completion report
taskforge done <TASK-ID>                # Mark task as done
```

If gates fail: fix the issues, re-run `taskforge gates`, then continue from checkpoint.
If `done` rejects: check acceptance criteria, worktree cleanliness, and branch push status.

## Development Workflow

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev -- <command>

# Build
npm run build

# Type-check
npm run typecheck

# Lint
npm run lint

# Format
npm run format

# Test (single run)
npm test -- --run

# Test (watch mode)
npm test
```

## Verification Gates

Before marking a task `Done`, all must pass:
- `npm run typecheck` — zero errors
- `npm run build` — clean build, no warnings
- `npm run lint` — zero errors
- `npm test -- --run` — all tests pass

**Gates prove nothing was broken. They do not prove the task was completed.** Passing gates without satisfying all ACs is an incomplete task. The AC checklist is the authoritative completion measure — gates are a safety net.

## Mandatory Deliverables per Task

When completing a task, agents must update:

1. **Acceptance criteria** — Each AC must be checked off (`- [x]`) with a brief note on how it was satisfied (test name, file path, or command). If an AC cannot be satisfied, document the unmet AC with a reason and create a follow-up task.

2. **CHANGELOG.md** — Add an entry under `## [Unreleased]` describing the change. Follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format:
   - `### Added` — new features
   - `### Changed` — changes to existing behavior
   - `### Fixed` — bug fixes
   - `### Deprecated` — features pending removal
   - Each entry should reference the task ID: `**TASK-NNN: Short description** — detailed one-liner.`

2. **Task file** — Append agent notes via `appendAgentNote()` and update acceptance criteria.

3. **README.md** — If the task adds or changes a CLI command, update the command table.

## Agent Discipline — Hard Rules

These rules are enforced by system guardrails where possible. Violating them creates inconsistent state that requires doctor recovery.

### 1. No Direct Git Manipulation on Task-State

Agents must never run `git` commands directly on the task-state worktree or main repo to modify task state. All task-state changes must flow through taskforge CLI commands:

| Action | Correct Command |
|--------|----------------|
| Claim a task | `taskforge claim` / `taskforge start` |
| Mark complete | `taskforge done` |
| Abandon claim | `taskforge release` |
| Mark blocked | `taskforge block` |
| Extend lease | `taskforge heartbeat` |

Normal agents must use TaskForge facade commands instead of direct git: `taskforge checkpoint` (replaces `git commit`), `taskforge submit` (replaces `git push`), `taskforge diff` (read-only diff). Doctor agents may use selected git commands under doctor protocol.

### Git Operations Matrix

| Operation | Allowed on main? | Allowed on task-state? | Allowed on agent branch? | TaskForge Command |
|-----------|------------------|------------------------|--------------------------|-------------------|
| `git pull` | ✅ | ✅ (via `pullTaskState`) | ✅ | `pullTaskState` (automatic) |
| `git push` | ❌ | ❌ (use transaction layer) | ✅ | `jitteredPush` / transaction |
| `git commit` | ❌ | ❌ | ✅ | — |
| `git worktree add` | ❌ (use `start`) | ❌ | ❌ | `taskforge start` |
| `git worktree remove` | ❌ (use `done --cleanup`) | ❌ | ❌ | `taskforge done --cleanup` |
| `git branch -D` | ❌ | ❌ | ❌ | `taskforge done --delete-branch` |
| `git merge` | ❌ (manual only) | ❌ | ✅ | — |
| `git checkout task-state` | ❌ | ❌ | ❌ | Never |
| `git push --force` | ❌ | ❌ | ❌ | Never |

### 2. No Direct Task-State File Editing

Never edit `../task-state/*.md` files directly — no `sed`, no manual YAML edits, no `vim`. Status changes, lock clearing, and agent notes must go through the CLI lifecycle commands. Manual edits produce stale `assignee`/`claimed_at` fields on Done tasks, broken state invariants, and confused schedulers.

### 3. Respect Guardrails Before Acting

Before `next`, `claim`, or `start`, the system checks:
- **Outstanding session tasks** (TASK-040): You cannot start new work while you own an unclosed task
- **Doctor lock** (TASK-042): All agents pause during system recovery
- **Verification gates** (TASK-018): `done` refuses if gates fail unless `--force` (human/doctor only)

Agents must obey these blocks — they are not suggestions.

**Important:** `--force` is never available to normal agents. If a guardrail blocks you and you believe force is required, run `taskforge doctor --json` or block the task for human intervention.

### 4. Doctor Mode Protocol

When an inconsistency is detected:
1. Agent runs `taskforge doctor` to diagnose
2. If critical errors found and `--fix` is passed, doctor creates a `.doctor-lock` and recovery task
3. All normal agents pause (doctor-lock blocks `next`/`claim`/`start`)
4. Doctor agent works the recovery task, marks it Done via `taskforge done`
5. Done auto-removes the lock; agents pull and resume

### 5. Never Bypass the CLI

Do not use `--force` to skip guardrails. The CLI is the system of record for task state — bypassing it creates technical debt that another agent (or a human) must clean up.

**Authority model:** Force operations are gated by `assertCanForce()` in `src/core/authority.ts`. Normal agents (`TASKFORGE_ACTOR` unset or `agent`) receive `FORCE_REQUIRES_HUMAN_OR_DOCTOR` errors. Only `human` and `doctor` actors may use `--force`.

If you encounter a situation where force seems necessary:
1. Run `taskforge doctor --json` to diagnose
2. If doctor cannot resolve it, block for human: `taskforge block <TASK-ID> "Requires human authorization" --category unsafe_operation --blocked-by human`
3. **Do not attempt to bypass the authority check.**

### 7. Use TaskForge CLI for Task Creation and Workflow Management

Agents must use `taskforge` CLI commands for all task creation and workflow management operations. Git is a tool of last resort — only use it when no `taskforge` command exists for the operation.

| Operation | Correct Command |
|-----------|----------------|
| Create a new task | `taskforge new` |
| Select next task | `taskforge next` |
| Start working on a task | `taskforge start` |
| Commit changes | `taskforge checkpoint` |
| Push changes / create PR | `taskforge submit` |
| View diff | `taskforge diff` |
| Mark task done | `taskforge done` |
| Block a task | `taskforge block` |
| Release a claim | `taskforge release` |
| Sync with GitHub | `taskforge sync` |

See **Forbidden Raw Git Commands** (above) for the complete list of prohibited git operations and their TaskForge equivalents.

Do not use `git commit`, `git push`, `git branch`, `git checkout`, or similar commands for task workflow unless the `taskforge` CLI has no equivalent and the operation is unavoidable.

### 6. Prioritize Correctness Over Throughput

Do not skip acceptance criteria or prematurely mark tasks Done because there are many pending tasks in the queue. This reasoning is actively harmful:

- Skipped ACs compound — each downstream task inherits the gap.
- Errors from missing ACs cost significantly more to fix later than the time saved by rushing.
- Force-closing tasks with unmet ACs creates invisible technical debt that blocks other agents.
- The verification gates (typecheck, lint, build, test) only prove nothing was broken — they do not prove the task is complete.

**A task is Done only when every acceptance criterion has been satisfied with evidence.** Task queue depth is irrelevant to this standard.

## Code Conventions

- **Language**: TypeScript with strict mode (`strict: true` in tsconfig)
- **Module system**: ESM (`"type": "module"` in package.json)
- **Imports**: Use `.js` extensions for relative imports (e.g., `./foo.js`)
- **No `any`**: Avoid `any` type; use `unknown` with type narrowing
- **No unused variables**: Prefix unused params with `_`
- **No comments**: Do not add comments unless the logic is non-obvious
- **Error handling**: Throw `TaskForgeError` subclasses for known error paths; let unexpected errors propagate to `cli.ts`'s `wrap()` handler
- **Console output**: Use the logging utilities from `src/util/logging.js` (`logInfo`, `logSuccess`, `logWarn`, `logError`, `logHeader`, `logSub`, `logDivider`)
- **Schema validation**: Use `zod` (`z.object`, `z.enum`, etc.) for runtime validation
- **No console.log**: Use `logInfo` or other logging helpers

## Project Structure

```
src/
  cli.ts                   — Entry point, commander setup
  commands/                — CLI command implementations
    init.ts, next.ts, start.ts, status.ts, summary.ts
    block.ts, done.ts, sync.ts
    deps/                  — Dependency Steward commands
  core/                    — Core logic
    task.ts                — Zod schemas for task model
    task-store.ts          — Task file I/O (gray-matter)
    status-transition.ts   — Status transition validation
    scheduler.ts           — Task scoring and selection
    continuation.ts        — Stopping condition checks
    config.ts              — Configuration loading
    errors.ts              — Error classes
    git.ts                 — Git worktree management
  util/                    — Utilities
    paths.ts               — Path resolution
    logging.ts             — Colored console output
    exec.ts                — execa wrapper
  markdown/
    templates.ts           — Task/document templates
```

## Task File Format

Task files are Markdown with YAML frontmatter:

```yaml
---
id: TASK-001
type: Task
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
branch: agent/TASK-001-short-title
worktree: ../worktrees/TASK-001
issue: 42
pr: 100
---
```

When editing task files:
- Use `writeTaskFile()` and `updateTaskStatus()` from `task-store.js`, not raw file I/O
- Append agent session notes via `appendAgentNote()`
- Do not manually edit frontmatter unless necessary

## Task Status Flow

```
Inbox → Needs Spec → Ready → In Progress → Review → Verify → Done
                         ↓
                      Blocked
```

Valid transitions are enforced by `status-transition.ts`.

## Git Worktree Workflow

Always use `taskforge start TASK-ID` to create isolated workspaces:

```bash
taskforge start TASK-123
cd ../worktrees/<project>/TASK-123
npm install
```

Branch pattern: `agent/TASK-ID-short-description`
Do not work directly on `main`.

## Dependency Management

Use `npm` (not pnpm/yarn). Run dependency commands:

```bash
npm run dev -- deps scan    # Full dependency health scan
npm run dev -- deps audit   # Vulnerability audit
npm run dev -- deps outdated  # Check outdated packages
npm run dev -- deps plan    # Generate remediation plan
```

## Testing Guidelines

- Tests use Vitest with `describe`/`it`/`expect`
- Tests go in `tests/` — one file per module
- Use `makeTaskFile` pattern (temp directories with `fs.mkdtempSync`) for I/O tests
- Use `setRepoRoot()` to control path resolution in tests
- Mock `execa` for tests that shell out to external commands
- Do not reduce coverage; add tests for new functionality

## GitHub Sync (`cmdSync`)

The `taskforge sync` command bidirectional syncs task files ↔ GitHub Issues:

- **New tasks** (no `issue` in frontmatter): Creates a GitHub Issue with labels and body
- **Existing tasks** (has `issue` number): Updates both **status labels** and **issue body** on GitHub
- Labels are kept in sync via `ensureLabels()` before any sync operation

Enable in `.taskforge/config.json`:
```json
{
  "github": { "enabled": true, "owner": "my-org", "repo": "my-repo" }
}
```

Requires `GITHUB_TOKEN` env var.

## Common Patterns

```typescript
// Loading a task
import { loadTaskById, updateTaskStatus } from "./core/task-store.js";
const task = loadTaskById("TASK-001");

// Validating a transition
import { validateTransition } from "./core/status-transition.js";
const err = validateTransition(task.status, "Done");

// Checking continuation safety
import { isSafeToContinue } from "./core/continuation.js";
if (!isSafeToContinue(task, { isDestructive: true })) {
  // stop
}

// Creating a worktree
import { createWorktree } from "./core/git.js";
const { path, branch } = await createWorktree(repoRoot, task);
```

## Custom Agents

Custom opencode agents are defined in `.opencode/agent/`:

| Agent | Role | Mode |
|---|---|---|
| `implementer` (default) | Implement one task in isolated worktree | primary |
| `intake` | Convert raw requests into structured tasks | subagent |
| `planner` | Decompose epics/features into executable tasks | subagent |
| `reviewer` | Review code for correctness, security, scope | subagent |
| `deps` | Dependency Steward — scan, audit, plan updates | subagent |

Switch agents with: `Use the [agent-name] agent` or via the CLI `--agent` flag.