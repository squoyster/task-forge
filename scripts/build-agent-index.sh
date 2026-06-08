#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
AGENT_DIR=".agent"

mkdir -p "$AGENT_DIR"

EXCLUDES=(
  -not -path './.git/*'
  -not -path './node_modules/*'
  -not -path './.opencode/node_modules/*'
  -not -path './Volumes/*'
  -not -path './docs/archive/*'
  -not -name 'session-ses_*.md'
)

write_file_idx() {
  local out="$AGENT_DIR/file.idx"

  {
    echo "FILEIDX.v=1"
    echo "ROOT:$ROOT"
    echo "AVOID:.git,node_modules,.opencode/node_modules,Volumes,docs/archive,session-ses_*.md,specs/session-ses_*.md"
    echo

    find . \
      \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.mjs' -o -name '*.cjs' -o -name '*.json' -o -name '*.md' \) \
      "${EXCLUDES[@]}" \
      -print |
    sed 's#^\./##' |
    sort |
    while read -r f; do
      case "$f" in
        src/commands/*) kind="cmd" ;;
        src/core/*) kind="core" ;;
        src/control/*) kind="control" ;;
        src/services/*) kind="svc" ;;
        src/store/*|src/stores/*) kind="store" ;;
        test/*|tests/*|*.test.ts|*.spec.ts|*.test.js|*.spec.js) kind="test" ;;
        tasks/*) kind="taskdoc" ;;
        docs/*) kind="doc" ;;
        specs/*) kind="spec" ;;
        .agent/*) kind="agentctx" ;;
        *.json) kind="config" ;;
        *) kind="src" ;;
      esac

      owns="$(echo "$f" |
        sed '
          s#^src/##;
          s#^docs/##;
          s#^specs/##;
          s#^tasks/##;
          s#/#,#g;
          s#\.[^.]*$##;
        ' |
        tr '[:upper:]' '[:lower:]')"

      size="$(wc -c < "$f" | tr -d ' ')"
      words="$(wc -w < "$f" 2>/dev/null | tr -d ' ' || echo 0)"
      est_tokens=$(( words * 4 / 3 ))

      echo "F:$f; kind=$kind; owns=$owns; bytes=$size; est_tok=$est_tokens; read=when-relevant"
    done
  } > "$out"

  echo "wrote $out"
}

write_symbol_idx() {
  local out="$AGENT_DIR/symbol.idx"

  {
    echo "SYMBOLIDX.v=1"
    echo "ROOT:$ROOT"
    echo

    find src \
      \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.mjs' -o -name '*.cjs' \) \
      "${EXCLUDES[@]}" \
      -print 2>/dev/null |
    sed 's#^\./##' |
    sort |
    while read -r f; do
      # Exported declarations.
      grep -nE '^[[:space:]]*export[[:space:]]+(async[[:space:]]+)?(function|class|interface|type|const|let|var|enum)[[:space:]]+[A-Za-z0-9_]+' "$f" 2>/dev/null |
      while IFS=: read -r line text; do
        sym="$(echo "$text" | sed -E 's/^[[:space:]]*export[[:space:]]+(async[[:space:]]+)?(function|class|interface|type|const|let|var|enum)[[:space:]]+([A-Za-z0-9_]+).*/\3/')"
        echo "S:$sym; file=$f; line=$line; kind=export; owns=$(basename "$f" | sed 's#\.[^.]*$##')"
      done

      # Common command/action names.
      grep -nE '(Command|command|Action|Handler|Service|Store|Scheduler)' "$f" 2>/dev/null |
      head -20 |
      while IFS=: read -r line text; do
        compact="$(echo "$text" | sed 's/^[[:space:]]*//; s/[[:space:]]\+/ /g' | cut -c1-140)"
        echo "H:$f:$line; hint=$compact"
      done
    done
  } > "$out"

  echo "wrote $out"
}

write_doc_idx() {
  local out="$AGENT_DIR/doc.idx"

  {
    echo "DOCIDX.v=1"
    echo "ROOT:$ROOT"
    echo "RULE: load docs only when use tag matches task"
    echo

    find docs specs tasks \
      -name '*.md' \
      "${EXCLUDES[@]}" \
      -print 2>/dev/null |
    sed 's#^\./##' |
    sort |
    while read -r f; do
      title="$(grep -m1 -E '^# ' "$f" 2>/dev/null | sed 's/^# //' || true)"
      [ -n "$title" ] || title="$(basename "$f")"

      headings="$(grep -E '^#{1,3} ' "$f" 2>/dev/null |
        head -12 |
        sed 's/^#\{1,3\}[[:space:]]*//' |
        paste -sd ',' - |
        cut -c1-240)"

      words="$(wc -w < "$f" 2>/dev/null | tr -d ' ' || echo 0)"
      est_tokens=$(( words * 4 / 3 ))

      case "$f" in
        specs/session-ses_*.md|session-ses_*.md) load="never-default" ;;
        docs/archive/*) load="never-default" ;;
        tasks/TEMPLATE.md) load="when-creating-task" ;;
        tasks/README.md) load="when-task-format-needed" ;;
        docs/architecture/*) load="when-architecture-relevant" ;;
        specs/*) load="when-specifically-relevant" ;;
        *) load="when-relevant" ;;
      esac

      use="$(echo "$f $title $headings" |
        tr '[:upper:]' '[:lower:]' |
        tr ' /_' ',,,' |
        tr -cd 'a-z0-9,.-' |
        cut -c1-220)"

      echo "D:$f; title=$title; est_tok=$est_tokens; use=$use; load=$load"
    done
  } > "$out"

  echo "wrote $out"
}

write_task_idx() {
  local out="$AGENT_DIR/task.idx"

  {
    echo "TASKIDX.v=1"
    echo "ROOT:$ROOT"
    echo

    find tasks \
      -type f \
      \( -name '*.md' -o -name '*.json' -o -name '*.yaml' -o -name '*.yml' \) \
      "${EXCLUDES[@]}" \
      -print 2>/dev/null |
    sed 's#^\./##' |
    sort |
    while read -r f; do
      title="$(grep -m1 -E '^# ' "$f" 2>/dev/null | sed 's/^# //' || true)"
      [ -n "$title" ] || title="$(basename "$f")"

      state="$(grep -im1 -E '^[[:space:]]*(state|status):' "$f" 2>/dev/null | sed 's/^[[:space:]]*//' || true)"
      owner="$(grep -im1 -E '^[[:space:]]*owner:' "$f" 2>/dev/null | sed 's/^[[:space:]]*//' || true)"
      next="$(grep -im1 -E 'next.action|next_action|next action|^[[:space:]]*next:' "$f" 2>/dev/null | sed 's/^[[:space:]]*//' || true)"

      [ -n "$state" ] || state="state:unknown"
      [ -n "$owner" ] || owner="owner:unknown"
      [ -n "$next" ] || next="next:unknown"

      echo "T:$f; title=$title; $state; $owner; $next"
    done
  } > "$out"

  echo "wrote $out"
}

write_flow_idx_if_missing() {
  local out="$AGENT_DIR/flow.idx"

  if [ -f "$out" ]; then
    echo "kept $out"
    return
  fi

  cat > "$out" <<'EOF'
FLOWIDX.v=1

FLOW task-dispatch:
  goal=select-or-create-next-task
  files=.agent/tf.ctx,.agent/file.idx,.agent/task.idx,tasks/README.md,tasks/TEMPLATE.md
  checks=duplicate,blocked,owner,lease,acceptance,next-action

FLOW task-state-machine:
  goal=verify claim/start/complete lifecycle
  files=src/control/TaskService.ts,src/control/TaskStore.ts,docs/architecture/command-state-machine-and-invariants.md
  checks=atomic-claim,owner-only-start,owner-only-complete,expired-lease,retry-idempotency

FLOW command-output:
  goal=stable CLI/agent command output
  files=specs/taskforge-command-return-template.md,docs/architecture/command-return-contract.md
  checks=status,error-shape,next-action,json-stability

FLOW repo-index:
  goal=route agent to minimal files
  files=.agent/file.idx,.agent/symbol.idx,.agent/doc.idx,.agent/task.idx
  checks=no-large-md,no-node_modules,no-session-md
EOF

  echo "wrote $out"
}

apply_overrides() {
  local overrides="$AGENT_DIR/index.overrides"
  [ -f "$overrides" ] || return 0

  {
    echo
    echo "# OVERRIDES"
    cat "$overrides"
  } >> "$AGENT_DIR/file.idx"

  echo "applied $overrides -> .agent/file.idx"
}

write_file_idx
write_symbol_idx
write_doc_idx
write_task_idx
write_flow_idx_if_missing
apply_overrides

echo "done"
