# GitHub Task-State Branch Protection

## Why This Matters

TaskForge CLI guardrails and `.doctor-lock` are **cooperative** — they rely on agents voluntarily using the CLI. An agent with raw git push access to `task-state` can bypass all validation, ownership checks, and sweep protocols.

Branch protection provides **hard enforcement** — GitHub refuses pushes that violate the rules regardless of what the agent's CLI tries to do.

## Prerequisites

- GitHub repository admin access
- The `task-state` branch must already exist (created by `taskforge init`)
- CI workflow `task-state-validate` must pass on `main` before enabling required checks

## Step-by-Step: Protecting `task-state`

### 1. Navigate to Branch Protection

```
Repository → Settings → Branches → Add branch protection rule
```

Enter `task-state` as the branch name pattern.

### 2. Configure Protection Rules

| Setting | Value | Why |
|---------|-------|-----|
| **Require a pull request before merging** | ❌ Off | TaskForge writes to task-state via transaction layer, not PRs |
| **Require linear history** | ✅ On | Prevents merge commits that could hide conflicting changes |
| **Allow force pushes** | ❌ Off | Force push to task-state destroys history and sweep audit trails |
| **Allow deletions** | ❌ Off | Deleting task-state loses all task data |
| **Restrict who can push to matching branches** | ✅ On | Only recovery bots and admins should push directly |

### 3. Configure Push Restrictions

Add only these entities:

| Who | Why |
|-----|-----|
| **Recovery bot GitHub App** or PAT | Runs `taskforge doctor --fix`, sweep recovery |
| **Repository admins** | Emergency recovery when bot is unavailable |

**Do NOT add** implementer agents, CI system accounts, or team-wide access.

### 4. Require Status Checks

Enable **"Require status checks to pass before merging"** (even though PRs aren't required — this validates the direct push):

| Check | Required? |
|-------|-----------|
| `task-state-validate` | ✅ Required |

This runs `taskforge validate-state --strict` which checks:
- No duplicate task IDs
- No impossible state combinations (Done+assignee, Ready+assignee)
- Valid branch patterns
- No broken `dependsOn` references
- No circular dependencies
- No null `dependsOn` values

### 5. Save

Click **"Create"** or **"Save changes"**. The protection takes effect immediately.

## Verifying Protection

```bash
# This should FAIL for an implementer agent:
git push origin task-state
# → remote: error: GH006: Protected branch update failed

# This should PASS if you're in the push restriction list:
git push origin task-state
# → Everything up-to-date
```

## Protecting `main`

Also protect the `main` branch:

| Setting | Value |
|---------|-------|
| Require pull request | ✅ On |
| Require approvals | 1 |
| Dismiss stale reviews | ✅ On |
| Allow force pushes | ❌ Off |
| Require linear history | ✅ On |

## Credential Tiers

See `docs/control-plane-hardening.md` for the full threat model. In summary:

| Tier | Token Scope | Task-State Push |
|------|-------------|-----------------|
| **read-only agent** | `read:repo` | ❌ Denied by token scope |
| **implementer agent** | `write:worktree` + `read:repo` | ❌ Denied by branch protection |
| **recovery bot** | `write:task-state` | ✅ Allowed (in push restriction list) |
| **admin/human** | `admin:repo` | ✅ Allowed (in push restriction list) |

## Emergency Recovery

If the `task-state` branch is corrupted and needs manual repair:

1. Admin temporarily disables the push restriction on `task-state`
2. Recovery bot or admin pushes the fix (creates `.doctor-lock`, repairs state, removes lock)
3. Admin re-enables the push restriction
4. All agents `git pull` in `../task-state/` to get the repaired state

Never give implementer agent tokens admin access. Recovery is a deliberate, audited action — not an automated fallback.

## CI Integration

The `task-state-validate` workflow (`.github/workflows/task-state-validate.yml`) runs on every push to `task-state`:

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
        with: { ref: main, path: main-repo }
      - uses: actions/checkout@v4
        with: { ref: task-state, path: task-state-data }
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: cd main-repo && npm ci && npm run build
      - run: cd main-repo && node dist/cli.js validate-state --strict --json
```

If this check fails, the push is rejected — even for users in the push restriction list.

## Related Documentation

- `docs/control-plane-hardening.md` — Threat model, attack surface, trust boundaries
- `TASKFORGE.md` § Control-Plane Architecture — Transaction layer, session guardrails
- `AGENTS.md` § Agent Discipline — No direct git manipulation on task-state

## Automation

An automation script is available for CI or `taskforge init` integration:

```bash
export GITHUB_TOKEN="ghp_..."      # PAT with admin:repo scope
./scripts/setup-branch-protection.sh squoyster task-forge
```

Dry-run to preview without applying:
```bash
DRY_RUN=true ./scripts/setup-branch-protection.sh squoyster task-forge
```

The script configures protection for both `main` and `task-state` branches. Push restrictions (who can push) must still be configured manually or via additional `gh api` calls targeting the specific bot token ID.
