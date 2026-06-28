# TaskForge Architecture Audit — 2026-06-27

## Abstract

TaskForge is moving in the correct direction for an agentic development control plane, but the current repository state is not simple. The dominant failure is architectural drift: the human-facing workflow now says **direct git + TaskForge for task/state coordination**, while code and generated guidance still assume an older **TaskForge-as-git-facade** lifecycle. That split will confuse agents, waste context, and create unsafe recovery behavior.

The project has strong raw materials: typed task schema, state validation, audit concepts, agent registry, worktree isolation, doctor lock, command result contracts, and OpenCode integration. The problem is not lack of capability. The problem is excess surface area, stale contracts, and inconsistent authority boundaries.

**Verdict:** keep TaskForge as a small local-first task/state control plane. Stop expanding it into a general git/dependency/MCP/security/orchestration shell. Remove or quarantine stale lifecycle commands and generated guidance. Make `next`, `prompt`, `inspect`, `validate-state`, `gates`, and minimal task CRUD the stable core. Everything else should be adapter/plugin/doctor-only or deleted.

## Audit Basis

This audit used the GitHub connector to inspect current repository files and the `dynovo-agent-rules` compact rule notation. Direct sandbox cloning was unavailable, so I did not run tests or perform whole-repo static analysis. Evidence came from:

- `package.json`
- root `AGENTS.md`
- `.agent/tf.ctx`
- `.agent/file.idx`
- `docs/workflow.md`
- `.taskforge/config.json`
- `opencode.json`
- `src/cli.ts`
- `src/core/task.ts`
- `src/util/status-constants.ts`
- `src/core/command-states.ts`
- `src/core/task-store.ts`
- `src/util/paths.ts`
- `squoyster/dynovo-agent-rules/rules/base.md`

## DOX Notation Used

```dox
□=always; ◇=before closeout; ¬=not; ∧=and; ∨=or; →=implies; ≺=before; ≻=higher priority.
M x=must x. F x=must-not x. S x=should x unless blocked by stronger rule. P x=may x. Pref(a,b)=prefer a over b.
R[id]: scope | trigger -> norm/action [verify] [except] [effect]
```

Selected governing rules for this report:

```dox
R-AUDIT-001: audit | evidence_available -> M cite(file∧path∧line_or_symbol) ∧ F invent(runtime_results).
R-AUDIT-002: architecture | simplicity_goal -> Pref(delete_or_hide,add_command) ∧ Pref(single_authority,mixed_authority).
R-AUDIT-003: agentic_use | command_guidance -> M executable_now ∧ F reference(removed_command∨stale_workflow).
R-AUDIT-004: task_output | issue_found -> M emit(task{prompt,AC,priority,scope}) ∧ S use_dox_for_agent_rules.
```

## Current-State Assessment

### Simplicity

**Score: 4/10.** The project has too many visible commands and too many overlapping lifecycle concepts. The CLI registers task lifecycle commands, audit commands, doctor commands, guard commands, MCP, dependency steward commands, and generated workflow helpers. Some are opt-in, but the source and guidance still contain them. This is excessive for a lightweight task manager.

### Ease of Use

**Score: 5/10.** Agents get good guardrail concepts, but the “what do I do next?” contract is inconsistent. `docs/workflow.md` says use direct git and treats `taskforge next|inspect|list|gates` as read-mostly helpers. `src/core/command-states.ts` still recommends removed facade commands like `taskforge checkpoint`, `taskforge submit`, and `taskforge diff`. That is a hard UX bug.

### Alignment With Project Goals

**Score: 6/10.** Alignment is good at the concept level: durable task state, stable agent identity, auditability, worktree isolation, state machine, and doctor recovery all match the stated agentic goals. Alignment breaks at implementation boundaries: broad permissions, generated `dist` committed into the repo, stale indexes, stale command guidance, hardcoded local paths, and mixed state ownership undermine safety and portability.

## Highest-Risk Findings

1. **Stale command guidance references removed commands.** `checkpoint`, `submit`, `diff`, and `pr` appear in the command-state guidance, but they are not registered in `src/cli.ts`. Root policy says the git facade was removed.
2. **The state model is not single-source.** Workflow docs show a smaller lifecycle; status constants contain extra phases; command-state registry uses the old phases.
3. **The CLI surface is too broad.** The current command list is much larger than the stable conceptual product.
4. **Config contradicts runtime path behavior.** `.taskforge/config.json` says `tasks.directory=tasks`, but runtime reads sibling `../task-state`. Config says `worktrees.root=../worktrees`, but path code hardcodes `../worktrees/<repoName>`.
5. **Permissions are too broad for a safety-oriented agentic workflow.** `opencode.json` allows broad edit and bash while the policy claims more specific denials.
6. **Generated build output is committed and indexed.** `dist/cli.js` alone is ~255 KB and is included in the agent file index, bloating navigation and context.
7. **Hardcoded local paths leak into project policy.** Root `AGENTS.md` includes `/Volumes/Transcend/...`, making the workflow less portable.
8. **The project lacks a discoverable README.** A public repo without a root README is hostile to new human and agent users.

---

# Task Pack

## TF-AUDIT-001 — Repair Stale Command Guidance

**Priority:** P0  
**Type:** Bug / Architecture  
**Risk:** High  
**Agent Role:** Implementer

### Problem

`src/core/command-states.ts` still emits commands from the removed git facade: `taskforge checkpoint`, `taskforge submit`, `taskforge diff`, and `taskforge pr`. Root policy says the facade was removed and agents should use git directly. `src/cli.ts` does not register those commands.

### Agent Prompt

Audit every command string emitted by `src/core/command-states.ts`, command result builders, and command tests. Replace removed TaskForge facade commands with current direct-git or current CLI equivalents. Ensure every emitted command is either registered in `src/cli.ts`, explicitly shell-native git, or explicitly human/doctor-only. Update tests to assert no removed commands appear in `nextActions`, `guidance`, or error recovery output.

```dox
R001: command_guidance | emit(command) -> M exists(command in CLI ∨ command is git/native ∨ command marked doctor/human-only).
R002: facade_removed | command∈{checkpoint,submit,diff,pr} -> F emit(`taskforge ${command}`).
R003: replacement | save_progress -> Pref(`git add -A && git commit -m ...`,`taskforge checkpoint`).
R004: replacement | submit_work -> Pref(`git push -u origin <branch>` + human PR,`taskforge submit`).
R005: verify | tests -> M assert_no_removed_facade_commands(output).
```

### Acceptance Criteria

- [ ] No production code emits `taskforge checkpoint`, `taskforge submit`, `taskforge diff`, or `taskforge pr` as recommended next actions.
- [ ] `COMMAND_STATE_REGISTRY` guidance is consistent with `docs/workflow.md`.
- [ ] Tests cover happy-path and error-path guidance for `next`, `start`, `claim`, `gates`, `done`, `ac-check`, and unknown command handling.
- [ ] `npm run typecheck`, `npm run lint`, `npm run build`, and `npm test -- --run` pass.

---

## TF-AUDIT-002 — Collapse the CLI Into a Stable Core Surface

**Priority:** P0  
**Type:** Refactor / Product Architecture  
**Risk:** High  
**Agent Role:** Architect + Implementer

### Problem

The CLI exposes too many concepts for a lightweight task control plane. The current source registers initialization, selection, lifecycle, reporting, cleanup, metadata updates, doctor, audit, transcript, timeline, AC checking, MCP, guard, release/reject, dependency steward, and state validation. That makes the product harder to learn and increases stale guidance risk.

### Agent Prompt

Define and implement a stable command taxonomy: **core**, **doctor**, **diagnostic**, **experimental/plugin**, and **deprecated/hidden**. Keep the normal user/agent path short. Hide or gate non-core commands. Update help text and docs so `taskforge --help` teaches the direct-git operating model in under one screen.

```dox
R001: cli_surface | normal_agent -> M expose(core_only).
R002: core := {init,next,prompt,inspect,list,gates,validate-state,new,update,block,done?}.
R003: risky_or_rare := {doctor,unlock,sweep,cleanup,guard,release,reject} -> M gate(role∈{doctor,human}) ∨ hide_from_default_help.
R004: plugin := {deps,mcp,github_sync} -> M opt_in ∧ F load_by_default.
R005: help_output | user_reads -> M show_minimal_workflow ∧ F list_experimental_noise_by_default.
```

### Acceptance Criteria

- [ ] `taskforge --help` presents a small normal workflow and hides/quarantines rare/experimental commands.
- [ ] Every command is classified in a command taxonomy document or constant.
- [ ] Plugin/experimental commands are opt-in and absent from default help unless enabled.
- [ ] Tests verify hidden/gated commands are not presented as normal next actions.

---

## TF-AUDIT-003 — Unify the Task Status Model

**Priority:** P0  
**Type:** Bug / Data Model  
**Risk:** High  
**Agent Role:** Implementer

### Problem

`docs/workflow.md` defines the visible lifecycle as `Inbox -> Needs Spec -> Ready -> In Progress -> Review -> Verify -> Done`, with `Blocked`, `Rejected`, and `Deferred`. `src/util/status-constants.ts` also defines `Implementation Complete`, `Submitted`, and `Merge Ready`. `src/core/command-states.ts` still uses the extra phases in guidance. This creates ambiguous workflow ownership.

### Agent Prompt

Choose one canonical status graph. Prefer the smaller workflow unless there is active code requiring extra phases. Remove, hide, or explicitly mark legacy statuses. Update status constants, transition validation, docs, tests, command-state guidance, and task templates.

```dox
R001: status_model | project -> M single_source_of_truth(status_graph).
R002: status_visible | normal_agent -> M subset({Inbox,Needs Spec,Ready,In Progress,Blocked,Review,Verify,Done,Rejected,Deferred}).
R003: legacy_status | status∈{Implementation Complete,Submitted,Merge Ready} -> M remove ∨ alias ∨ mark_legacy_with_migration.
R004: transition | command_changes_status -> M validate_against(canonical_graph).
R005: docs_tests | status_change -> M update(docs ∧ fixtures ∧ tests).
```

### Acceptance Criteria

- [ ] One canonical status graph exists and is imported by code/tests/docs.
- [ ] No command guidance recommends transitions through undocumented statuses unless explicitly legacy/migrating.
- [ ] `TaskStatus`, `ACTIVE_STATUSES`, transition tests, and workflow docs agree.
- [ ] Migration behavior is documented for existing task files using removed/legacy statuses.

---

## TF-AUDIT-004 — Fix Config/Runtime Path Drift

**Priority:** P0  
**Type:** Bug / Portability  
**Risk:** High  
**Agent Role:** Implementer

### Problem

`.taskforge/config.json` declares `tasks.directory = "tasks"`, `tasks.template = "tasks/TEMPLATE.md"`, and `worktrees.root = "../worktrees"`. Runtime path code reads task state from `../task-state` relative to the main repo and hardcodes worktree layout as `../worktrees/<repoName>`. This makes config partly decorative and breaks user expectations.

### Agent Prompt

Make path resolution explicit and testable. Either update config to represent the current direct-git/task-state model, or update runtime to honor config. Add `taskState.directory` or equivalent if sibling task-state is authoritative. Eliminate dead `config.yaml` assumptions unless still used.

```dox
R001: path_config | config_field_exists -> M runtime_uses(field) ∨ delete(field) ∨ mark_deprecated.
R002: task_state | authoritative=../task-state -> M encode_in_config(taskState.directory) ∧ docs.
R003: worktrees | configured_root -> M getWorktreesDir honors(config.worktrees.root).
R004: portability | path -> F hardcode(user_machine_absolute_path).
R005: tests | path_resolution -> M cover(main_repo ∧ worktree ∧ non_default_config).
```

### Acceptance Criteria

- [ ] Runtime path behavior and `.taskforge/config.json` agree.
- [ ] `getTaskStateDir`, `getWorktreesDir`, and related tests cover configured custom locations.
- [ ] `getConfigPath`/`getConfigJsonPath` behavior is rationalized; no dead `config.yaml` contract remains unless documented.
- [ ] Docs explain the task-state branch/worktree location in config terms.

---

## TF-AUDIT-005 — Remove Hardcoded Local Machine Paths From Agent Policy

**Priority:** P1  
**Type:** Documentation / Portability  
**Risk:** Medium  
**Agent Role:** Implementer

### Problem

Root `AGENTS.md` contains absolute paths like `/Volumes/Transcend/devel/task-forge` and `/Volumes/Transcend/devel/worktrees/...`. That is useful for one machine but invalid as project policy. Agents on other machines will copy bad commands.

### Agent Prompt

Replace machine-specific absolute paths in root policy with variables derived from repo/config: `<main_repo>`, `<worktree_root>`, `<task_state_repo>`, `<task_worktree>`. If local examples are needed, put them in a non-binding local notes file ignored by git.

```dox
R001: shared_policy | command_example -> F include(user_absolute_path).
R002: shared_policy | path_needed -> M use(symbolic_path ∨ config_key).
R003: local_machine_notes -> M gitignored ∧ F authoritative.
R004: docs_update | path_policy_changed -> M update(AGENTS.md ∧ docs/workflow.md if affected).
```

### Acceptance Criteria

- [ ] Root `AGENTS.md` has no `/Volumes/...` machine-specific commands.
- [ ] Worktree and task-state examples use symbolic variables or config-derived paths.
- [ ] Any local-only path guidance is moved to an ignored local file or deleted.

---

## TF-AUDIT-006 — Replace Broad OpenCode Permissions With Least-Privilege Profiles

**Priority:** P1  
**Type:** Security / Agent Safety  
**Risk:** High  
**Agent Role:** Implementer + Reviewer

### Problem

`opencode.json` allows broad `edit` and `bash`, while root policy claims stronger command-specific constraints such as force-push denial and task-state protections. Broad allow rules reduce the value of TaskForge guardrails.

### Agent Prompt

Refactor OpenCode permissions into role profiles: implementer, reviewer, planner, doctor. Implementer should allow normal git/task-state edits and deny force-push/destructive operations. Reviewer/planner should be read-only by default. Doctor should have elevated but explicit recovery permissions.

```dox
R001: permissions | role=implementer -> M allow(required_normal_work) ∧ F force_push ∧ F destructive_without_ask.
R002: permissions | role∈{reviewer,planner} -> Pref(read_only,write_access).
R003: permissions | role=doctor -> M explicit_allowlist(recovery_commands) ∧ F wildcard_bash_if_specific_possible.
R004: config_change(opencode) -> M notify(user_restart_required).
R005: verify -> M test_or_static_check(no broad allow masks deny).
```

### Acceptance Criteria

- [ ] Broad `bash: allow` is replaced by a narrower policy or justified in a documented exception.
- [ ] Force-push and destructive git commands are denied at the OpenCode policy layer.
- [ ] Reviewer/planner cannot edit by default.
- [ ] Permission tests or a static validation script confirms deny rules are effective.

---

## TF-AUDIT-007 — Stop Committing and Indexing Build Output

**Priority:** P1  
**Type:** Repository Hygiene / Agent Context  
**Risk:** Medium  
**Agent Role:** Implementer

### Problem

`.agent/file.idx` includes `dist/` files, including a large bundled `dist/cli.js`. This bloats repository navigation and creates duplicate source-of-truth risk. `package.json` can still publish `dist` without committing it.

### Agent Prompt

Decide whether `dist/` is source-controlled. Prefer not source-controlled. If publishing requires `dist`, produce it in build/prepack/release only. Update `.gitignore`, file indexes, package scripts, and any tests relying on committed `dist`.

```dox
R001: generated_output | source_repo -> Pref(ignore,commit) unless release_contract_requires_commit.
R002: agent_index | generated_output -> F include_by_default.
R003: package_publish | needs_dist -> M build(prepack∧release) ∧ include(package.files).
R004: tests | spawn_dist_cli -> M build_before_test ∨ switch_to(src_cli_runner).
```

### Acceptance Criteria

- [ ] `dist/` is either removed from git/indexes or explicitly justified as committed release artifact.
- [ ] Agent indexes exclude generated output by default.
- [ ] Tests that need `dist/cli.js` build it deterministically.
- [ ] Package publishing still includes built CLI output.

---

## TF-AUDIT-008 — Add a Root README Focused on First-Run Usability

**Priority:** P1  
**Type:** Documentation / UX  
**Risk:** Medium  
**Agent Role:** Technical Writer + Implementer

### Problem

The repository appears to lack a root `README.md`. New humans and agents need a single concise entry point. The current operational truth is scattered across `AGENTS.md`, `.agent/tf.ctx`, `docs/workflow.md`, specs, and CLI help.

### Agent Prompt

Create `README.md` for humans and agents. It should explain what TaskForge is, what it is not, the minimal workflow, install/build/test commands, task-state setup, and safety model. Keep deep architecture out of README and link to docs/specs.

```dox
R001: README | first_run -> M answer({what,is_not,install,init,workflow,state_location,gates,safety}).
R002: README | command_examples -> M current_commands_only ∧ F removed_facade_commands.
R003: README | depth -> Pref(short_links,long_embedded_specs).
R004: README | task_state -> M explain(../task-state requirement ∧ branch/worktree model).
```

### Acceptance Criteria

- [ ] Root `README.md` exists.
- [ ] README includes a minimal direct-git workflow that matches `docs/workflow.md`.
- [ ] README does not mention removed facade commands.
- [ ] README links to architecture, workflow, and agent policy docs.

---

## TF-AUDIT-009 — Rationalize Task Schema Fields and Agent Roles

**Priority:** P1  
**Type:** Data Model / Agent Interop  
**Risk:** Medium  
**Agent Role:** Implementer

### Problem

Task type, priority, risk, status, and blocker values are enumerated, but `agentRole` is free-form. That weakens routing and agent interop. The CLI exposes `--agent-role`, OpenCode defines concrete agents, and task metadata should align with actual routable roles.

### Agent Prompt

Add a controlled agent-role model tied to configured agent definitions, while preserving migration compatibility for existing free-form values. Validate roles on `new`/`update`, and make `list --agent-role` or equivalent possible if useful.

```dox
R001: task_schema | routable_field(agentRole) -> M validate_against(configured_agents ∨ known_role_enum).
R002: migration | legacy_freeform_role -> M warn ∧ preserve_read ∧ normalize_on_write_if_safe.
R003: cli | new/update(agentRole) -> M reject_or_warn(unknown_role).
R004: interop | agentRole -> M map_to(OpenCode_agent ∨ generic_capability).
```

### Acceptance Criteria

- [ ] Agent roles are validated against a documented source of truth.
- [ ] Existing tasks with unknown roles still load with warnings or migration path.
- [ ] `new` and `update` tests cover valid and invalid agent roles.
- [ ] Docs explain role routing semantics.

---

## TF-AUDIT-010 — Make `taskforge next` the Single Agent Entry Point

**Priority:** P1  
**Type:** UX / Agent Workflow  
**Risk:** Medium  
**Agent Role:** Implementer

### Problem

Agents currently need to understand `next`, `claim`, `start`, `resume`, `prompt`, direct git, task-state edits, and status-specific exceptions. This is too much. `next --json` should produce a complete executable instruction packet for the next safe action.

### Agent Prompt

Evolve `taskforge next --json` into the primary agent entry point. It should return: selected task, current ownership state, exact allowed next command(s), required cwd/worktree, relevant policy snippets, prompt packet reference, and blocked/doctor reasons. It must never recommend stale commands.

```dox
R001: agent_entry | normal_agent_start -> M use(`taskforge next --json`).
R002: next_json | actionable -> M include(taskId,status,worktree,branch,allowed_next_commands,reason,safety,prompt_command).
R003: next_json | blocked -> M include(block_reason ∧ human_or_doctor_action) ∧ F improvise.
R004: next_json | command -> M executable_now.
R005: UX -> Pref(one_entrypoint,multi_command_ceremony).
```

### Acceptance Criteria

- [ ] `next --json` gives enough information for an agent to continue without reading broad docs.
- [ ] It distinguishes start/resume/verify/review/blocked/doctor paths.
- [ ] It references `prompt` or embeds a compact prompt packet location.
- [ ] Contract tests cover representative statuses and failure modes.

---

## TF-AUDIT-011 — Split Runtime State, Durable Project State, and Generated Agent Indexes

**Priority:** P2  
**Type:** Architecture / Repository Hygiene  
**Risk:** Medium  
**Agent Role:** Architect + Implementer

### Problem

The repository contains `.taskforge/` config, `.agent/` indexes, `tasks/` legacy content, references to sibling `task-state`, and runtime artifacts mentioned in docs. The boundary between committed config, generated navigation aids, local runtime state, and durable external task state is not crisp enough.

### Agent Prompt

Define four storage classes and enforce them: committed config/docs, generated-but-committed indexes if retained, ignored local runtime state, and external durable task-state. Update `.gitignore`, docs, validation, and init/repair behavior.

```dox
R001: storage | file -> M classify(file,{committed_config,generated_index,ignored_runtime,external_durable_state}).
R002: ignored_runtime -> F commit.
R003: generated_index -> M reproducible ∧ validate_freshness ∧ exclude_build_output.
R004: external_durable_state -> M explicit_location ∧ health_check ∧ sync_check.
R005: init_repair -> M create_or_validate_each_storage_class.
```

### Acceptance Criteria

- [ ] A storage-boundary document exists and is short.
- [ ] `.gitignore` matches the storage classes.
- [ ] `doctor --check` or `validate-state` detects missing/stale task-state and stale indexes.
- [ ] `tasks/` legacy status is clarified or removed from active config.

---

## TF-AUDIT-012 — Add Command Contract Tests for Help, JSON, and Guidance

**Priority:** P2  
**Type:** Test / Reliability  
**Risk:** Medium  
**Agent Role:** QA + Implementer

### Problem

The project has many command tests, but the observed drift suggests insufficient contract tests for user-visible command guidance. A command can compile while still telling agents to execute removed commands.

### Agent Prompt

Create a command contract test suite that snapshots or structurally validates CLI help, JSON result shapes, `nextActions`, and guidance strings. Focus on preventing stale command emission, undocumented statuses, and non-executable advice.

```dox
R001: contract_test | command_output -> M validate(schema ∧ executable_guidance ∧ no_removed_commands).
R002: json_output -> M stable_shape ∧ include(errorCode,nextActions,safety) where applicable.
R003: help_output -> M matches(command_taxonomy).
R004: status_output -> F emit(undocumented_status) unless legacy_migration.
```

### Acceptance Criteria

- [ ] Tests fail if removed commands appear in guidance.
- [ ] Tests fail if command outputs include undocumented statuses.
- [ ] `--json` outputs validate against schemas or explicit structural assertions.
- [ ] Help output is tested against the command taxonomy.

---

## TF-AUDIT-013 — Define the Minimal Architecture Decision Record Set

**Priority:** P2  
**Type:** Documentation / Architecture Governance  
**Risk:** Low  
**Agent Role:** Architect

### Problem

The repo contains many specs and task packs. That is useful historically, but agents need a smaller current decision set. Without concise Architecture Decision Records (ADRs), old specs compete with current docs.

### Agent Prompt

Create a minimal ADR index capturing current architectural decisions: direct-git model, external task-state, command taxonomy, status graph, OpenCode adapter boundary, generated indexes, and doctor recovery. Mark old specs as historical where superseded.

```dox
R001: architecture_docs | current_decision -> M ADR(short,status,date,decision,consequences).
R002: superseded_spec -> M mark(historical) ∧ link(current_ADR).
R003: agent_navigation -> Pref(ADR_index,current_specs_scattered).
R004: docs -> M concise ∧ operational ∧ delete_stale.
```

### Acceptance Criteria

- [ ] ADR index exists.
- [ ] At least six current decisions are captured.
- [ ] Superseded specs/task packs are marked historical or linked to current ADRs.
- [ ] Agent navigation docs point to ADRs before long specs.

---

## TF-AUDIT-014 — Make Task-State Updates Transactional and Auditable Under Direct-Git

**Priority:** P2  
**Type:** Reliability / Distributed Agents  
**Risk:** High  
**Agent Role:** Implementer

### Problem

The direct-git task-state model is viable but fragile: agents edit a sibling worktree and push with `TASKFORGE_INTERNAL=1`. This needs strong transaction semantics, conflict detection, and audit records, especially with distributed agents.

### Agent Prompt

Audit `task-state-transaction`, claim/start/done/update flows, and event logging. Ensure every state mutation has atomic read-modify-write semantics, detects remote changes, records actor/session/run IDs where available, and emits an audit event.

```dox
R001: state_mutation | task_state -> M atomic_read_modify_write ∧ detect_conflict ∧ retry_or_fail_safe.
R002: distributed_agents | claim -> M compare_latest_remote_before_push.
R003: audit | mutation -> M record(actor,agentId?,sessionId?,runId?,taskId,old,new,time,command).
R004: failure | push_conflict -> M no_silent_success ∧ guidance(executable_recovery).
R005: verify -> M race_tests(two_agents_same_task).
```

### Acceptance Criteria

- [ ] Claim/update/done flows detect remote conflict and do not overwrite silently.
- [ ] Mutations record audit events with available identity fields.
- [ ] Race/concurrency tests cover two agents claiming or updating the same task.
- [ ] Recovery guidance after conflict is executable and current.

---

## Recommended Execution Order

1. **TF-AUDIT-001** — remove stale command guidance.
2. **TF-AUDIT-003** — unify status model.
3. **TF-AUDIT-004** — fix config/path drift.
4. **TF-AUDIT-002** — collapse CLI surface.
5. **TF-AUDIT-006** — least-privilege OpenCode profiles.
6. **TF-AUDIT-010** — make `next --json` the single agent entry.
7. **TF-AUDIT-012** — command contract tests.
8. **TF-AUDIT-007** — remove generated output from index/git.
9. **TF-AUDIT-008** — root README.
10. **TF-AUDIT-011/013/014** — storage boundaries, ADRs, task-state hardening.

## Architectural Target

```text
TaskForge Core
  - task schema + status graph
  - task-state transaction layer
  - next-action planner
  - prompt packet emitter
  - validation/gates adapter
  - audit/event log

Adapters
  - OpenCode adapter
  - GitHub issue/PR adapter
  - MCP adapter, optional
  - Dependency steward, optional plugin

Doctor Mode
  - lock
  - diagnose
  - repair
  - recover stale agents/tasks

Out of Core
  - generic git facade
  - dependency upgrade automation
  - broad shell permissions
  - generated build output
  - historical specs as active policy
```

## Bottom Line

TaskForge should become smaller, not larger. The winning architecture is a **minimal, opinionated task/state kernel** with explicit adapters. Agents should not need to understand TaskForge internals, deprecated lifecycle commands, local machine paths, or multiple status graphs. They should run `taskforge next --json`, receive a compact safe instruction packet, work in a worktree with direct git, run gates, and update task-state transactionally.

The current repo is close enough to salvage cleanly, but the next work should be subtractive: delete, hide, unify, and test the contracts that agents actually consume.
