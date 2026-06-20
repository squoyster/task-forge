# TaskForge Slimming Refactor

**Status:** Planned — awaiting execution
**Date:** 2026-06-20
**Premise:** TaskForge has bloated by trying to manage SCCS (git/gh) via facade commands. This refactor abandons the facade, hands git control back to agents/humans, and enforces the workflow contract via git hooks.

## Vision

Reduce TaskForge to its irreducible core: **task-state management + collision avoidance**. Git owns the code; TaskForge owns task state and the worktree lifecycle; hooks bridge them. Maximize human ease-of-use; minimize error surface.

## Locked Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Gates enforcement | Stamp file + CI backstop | Fast hooks, airtight via commit-SHA binding; CI closes `--no-verify` gap |
| Audit model | Git is the audit | Drop per-code-change events; task-state lifecycle audit remains |
| Collision protection | Branch-name + claim binding, heartbeat-based abandonment | Branch names already encode session ID (`agent/<TASK>-slug--<session>`) |
| Final SHA | `done` records PR merge SHA (or HEAD) | Done becomes the single closeout point |
| TASK-306 | Discard | The commands it extends are being removed |
| Deprecation | Hard cut | Clean break; bump policyVersion |
| Auto-reclaim | ON by default (`sweep.autoReclaim`) | Smooth restart/recovery; 15m threshold mitigates false positives |
| Clean-tree gating | Required before `taskforge gates` | Trade-off accepted for airtight stamps |

## Target Command Surface

### Remove (~376 lines + TASK-306 extensions)
`diff`, `checkpoint`, `submit`, `pr` — delete `src/commands/git-facade.ts` and the submit/pr-only logic in `command-states.ts` (`submitStateMachine`, `prCreationFailed`, branch-behind conditions).

### Keep (lifecycle + state + coordination)
`init`, `next`, `start`, `resume`, `claim`, `release`, `block`, `reject`, `done`, `unlock`, `promote`, `new`, `update`, `list`, `status`, `summary`, `inspect`, `prompt`, `ac-check`, `heartbeat`, `gates`, `doctor`, `sweep`, `agents`, `validate-state`, `config-validate`, `cleanup`, `report`, `audit`, `transcript`, `timeline`, `guard`, `mcp`.

### Move out (optional plugins, separate follow-up)
`deps *` (8 cmds), `sync`. Keep compiling; gate behind `--with-deps`/config flag. Aligns with roadmap TASK-RAT-010/011.

## Hook Contract

`src/core/hooks.ts` installs hooks via `core.hooksPath`. This refactor strengthens them. Hooks are thin shell scripts delegating to a new `taskforge _hook <name>` internals command so enforcement logic lives in testable TS. Bypass only via `TASKFORGE_INTERNAL` / `TASKFORGE_DOCTOR`.

### `taskforge _hook pre-commit`
Keep: block commits to `task-state`; block commits to `main`/`master` from worktrees; block staged edits to `tasks/*.md`, `../task-state/*.md`, `.taskforge/**`, `.opencode/**`.
Add: block staged edits to `.taskforge/gate-stamp.json` (prevent forging).

### `taskforge _hook pre-push` (enforcement boundary)
Reads `local_ref local_sha remote_ref remote_sha` per ref. For each task branch (`agent/*`):

1. **Protected-branch guard** (existing): block push to `main`/`master`/`task-state`; block force-push.
2. **Gate-stamp check** (NEW): read `.taskforge/gate-stamp.json`. Block unless stamp exists, `stamp.commit_sha == local_sha`, and all `stamp.gates[].passed`. On mismatch: *"HEAD moved past last gate run (stamped <sha>, pushing <sha>). Run `taskforge gates` then push."*
3. **Branch-ownership check** (NEW): parse session from branch; read task-state for the branch's task ID; block unless `task.assignee == branch_session`. Prevents pushing an abandoned session's branch after re-claim.

Non-task branches allowed only if in `push.allowedBranches` (default empty).

### `taskforge post-commit`
Per "git is the audit": **remove** the global `git.jsonl` writing. Hook becomes no-op or removed.

## Gate Stamp Design

`taskforge gates` (modified):
1. Require clean working tree (`git status --porcelain` empty). Error if dirty: *"Commit or stash before gating — gates validate a specific tree."*
2. Run typecheck/lint/build/test.
3. On all-pass, write `.taskforge/gate-stamp.json` (gitignored, local):
   ```json
   {
     "commit_sha": "<HEAD>",
     "gates": { "typecheck": true, "lint": true, "build": true, "test": true },
     "timestamp": "...",
     "runner_session": "ses_..."
   }
   ```

Stamp binds to exact commit SHA, so any post-gate change (commit/amend/rebase) invalidates it — file-hashing is redundant. CI re-runs all gates as network-side backstop for `--no-verify` and forgotten hooks. GitHub branch protection with required checks is the fully-remote backstop.

## Abandonment & Collision Model

Branch name `agent/<TASK-ID>-<slug>--<session_id>` (`makeBranchName`, `util/paths.ts:94`; `parseSessionIdFromBranch`, `core/session.ts:41`) makes collision protection structural.

**Claim side (abandonment recovery):**
- Submitted source of truth: `task.assignee` + `task.claimed_at` in `../task-state/`.
- `taskforge claim` already calls `sweepStaleTasks`. Strengthen sweeper: a task is re-claimable when `claimed_at` older than `sweep.staleThresholdMinutes` (default 15m). On re-claim, the new agent gets a fresh session-scoped branch; old branch is orphaned and flagged for `cleanup`.
- Add `taskforge sweep --reclaim`: auto-releases stale-claimed tasks back to `Ready`/re-assignable. `sweep.autoReclaim` (default on) runs this transparently.

**Push side:** hook rule 3 — branch's encoded session must equal `task.assignee`. After re-claim, abandoned branch fails this check.

**Restarted agent:** session ID stable across restarts (session-state file / `TASKFORGE_SESSION`), so `resume` → `heartbeat` keeps the same branch valid. Only true abandonment (no heartbeat within threshold) triggers re-claim.

## Done as the Single Closeout

`cmdDone` (`src/commands/done.ts`) already runs gates, checks AC, verifies PR. Add as the final step:
1. After gates + AC pass, resolve final SHA: PR exists → record its **merge commit SHA** (via `GitHubPullRequestVerifier`); else record `HEAD`.
2. Write `submitted_sha` + `submitted_at` to task frontmatter.
3. Existing cleanup (worktree/branch removal) proceeds.

Drop `completion-policy.ts` `NO_SUBMITTED_SHA` tension — Done records and verifies in one step.

## Config Changes (`config.json` schema)

Add:
- `push.allowedBranches: string[]` (default `[]`)
- `gates.requireCleanTree: boolean` (default `true`)
- `sweep.staleThresholdMinutes: number` (default `15`)
- `sweep.autoReclaim: boolean` (default `true`)
- `hooks.enforce: boolean` (default `true`) — false = warn-only (human escape hatch)

Remove/deprecate: `continuation.allowPush`, `continuation.allowCommit`, `continuation.allowDraftPr` (no longer meaningful). Keep `autoContinue`, `maxTaskFixIterations`.

## Documentation Rewrite

**`docs/workflow.md`** — rewrite Control Plane + Prohibited Substitutions:

| Old | New |
|---|---|
| `git commit` → `checkpoint` | `git commit` is correct; pre-commit guards task-state |
| `git push` → `submit` | `git push` is correct; run `taskforge gates` first; pre-push verifies stamp |
| `gh pr create` → `pr` | `gh pr create` is correct |
| `git worktree add/remove`, `git branch -D` | Still use `taskforge start/done/cleanup` — these coordinate task-state |

Invariant: *"TaskForge owns task state and worktree lifecycle. Git owns the code. Hooks bridge them."*

**AGENTS.md chain** — root TaskForge Managed Policy block (remove `checkpoint`/`submit`); `src/commands/AGENTS.md` and `src/core/AGENTS.md` ownership tables (drop git-facade row).

## Migration & Rollback

- Hard cut in one major version; bump `policyVersion`.
- `taskforge init` re-installs strengthened hooks.
- In-flight task branches: one-time `taskforge gates` re-stamp. Document in release note.
- Rollback: revert commit; facade commands return from history. No data migration (removed audit events were append-only).

## Risks

- **`--no-verify` bypass**: only CI (server-side) fully closes. Acceptable per CI-backstop decision; recommend GitHub branch-protection required checks.
- **Stamp on dirty tree**: requiring clean tree is a small UX change (commit before gating). Accepted.
- **Auto-reclaim false positive**: long gate run could exceed threshold. Mitigated by 15m default + re-claimed agent's branch still passes ownership until push. Threshold is config-tunable.

## Execution Task Breakdown (sequenced)

| ID | Scope |
|---|---|
| TF-SLIM-01 | Discard TASK-306 worktree; confirm clean main starting point |
| TF-SLIM-02 | `taskforge _hook` internals + gate-stamp in `gates.ts` (clean-tree, stamp writer); tests |
| TF-SLIM-03 | Rewrite `hooks.ts`: pre-push (stamp + ownership), simplified pre-commit, remove post-commit audit; tests |
| TF-SLIM-04 | Strengthen `sweeper.ts` (stale-claim reclaim) + config flags; tests |
| TF-SLIM-05 | `done.ts`: record merge/HEAD SHA as closeout; adjust `completion-policy.ts`; tests |
| TF-SLIM-06 | Remove `git-facade.ts`, `diff`/`checkpoint`/`submit`/`pr` from `cli.ts` + dead code; move `sync`/`deps` behind flag |
| TF-SLIM-07 | Config schema changes; remove deprecated `continuation.*` keys |
| TF-SLIM-08 | Rewrite `docs/workflow.md` + AGENTS.md chain |
| TF-SLIM-09 | Full gate pass + `validate-state --strict`; end-to-end walkthrough (start → git work → gates → push → done) |
