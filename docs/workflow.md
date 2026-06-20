# TaskForge Workflow Contract

This is the current operating contract for humans and agents. When another document conflicts with this file, this file and the live CLI output win.

## Control Plane

> **TEMPORARY — TaskForge Slimming Refactor (TASK-307..315):** For the duration of the refactor, the managed policy is **relaxed**. Agents MAY use raw git for ALL routine work — including task-state maintenance (edit `../task-state/*.md`, then `git commit`/`git push` directly). The git facade and task lifecycle commands are optional and may be bypassed in favor of direct git. The "Prohibited Substitutions" table below is suspended for the refactor. Git hooks still enforce branch/ref protections (no force-push, no push to `main`/`task-state` from worktrees). Gates must pass before completion; CI is the backstop. Full workflow rewrite tracked in TASK-314. See `specs/taskforge-slimming-refactor.md`.

- During the refactor, raw git (commit/push/diff/branch/worktree, and direct task-state edits) is the primary workflow. `taskforge` CLI use is optional.
- Authoritative task state lives in `../task-state/`, not in `tasks/` on `main`.
- Normal agents do not edit `../task-state/*.md`, `tasks/*.md`, `.opencode/**`, or `.taskforge/**` directly.
- JSON command output is authoritative for agents. Pick one returned `validNextCommands` entry and execute that command.
- If `.doctor-lock` exists, normal agents stop. Only a doctor or human may repair state.

## Local Runtime Artifacts

The following files are local coordination/runtime state and must not be submitted:

- `.taskforge-session.json`
- `.taskforge/agent-registry.json`
- `logs/taskforge/**`

If one of these files points at a terminal task, treat it as stale local state. Remove it locally or run the appropriate TaskForge lifecycle/recovery command; do not preserve it in a checkpoint. Historical task records remain in `../task-state/*.md`.

## Status Flow

```text
Inbox -> Needs Spec -> Ready -> In Progress -> Review -> Verify -> Done
                         |
                      Blocked
```

`Rejected` is terminal. `Deferred` can return to `Ready`.

## Command Rules By Status

| Status | Normal action | Command |
|---|---|---|
| `Ready` | Begin implementation | `taskforge start TASK-ID` |
| `In Progress` | Continue owned work | `taskforge resume TASK-ID`, then `taskforge heartbeat TASK-ID` |
| `Review` | Review existing worktree | `taskforge diff TASK-ID`, then `taskforge resume TASK-ID` if edits are required |
| `Verify` | Run QA and acceptance checks | `taskforge resume TASK-ID`, then `taskforge gates --json` |
| `Blocked` | Do not improvise | inspect, then unblock only with clear evidence or human direction |
| `Done` / `Rejected` | Historical state | do not mutate except under explicit recovery |

`taskforge next --json` returns the correct next commands for the selected task. Do not substitute `start` when `next` tells you to `resume`.

## Standard Implementation Loop

```bash
taskforge next --json
taskforge start TASK-ID
taskforge diff TASK-ID
taskforge gates --json
taskforge checkpoint TASK-ID --message "..."
taskforge submit TASK-ID
taskforge report TASK-ID --complete
taskforge done TASK-ID
```

For an already-started task, replace `start` with `resume`.

## Review And Verify Loop

```bash
taskforge next --json
taskforge resume TASK-ID
taskforge diff TASK-ID
taskforge gates --json
taskforge done TASK-ID
```

Reviewers should prefer findings over edits. QA agents should avoid production-code changes unless explicitly tasked.

## Doctor Recovery

```bash
taskforge doctor --check --json
TASKFORGE_ACTOR=doctor taskforge doctor --lock --reason "..."
TASKFORGE_ACTOR=doctor taskforge doctor --fix --json
taskforge validate-state --strict --json
taskforge agents --stale --json
```

Use TaskForge repair commands first, including `taskforge agents --recover --json` and `TASKFORGE_ACTOR=doctor taskforge unlock TASK-ID --force --json` when clearing a stale claim without changing task status.

Release `.doctor-lock` only after `validate-state --strict --json` passes and stale-agent recovery is complete. If a recovery task exists, finish it with `taskforge done TASK-ID`; otherwise a doctor or human may remove the lock as an audited recovery action.

## Prohibited Substitutions

| Do not use | Use |
|---|---|
| `git commit` | `taskforge checkpoint TASK-ID --message "..."` |
| `git push` | `taskforge submit TASK-ID` |
| `git worktree add` | `taskforge start TASK-ID` |
| `git worktree remove` | `taskforge cleanup TASK-ID` or `taskforge done TASK-ID --cleanup` |
| `git branch -D` | `taskforge done TASK-ID --delete-branch` |
| direct task-state edits | TaskForge lifecycle, doctor, or recovery commands |

Read-only git inspection is acceptable only when no TaskForge command provides the needed information.
