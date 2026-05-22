# Changelog

All notable changes to TaskForge are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **TASK-034: Proactive git pull before reading task-state** — adds `pullTaskState()` helper that does `git pull --rebase origin task-state` in the task-state worktree before any task read. Called in `next`, `start`, `claim`, and `sweep` commands. Gracefully handles network errors, missing remotes, and non-git repos without throwing. Eliminates the stale-read race window where agents select already-claimed tasks.

- **TASK-024: `claim` command** — standalone primitive that sets `assignee`/`claimed_at` on a task without creating a worktree or branch. Accepts `--force` to override existing claims, `--session` for explicit session IDs, `--json` for structured output. Uses `jitteredPush` with `onConflict` for optimistic concurrency (same as `start`). Enables `next → claim → start` workflow decomposition.

- **TASK-023: Docs update** — `tasks/README.md` now carries a deprecation banner directing readers to `../task-state/` as the authoritative task store. `README.md` already correctly identified task-state as authoritative (verified, no changes needed).

- **TASK-022: Auto-sweep on start/next** — `taskforge start` and `taskforge next` automatically run `sweepStaleTasks()` before task selection, ensuring stale claims are recovered before a new agent picks a task. The `sweep` command remains available as a thin wrapper for manual use.

- **TASK-021: Harden status semantics** — centralized `STATUS` constants object (`src/util/status-constants.ts`) as the single source of truth for all status values. Added `normalizeStatus()` that accepts common input variants (`in_progress`, `InProgress`, `needs_spec`, `NeedsSpec`, etc.) and normalizes to canonical human-readable values at boundaries. Uses `z.preprocess` in Zod schema for transparent normalization. All internal status comparisons now use `STATUS.*` constants. Persisted values remain human-readable (`In Progress`, `Needs Spec`) — no snake_case migration. Note: TASK-016 (normalize status to snake_case) was deferred and replaced by this task.

- **TASK-020: `inspect` command** — `taskforge inspect TASK-ID` reports worktree existence, branch existence, dirty status (`git status --porcelain`), commits ahead/behind main (`git rev-list --count`), last commit hash, claim staleness (>4h), and claim age in hours. Supports `--all` to inspect all `In Progress` tasks, and `--json` for structured machine output.

- **TASK-019: `heartbeat` command** — `taskforge heartbeat TASK-ID` extends the Sweeper lease by updating `claimed_at` to current UTC. Requires session ownership (via `assertTaskOwnership`) unless `--force`. Only valid for `In Progress` tasks. Appends agent note with previous lease time. Supports `--json` output.

- **TASK-018: `gates` command** — `taskforge gates` runs configured verification gates (typecheck, lint, build, test) sequentially via execa. Reads gate commands from `.taskforge/config.json`. Supports `--only typecheck,lint` to run a subset, and `--json` for structured results. `taskforge done` now enforces gate checks before marking Done (throws unless gates pass; `--force` overrides).

- **TASK-017: Lifecycle JSON contracts** — all lifecycle commands (`next`, `start`, `done`, `block`, `unlock`, `sweep`) now support `--json` for structured machine output. JSON contract helper in `src/util/json-result.ts` provides `jsonOk()`, `jsonError()`, `buildJsonTask()`, `printJson()`, and `statusToJson()` (snake_case for API consumption). Success output includes `task`, `workspace`, and `next` fields.

- **TASK-015: Jittered retries for optimistic concurrency** — resilient multi-agent task claiming with `git pull --rebase`, 2–10s random jitter wait, and up to 3 retries on push rejection.

- **TASK-014: Sweeper Protocol** — automatic deadlock recovery: detects stale `in_progress` tasks (claimed_at > 4 hours), resets to `Ready`, clears `assignee`. Runs via `taskforge sweep`.

- **Field rename** — `lockedBy` → `assignee`, `lockedAt` → `claimed_at` across all schemas, commands, and tests. Supersedes the TASK-012 naming convention.

### Changed

- **TASKFORGE.md, AGENTS.md** — documented the Sweeper Protocol, optimistic concurrency with jittered retries, and the renamed field schema. Added `task-state` architecture as authoritative.

- **TASKS-023:** `tasks/README.md` updated with deprecation notice pointing to `task-state` as authoritative task store.

## [0.1.0] — 2026-05-21

### Added

- **TASK-013: Shared task-state branch** — dedicated `task-state` git branch replaces `tasks/` on `main` as the single source of truth for all task files. Worktree at `../task-state/`. Every mutation is auto-committed and auto-pushed. Created by `taskforge init`.

  - `getTaskStateDir()` resolves `../task-state` relative to repo root.
  - `ensureTaskStateBranch()` creates orphan `task-state` branch + worktree (idempotent).
  - `commitAndPushTaskState()` auto-commits and pushes every mutation.
  - All task I/O in `task-store.ts` targets the task-state worktree.
  - `init.ts` seeds template files and migrates existing tasks from `tasks/`.

- **TASK-012: Session-based task locking** — prevents two agents from simultaneously working on the same task using session-aware locking.

  - `session.ts`: `generateSessionId()` (10-char hex), `parseSessionIdFromBranch()`, `assertTaskOwnership()`.
  - `start.ts`: lock check, `--force` flag, session GUID embedded in branch name.
  - `done.ts`/`block.ts`: ownership assertion, clears lock on completion.
  - `unlock.ts` (NEW): `--force` guard for manual lock recovery.
  - Schema: `lockedBy`/`lockedAt` fields (later renamed to `assignee`/`claimed_at`).
  - Gray-matter `date: false` option to prevent YAML auto-parsing ISO timestamps.

- **TASK-011: Merge all branches** — all 5 feature branches merged into `main` with conflict resolution.

- **BUG-001: Block command transition** — `Ready → Blocked` added to transition table; `block.ts` uses central `getAllowedTransitions()` instead of hardcoded list.

- **TASK-010: `taskforge list` command** — search and filter tasks from the command line.

- **TASK-009: GitHub Projects v2 board sync** — full GraphQL API integration via Octokit (no extra packages). Syncs task status to GitHub Project boards. `src/integrations/github/projects.ts` with `getProjectNodeId`, `getIssueNodeId`, `getStatusFieldInfo`, `addProjectItem`, `updateItemStatus`, `syncTaskToProject`.

- **TASK-008: Command test coverage** — tests for `init`, `start`, `done`, `block`, `status`, `summary` commands.

- **TASK-007: Force-init flag** — `taskforge init --force` recreates missing files without overwriting existing task files.

- **TASK-006: Dependency tracking** — `dependsOn` field in task schema; `taskforge next` respects dependency ordering.

- **TASK-005: Cleanup/done flag** — `taskforge done --cleanup` removes worktree; `--delete-branch` removes the feature branch.

- **TASK-004 through TASK-001**: Initial scaffolding — `taskforge init`, `start`, `next`, `status`, `summary`, `block`, `done`. Dependency audit commands (`deps scan`, `audit`, `outdated`, `deprecated`, `plan`, `create-tasks`, `pr`, `summary`). `--json` output flags. Git worktree management.

### Changed

- **Workspace architecture**: Three-layer git layout:
  ```
  /repo/                  (main branch — source code)
  ../task-state/          (task-state branch — task data only)
  ../worktrees/TASK-NNN/  (agent worktree branches)
  ```

- **Task file storage**: Moved from `tasks/` on `main` to `../task-state/` (worktree of dedicated `task-state` branch). The old `tasks/` directory on main is preserved for backward compatibility but is no longer authoritative.

- **Init flow**: `taskforge init` now creates the `task-state` branch and worktree, seeds template files there, and migrates existing task files.

- **Session naming**: Session GUID format is `--<10-char-hex>` appended to branch name with `--` separator (e.g., `agent/TASK-012-slug--a1b2c3d4f5`).

### Fixed

- **Gray-matter YAML date auto-parsing**: `date: false` option prevents ISO timestamps from being parsed as `Date` objects on re-read. Date values stored in `YYYY-MM-DD HH:MM:SS` format.

- **Test isolation**: All test helpers use `uniqueDir` pattern (`uniqueDir/repo/` for repo root, `uniqueDir/task-state/` for task-state) to prevent cross-test collisions on the `../task-state` path.

- **Config default branch detection**: `init.ts` gracefully handles non-git repos during `defaultBranch` detection.

### Deprecated

- `lockedBy`/`lockedAt` frontmatter fields — replaced by `assignee`/`claimed_at`. The old names still parse but will be removed in a future release.
- `tasks/` directory on `main` branch — task files now live on the `task-state` branch.

[Unreleased]: https://github.com/squoyster/task-forge/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/squoyster/task-forge/releases/tag/v0.1.0
