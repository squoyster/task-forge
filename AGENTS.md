# TaskForge — Agent Guide

This file provides operational instructions for coding agents working on the TaskForge project itself.

## Before Starting

1. Read `TASKFORGE.md` — the full system specification
2. Read the relevant task file from the task-state worktree (`../task-state/`)
3. Check `git status` to understand current branch state

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

## Mandatory Deliverables per Task

When completing a task, agents must update:

1. **CHANGELOG.md** — Add an entry under `## [Unreleased]` describing the change. Follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format:
   - `### Added` — new features
   - `### Changed` — changes to existing behavior
   - `### Fixed` — bug fixes
   - `### Deprecated` — features pending removal
   - Each entry should reference the task ID: `**TASK-NNN: Short description** — detailed one-liner.`

2. **Task file** — Append agent notes via `appendAgentNote()` and update acceptance criteria.

3. **README.md** — If the task adds or changes a CLI command, update the command table.

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

Always use git worktrees for task implementation:

```bash
git worktree add ../worktrees/TASK-123 -b agent/TASK-123-short-title
cd ../worktrees/TASK-123
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