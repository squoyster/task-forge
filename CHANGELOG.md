# Changelog

All notable changes to TaskForge are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **TASK-241: Enforce TaskForgeCommandResult return schema as invariant** — Defined TaskForgeCommandResult interface with Zod schema and all sub-interfaces. Created result builder helpers (success, blocked, failed, noop, humanRequired, doctorRequired, contextCleanup). Added command-specific validNextCommands maps for 35+ CLI commands. Created Markdown and JSON renderers with 9-section output per spec. Added validate-state command-return-schema audit check. Standard prohibited actions (5) included in every normal-agent result. Documentation in `docs/architecture/command-return-contract.md`. 30 new tests in `command-result.test.ts` and `validate-state-command-result.test.ts`. (Core infrastructure complete; command wiring deferred to follow-up)

- **TASK-233: Record all taskforge CLI invocations with parameters and return values** — All CLI commands now wrapped with `wrapWithAudit()` to capture invocations at entry point. Records command name, args, flags, exit code, duration, session ID, and errors. Per-task commands write to task's NDJSON transcript; global commands write to global audit log. `taskforge timeline` now displays CLI invocations alongside existing events. 10 new tests in `cli-audit.test.ts`.

- **TASK-231: Implement distributed agent registry with heartbeat tracking and crash recovery** — Added `.taskforge/agent-registry.json` to track active agents across machines. Agents register on `claim`/`start`, update heartbeat on `heartbeat`, and mark idle on `done`/`release`. New `taskforge agents` command lists active/idle/crashed agents with `--stale` and `--recover` options. High watermark tracking for max concurrent agents. Crash detection with configurable threshold (default 15 min). 19 new tests in `agent-registry.test.ts`.

- **TASK-230: Implement quasi-persistent session ID storage for agent recovery** — Added `.taskforge-session.json` file in worktree directories to persist session state (`session_id`, `task_id`, `claimed_at`, `worktree_path`, `last_heartbeat`) across process restarts. Session file is written on `claim`/`start`, updated on `heartbeat`, and removed on `done`/`release`. `taskforge resume` now auto-detects recoverable sessions via fallback chain: session file → branch session matching → dirty worktree. Added `recovery` field to JSON output with method, sessionId, and claimedAt. Added `.taskforge-session.json` to `.gitignore`. 10 new tests in `session-state.test.ts`.

### Fixed

- **TASK-243: Fix claim/start self-deadlock and remove agent-facing force guidance** — `claim` no longer recommends `taskforge start` after success (which would deadlock since the task is already assigned). On claim success with worktree: guides to `cd <worktree>`. On claim success without worktree: guides to `taskforge doctor`/`block` with explicit "Do NOT run start" warning. `start` on already-assigned task no longer recommends `--force` — recommends `resume`, `inspect`, `doctor`, or `block`. `assertTaskOwnership()` no longer recommends `unlock --force`. `claimStateMachine()` already-claimed error no longer recommends `claim --force`. `gatesStateMachine` no longer mentions `done --force`. Removed `done --force` from `done` command nextActions. Updated TASKFORGE.md OpenCode Session Prompt to document normal workflow (`next → start`) and force restrictions. Added 17 new tests across `command-states.test.ts`, `session.test.ts`, and `start.test.ts`.

- **TASK-215: Migrate `new` to transaction layer, wire uncommitted worktree detection into `start`/`claim`** — `taskforge new` now uses `withTaskStateTransaction` instead of `commitAndPushTaskState`, so push failures properly reject instead of being silently swallowed. `taskforge start` and `taskforge claim` now check for uncommitted worktrees before proceeding — blocked tasks get "commit then next" guidance, non-blocked tasks get "complete current task first" guidance. Added `UNCOMMITTED_CHANGES` state to `StartStates` and `ClaimStates`.

- **TASK-221: Fix `taskforge start` rejecting same-session re-entry** — The pre-check at line 131 of `start.ts` was rejecting ANY task with an `assignee` set, even when the assignee belonged to the current session. Fixed by generating the session ID earlier and changing the check to `task.assignee && task.assignee !== sessionId`, allowing same-session re-entry (e.g., agent restart after crash) while still blocking cross-session conflicts. Added 4 new tests covering same-session re-entry, cross-session rejection, `--force` override, and session ID generation.

## [0.3.0] — 2026-05-28

### Added

- **TASK-218: Make `taskforge claim` create worktree and return workspace path in all task commands** — `taskforge claim` now creates a worktree immediately after claiming (matching `start` behavior) and returns `workspace: { worktree, branch }` in JSON output. `taskforge status` and `taskforge summary` now include `worktree` and `branch` fields in JSON task entries and display worktree/branch info in terminal output for active tasks.

- **TASK-232: Require clean worktree and pushed branch in done command** — `taskforge done` now rejects when the worktree has uncommitted files (WORKTREE_DIRTY) or the branch has unpushed commits (BRANCH_UNPUSHED). Error messages include actionable guidance (`taskforge checkpoint`, `taskforge submit`). JSON output includes structured `nextActions`. Added `getWorktreeDirtyFiles()` and `getBranchCommitsAhead()` to `git.ts`, new states to `command-states.ts`, and 5 tests. Invariant documented in TASKFORGE.md and AGENTS.md.

- **TASK-217: Wire command state machines into all lifecycle commands** — All lifecycle commands (`next`, `claim`, `start`, `done`, `new`, `gates`, `checkpoint`, `submit`, `pr`) now use the command state machines from `command-states.ts` to produce structured `CommandResult` objects with `nextAction` and `guidance` fields. Added `GuidanceAdapter` interface with `NoOpGuidanceAdapter` and `OpenCodeGuidanceAdapter` implementations for pushing guidance to agent frameworks. Every command JSON output now includes `nextActions` array and `guidance` string. Human-readable output uses state machine guidance text.

- **TASK-220: Implement validate-state --strict flag** — `taskforge validate-state --strict` now exits non-zero on any warnings or errors, enabling CI branch protection enforcement. JSON output includes structured `nextActions` with recovery guidance. Human output includes "Valid next actions:" section. Added `NextAction` interface and `Safety` type to `json-result.ts`. 8 tests added covering strict/non-strict modes, errors, warnings, and clean state.

### Changed

- **TASK-220: Update report command with AC review guidance** — `taskforge report --complete` now includes explicit reviewer instructions for verifying acceptance criteria satisfaction, with structured `nextActions` and AC state awareness (section present, blank items, unchecked items).

### Fixed

- **TASK-215: Migrate `new` to transaction layer, wire uncommitted worktree detection into `start`/`claim`** — `taskforge new` now uses `withTaskStateTransaction` instead of `commitAndPushTaskState`, so push failures properly reject instead of being silently swallowed. `taskforge start` and `taskforge claim` now check for uncommitted worktrees before proceeding — blocked tasks get "commit then next" guidance, non-blocked tasks get "complete current task first" guidance. Added `UNCOMMITTED_CHANGES` state to `StartStates` and `ClaimStates`.

- **TASK-221: Fix `taskforge start` rejecting same-session re-entry** — The pre-check at line 131 of `start.ts` was rejecting ANY task with an `assignee` set, even when the assignee belonged to the current session. Fixed by generating the session ID earlier and changing the check to `task.assignee && task.assignee !== sessionId`, allowing same-session re-entry (e.g., agent restart after crash) while still blocking cross-session conflicts. Added 4 new tests covering same-session re-entry, cross-session rejection, `--force` override, and session ID generation.

## [0.2.0] — 2026-05-27

### Added

- **TASK-183: Enhance timeline command with actionable audit detail** — `taskforge timeline` now shows per-event chronological entries with summary text and extracted metadata (commit messages, file paths, status transitions). Includes duration calculation, event icons (▶ start, ┃ work, ✔ complete, ✘ errors), and enriched `--json` output with `entries[]` array. Added `TimelineEntry` interface and `extractEventDetail()` function. 10 tests added.

- **TASK-176: Document command next-action semantics** — `docs/next-action-semantics.md` enumerates all 7 `nextAction` values from the summary command priority cascade, with continuation rules, follow-up commands, and JSON output format.

- **TASK-174: Add AC linter command** — `taskforge ac-check [taskId]` scans task files for acceptance criteria issues: missing sections, blank items, unchecked items, and duplicate sections. Supports `--json` output and scanning all tasks or a specific one. Added 7 tests.

- **TASK-172: Add task-forge CLI alias** — `package.json` bin field now exposes both `taskforge` and `task-forge` pointing to the same entrypoint, supporting both compact and hyphenated command names.

- **TASK-169: Agent framework integration documentation** — `docs/agent-framework-integration.md` documents the adapter system (`AgentFrameworkAdapter` interface, `GenericAgentFrameworkAdapter`, `OpenCodeAgentFrameworkAdapter`), audit event registry, generated files (AGENTS.md, opencode.json, agent files, plugins), hooks, doctor integration, guard plugin, and extension author workflow.

- **TASK-164: Validate audit JSONL parseability in doctor** — `taskforge doctor` now scans all `.jsonl` files under `logs/taskforge/` for corrupted lines. Reports invalid JSON and schema validation failures with file path and line number (code: `JSONL_CORRUPT`). Added `validateJsonlFiles()` function to audit module.

- **TASK-151: Transaction invariant abort tests** — `withTaskStateTransaction` now validates task-state invariants after mutation and before commit, aborting with descriptive error on violations (e.g., `DONE_WITH_ASSIGNEE`, `READY_WITH_ASSIGNEE`). Tests prove invalid mutations fail before commit and leave task-state unchanged. (Also implements missing invariant validation from TASK-147.)

- **TASK-150: Transaction conflict retry tests** — `tests/task-state-transaction.test.ts` now has 3 new tests proving that non-fast-forward push causes the transaction to reload fresh state (`loadAllTasks` called >= 2 times), rerun mutation with updated state, and throw after exhausting retries. Fixed pre-existing test timeout by disabling jitter in test mocks.

- **TASK-160: JSON output for timeline command** — `taskforge timeline TASK-ID --json` now emits a structured JSON summary containing `taskId`, `totalEvents`, `firstEvent`, `lastEvent`, `errorCount`, and `eventCounts`.

- **TASK-140: Validate-state rule for invalid Done tasks** — `taskforge validate-state` now exits nonzero when any `Done` task has missing, blank, or unchecked acceptance criteria, treating AC integrity as a hard state invariant.

- **TASK-139: Report invalid Done tasks in Doctor** — `taskforge doctor` now checks all `Done` tasks for missing, blank, or unchecked acceptance criteria and reports them with machine-readable codes (`AC_MISSING`, `AC_BLANK`, `AC_UNCHECKED`). JSON output includes the `code` field for every issue.

- **TASK-138: Structured override metadata for forced completion** — `taskforge done --force` now requires `--reason 'explanation'` and records structured override metadata (`override_reason`, `override_actor`, `override_timestamp`, `override_failed_gates`) in task frontmatter. JSON output includes an `override` object with these fields.

- **TASK-137: Reject Done when AC items are unchecked** — `taskforge done` now rejects completion if any nonblank acceptance criterion remains unchecked (`- [ ]`). Unchecked ACs emit `UNCHECKED_ACCEPTANCE_CRITERIA` error instructing the agent to check off each criterion with evidence. Force override available via `--force`.

- **TASK-136: Reject Done when AC items are blank** — `taskforge done` now rejects completion if any acceptance criterion checkbox is blank (e.g., `- [ ]` with no text). Blank ACs emit `BLANK_ACCEPTANCE_CRITERIA` error instructing the agent to replace placeholders with verifiable conditions. Force override available via `--force`.

- **TASK-135: Reject Done when AC section is missing** — `taskforge done` now validates that the task file contains a `## Acceptance Criteria` section before allowing completion. Missing ACs emit `MISSING_ACCEPTANCE_CRITERIA` error with actionable guidance to add or request ACs. Force override available via `--force`.

- **TASK-057: Transactional migration** — `start`, `sweep`, and `done` now use `withTaskStateTransaction` for CAS reapply semantics instead of raw `jitteredPush`/`commitAndPushTaskState`. `claim` already migrated in TASK-048.

- **TASK-056: `reject` command** — `taskforge reject TASK-ID "reason"` marks tasks as rejected (obsolete, won't implement, superseded). Terminal state; clears claim fields.

- **TASK-055: Git operations matrix** — `AGENTS.md` now has a complete matrix of which git operations are allowed on main, task-state, and agent branches. Documents the `taskforge` CLI equivalents for every git workflow.

- **TASK-051: Doctor-lock via transaction** — `taskforge doctor --fix` creates `.doctor-lock` through the transactional mutation layer. Lock removal is tied to recovery task completion.

- **TASK-050: Explicit override flags** — `done` accepts `--force-gates`, `--force-transition`, `--force-ownership` as explicit alternatives to generic `--force`. Generic `--force` still works (deprecated).

- **TASK-049: Control-plane hardening docs** — `docs/control-plane-hardening.md` documents threat model, credential tiers (read-only agent, implementer, recovery/bot, admin), GitHub branch protection config, and emergency recovery procedure. CI workflow at `.github/workflows/task-state-validate.yml`.

- **TASK-048: CAS reapply for claim** — `claim.ts` migrated from `jitteredPush` to `withTaskStateTransaction`, providing true compare-and-swap semantics with fresh-state re-read on conflict.

- **TASK-047: Two-phase `start`** — `start` now durably claims the task (pushes to remote) BEFORE creating the worktree. Failed push leaves no orphan worktree.

- **TASK-046: State invariant validator** — `taskforge validate-state` checks 13 invariants (Done+assignee, Ready+assignee, broken deps, circular deps, etc.). Integrated with `doctor` and CI.

- **TASK-045: Transactional mutation layer** — `withTaskStateTransaction()` provides single boundary for all task-state writes: pull → load → mutate → validate → commit → push → CAS retry. Foundation for P0 hardening.

- **TASK-044: Legacy `tasks/` removal** — Removed 16 stale task files from `main/tasks/`. Task files live exclusively on `task-state` branch.

- **TASK-043: Agent discipline policy** — `AGENTS.md` codifies: no direct git on task-state, no direct file editing, doctor-mode protocol, guardrail compliance.

- **TASK-042: Doctor-lock mechanism** — Global pause flag at `task-state/.doctor-lock` with TTL. Checked by `next`, `claim`, `start`. Auto-removed on recovery task completion.

- **TASK-041: Worktree path qualification** — Worktrees now live at `../worktrees/<project-name>/TASK-NNN/` preventing collisions across repos.

- **TASK-040: Session guardrails** — `checkOutstandingSessionTasks()` prevents agents from claiming a new task while owning an unclosed one. Wired into `next`, `claim`, `start`.

- **TASK-039: Control-file change detection** — `hashControlFiles()` computes SHA-256 of AGENTS.md, TASKFORGE.md, configs, etc. on task start. `done` refuses if files changed (unless `--force`).

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

- **TASK-185: Bump version to 0.2.0** — package.json version incremented from 0.1.0 to 0.2.0. CHANGELOG.md Unreleased section finalized as 0.2.0 release. AGENTS.md updated with explicit Rule 7 requiring taskforge CLI for all task creation and workflow management.

- **TASK-177: Disable `taskforge done --force`** — Removed `--force`, `--force-gates`, `--force-transition`, `--force-ownership`, and `--reason` options from `taskforge done`. All guards (gates, status transition, ownership, control-file hash, AC section/blank/unchecked checks) now always run without exception. Override metadata fields (`override_reason`, `override_actor`, `override_timestamp`, `override_failed_gates`) are no longer written. Tests updated to expect rejection instead of force success; override metadata tests removed.

- **TASK-173: Remove placeholder install URL from container runtime docs** — Replaced `https://example.invalid/taskforge/install.sh` in `docs/deployment/container-runtime.md` with a note that the install script is not yet published and manual install instructions.

- **TASK-165: Replace direct gh usage in PR command** — `cmdPr` no longer executes `gh` directly. When GitHub is configured (`github.enabled: true`), creates PRs via Octokit API. When not configured, emits manual PR instructions with `gh` command and compare URL. Added `createPullRequest()` to GitHub service and `github.pr.created`/`github.pr.manual` audit event types.

- **TASK-162: Route doctor diagnostics through Agent Framework Adapter** — `taskforge doctor` now invokes `AgentFrameworkAdapter.doctor()` for agent-framework-specific diagnostics instead of duplicating OpenCode checks in `cmdDoctor`. Introduced `AgentFrameworkAdapter` interface, `OpenCodeAgentFrameworkAdapter` (AGENTS.md, opencode.json, audit directory checks), `GenericAgentFrameworkAdapter` (no-op), and factory function. `cmdDoctor` loads adapter based on `config.agentFramework.id`.

- **TASKFORGE.md, AGENTS.md** — documented the Sweeper Protocol, optimistic concurrency with jittered retries, and the renamed field schema. Added `task-state` architecture as authoritative.

- **TASKS-023:** `tasks/README.md` updated with deprecation notice pointing to `task-state` as authoritative task store.

### Fixed

- **TASK-168: Fail clearly on invalid config** — `loadConfig()` now throws descriptive errors for invalid JSON or schema validation failures instead of silently returning defaults. Returns `DEFAULT_CONFIG` only when config file does not exist.

- **TASK-167: Validate ownership in diff command** — `taskforge diff` now calls `assertTaskOwnership()` before accessing the worktree, enforcing the same ownership discipline as `checkpoint` and `submit`.

- **TASK-166: Emit audit events for PR command** — `taskforge pr` now appends task transcript events for all outcomes: `github.pr.created` (success with PR number/URL), `github.pr.failed` (API error with message), and `github.pr.manual` (GitHub not configured). Added `github.pr.failed` event type.

- **TASK-159: Stop silently swallowing audit write failures** — generated audit plugin now logs `console.error` with `[taskforge-audit] Failed to write audit event: <message>` when write operations fail. Suppression available via `TASKFORGE_SUPPRESS_AUDIT_FAILURES=true` env var.

- **TASK-180: Fix pre-existing sweep and claim test failures** — fixed YAML status assertions in sweep tests (gray-matter quotes values with spaces), updated sweep test to verify transaction layer instead of deprecated `jitteredPush`, added `withTaskStateTransaction` mocks to sweep and claim tests with actual file persistence, and fixed claim JSON output test. All 454 tests now pass.

- **TASK-178: Fix done command test mocks** — added missing `runGates` mock to `tests/commands/done.test.ts`, added `withTaskStateTransaction` mock to `tests/done.test.ts`, added `simple-git` mocks, and fixed default acceptance criteria from unchecked to checked. All 27 done tests now pass.

- **TASK-158: Recursive secret redaction in audit plugin** — `redactSecrets()` now recursively traverses nested objects and arrays, redacting values for keys matching TOKEN, SECRET, PASSWORD, API_KEY, PRIVATE_KEY, CREDENTIAL, AUTHORIZATION, and related patterns. Redaction is applied before writing JSONL to prevent credentials from being stored in audit logs.

- **TASK-157: Audit plugin task-ID regex** — fixed double-escaped regex (`TASK-\\\\d+` → `TASK-\\d+`) in `generateAuditPlugin()` so task IDs are correctly extracted from agent branches (`agent/TASK-123-example`) and worktree paths (`/worktrees/task-forge/TASK-123`).

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

[Unreleased]: https://github.com/squoyster/task-forge/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/squoyster/task-forge/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/squoyster/task-forge/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/squoyster/task-forge/releases/tag/v0.1.0
