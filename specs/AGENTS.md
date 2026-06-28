# AGENTS.md - Specs Overlay

Purpose: specification, gap-analysis, task-pack, and roadmap rules for TaskForge. This folder holds design-time documents, not runtime policy.

## Specs Rules

```axl
R000 specs | scope -> design specs, gap analyses, task packs, roadmap docs, and the compact guide belong here.
R001 specs | source_of_truth -> specs are planning and design artifacts; runtime workflow still comes from `docs/workflow.md`.
R002 specs | compact_guide -> the operational Agent Compact Guide (direct-git routine, AC discipline, gates, file discovery) is authoritative in `docs/workflow.md` and the root `AGENTS.md`; this file defers to them rather than re-hosting them.
R010 specs | update_when -> update specs when durable design, architecture, or task-pack assumptions change.
R011 specs | no_session_noise -> F store transient session artifacts in `specs/`.
R012 specs | prefer_existing -> M revise existing specs over creating new ones unless a new spec is required.
R020 specs | verify -> check spec changes against the implementation, task state, or linked docs when the change depends on them.
```

## Child DOX Index

```axl
R150 child(specs docs)=`README.md`, `CHANGELOG.md`, `TASKFORGE.md`, `control-plane-hardening.md`, `github-task-state-protection.md`, `taskforge-slimming-refactor.md`, `taskforge-agent-policy-tasks.md`, `taskforge-agent-definitions-gap-analysis-tasks.md`, `taskforge-container-deployment-gap-analysis-tasks.md`, `taskforge-command-return-template.md`, `taskforge-control-plane-closure-spec.md`, `task-forge-rationalization-roadmap.md`, `task-forge-prescriptive-command-output-task-pack.md`, `task-forge-ac-repair-task-pack.md`, `taskforge_architecture_gap_analysis.md`, `fix-claim-start-self-deadlock-agent-prompt.md`.
```
