# TaskForge Container Runtime Deployment

## Overview

TaskForge uses a **container-first** deployment model for packaged/runtime deployments. For local worktrees, the documented launcher is source-first and runs directly from `src/` unless you explicitly opt into a built `dist/` bundle. Published packages build `dist/` during `npm pack`/publish via `prepack`.

This deployment guide is secondary to the live CLI and `docs/workflow.md` for command workflow.

## Architecture

```
Host                             Container
────                             ────────
taskforge launcher ──docker──▶  taskforge CLI
  (thin shell wrapper)           Node.js 22
                                 npm / git / rg / jq
                                 OpenCode (optional)
```

The launcher mounts the project parent directory so TaskForge can manage sibling directories:

```
/host/project/        → /workspace/project
/host/task-state/     → /workspace/task-state
/host/worktrees/      → /workspace/worktrees
```

## One-Time System Setup

### Prerequisites

- Docker or Podman
- Git (for cloning)
- Optional: SSH agent for git remotes
- Optional: GitHub token for GitHub API operations

### Install the Launcher

Use the repo-local launcher for source-first worktree execution:

```bash
./scripts/taskforge doctor --check
```

To force a built bundle instead of source, set `TASKFORGE_RUNTIME=dist`.

### Verify

```bash
taskforge doctor --check
```

## Per-Project Setup

```bash
cd /path/to/existing/git/project

taskforge init \
  --agent-framework opencode \
  --policy managed \
  --install-hooks \
  --audit

taskforge doctor --check
```

## Agent Workflow

```bash
taskforge next
taskforge start TASK-123
# agent works in generated worktree
taskforge gates --json
git add -A && git commit --message "Implement scoped change"
git push -u origin <branch>
taskforge done TASK-123
```

For `In Progress`, `Review`, or `Verify` tasks returned by `taskforge next --json`, use `taskforge resume TASK-123` instead of `taskforge start TASK-123`.

## Native Execution (Alternative)

For development or environments where containers are impractical, run the repo-local launcher directly from the checkout:

```bash
./scripts/taskforge init
```

This uses `tsx src/cli.ts` by default and does not depend on committed `dist/` files.

## Credential Configuration

### SSH Agent Forwarding

The launcher forwards `$SSH_AUTH_SOCK` automatically when present.

### GitHub Token

Set `GITHUB_TOKEN` in the host environment; the launcher passes it to the container.

### Git Config

Host `~/.gitconfig` is mounted read-only if it exists.

## Platform Notes

### macOS

- Docker Desktop or OrbStack required.
- `/tmp` and `/var/folders` must be shared in Docker settings.
- `~/.gitconfig` must be readable by the container user.

### Linux

- Docker or Podman both supported.
- UID/GID mapping: files created in the container are owned by the container's `taskforge` user.
- Use `--userns=keep` or podman's native rootless mode to match host UID.

### Windows / WSL2

- Run from WSL2 Linux environment.
- Docker Desktop with WSL2 backend recommended.
- Avoid paths under `/mnt/c/` — run from the WSL2 filesystem for performance.

## Known Limitations

- Container mode has ~200ms startup overhead per command.
- File ownership may differ between host and container on Linux.
- Docker socket is not mounted (intentional — no container-in-container).
- OpenCode runs on the host and calls the launcher; it does not run inside the container (MVP).

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `taskforge: command not found` | Launcher not installed | Run install script or copy manually |
| `Cannot connect to Docker` | Docker not running | Start Docker/Podman |
| `Permission denied` | Docker socket access | Add user to `docker` group |
| `Not a git repository` | Not in a git project | `cd` into a git checkout |
| `../task-state not found` | Not initialized | Run `taskforge init` |
| Files owned by wrong user | UID mismatch | Use podman rootless or adjust `--user` |
| SSH git push fails | SSH agent not forwarded | Ensure `$SSH_AUTH_SOCK` is set |
