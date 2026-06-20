# Documentation — TaskForge

## Purpose

Project documentation for TaskForge: architecture specs, workflow contracts, deployment guides, and design decisions. The canonical agent workflow contract is `docs/workflow.md`.

## Ownership

| Document | Path | Purpose |
|---|---|---|
| Workflow Contract | `workflow.md` | Canonical agent/human workflow; overrides conflicting docs |
| Architecture: State Machine | `architecture/command-state-machine-and-invariants.md` | Task lifecycle state machine and invariant rules |
| Architecture: Return Contract | `architecture/command-return-contract.md` | CommandResult shape and serialization contract |
| Agent Framework Integration | `agent-framework-integration.md` | How TaskForge integrates with agent frameworks |
| Control Plane Hardening | `control-plane-hardening.md` | Error recovery and resilience design |
| GitHub Task State Protection | `github-task-state-protection.md` | Branch protection rules for task state |
| Next Action Semantics | `next-action-semantics.md` | Semantics of the `nextAction` field in CommandResult |
| Deployment: Container | `deployment/container-runtime.md` | Container runtime configuration |
| Decisions | `decisions/` | Design decision records (currently empty) |

## Local Contracts

- `workflow.md` is the canonical workflow contract. If another doc (including AGENTS.md) conflicts with `workflow.md`, `workflow.md` wins for workflow rules.
- Architecture docs in `architecture/` define contracts that source code implements.
- Do not store temporary or session-specific content in `docs/`.

## Work Guidance

- Update `docs/workflow.md` when agent workflow rules change.
- Update `docs/architecture/` docs when state machine, return contract, or invariants change.
- Add ADR-style records to `docs/decisions/` for significant design choices.
- Do not create new docs unless necessary — prefer updating existing ones.
- Keep documentation concise, current, and operational.

## Verification

N/A — docs are informational. Verify accuracy against source code when updating.

## Child DOX Index

- `architecture/` — State machine and return contract specs.
- `deployment/` — Deployment and runtime configuration.
- `decisions/` — Design decision records (empty).
