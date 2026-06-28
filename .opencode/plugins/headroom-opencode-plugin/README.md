# Headroom Savings Monitor for OpenCode

Minimal OpenCode plugin that polls Headroom's local `/stats` endpoint and turns the savings data into a compact status line.

## What it does

- Polls `http://127.0.0.1:8787/stats` every 45 seconds by default.
- Writes a compact one-line status:
  - `.opencode/headroom-status.txt`
  - `.opencode/headroom-status.ansi`
  - `.opencode/headroom-status.json`
- Adds an OpenCode custom tool:
  - `headroom_savings`
- Logs state changes through `client.app.log`.

## Important UI limitation

OpenCode's documented plugin API currently exposes plugin loading, event hooks, custom tools, and some TUI hooks, but it does not document a direct right-panel/status-bar render API.

So this is a working poller/formatter plugin. A true right-hand status panel needs either:

1. an undocumented OpenCode TUI render hook, or
2. a small upstream OpenCode TUI patch that reads `.opencode/headroom-status.json` or calls a plugin-provided status source.

## Install

From your project root:

```bash
cp -R .opencode ./
export HEADROOM_STATS_URL="http://127.0.0.1:8787/stats"
opencode
```

Optional interval:

```bash
export HEADROOM_STATS_INTERVAL_MS=30000
```

## Use inside OpenCode

Ask the agent to run the custom tool:

```text
Use the headroom_savings tool and show the current Headroom savings status.
```

## Use as a tiny side terminal panel

In another terminal pane:

```bash
./bin/watch-headroom-status.sh
```

Example outputs:

```text
HR 0tok 0% $0 OK
HR 14.2k 23% $0.04 OK
HR 0tok 0% $0 404×6 401×5 resp×6
HR offline
```

## Environment variables

| Variable | Default | Meaning |
|---|---:|---|
| `HEADROOM_STATS_URL` | `http://127.0.0.1:8787/stats` | Headroom stats endpoint |
| `HEADROOM_STATS_INTERVAL_MS` | `45000` | Poll interval |
| `HEADROOM_STATS_TIMEOUT_MS` | `1500` | HTTP timeout |
| `HEADROOM_STATUS_DIR` | `<project>/.opencode` | Output directory |
| `HEADROOM_STATUS_FILE` | `.opencode/headroom-status.ansi` | Watcher file |

## Status color levels

| Level | Condition | Color intent |
|---|---|---|
| offline | cannot reach Headroom | red |
| idle | alive, no savings | gray |
| warn | 401/404/`/responses` seen | yellow |
| saving | any savings observed | green |
| high | >=20% or >=10k tokens saved | cyan/bold |
