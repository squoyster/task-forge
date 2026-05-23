# TaskForge — Agent Guide

This file provides operational instructions for coding agents working on the TaskForge project itself.

## Before Starting

1. Read `TASKFORGE.md` — the full system specification
2. Read the relevant task file from the task-state worktree (`../task-state/`)
3. Check `git status` to understand current branch state
4. **Extract every Acceptance Criterion into an explicit checklist** — do not proceed until you can enumerate exactly what constitutes "done"

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

1. Every AC must have **evidence of satisfaction** recorded in the task file's Acceptance Criteria section, including the source file and identifier.
2. The completed checklist in the task file must be parseable by any agent or reviewer — do not bury evidence in prose, use structured checkmarks:
   ```
   - [x] AC description — `src/commands/claim.ts` `auditCommand(~L142)`: writes task.command.completed event
   ```
3. If using `--force` to bypass gates: document in agent notes which ACs are unmet and why, and create follow-up tasks.
4. The verification gates (`typecheck`, `lint`, `build`, `test`) prove you did not *break* anything. The AC checklist proves you *built* everything.

### Anti-Pattern: Throughput Over Correctness

Do NOT reason: *"There are N pending tasks, so I'll move fast and skip some ACs."* This is actively harmful:

- Skipped ACs compound — each downstream task inherits the gap
- Errors from missing ACs cost more to fix later than the time saved now
- Force-closing tasks creates invisible debt that blocks other agents

**Correctness over velocity. Every time.**

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
- **Verification gates** (TASK-018): `done` refuses if gates fail unless `--force`

Agents must obey these blocks — they are not suggestions.

### 4. Doctor Mode Protocol

When an inconsistency is detected:
1. Agent runs `taskforge doctor` to diagnose
2. If critical errors found and `--fix` is passed, doctor creates a `.doctor-lock` and recovery task
3. All normal agents pause (doctor-lock blocks `next`/`claim`/`start`)
4. Doctor agent works the recovery task, marks it Done via `taskforge done`
5. Done auto-removes the lock; agents pull and resume

### 5. Never Bypass the CLI

Do not use `--force` to skip guardrails unless you understand exactly what you're overriding. The CLI is the system of record for task state — bypassing it creates technical debt that another agent (or a human) must clean up.

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