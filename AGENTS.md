# AGENTS.md - TaskForge Overlay

Purpose: TaskForge-specific rules layered on top of the global baseline from `https://github.com/squoyster/dynovo-agent-rules`. Keep this file free of generic AXL or DOX boilerplate already covered there.

## TaskForge Rules

```axl
R000 root | workflow_conflict -> `docs/workflow.md` wins for operator workflow; this file owns only TaskForge deltas.
R001 root | inherited_baseline -> dynovo-agent-rules AGENTS supplies generic rules; do not repeat them here.
R010 all | direct_git -> M use(git_directly) ∧ F use(taskforge checkpoint|submit|diff|pr).
R011 all | agent_navigation -> M read(.agent/tf.ctx) ≺ read(.agent/file.idx) ≺ read(.agent/symbol.idx) ≺ read(.agent/spec.idx) ≺ read(.agent/task.idx).
R012 all | read_state -> P use(taskforge next|inspect|list|gates|doctor|validate-state|status).
R020 all | worktree_task -> M use_task_specific_worktree ∧ F work_in(/Volumes/Transcend/devel/task-forge).
R021 all | fresh_worktree -> M symlink(/Volumes/Transcend/devel/task-forge/node_modules -> <wt>/node_modules).
R030 all | task_state -> M treat(../task-state/ as authoritative) ∧ M edit ../task-state/TASK-NNN.md directly in the task-state worktree ∧ commit/push with TASKFORGE_INTERNAL=1 ∧ keep task-state push-protected from worktrees.
R031 task_file(T) -> M frontmatter(status,assignee,claimed_at,completed_at,branch,worktree) ∧ fill(##Result) on completion.
R032 done(T) -> M run(typecheck) ≺ run(lint) ≺ run(build) ≺ run(test) ∧ require(lint_errors=0).
R033 all | hard_rules -> F force_push ∧ M stop_all_work when `.doctor-lock` exists.
R034 edit(opencode.json) -> M tell_user_restart_if_required.
R040 all | agent_identity -> M use(durable_state) as source of truth ∧ F rely(memory∨summaries∨prompt_text) for identity-sensitive work.
R041 all | gitnexus_sensitive_edit -> M run(impact upstream) before symbol edits ∧ M run(detect_changes()) before commit ∧ warn on HIGH/CRITICAL risk.
R042 all | stale_hook -> if hook emits `unknown command '_hook'`, reinstall/upgrade TaskForge or use `git -c core.hooksPath=/dev/null push ...`.
```

## Child DOX Index

```axl
R150 child(src/core)=core engine: state machine, lifecycle, git, audit, hooks, config, agents, sessions, validation, sweeper, continuation, errors, templates, publication.
R151 child(src/commands)=CLI handlers and deps; thin delegation to core.
R152 child(tests)=Vitest suite mirroring src.
R153 child(docs)=workflow, architecture, deployment, and design docs.
R154 child(.agent)=routing indices tf.ctx, file.idx, symbol.idx, spec.idx, task.idx.
R155 child(specs)=specs, gap analyses, task packs, roadmap, compact guide.
R156 root_owns := src/agent-frameworks/ ∪ src/integrations/ ∪ src/util/ ∪ src/markdown/ ∪ scripts/ ∪ tasks/ ∪ .taskforge/.
```
