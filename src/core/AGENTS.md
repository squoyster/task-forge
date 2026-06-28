# AGENTS.md - Core Engine Overlay

Purpose: core-engine ownership for TaskForge. This file governs the core modules that implement the state machine, task lifecycle, git operations, audit trail, hooks, config, agent registry, and sessions.

## Core Rules

```axl
R000 core | scope -> core modules are the heart of TaskForge; CLI commands delegate here.
R001 core | ownership -> command states, task model, task documents, git, audit, hooks, agent registry, config, agent-framework adapter, agents-md, doctor lock, state validation, session, result rendering, next-command maps, continuation, control files, scheduler, sweeper, guard plugin, PR verifier, pending publish, templates, opencode config, portable skills, command-result sink, MCP typed bridge, errors, event log, closure task, authority, init audit.
R010 core | command_result -> every command returns `{ ok, state, nextAction, guidance, errorCode?, context? }`; `nextAction` drives agent behavior.
R011 core | task_schema -> task state is validated with Zod and transitions follow the core state machine.
R012 core | git_ops -> all git mutations go through `git.ts`; do not bypass it with direct mutation paths from core logic.
R013 core | audit -> log state changes, commands, and lifecycle events before mutating durable state.
R014 core | errors -> use structured `TaskForgeError` subclasses; do not throw raw `Error` from core modules.
R015 core | config -> configuration loads from `.taskforge/config.json`.
R016 core | agent_registry -> agents must heartbeat to keep their lease; stale agents are swept.
R020 core | work_guidance -> ESM imports use `.js`; use Zod for runtime validation; prefer `unknown` over `any`; keep new core behavior covered by tests in `tests/`.
R021 core | verification -> `npm run typecheck` ∧ `npm run build`.
R022 core | child_index -> `src/core/` has no child AGENTS files.
R023 core | result_sink -> M use(emitResult) over raw(process.stdout.write(renderResult…)) ∧ emitResult(result,json) is the drop-in for writeResult that also pushes the typed result into a module-level sink (setResultSink); the MCP bridge installs the sink to capture structured results in-process, never by parsing stdout.
R024 core | mcp_bridge -> runCommandForResult (mcp-contract.ts) silences stdout, runs a CLI command fn in json mode, and returns its typed result via the sink; a throw-without-emit synthesises COMMAND_THREW/NO_RESULT_EMIT; taskId is an opaque token guarded against path traversal; task resources never expose out-of-root paths.
R025 core | storage_paths -> config.tasks.stateDir (default `../task-state`) ∧ config.worktrees.root (default `../worktrees`, parent of `<repoName>/<taskId>`) are runtime-honored; getTaskStateDir/getWorktreesDir (config.ts, config-authoritative since TF-SLIM-03) resolve against the MAIN repo root → identical from the main checkout or any linked worktree; F decorative path fields.
R026 core | least_priv -> opencode.json uses role-scoped permissions, not broad global allows: implementer may run direct git (add/commit/push/branch/worktree) but F force-push; planner/reviewer are read-only (edit: deny); doctor has an explicit recovery allowlist (no wildcards); hard denies (`git push --force*`, `.git/**`, `tasks/**`) appear at both global ∧ role level; mcp.taskforge.enabled defaults false (opt-in via TASKFORGE_WITH_MCP=1); generateOpenCodeConfig M mirror the checked-in opencode.json.
R027 core | portable_skills -> two canonical skills (taskforge-work-task, taskforge-recover-state) are installed byte-identically by the generic ∧ opencode adapters under `.agents/skills/`; bodies are concise/imperative, defer to JSON output as the live contract, and F duplicate the status graph or command map; framework adapters M reuse the canonical files, F vendor workflow forks.
```

## Ownership Index

```axl
R150 owner(command-states.ts,status-transition.ts)=state machine and next-action guidance.
R151 owner(task.ts,task-store.ts,task-state-transaction.ts)=task schema, CRUD, and state transitions.
R152 owner(task-document.ts)=task document parsing and generation.
R153 owner(git.ts)=worktrees, branches, commits, pushes, and diff.
R154 owner(audit*.ts,cli-audit.ts,init-audit.ts)=event logging and audit trail.
R155 owner(hooks.ts)=pre/post command hooks.
R156 owner(agent-registry.ts,agent-files.ts)=agent identity, heartbeat, stale detection.
R157 owner(config.ts)=TaskForge configuration loading, validation, and config-authoritative storage paths (R025).
R158 owner(agent-framework-adapter.ts,guidance-adapter.ts)=OpenCode/generic framework integration.
R159 owner(agents-md.ts)=AGENTS.md file management.
R160 owner(doctor-lock.ts)=exclusive recovery lock.
R161 owner(state-validator.ts)=whole-state validation.
R162 owner(session.ts,session-state.ts)=session tracking.
R163 owner(result-builder.ts,result-renderer.ts)=CommandResult formatting.
R164 owner(next-command-maps.ts)=valid next-command mapping.
R165 owner(continuation.ts,completion-policy.ts)=auto-continuation policy.
R166 owner(control-files.ts)=runtime control-file management.
R167 owner(scheduler.ts)=task scheduling.
R168 owner(sweeper.ts)=stale cleanup.
R169 owner(guard-plugin.ts,mutation-guard.ts)=mutation protection.
R170 owner(pr-verifier.ts)=PR verification.
R171 owner(pending-publish.ts)=un-pushed task tracking.
R172 owner(templates.ts)=task template rendering.
R173 owner(opencode-config.ts)=OpenCode configuration sync and least-privilege profiles (R026).
R174 owner(errors.ts)=TaskForgeError hierarchy.
R175 owner(event-log.ts)=structured event logging.
R176 owner(closure-task.ts)=auto-create tasks for error states.
R177 owner(authority.ts)=agent authorization.
R178 owner(init-audit.ts)=initialization audit.
R179 owner(command-result.ts)=TaskForgeCommandResultSchema + emitResult/setResultSink in-process capture for the MCP bridge (R023).
R180 owner(mcp-contract.ts)=typed MCP bridge: runCommandForResult, McpCommandResultSchema, buildGetTaskResult, task-resource builder, taskId traversal guard (R024).
R181 owner(skill-files.ts)=canonical portable agent skills under `.agents/skills/`, shared across framework adapters (R027).
```
