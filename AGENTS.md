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
Core engine: state machine, task lifecycle, git operations, audit trail, hooks, config, agent registry, session management, state validation, sweeper, continuation policy, errors, templates, and pending publication tracking. 42 files — the heart of TaskForge.

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

## Reasoning & Communication Style

- **Be terse.** Minimize deliberation prose — don't restate the task, narrate obvious steps, or hedge. Act, then report results briefly.
- **Think in ordered sequence.** Before acting on non-trivial work, lay out the steps as a numbered/logical plan; execute them in order; verify each before the next.
- **Make no mistakes.** Correctness over speed: read before editing, confirm assumptions, run the gates, and double-check commands and file paths. A careless action costs more tokens and time than a careful one.

## Agent Instructions

- Read discovery indexes first when navigating: `.agent/tf.ctx` → `.agent/file.idx` → `.agent/symbol.idx` → `.agent/spec.idx` → `.agent/task.idx`. Use them to select files before glob/grep/read.
- Routine reads only: indexes, changed files, directly referenced sources/tests, relevant docs.
- If a file is missing from indexes: narrow grep/glob, then update `.agent/index.overrides`.

Skip by default: `session-ses_*.md`, `specs/session-ses_*.md`, `docs/archive/`, `.opencode/node_modules/`, `Volumes/`, `node_modules/`

## Agent Operating Policy (Slimming Refactor)

> **Active for the duration of the TaskForge Slimming Refactor (TASK-307..315).** This is a deliberately **permissive, direct-git policy** so you don't spend tokens deliberating about process — just follow it. It supersedes `docs/workflow.md` and any prior managed-policy until TASK-315 lands. Full design + task breakdown: `specs/taskforge-slimming-refactor.md`.
>
> **Mindset:** use git directly, move fast, keep gates green, maintain task-state. Don't ask "should I use the facade or git?" — use git. Don't agonize over token/context budget — the window is large; work normally.

### 1. Use git directly for everything routine
- The git facade (`taskforge checkpoint|submit|diff|pr`) is **deprecated and being removed** (TASK-312). Do not use it — use the git equivalent.
- Lifecycle commands (`taskforge start|done|promote|cleanup`) are **optional**; prefer git for worktree/branch work and task-state.
- Query commands (`taskforge next|inspect|list/gates`) are fine for *reading* state.

### 2. Worktree setup (per task)
- **Sequential refactor tasks branch from the previous task's tip** so the chain accumulates (307→308→309→310…). Standalone tasks branch from clean `main` HEAD.
- Create: `git -C /Volumes/Transcend/devel/task-forge worktree add -b agent/TASK-NNN-<slug> /Volumes/Transcend/devel/worktrees/task-forge/TASK-NNN <base-branch>`
- Fresh worktrees have no deps — symlink: `ln -s /Volumes/Transcend/devel/task-forge/node_modules <wt>/node_modules`.
- **Never work in the main checkout** — it carries in-flight uncommitted work (the "swamp"). Leave it alone; do your work in worktrees.

### 3. Task-state maintenance (directly, via git)
Task-state lives in `../task-state/` (a separate worktree on the `task-state` branch). Edit `../task-state/TASK-NNN.md` directly:
- Frontmatter fields: `status`, `assignee`, `claimed_at`, `completed_at`, `branch`, `worktree`.
- Fill the `## Result` section on completion.
- Commit + push **with `TASKFORGE_INTERNAL=1`** (hooks block task-state commits/pushes without it):
  ```
  cd ../task-state && TASKFORGE_INTERNAL=1 git add TASK-NNN.md && TASKFORGE_INTERNAL=1 git commit -m "TASK-NNN: ..." && TASKFORGE_INTERNAL=1 git push
  ```
- Status flow: `Inbox → Needs Spec → Ready → In Progress → Review → Verify → Done`. During the refactor, set `Done` + `completed_at` once implemented + gates pass (skip Review/Verify ceremony unless asked).

### 4. Gates must pass before a task is done
Run in the worktree: `npm run typecheck` → `npm run lint` → `npm run build` → `npm test -- --run`. Run `typecheck` first (fastest feedback on import/type errors). Lint must be **0 errors** (pre-existing warnings are fine). The gate-stamp + `_hook` enforcement (TASK-308/309) is live — don't bypass gates.

### 5. Committing & pushing code
`git add -A && git commit -m "TASK-NNN: <summary>"` in the worktree (`node_modules`/`dist` are gitignored). Push with `git push -u origin <branch>` when useful. Committing on the task branch (not main/task-state) is fine — the pre-commit hook allows it.

### 6. Cleanup when a task is done
- Remove the worktree: `git -C /Volumes/Transcend/devel/task-forge worktree remove <wt>` (add `--force` if dirty).
- Delete the branch if merged/superseded: `git branch -D <branch>`. **Keep** the branch if it's the base for the next sequential task.

### 7. Hard rules
- **Never force-push** — hook-enforced; opencode also denies `git push --force`. Non-fast-forward pushes are blocked.
- **Stop all work** if `.doctor-lock` exists.
- `main` and `task-state` are push-protected from worktrees. Task-state pushes go through the `task-state` worktree with `TASKFORGE_INTERNAL=1`.

### 8. Permissions (already configured in `opencode.json`)
`git *` → allow (force-push denied); `edit ../task-state/**` → allow; `tasks/**`, `.git/**` → deny. So git ops and task-state edits need no facade. After editing `opencode.json`, the user must restart opencode for changes to take effect.

### 9. Known gotchas
- **Commander:** hide a command with `.command("name", { hidden: true })` — there is no `.hidden()`.
- **Tests:** Vitest with temp dirs (`fs.mkdtempSync` + `git init`); mock `execa` by routing on the command string when a function shells out.
- **Commit author hint:** git may print `git commit --amend --reset-author` after a commit — that's advisory, the commit succeeded; ignore it.
- **Don't over-compress context.** The window is ~1M tokens; "max context" warnings are often false alarms.

## Durable Agent Identity

Agents MUST NOT rely on conversation memory, summaries, or prompt text as the source of truth for identity. Identity MUST be stored in durable project state and rehydrated into context before every model invocation.

### Required IDs

Use separate IDs for each entity type:

- agentId: stable identity of the agent/runtime
- sessionId: current conversational/model session
- runId: one execution attempt
- taskId: durable work item, when applicable
- claimId: task ownership record, when applicable

IDs MUST be typed. Prefer UUIDv7 or ULID.

### Source of Truth

The durable state file or database is authoritative. Prompt-visible identity is only a projection.

Recommended project paths: .taskforge/agents/<agentId>.json, .taskforge/sessions/<sessionId>.json, .taskforge/runs/<runId>.json

### Runtime Requirements

Before every model invocation, the agent runtime MUST:
1. Load identity from durable state.
2. Validate repo, worktree, task, and claim scope.
3. Inject identity into model context.
4. Refuse identity-sensitive work if required identity is missing or inconsistent.

### Write Requirements

The agent MUST include agentId, sessionId, and runId in task claims, checkpoints, logs, summaries, handoff notes, and PR/submission metadata when available.

### Regeneration Rule

The agent MUST NOT regenerate agentId when durable state exists. A new agentId is allowed only when initializing a new agent identity or explicitly forking an existing one.

### Subagents and Handoffs

Subagents MUST receive their own agentId and inherit parent linkage explicitly. Handoff notes MUST include source and target identity fields.

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
