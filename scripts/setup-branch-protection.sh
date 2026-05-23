#!/usr/bin/env bash
set -euo pipefail

OWNER="${1:-}"
REPO="${2:-}"
DRY_RUN="${DRY_RUN:-false}"

green()  { printf '\033[32m%s\033[0m\n' "$1"; }
yellow() { printf '\033[33m%s\033[0m\n' "$1"; }
red()    { printf '\033[31m%s\033[0m\n' "$1" >&2; }

usage() {
    echo "Usage: $0 <owner> <repo>"
    echo "  owner    GitHub user or org (e.g., squoyster)"
    echo "  repo     GitHub repo name (e.g., task-forge)"
    echo ""
    echo "Environment:"
    echo "  GITHUB_TOKEN   Required — GitHub PAT with admin:repo scope"
    echo "  DRY_RUN=true   Preview commands without applying"
    exit 1
}

if [ -z "$OWNER" ] || [ -z "$REPO" ]; then
    usage
fi

require_gh() {
    if ! command -v gh >/dev/null 2>&1; then
        red "Error: GitHub CLI (gh) is required. Install: https://cli.github.com/"
        exit 1
    fi
    if ! gh auth status >/dev/null 2>&1; then
        red "Error: gh is not authenticated. Run: gh auth login"
        exit 1
    fi
    if [ -z "${GITHUB_TOKEN:-}" ]; then
        export GITHUB_TOKEN="$(gh auth token 2>/dev/null || echo "")"
        if [ -z "$GITHUB_TOKEN" ]; then
            red "Error: GITHUB_TOKEN not set and gh auth token failed."
            exit 1
        fi
    fi
}

config_main() {
    green "Configuring main branch protection for $OWNER/$REPO..."
    if [ "$DRY_RUN" = "true" ]; then
        echo "[dry-run] PUT repos/$OWNER/$REPO/branches/main/protection"
        return 0
    fi
    gh api "repos/$OWNER/$REPO/branches/main/protection" \
        -X PUT \
        --input - <<'JSON'
{
  "required_status_checks": null,
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "lock_branch": false
}
JSON
}

config_task_state() {
    green "Configuring task-state branch protection for $OWNER/$REPO..."
    if [ "$DRY_RUN" = "true" ]; then
        echo "[dry-run] PUT repos/$OWNER/$REPO/branches/task-state/protection"
        return 0
    fi
    gh api "repos/$OWNER/$REPO/branches/task-state/protection" \
        -X PUT \
        --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["task-state-validate"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "lock_branch": false
}
JSON
}

verify_protection() {
    local branch="$1"
    if [ "$DRY_RUN" = "true" ]; then
        echo "[dry-run] Verify protection for $branch"
        return 0
    fi

    local result
    result=$(gh api "repos/$OWNER/$REPO/branches/$branch/protection" -q '.url' 2>/dev/null || echo "")
    if [ -n "$result" ]; then
        green "  $branch: protected"
    else
        yellow "  $branch: not protected (may need admin access to view)"
    fi
}

require_gh

echo ""
green "TaskForge Branch Protection Setup"
yellow "Repository: $OWNER/$REPO"
echo ""

config_main
config_task_state

echo ""
green "Verifying protection..."
verify_protection "main"
verify_protection "task-state"

echo ""
green "Setup complete."
echo ""
echo "Push restrictions (who can push) are optional — CI validation and the"
echo "CLI transaction layer already enforce state integrity. Configure push"
echo "restrictions only if agent tokens have elevated scopes:"
echo "  Repository → Settings → Branches → task-state → Restrict who can push"
echo "  Add recovery bot and repository admins only. (Requires Team/Enterprise plan.)"
echo ""
