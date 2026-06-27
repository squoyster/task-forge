# TaskForge Workflow Contract

Operating contract for humans and agents. This file + the live CLI output win on conflict. Full operating policy (direct-git model, worktree-per-task, gates, hard rules) lives in [`AGENTS.md`](../AGENTS.md) — read it.

## Model

- **Direct-git, permissive.** Agents use raw git for all routine work (commits, pushes, branches, worktrees, and task-state edits). The git facade was removed (TASK-312). `taskforge` CLI is optional except where noted.
- Authoritative task state lives in `../task-state/` (the `task-state` worktree), not `tasks/` on `main`. The task-state and worktree paths are **config-authoritative** (`.taskforge/config.json`: `tasks.stateDir`, `worktrees.root`), resolved against the main repo root so they are identical from the main checkout or any linked worktree. Task-state commits/pushes use `TASKFORGE_INTERNAL=1` (hooks block otherwise).
- `taskforge next|inspect|list|gates` are useful for reading state. `--json` output is authoritative.
- **CLI surface.** `taskforge --help` exposes only the entry commands (`init`, `next`, `prompt`, `inspect`, `list`, `new`, `update`, `gates`, `validate-state`, `doctor`). Contextual mutations (`claim`, `done`, `promote`, …) and recovery/diagnostic commands (`status`, `sweep`, `audit`, …) are callable but hidden — discover them via `next --json`. `sync`, `deps`, and `mcp` are opt-in (`TASKFORGE_WITH_DEPS` / `TASKFORGE_WITH_MCP`) and absent by default.
- **Least-privilege profiles.** `opencode.json` uses role-scoped permissions instead of broad global allows: the implementer may run direct git (`add`, `commit`, `push`, `branch`, `worktree`) but never force-push; planner/reviewer are read-only (`edit: deny`); doctor has an explicit recovery allowlist with no wildcards. Hard denies (`git push --force*`, `.git/**`, `tasks/**`) appear at both global and role level. MCP is disabled by default — opt in via `mcp.taskforge.enabled: true` or `TASKFORGE_WITH_MCP=1`. After `taskforge init` regenerates `opencode.json`, **restart opencode** for the new permissions to take effect.
- **All changes to `main` via PR.** Work in a worktree per task; push the branch; a human merges the PR.
- **Stop all work** if `.doctor-lock` exists.

## Local Runtime Artifacts (never submit)

`.taskforge-session.json`, `.taskforge/agent-registry.json`, `logs/taskforge/**`. If one points at a terminal task, treat it as stale; remove locally.

## Status Flow

```text
Inbox -> Needs Spec -> Ready -> In Progress -> Review -> Verify -> Done
                         |
                      Blocked
```

`Rejected` is terminal. `Deferred` may return to `Ready`.

## Command Rules By Status

| Status | Action |
|---|---|
| `Ready` | `taskforge claim TASK-ID` (atomic ownership); then `git worktree add -b <branch> <wt> main` |
| `In Progress` | continue in the worktree; `taskforge heartbeat TASK-ID` renews the lease |
| `Review` | inspect the worktree; request edits if needed |
| `Verify` | `taskforge gates --json` (typecheck/lint/build/test must pass) |
| `Blocked` | do not improvise; unblock only with evidence or human direction |
| `Done`/`Rejected` | historical; do not mutate except under explicit recovery |

`taskforge next --json` returns the correct next commands. Worktree and branch lifecycle is direct-git: `taskforge claim` only sets ownership and metadata.

## Implementation Loop

```bash
taskforge next --json                 # pick a task
# create worktree (from synced main, or previous task's tip for a chain)
npm run typecheck && npm run lint && npm run build && npm test -- --run   # gates
git add -A && git commit -m "TASK-ID: ..."
git push -u origin <branch>           # then a human opens/merges the PR
# update ../task-state/TASK-ID.md (status: Done + Result), commit+push with TASKFORGE_INTERNAL=1
```

## Doctor Recovery

```bash
taskforge doctor --check --json
TASKFORGE_ACTOR=doctor taskforge doctor --lock --reason "..."
TASKFORGE_ACTOR=doctor taskforge doctor --fix --json
taskforge validate-state --strict --json
taskforge agents --stale --json       # then --recover if stale
```

Release `.doctor-lock` only after `validate-state --strict` passes and stale agents are recovered.
