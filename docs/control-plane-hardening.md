# TaskForge Control-Plane Hardening

## Threat Model

TaskForge CLI guardrails and `.doctor-lock` are **cooperative** — they rely on agents voluntarily using the CLI. An agent with raw filesystem or git access can bypass them. Hard enforcement requires repository permissions, branch protection, or a broker service. See `docs/workflow.md` for the normal and doctor-mode workflow.

### Attack Surface

| Vector | Risk | Mitigation |
|--------|------|------------|
| Direct edit of `task-state/*.md` | High — bypasses all validation | Branch protection, CI validation |
| Raw `git push` to `task-state` | High — bypasses ownership, gates | Restrict push access |
| `rm .doctor-lock` | Medium — ignores recovery pause | Doctor/human only after strict validation; branch protection and CI validation |
| `git push --force` to task-state | Critical — destroys history | Block force pushes |
| Manual `git commit` with invalid state | Medium — corrupts invariants | `validate-state` in CI |

### Trust Boundary

```
Hard enforcement  ←→  Cooperative guardrails
─────────────────────────────────────────
Branch protection       CLI checks (next/start/claim/done)
CI validation           .doctor-lock (file-level)
Credential tiers        Event logging
                        Invariant validator
```

## Credential Tiers

| Tier | Token Scope | Allowed Actions |
|------|-------------|-----------------|
| **read-only agent** | `read:repo` | Read task-state, read main, pull |
| **implementer agent** | `write:worktree` + `read:repo` | Create worktrees, push feature branches, use taskforge CLI |
| **recovery/bot** | `write:task-state` | Push to task-state, create/remove `.doctor-lock` |
| **admin/human** | `admin:repo` | Configure branch protection, manage tokens |

Implementation agents should **never** have direct push access to `task-state`. The CLI mediates all writes through `jitteredPush`/transaction layer, but the token used by the agent must not have `task-state` write permission to enforce this at the remote level.

## GitHub Branch Protection

### `task-state` branch

```yaml
# Recommended GitHub branch protection rules for task-state
protections:
  - require_pull_request: false           # TaskForge uses direct push via CLI
  - required_linear_history: true          # MANDATORY — prevents merge commits
  - allow_force_pushes: false              # MANDATORY — protects history
  - allow_deletions: false                 # MANDATORY — protects data
  - required_status_checks:                # MANDATORY — validates invariants
      - "task-state-validate"
  - restrict_pushes:                       # OPTIONAL — belt-and-suspenders
      - recovery-bot-token                 # Only needed if agent tokens have elevated scopes
      - admin-users
```

Push restrictions are optional. The primary enforcement comes from the CI `task-state-validate` workflow (rejects invalid state regardless of who pushed) and the CLI transaction layer (ownership checks, status transitions, CAS retry). Push restrictions add defense-in-depth for repos where agent tokens accidentally have `write:task-state` scope. See `docs/github-task-state-protection.md` for detailed setup guidance.

### `main` branch

```yaml
protections:
  - require_pull_request: true
  - required_approving_review_count: 1
  - allow_force_pushes: false
```

## CI Validation

Add `.github/workflows/task-state-validate.yml`:

```yaml
name: Task-State Validation
on:
  push:
    branches: [task-state]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: main
          path: main-repo
      - uses: actions/checkout@v4
        with:
          ref: task-state
          path: task-state-data
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: |
          cd main-repo
          npm ci
          npm run build
          node dist/cli.js validate-state --strict --json
        env:
          TASKFORGE_STATE_DIR: ../task-state-data
```

## Emergency Recovery

If branch protection blocks legitimate recovery:

1. Human/admin temporarily disables push restriction on `task-state`
2. Recovery bot creates `.doctor-lock`, fixes state, verifies `taskforge validate-state --strict --json`, then removes lock or completes the recovery task
3. Human/admin re-enables push restriction
4. All agents pull and resume

Never give implementer agents admin tokens. Recovery should be a deliberate, audited action.
