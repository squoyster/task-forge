#!/usr/bin/env bash
set -euo pipefail
STATUS_FILE="${HEADROOM_STATUS_FILE:-.opencode/headroom-status.ansi}"
INTERVAL="${HEADROOM_STATUS_WATCH_INTERVAL:-2}"
while true; do
  printf '\033[2J\033[H'
  if [[ -f "$STATUS_FILE" ]]; then
    cat "$STATUS_FILE"
  else
    echo "HR waiting for plugin sample..."
  fi
  sleep "$INTERVAL"
done
