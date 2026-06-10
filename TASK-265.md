---
id: TASK-265
type: Feature
status: Ready
priority: P1
agentRole: Planner
riskLevel: Low
humanInterventionRequired: false
spec_hash: ad13fd7b7c245459
---

# TASK-265: STANDARDIZE AGENT COMPLETION PROTOCOL AND STATUS LANGUAGE

## Goal

Describe the desired outcome.

## Acceptance Criteria

- [ ]

## Agent Notes


## Problem

The agent\'s own checklist omitted PR verification and then declared "all done." Language such as "clean" or "completed" was used for states that still had warnings, missing PRs, or unresolved conflicts.

## Task Description

Define and distribute a standardized machine-driven completion protocol for TaskForge agents.

Agent prompts must require authoritative TaskForge status checks and prohibit free-form completion claims that contradict lifecycle state.

## Agentic Implementation Prompt

> Create a standardized completion protocol used by implementer, planner, reviewer, and continuation agents.
>
> The protocol must require agents to obtain authoritative structured results from TaskForge before reporting completion.
>
> For a code-bearing implementation task, the expected sequence should be conceptually equivalent to:
>
> inspect -> gates -> checkpoint -> submit -> inspect-pr / reconcile -> report authoritative lifecycle state
>
> Exact commands must match the implemented CLI.
>
> Define controlled status language: Implementation Complete, Submitted, In Review, Merge Ready, Done, Blocked.
>
> Prohibit ambiguous substitutions such as "all done," "complete," or "clean" unless the authoritative state and gate evidence justify them.
>
> Ensure prompt changes are generated from a single policy source where possible so role definitions do not drift.

## Acceptance Criteria

1. All implementation-oriented agent prompts include the same completion semantics.
2. Agents must query TaskForge\'s authoritative state before final reporting.
3. Agents cannot treat commit or push success as task completion.
4. Agents report PR identifier and lifecycle state when a PR exists.
5. Agents report exact gate results, including warnings.
6. Agents stop at Merge Ready when human approval is required.
7. Agents report unresolved reconciliation findings.
8. Completion language is generated from structured state where possible.
9. Prompt tests or snapshots prevent policy drift across agent roles.
10. Documentation contains examples of correct and incorrect completion reports.
11. The planner can use read-only TaskForge and todo facilities without confusing NONE permissions with a prohibition on planning-state updates.
12. Prompt guidance points to enforced commands and does not imply that prose rules are the sole guardrail.

## Required Tests

- Prompt snapshots for each role.
- Simulated pushed branch without PR.
- Open conflicting PR.
- Merge Ready.
- Done after merge.
- Gates passing with warnings.
- Planner read-only command use.

## Completion Evidence

- Canonical completion-policy source.
- Updated role prompt examples.
- Example final agent reports for each lifecycle state.

## Dependencies

Depends on TASK-255 (Enforce PR-Backed Terminal Task State), TASK-256 (Make Submission Atomic and Idempotent), TASK-257 (Add Lifecycle Reconciliation and Invalid-State Detection), and TASK-262 (Persist Structured Gate Evidence by Commit SHA).

---

_Source: docs/taskforge-agentic-workflow-hardening-tasks.md_
