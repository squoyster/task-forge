# AGENTS.md - Docs Overlay

Purpose: documentation-specific rules for TaskForge. Workflow rules live in `docs/workflow.md`; this file only owns docs-layer deltas.

## Docs Rules

```axl
R000 docs | workflow_contract -> `docs/workflow.md` is canonical for agent/human workflow and overrides conflicting docs.
R001 docs | ownership -> `agent-framework-integration.md`, `control-plane-hardening.md`, `github-task-state-protection.md`, `next-action-semantics.md`, `architecture/command-state-machine-and-invariants.md`, `architecture/command-return-contract.md`, and `deployment/container-runtime.md` belong here.
R002 docs | temporary_content -> F store session-specific or transient material in `docs/`.
R010 docs | update_workflow -> when workflow rules change, update `docs/workflow.md`.
R011 docs | update_architecture -> when state machine, return contract, or invariant rules change, update the matching `docs/architecture/*.md` file.
R012 docs | update_deployment -> when container/runtime behavior changes, update `docs/deployment/container-runtime.md`.
R013 docs | prefer_existing -> M update existing docs over creating new ones unless a new doc is necessary.
R014 docs | quality -> keep docs concise, current, and operational.
R020 docs | verify_accuracy -> verify doc changes against source code or live contracts when relevant.
```

## Child DOX Index

```axl
R150 child(architecture/)=`command-state-machine-and-invariants.md`, `command-return-contract.md`.
R151 child(deployment/)=`container-runtime.md`.
```
