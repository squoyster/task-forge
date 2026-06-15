# DOX framework

- DOX is highly performant AGENTS.md hierarchy installed here
- Agent must follow DOX instructions across any edits

## Core Contract

- AGENTS.md files are binding work contracts for their subtrees
- Work products, source materials, instructions, records, assets, and durable docs must stay understandable from the nearest applicable AGENTS.md plus every parent AGENTS.md above it

## Read Before Editing

1. Read the root AGENTS.md
2. Identify every file or folder you expect to touch
3. Walk from the repository root to each target path
4. Read every AGENTS.md found along each route
5. If a parent AGENTS.md lists a child AGENTS.md whose scope contains the path, read that child and continue from there
6. Use the nearest AGENTS.md as the local contract and parent docs for repo-wide rules
7. If docs conflict, the closer doc controls local work details, but no child doc may weaken DOX

Do not rely on memory. Re-read the applicable DOX chain in the current session before editing.

## Update After Editing

Every meaningful change requires a DOX pass before the task is done.

Update the closest owning AGENTS.md when a change affects:

- purpose, scope, ownership, or responsibilities
- durable structure, contracts, workflows, or operating rules
- required inputs, outputs, permissions, constraints, side effects, or artifacts
- user preferences about behavior, communication, process, organization, or quality
- AGENTS.md creation, deletion, move, rename, or index contents

Update parent docs when parent-level structure, ownership, workflow, or child index changes. Update child docs when parent changes alter local rules. Remove stale or contradictory text immediately. Small edits that do not change behavior or contracts may leave docs unchanged, but the DOX pass still must happen.

## Hierarchy

- Root AGENTS.md is the DOX rail: project-wide instructions, global preferences, durable workflow rules, and the top-level Child DOX Index
- Child AGENTS.md files own domain-specific instructions and their own Child DOX Index
- Each parent explains what its direct children cover and what stays owned by the parent
- The closer a doc is to the work, the more specific and practical it must be

## Child Doc Shape

- Create a child AGENTS.md when a folder becomes a durable boundary with its own purpose, rules, responsibilities, workflow, materials, or quality standards
- Work Guidance must reflect the current standards of the project or user instructions; if there are no specific standards or instructions yet, leave it empty
- Verification must reflect an existing check; if no verification framework exists yet, leave it empty and update it when one exists

Default section order:
- Purpose
- Ownership
- Local Contracts
- Work Guidance
- Verification
- Child DOX Index

## Style

- Keep docs concise, current, and operational
- Document stable contracts, not diary entries
- Put broad rules in parent docs and concrete details in child docs
- Prefer direct bullets with explicit names
- Do not duplicate rules across many files unless each scope needs a local version
- Delete stale notes instead of explaining history
- Trim obvious statements, repeated rules, misplaced detail, and warnings for risks that no longer exist

## Closeout

1. Re-check changed paths against the DOX chain
2. Update nearest owning docs and any affected parents or children
3. Refresh every affected Child DOX Index
4. Remove stale or contradictory text
5. Run existing verification when relevant
6. Report any docs intentionally left unchanged and why

## User Preferences

When the user requests a durable behavior change, record it here or in the relevant child AGENTS.md

## Child DOX Index

### `src/core/AGENTS.md`
Core engine: state machine, task lifecycle, git operations, audit trail, hooks, config, agent registry, session management, state validation, sweeper, continuation policy, errors, and templates. 41 files — the heart of TaskForge.

### `src/commands/AGENTS.md`
CLI command handlers: every `taskforge` subcommand (start, done, next, resume, block, claim, etc.) plus the `deps/` subdirectory for dependency management. Each file is a thin handler delegating to core modules.

### `tests/AGENTS.md`
Test suite: Vitest tests for core engine, CLI commands, agent frameworks, integrations, and utilities. Tests mirror the `src/` directory structure.

### `docs/AGENTS.md`
Project documentation: workflow contract (`workflow.md`), architecture specs, deployment guides, and design decisions.

### `.agent/AGENTS.md`
Agent routing indices: compact file/symbol/spec/task/context indexes (`tf.ctx`, `file.idx`, `symbol.idx`, `spec.idx`, `task.idx`) for efficient agent navigation.

### `specs/AGENTS.md`
Specifications: detailed design specs, gap analyses, task packs, and architecture roadmap documents. Contains the TaskForge Agent Compact Guide.

### Owned by Root (no child AGENTS.md)

| Path | Description |
|---|---|
| `src/agent-frameworks/` | Agent framework adapters (OpenCode, generic) |
| `src/integrations/` | External integrations (GitHub) |
| `src/util/` | Shared utilities (exec, paths, logging, timestamps, JSON result) |
| `src/markdown/` | Markdown template rendering |
| `scripts/` | Build and utility scripts |
| `tasks/` | Legacy task files (deprecated — task state lives in task-state worktree) |
| `.taskforge/` | TaskForge runtime configuration and state |

## Agent Instructions

- `docs/workflow.md` is the canonical workflow contract
- Read discovery indexes first: `.agent/tf.ctx` → `.agent/file.idx` → `.agent/symbol.idx` → `.agent/spec.idx` → `.agent/task.idx`
- Use indexes to select files before glob/grep/read
- Routine reads only: indexes, changed files, directly referenced sources/tests, relevant docs
- If a file is missing from indexes: narrow grep/glob, then update `.agent/index.overrides`

Skip by default: `session-ses_*.md`, `specs/session-ses_*.md`, `docs/archive/`, `.opencode/node_modules/`, `Volumes/`, `node_modules/`

<!-- TASKFORGE:BEGIN managed-agent-policy -->
## TaskForge Managed Policy

- **Never run git directly.** Use `taskforge start|done|checkpoint|submit` instead.
- **No direct edits** to `../task-state/*.md`, `tasks/*.md`, `.opencode/**`, `.taskforge/**` (doctor excepted).
- **Stop all work** when `.doctor-lock` exists.
- **Doctor protocol:** check → lock → fix → release via `taskforge done`. Minimize task-state edits; never force push.
- **Allowed commands:** `taskforge next|start TASK-ID|heartbeat TASK-ID|inspect TASK-ID|diff TASK-ID|checkpoint TASK-ID --message "..."|submit TASK-ID|done TASK-ID|block TASK-ID "reason"|release TASK-ID|doctor --check`
<!-- TASKFORGE:END managed-agent-policy -->

<!-- gitnexus:start -->
## GitNexus — Code Intelligence

Indexed as **task-forge** (2769 symbols, 6157 relationships, 233 execution flows). Re-index: `node .gitnexus/run.cjs analyze` (no `.gitnexus/run.cjs` → `npx gitnexus analyze`; npm 11 crash → `npm i -g gitnexus`; #1939).

**Always:**
- `impact({target, direction:"upstream"})` before editing any symbol — warn on HIGH/CRITICAL risk
- `detect_changes()` before committing; for regression review `detect_changes({scope:"compare", base_ref:"main"})`
- Use `query({query:"concept"})` for execution flow discovery instead of grep
- Use `context({name:"symbolName"})` for full caller/callee/process context on a symbol

**Never:**
- Edit a symbol without running `impact` first
- Ignore HIGH/CRITICAL risk warnings
- Rename with find-and-replace — use `rename` which understands the call graph
- Commit without running `detect_changes()`

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/task-forge/context` | Codebase overview, index freshness |
| `gitnexus://repo/task-forge/clusters` | Functional areas |
| `gitnexus://repo/task-forge/processes` | All execution flows |
| `gitnexus://repo/task-forge/process/{name}` | Step-by-step trace |

| Task | Skill file |
|------|-----------|
| Architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Debug / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools / schema / guide | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index / status / CLI | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
