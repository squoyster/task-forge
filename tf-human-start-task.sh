#!/usr/bin/env bash
set -euo pipefail

# tf-human-start-task.sh
#
# Temporary HUMAN-ONLY recovery helper.
#
# Purpose:
#   Put a TaskForge task into started/In Progress state so an agent can process it
#   when the normal `taskforge start TASK-ID` path is blocked by the current
#   claim/start self-deadlock bug.
#
# Authority:
#   Human override only. Do not give this script to normal agents as an allowed path.
#
# Usage:
#   ./tf-human-start-task.sh TASK-123
#   ./tf-human-start-task.sh TASK-123 --no-worktree
#   ./tf-human-start-task.sh TASK-123 --push
#
# Behavior:
#   - Finds ../task-state/<TASK-ID>.md
#   - Sets frontmatter:
#       status: In Progress
#       assignee: <generated 10-char hex session>
#       claimed_at: <UTC timestamp>
#       branch: agent/<TASK-ID>-manual-start--<session>
#       worktree: ../worktrees/<repo-name>/<TASK-ID>   unless --no-worktree
#   - Creates worktree/branch unless --no-worktree
#   - Commits task-state change
#   - Pushes task-state only if --push is specified
#   - Prints agent handoff commands
#
# Assumptions:
#   - Run from the main TaskForge repo root.
#   - Task-state worktree exists at ../task-state.
#   - Task file uses YAML frontmatter delimited by ---.
#   - Python 3 is available.

TASK_ID="${1:-}"
if [[ -z "$TASK_ID" || "$TASK_ID" == "-h" || "$TASK_ID" == "--help" ]]; then
  sed -n '1,60p' "$0"
  exit 0
fi
shift || true

CREATE_WORKTREE=1
PUSH_STATE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-worktree)
      CREATE_WORKTREE=0
      shift
      ;;
    --push)
      PUSH_STATE=1
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

REPO_ROOT="$(git rev-parse --show-toplevel)"
REPO_NAME="$(basename "$REPO_ROOT")"
TASK_STATE_DIR="$(cd "$REPO_ROOT/../task-state" 2>/dev/null && pwd || true)"

if [[ -z "$TASK_STATE_DIR" || ! -d "$TASK_STATE_DIR/.git" ]]; then
  echo "ERROR: ../task-state is missing or is not a git worktree." >&2
  echo "Run: taskforge init" >&2
  exit 1
fi

TASK_FILE="$TASK_STATE_DIR/${TASK_ID}.md"
if [[ ! -f "$TASK_FILE" ]]; then
  echo "ERROR: Task file not found: $TASK_FILE" >&2
  echo "Known matching files:" >&2
  find "$TASK_STATE_DIR" -maxdepth 1 -type f -name "*${TASK_ID}*.md" -print >&2 || true
  exit 1
fi

SESSION_ID="$(python3 - <<'PY'
import secrets
print(secrets.token_hex(5))
PY
)"
CLAIMED_AT="$(date -u '+%Y-%m-%d %H:%M:%S')"
BRANCH="agent/${TASK_ID}-manual-start--${SESSION_ID}"
WORKTREE_PATH="$REPO_ROOT/../worktrees/${REPO_NAME}/${TASK_ID}"

echo "Human override starting task:"
echo "  task:       $TASK_ID"
echo "  session:    $SESSION_ID"
echo "  branch:     $BRANCH"
echo "  worktree:   $WORKTREE_PATH"
echo "  task file:  $TASK_FILE"
echo

python3 - "$TASK_FILE" "$TASK_ID" "$SESSION_ID" "$CLAIMED_AT" "$BRANCH" "$WORKTREE_PATH" "$CREATE_WORKTREE" <<'PY'
from pathlib import Path
import sys
import re

task_file = Path(sys.argv[1])
task_id = sys.argv[2]
session_id = sys.argv[3]
claimed_at = sys.argv[4]
branch = sys.argv[5]
worktree = sys.argv[6]
create_worktree = sys.argv[7] == "1"

text = task_file.read_text(encoding="utf-8")

if not text.startswith("---\n"):
    raise SystemExit(f"ERROR: {task_file} does not start with YAML frontmatter delimiter ---")

parts = text.split("---", 2)
if len(parts) < 3:
    raise SystemExit(f"ERROR: {task_file} does not contain closing YAML frontmatter delimiter ---")

prefix = parts[0]          # empty
frontmatter = parts[1].strip("\n")
body = parts[2].lstrip("\n")

updates = {
    "status": "In Progress",
    "assignee": session_id,
    "claimed_at": claimed_at,
    "branch": branch,
}
if create_worktree:
    updates["worktree"] = worktree

def set_yaml_scalar(fm: str, key: str, value: str) -> str:
    # Simple scalar updater for top-level YAML keys.
    # Quotes values containing colon/hash-sensitive chars.
    quoted = '"' + value.replace('"', '\\"') + '"'
    line = f"{key}: {quoted}"
    pattern = re.compile(rf"^{re.escape(key)}\s*:.*$", re.MULTILINE)
    if pattern.search(fm):
        return pattern.sub(line, fm)
    if fm.strip():
        return fm.rstrip() + "\n" + line
    return line

for k, v in updates.items():
    frontmatter = set_yaml_scalar(frontmatter, k, v)

note = f"""
## Agent Notes

### {claimed_at.split()[0]} — Human Override

- Human override used temporary start helper.
- Status set to In Progress.
- Session: `{session_id}`
- Branch: `{branch}`
"""
if create_worktree:
    note += f"- Worktree: `{worktree}`\n"

if "## Agent Notes" in body:
    body = body.rstrip() + "\n\n" + f"### {claimed_at.split()[0]} — Human Override\n\n" + \
        f"- Human override used temporary start helper.\n- Status set to In Progress.\n- Session: `{session_id}`\n- Branch: `{branch}`\n"
    if create_worktree:
        body += f"- Worktree: `{worktree}`\n"
else:
    body = body.rstrip() + "\n\n" + note

task_file.write_text(f"---\n{frontmatter}\n---\n\n{body.rstrip()}\n", encoding="utf-8")
PY

if [[ "$CREATE_WORKTREE" -eq 1 ]]; then
  mkdir -p "$(dirname "$WORKTREE_PATH")"

  if [[ -d "$WORKTREE_PATH/.git" || -f "$WORKTREE_PATH/.git" ]]; then
    echo "Worktree already exists: $WORKTREE_PATH"
  else
    echo "Creating worktree..."
    git -C "$REPO_ROOT" worktree add -b "$BRANCH" "$WORKTREE_PATH"
  fi
else
  echo "Skipping worktree creation due to --no-worktree"
fi

echo
echo "Committing task-state update..."
git -C "$TASK_STATE_DIR" add "$(basename "$TASK_FILE")"
if git -C "$TASK_STATE_DIR" diff --cached --quiet; then
  echo "No task-state changes to commit."
else
  git -C "$TASK_STATE_DIR" commit -m "chore: human override start ${TASK_ID}"
fi

if [[ "$PUSH_STATE" -eq 1 ]]; then
  echo "Pushing task-state..."
  git -C "$TASK_STATE_DIR" push origin task-state
else
  echo "Not pushing task-state. Use --push if this must propagate immediately."
fi

echo
echo "AGENT HANDOFF"
echo "============="
echo "Command status: success"
echo "Task: $TASK_ID"
echo "Session: $SESSION_ID"
echo
echo "Valid next commands for the agent:"
if [[ "$CREATE_WORKTREE" -eq 1 ]]; then
  echo "  cd \"$WORKTREE_PATH\""
  echo "  taskforge prompt \"$TASK_ID\""
  echo "  taskforge inspect \"$TASK_ID\""
  echo "  taskforge heartbeat \"$TASK_ID\""
else
  echo "  taskforge inspect \"$TASK_ID\""
  echo "  taskforge doctor --json"
fi
echo
echo "Forbidden for normal agents:"
echo "  taskforge start \"$TASK_ID\" --force"
echo "  taskforge unlock \"$TASK_ID\" --force"
echo "  raw git checkout/branch/push/merge/worktree operations"
echo
echo "Context cleanup instruction:"
echo "  Start a fresh agent context for this task. Preserve only relevant prior context"
echo "  by converting it into explicit todo items in the task before continuing."
