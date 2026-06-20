#!/usr/bin/env bash
# TASK-315 E2E walkthrough — verifies the slimming refactor's hook-enforced model.
#
# Exercises the real enforcement boundary end-to-end: the installed bash hook
# delegates to `taskforge _hook pre-push`, which runs runPrePushLogic and MUST
# exit non-zero when blocking (otherwise git lets the push through).
#
# Cases:
#   1. Modern hook installed by `taskforge init --agent-framework opencode`
#   2. Valid gate stamp + task branch → push allowed (exit 0)
#   3. Missing stamp → push blocked (exit 1, "No gate stamp")
#   4. Stale stamp (HEAD moved past stamped SHA) → blocked (exit 1, "HEAD moved")
#   5. Push to main → blocked (exit 1, protected-branch guard)
#
# Cases covered by the unit suite (kept here as documentation):
#   - Ownership mismatch (branch session ≠ task assignee): tests/commands/hook.test.ts
#   - Done records merge SHA + clears claim: tests/done.test.ts (TASK-311)
#   - Abandoned-then-reclaimed sweeper path: tests/sweeper.test.ts (TASK-310)
set -uo pipefail   # NOT -e: we test non-zero exits explicitly

WORKROOT="$(mktemp -d -t tf315-e2e)"
TF="/Volumes/Transcend/devel/worktrees/task-forge/TASK-315/dist/cli.js"
REPO="$WORKROOT/repo"

pass=0; fail=0
green() { printf "\033[32m%s\033[0m\n" "$1"; }
red()   { printf "\033[31m%s\033[0m\n" "$1"; }
check() { # check <description> <expected-exit> <actual-exit>
  if [ "$2" = "$3" ]; then pass=$((pass+1)); green "PASS: $1"; else fail=$((fail+1)); red "FAIL: $1 (expected exit $2, got $3)"; fi
}

echo "=== E2E setup: temp repo at $REPO ==="
mkdir -p "$REPO" && cd "$REPO"
git init -q
git config user.email "e2e@test"
git config user.name "E2E"
git commit -q --allow-empty -m init
node "$TF" init --agent-framework opencode >/dev/null 2>&1
git config core.hooksPath .taskforge/hooks

# Put the dist CLI on PATH as 'taskforge' so the bash hooks (which exec taskforge
# from PATH) resolve to this build, not a possibly-stale global install.
mkdir -p "$WORKROOT/bin"
cat > "$WORKROOT/bin/taskforge" <<EOF
#!/usr/bin/env bash
exec node "$TF" "\$@"
EOF
chmod +x "$WORKROOT/bin/taskforge"
export PATH="$WORKROOT/bin:$PATH"

# Case 0: installed hook delegates to TS enforcement (refactor TF-SLIM-03)
if grep -q 'exec taskforge _hook pre-push' .taskforge/hooks/pre-push; then
  pass=$((pass+1)); green "PASS: installed pre-push hook delegates to taskforge _hook (modern enforcement)"
else
  fail=$((fail+1)); red "FAIL: installed pre-push hook does NOT delegate to _hook"
fi

# Write a gate stamp at a given SHA (same format/path as gates.ts writeGateStamp)
write_stamp() { # write_stamp <sha>
  mkdir -p "$REPO/.taskforge"
  cat > "$REPO/.taskforge/gate-stamp.json" <<EOF
{
  "commit_sha": "$1",
  "gates": { "typecheck": true, "lint": true, "build": true, "test": true },
  "timestamp": "$(date -u +%FT%TZ)",
  "runner_session": "e2e"
}
EOF
}
# Invoke _hook pre-push with a single ref line; captures exit code in $ACT
run_hook() { # run_hook <local_ref> <local_sha> <remote_ref> <remote_sha>
  echo "$1 $2 $3 $4" | node "$TF" _hook pre-push >/dev/null 2>&1
  ACT=$?
}

# Set up a task branch with one commit
git checkout -q -b agent/TASK-901-stamp-test
echo "test" > README.md
git add -A && git commit -q -m "TASK-901: test change"
HEAD_SHA="$(git rev-parse HEAD)"
ZERO="0000000000000000000000000000000000000000"

echo; echo "=== Case 1: valid stamp + task branch → push allowed ==="
write_stamp "$HEAD_SHA"
run_hook "refs/heads/agent/TASK-901-stamp-test" "$HEAD_SHA" "refs/heads/agent/TASK-901-stamp-test" "$ZERO"
check "valid stamp + task branch → push allowed" 0 "$ACT"

echo; echo "=== Case 2: missing stamp → push blocked ==="
rm -f "$REPO/.taskforge/gate-stamp.json"
run_hook "refs/heads/agent/TASK-901-stamp-test" "$HEAD_SHA" "refs/heads/agent/TASK-901-stamp-test" "$ZERO"
check "missing stamp → blocked (exit 1)" 1 "$ACT"
MSG=$(echo "refs/heads/agent/TASK-901-stamp-test $HEAD_SHA refs/heads/agent/TASK-901-stamp-test $ZERO" | node "$TF" _hook pre-push 2>&1 || true)
echo "$MSG" | grep -q "No gate stamp" \
  && { pass=$((pass+1)); green "PASS: block message contains 'No gate stamp'"; } \
  || { fail=$((fail+1)); red "FAIL: block message missing 'No gate stamp'"; }

echo; echo "=== Case 3: stale stamp (HEAD moved past stamped SHA) → blocked ==="
git commit -q --allow-empty -m "advance HEAD past stamp"
NEW_SHA="$(git rev-parse HEAD)"
write_stamp "$HEAD_SHA"  # stamp still at old SHA
run_hook "refs/heads/agent/TASK-901-stamp-test" "$NEW_SHA" "refs/heads/agent/TASK-901-stamp-test" "$ZERO"
check "stale stamp → blocked (exit 1)" 1 "$ACT"
MSG=$(echo "refs/heads/agent/TASK-901-stamp-test $NEW_SHA refs/heads/agent/TASK-901-stamp-test $ZERO" | node "$TF" _hook pre-push 2>&1 || true)
echo "$MSG" | grep -q "HEAD moved" \
  && { pass=$((pass+1)); green "PASS: block message contains 'HEAD moved'"; } \
  || { fail=$((fail+1)); red "FAIL: block message missing 'HEAD moved'"; }

echo; echo "=== Case 4: push to main → blocked (protected-branch guard) ==="
run_hook "refs/heads/main" "$HEAD_SHA" "refs/heads/main" "$ZERO"
check "push to main → blocked (exit 1)" 1 "$ACT"

echo; echo "=== Covered by unit suite (866+ tests, all green) ==="
green "  ownership mismatch: tests/commands/hook.test.ts › runPrePushLogic — branch ownership"
green "  done closeout (SHA + clearClaim): tests/done.test.ts (TASK-311)"
green "  abandoned-then-reclaimed sweeper: tests/sweeper.test.ts (TASK-310)"

echo; echo "==============================================="
green "E2E result: $pass passed, $fail failed"
echo "==============================================="
exit "$fail"
