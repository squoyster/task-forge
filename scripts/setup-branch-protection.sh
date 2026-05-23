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

if [ -z "${GITHUB_TOKEN:-}" ]; then
    red "Error: GITHUB_TOKEN environment variable is required."
    red "Create a PAT at https://github.com/settings/tokens with admin:repo scope."
    exit 1
fi

gh_cmd() {
    if [ "$DRY_RUN" = "true" ]; then
        echo "[dry-run] gh api $*"
        return 0
    fi
    gh api "$@" 2>/dev/null
}

require_gh() {
    if ! command -v gh >/dev/null 2>&1; then
        red "Error: GitHub CLI (gh) is required. Install: https://cli.github.com/"
        exit 1
    fi
    if ! gh auth status >/dev/null 2>&1; then
        red "Error: gh is not authenticated. Run: gh auth login"
        exit 1
    fi
}

config_main() {
    green "Configuring main branch protection for $OWNER/$REPO..."
    gh_cmd "repos/$OWNER/$REPO/branches/main/protection" \
        -X PUT \
        -F required_status_checks='{"strict":true,"contexts":[]}' \
        -F enforce_admins=false \
        -F required_pull_request_reviews='{"dismiss_stale_reviews":true,"require_code_owner_reviews":false,"required_approving_review_count":1}' \
        -F restrictions=null \
        -F required_linear_history=true \
        -F allow_force_pushes=false \
        -F allow_deletions=false \
        -F lock_branch=false
}

config_task_state() {
    green "Configuring task-state branch protection for $OWNER/$REPO..."

    gh_cmd "repos/$OWNER/$REPO/branches/task-state/protection" \
        -X PUT \
        -F required_status_checks='{"strict":true,"contexts":["task-state-validate"]}' \
        -F enforce_admins=false \
        -F required_pull_request_reviews=null \
        -F restrictions=null \
        -F required_linear_history=true \
        -F allow_force_pushes=false \
        -F allow_deletions=false \
        -F lock_branch=false
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
echo "Note: Push restrictions (who can push) should be configured manually in GitHub UI:"
echo "  Repository → Settings → Branches → task-state → Restrict who can push"
echo "  Add recovery bot and repository admins only."
echo ""
