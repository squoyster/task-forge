---
id: TASK-227
type: Documentation
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-227: Update AGENTS.md with control-plane directive and mandatory startup sequence

## Goal

## Goal

Update AGENTS.md to enforce TaskForge as the mandatory control plane for all agent operations, including the master agent directive from the spec.

## Context

Per `taskforge-control-plane-closure-spec.md` §2, §8, and §10.

## Current State

AGENTS.md already has:
- Rule 7: "Use taskforge CLI for task creation and workflow management"
- Git operations matrix
- Doctor mode protocol
- Development workflow

But it is missing:
- Mandatory startup sequence
- Explicit forbidden raw git commands list
- Force restriction directive
- Unknown state closure rule
- End-of-work sequence
- Master agent directive section

## Required Additions

### 1. Mandatory Startup Sequence
```bash
taskforge doctor --json
taskforge validate-state --json
taskforge next --json
```

### 2. Forbidden Raw Git Commands
```bash
git checkout
git switch
git worktree add
git commit
git push
gh pr create
```
Use TaskForge equivalents instead.

### 3. Force Restriction
Never use `--force`. If force appears necessary:
```bash
taskforge doctor --json
taskforge block TASK-ID "Force operation requires human or doctor-mode authorization" --category unsafe_operation --blocked-by human
```

### 4. Unknown State Rule
If TaskForge does not provide a valid next action:
```bash
taskforge new "Handle unclosed TaskForge state: <summary>" --type Bug --priority P1 --status Ready --body "<details>"
```

### 5. End-of-Work Sequence
```bash
taskforge diff TASK-ID
taskforge gates
taskforge checkpoint TASK-ID -m "..."
taskforge submit TASK-ID
taskforge pr TASK-ID
taskforge report TASK-ID --complete
taskforge done TASK-ID
```

## Acceptance Criteria

- [ ] AGENTS.md includes mandatory startup sequence section
- [ ] AGENTS.md includes forbidden raw git commands list
- [ ] AGENTS.md includes force restriction directive
- [ ] AGENTS.md includes unknown state closure rule
- [ ] AGENTS.md includes end-of-work sequence
- [ ] AGENTS.md includes master agent directive section
- [ ] Existing rules updated to reference new authority model
- [ ] No recommendations for raw git bypass remain in AGENTS.md
- [ ] CLI/docs consistency test (TASK-225) passes against updated AGENTS.md

## Acceptance Criteria

- [ ]

## Agent Notes
