# TaskForge Containerized Deployment — Gap Analysis and Implementation Tasks

## Context

TaskForge needs a boring, repeatable installation path for humans and agents.

The target outcome:

1. A developer can install one launcher or container image.
2. From any existing git project, the developer can run:

   ```bash
   taskforge init
   ```

3. The project is converted into a TaskForge-managed project.
4. Future agent execution happens with known tools, known versions, predictable filesystem layout, and enforceable policy.
5. The runtime remains compatible with OpenCode by default but is not locked to OpenCode.

## Architectural recommendation

Use a **container-first TaskForge runtime**, with a thin host launcher.

The container should include:

- TaskForge CLI
- Node.js runtime
- npm
- git
- GitHub CLI, optional but useful
- OpenCode, optional/default profile
- shell utilities used by agents and hooks
- ripgrep
- jq
- yq
- Python for small helper tooling if needed
- test/build tools required by TaskForge itself

The host should only need:

- Docker or Podman
- a working git checkout
- optional SSH agent or GitHub token for remote operations
- optional OpenCode host install if the user prefers host-side agents

The launcher should mount the current project and its parent directory so TaskForge can create sibling directories:

```text
/host/path/project/        -> /workspace/project
/host/path/task-state/     -> /workspace/task-state
/host/path/worktrees/      -> /workspace/worktrees
```

This preserves the current TaskForge layout model:

```text
project/
../task-state/
../worktrees/
```

## Recommended user-facing procedure

### One-time system setup

```bash
# install launcher
curl -fsSL https://example.invalid/taskforge/install.sh | sh

# verify runtime
taskforge doctor system
```

### Per-project setup

```bash
cd /path/to/existing/git/project

taskforge init \
  --agent-framework opencode \
  --policy managed \
  --install-hooks \
  --audit

taskforge doctor project
```

### Agent workflow

```bash
taskforge next
taskforge start TASK-123
# agent works in generated worktree
taskforge checkpoint TASK-123 --message "Implement scoped change"
taskforge submit TASK-123
taskforge done TASK-123
```

## Container runtime model

### Preferred command shape

The host launcher should translate:

```bash
taskforge <args>
```

into something like:

```bash
docker run --rm -it \
  --name taskforge-runtime \
  -v "$PROJECT_PARENT:/workspace" \
  -v "$HOME/.gitconfig:/home/taskforge/.gitconfig:ro" \
  -v "$SSH_AUTH_SOCK:/ssh-agent" \
  -e SSH_AUTH_SOCK=/ssh-agent \
  -e GITHUB_TOKEN \
  -w "/workspace/$PROJECT_BASENAME" \
  ghcr.io/squoyster/taskforge:<version> \
  taskforge "$@"
```

The actual launcher must handle spaces in paths, missing SSH agent, GitHub HTTPS credentials, macOS Docker path sharing, Linux UID/GID mapping, and Podman compatibility.

## Gap analysis

### Current likely state

TaskForge has a CLI, task-state branch/worktree model, agent worktree model, and a defined future direction for OpenCode policy, hooks, doctor mode, and audit.

### Missing capability

| Gap | Impact | Required fix |
|---|---:|---|
| No canonical deployment procedure | Users and agents will install inconsistently | Add container-first install/run docs and commands |
| No published runtime image | Cannot guarantee tool versions | Add Dockerfile/Containerfile and release workflow |
| No host launcher | Container usage will be too verbose/error-prone | Add `taskforge` launcher that wraps container execution |
| No system doctor | Hard to diagnose missing Docker, path mounts, git identity, SSH, token access | Add `taskforge doctor system` |
| No project doctor | Hard to verify that init produced a usable TaskForge project | Add `taskforge doctor project` |
| No runtime manifest | Agents cannot know what tools are allowed or installed | Add runtime manifest and validation |
| No volume/path abstraction | Containerized sibling worktrees can break across host/container paths | Add canonical path mapping logic |
| No credential strategy | Git push/PR operations will fail unpredictably | Support SSH agent, GitHub token, and read-only config mounts |
| No OpenCode runtime strategy | Unclear whether OpenCode runs on host or in container | Support both, document default |
| No reproducible release channel | Users cannot pin TaskForge runtime versions | Publish versioned container tags and checksums |
| No bootstrap command for project conversion | `taskforge init` may not fully convert arbitrary repos | Add init validation and repair |

## Design decisions

### Decision 1: Container-first, not container-only

TaskForge should support native execution for developers who want it, but the documented reliable path should be container-first.

Reason: agentic workflows need predictable tool semantics more than they need host-native convenience.

### Decision 2: Mount the project parent, not just the project

Mounting only the project directory is insufficient because TaskForge intentionally creates sibling directories:

```text
../task-state
../worktrees
```

The launcher should detect the git project root, mount its parent, and set the working directory to the project inside the container.

### Decision 3: OpenCode integration is an adapter, not the runtime itself

TaskForge should be able to generate OpenCode config, agents, hooks, and plugins, but the TaskForge runtime should not require OpenCode for human CLI usage.

### Decision 4: Runtime image should be minimal but complete

Do not build a giant general-purpose dev image. Include TaskForge and generic coordination tools. Let per-project build/test dependencies remain project-specific.

For projects that need extra tools, support:

```bash
taskforge runtime extend
```

or project-local runtime overlays later.

---

# TASK-077: Add container-first deployment architecture documentation

## Type

Documentation

## Priority

P1

## Agent Role

Documentation Agent

## Risk Level

Low

## Goal

Document the canonical procedure for deploying TaskForge on a system and converting an existing git project into a TaskForge-managed project.

## Requirements

Add documentation under:

```text
docs/deployment/container-runtime.md
```

Update:

```text
README.md
TASKFORGE.md
```

The documentation must cover:

- One-time system setup.
- Per-project `taskforge init` flow.
- Container-first runtime model.
- Native execution as a secondary path.
- Required host dependencies.
- Required git credentials.
- SSH agent forwarding.
- GitHub token usage.
- Parent-directory volume mount rationale.
- OpenCode host-side vs container-side execution models.
- Known limitations on macOS, Linux, and Windows/WSL.

## Acceptance Criteria

- A new user can follow the documented procedure from an existing git repo.
- The docs explicitly say the reliable path is container-first.
- The docs explain why the project parent directory must be mounted.
- The docs do not assume OpenCode is required for human CLI usage.
- The docs include a minimal happy path and a troubleshooting section.

---

# TASK-078: Add TaskForge runtime Dockerfile and Containerfile

## Type

Infrastructure

## Priority

P1

## Agent Role

Infrastructure Agent

## Risk Level

Medium

## Goal

Create a reproducible container image that provides the default TaskForge runtime environment.

## Files

Add:

```text
Dockerfile
Containerfile
.dockerignore
docs/deployment/runtime-image.md
```

## Runtime contents

The image must include:

- Node.js 22 or current project-supported LTS.
- npm.
- TaskForge CLI.
- git.
- openssh-client.
- ca-certificates.
- bash.
- ripgrep.
- jq.
- yq or equivalent YAML utility.
- GitHub CLI if feasible.
- OpenCode if feasible, or document why it is excluded.

## Image user

Run as a non-root user by default:

```text
taskforge
```

Support UID/GID override if feasible.

## Entrypoint

Default entrypoint should allow:

```bash
docker run ... taskforge <args>
```

## Acceptance Criteria

- `docker build .` succeeds.
- `docker run --rm <image> taskforge --version` succeeds.
- Image runs as non-root by default.
- Image includes `git`, `node`, `npm`, `rg`, and `jq`.
- Documentation lists all bundled tools and versions.
- CI builds the image.

---

# TASK-079: Add host launcher for containerized TaskForge execution

## Type

Feature

## Priority

P1

## Agent Role

Implementer Agent

## Risk Level

High

## Goal

Provide a host-side launcher that makes containerized TaskForge feel like a normal CLI.

## Command

The user should run:

```bash
taskforge <args>
```

The launcher should invoke the container runtime automatically when configured for container mode.

## Requirements

Implement a launcher script or binary under:

```text
scripts/taskforge-container
scripts/install-taskforge-launcher
```

The launcher must:

- Detect the current git project root.
- Mount the project parent directory into `/workspace`.
- Set container working directory to `/workspace/<project-name>`.
- Preserve relative TaskForge sibling paths.
- Mount git config read-only where safe.
- Forward SSH agent if present.
- Pass `GITHUB_TOKEN` if present.
- Support Docker.
- Support Podman if feasible.
- Fail clearly if not inside a git repo for project-scoped commands.
- Allow non-project commands such as `taskforge --version` and `taskforge doctor system`.

## Edge cases

Handle:

- Spaces in paths.
- Symlinked project directories.
- Missing SSH agent.
- Missing Docker/Podman.
- macOS Docker file-sharing limitations.
- Linux UID/GID file ownership.
- Existing `../task-state` and `../worktrees` directories.

## Acceptance Criteria

- From an existing git repo, `taskforge init` works through the launcher.
- Generated files are owned by the invoking host user where feasible.
- `taskforge doctor system` reports container runtime status.
- The launcher has unit or shell tests for path mapping.
- Failure messages are actionable.

---

# TASK-080: Add system doctor checks for deployment readiness

## Type

Feature

## Priority

P1

## Agent Role

Doctor Agent

## Risk Level

Medium

## Goal

Add diagnostics that validate whether the host can run TaskForge reliably.

## Command

```bash
taskforge doctor system
```

## Checks

Validate:

- Container runtime available: Docker or Podman.
- Runtime image available or pullable.
- Current user can run containers.
- Current directory is inside a git repo when required.
- Git is available inside the runtime.
- Node/npm are available inside the runtime.
- Git user.name and user.email are configured or intentionally absent.
- SSH agent is reachable if using SSH remotes.
- GitHub token is available if GitHub integration is enabled.
- Project parent directory can be mounted.
- Files created in container have acceptable ownership.

## Output

Support:

```bash
taskforge doctor system
taskforge doctor system --json
taskforge doctor system --fix
```

`--fix` may repair only safe items, such as creating local directories or writing TaskForge config. It must not install Docker or mutate global credentials.

## Acceptance Criteria

- Doctor produces pass/warn/fail checks.
- `--json` output is stable and testable.
- Missing Docker produces a clear failure.
- Missing SSH agent produces warning only unless SSH remote requires it.
- Tests cover major diagnostic branches.

---

# TASK-081: Add project conversion doctor checks

## Type

Feature

## Priority

P1

## Agent Role

Doctor Agent

## Risk Level

Medium

## Goal

Validate that an existing git project has been fully converted into a TaskForge-managed project.

## Command

```bash
taskforge doctor project
```

## Checks

Validate:

- `.taskforge/config.json` exists and is valid.
- `AGENTS.md` exists and contains current managed policy block.
- `../task-state` exists and is on the `task-state` branch.
- `../worktrees` exists or can be created.
- `task-state` branch exists locally.
- `task-state` branch has expected files.
- Git hooks are installed if policy requires them.
- OpenCode config exists if selected framework is OpenCode.
- Audit directories exist if audit is enabled.
- Normal-agent policy blocks direct git if OpenCode integration is enabled.

## Fix behavior

```bash
taskforge doctor project --fix
```

May call the same internal repair logic as:

```bash
taskforge init --repair
```

## Acceptance Criteria

- Freshly initialized project passes `doctor project`.
- Partially initialized project reports exact missing components.
- `--fix` repairs missing generated files.
- Tests use temp git repos.

---

# TASK-082: Add runtime manifest and tool policy validation

## Type

Feature

## Priority

P2

## Agent Role

Infrastructure Agent

## Risk Level

Medium

## Goal

Define a runtime manifest that describes bundled tools and allowed tools for agent execution.

## File

Add generated/runtime file:

```text
.taskforge/runtime.json
```

or image-level file:

```text
/usr/local/share/taskforge/runtime.json
```

## Example

```json
{
  "runtimeVersion": "0.1.0",
  "image": "ghcr.io/squoyster/taskforge:0.1.0",
  "tools": {
    "node": "22.x",
    "npm": "present",
    "git": "present",
    "rg": "present",
    "jq": "present",
    "opencode": "optional"
  },
  "policy": {
    "normalAgentsMayUseGitDirectly": false,
    "taskStateDirectEditsAllowed": false
  }
}
```

## Requirements

- Runtime image should include a manifest.
- `taskforge doctor system` should read and validate it.
- `taskforge init` should record the selected runtime/policy in `.taskforge/config.json`.
- Agent-framework adapters may use the manifest when generating policies.

## Acceptance Criteria

- Runtime manifest exists in the image.
- Project config records runtime mode and policy version.
- Doctor detects missing required tools.
- Tests cover manifest parse and validation.

---

# TASK-083: Add credential strategy for containerized git and GitHub operations

## Type

Feature

## Priority

P1

## Agent Role

Security Agent

## Risk Level

High

## Goal

Make git remote access reliable from the container without copying secrets into project files or logs.

## Requirements

Support these credential modes:

1. SSH agent forwarding.
2. `GITHUB_TOKEN` environment variable.
3. Host git config read-only mount.
4. Optional GitHub CLI auth mount if safe and documented.

## Must not do

- Do not copy private SSH keys into the image.
- Do not write tokens into `.taskforge/config.json`.
- Do not log secrets in audit/transcripts.
- Do not mount the entire home directory by default.

## Commands

Add or extend:

```bash
taskforge doctor credentials
taskforge doctor credentials --json
```

## Acceptance Criteria

- SSH remote projects can be diagnosed for missing SSH agent.
- HTTPS GitHub projects can be diagnosed for missing token/credential helper.
- Secrets are redacted from logs.
- Docs explain supported credential modes.
- Tests cover redaction and diagnostic classification.

---

# TASK-084: Add container-aware path mapping utilities

## Type

Feature

## Priority

P1

## Agent Role

Implementer Agent

## Risk Level

High

## Goal

Centralize host/container path mapping so task-state and worktree paths remain correct under containerized execution.

## Suggested files

```text
src/core/runtime-paths.ts
src/core/runtime-context.ts
```

## Requirements

Implement utilities for:

- Detecting project root.
- Detecting project parent.
- Mapping host project root to container project root.
- Mapping `../task-state` and `../worktrees` consistently.
- Avoiding accidental path traversal outside mounted workspace.
- Supporting native mode and container mode.

## Runtime modes

Support:

```text
native
container
unknown
```

## Acceptance Criteria

- Existing path logic still works in native mode.
- Container mode uses `/workspace/<project>` consistently.
- Sibling task-state/worktrees resolve correctly.
- Tests cover nested directories, spaces in paths, symlinks where feasible, and non-git directories.

---

# TASK-085: Add install script for TaskForge launcher

## Type

Infrastructure

## Priority

P2

## Agent Role

Infrastructure Agent

## Risk Level

Medium

## Goal

Provide a simple installation path for the host launcher.

## Files

Add:

```text
scripts/install.sh
scripts/uninstall.sh
```

## Behavior

The installer should:

- Detect OS and shell environment.
- Install a `taskforge` launcher into a user-local bin directory.
- Avoid requiring sudo by default.
- Verify Docker or Podman availability.
- Print next steps.

Suggested install target:

```text
~/.local/bin/taskforge
```

On macOS, also support:

```text
/opt/homebrew/bin/taskforge
```

only if explicitly requested.

## Acceptance Criteria

- Installer works without sudo on Linux/macOS.
- Installer does not overwrite existing binary without confirmation or backup.
- Uninstaller removes only files it installed.
- Docs explain manual install alternative.

---

# TASK-086: Add release workflow for versioned runtime images

## Type

Infrastructure

## Priority

P2

## Agent Role

Release/Summary Agent

## Risk Level

Medium

## Goal

Publish versioned TaskForge runtime images so users can pin a known runtime.

## Requirements

Add GitHub Actions workflow to:

- Build runtime image.
- Run smoke tests.
- Push image to GitHub Container Registry.
- Tag with semantic version.
- Tag with git SHA.
- Optionally tag `latest` only on release.

Example tags:

```text
ghcr.io/squoyster/taskforge:0.1.0
ghcr.io/squoyster/taskforge:sha-abcdef0
ghcr.io/squoyster/taskforge:latest
```

## Acceptance Criteria

- CI builds image on PR without pushing.
- Release workflow pushes image on tags.
- Smoke test runs `taskforge --version` inside image.
- Documentation explains pinning image versions.

---

# TASK-087: Add project runtime configuration

## Type

Feature

## Priority

P1

## Agent Role

Implementer Agent

## Risk Level

Medium

## Goal

Extend `.taskforge/config.json` to record how the project expects TaskForge to run.

## Config shape

Add:

```json
{
  "runtime": {
    "mode": "container",
    "image": "ghcr.io/squoyster/taskforge:0.1.0",
    "workspaceMount": "/workspace",
    "projectRootStrategy": "git-root-parent",
    "credentialMode": "ssh-agent-or-token"
  }
}
```

## Requirements

- Support `native` and `container` modes.
- Default to `container` for generated deployment docs/procedure, but do not break existing native usage.
- Make doctor commands aware of runtime mode.
- Make generated OpenCode config aware of runtime assumptions where needed.

## Acceptance Criteria

- Config schema validates runtime settings.
- Missing runtime config defaults safely.
- `taskforge init` writes runtime config when requested.
- Tests cover config defaulting and invalid image/mode values.

---

# TASK-088: Define OpenCode execution strategy for containerized TaskForge

## Type

Architecture / Documentation

## Priority

P1

## Agent Role

Framework Adapter Agent

## Risk Level

Medium

## Goal

Define and document how OpenCode should interact with containerized TaskForge.

## Problem

There are two plausible execution models:

1. OpenCode runs on the host and calls `taskforge` launcher commands.
2. OpenCode runs inside the TaskForge runtime container.

Both should be supported eventually, but TaskForge needs one default.

## Required deliverable

Create:

```text
docs/architecture/opencode-container-execution.md
```

The document must compare:

| Model | Pros | Cons | Default? |
|---|---|---|---|
| Host OpenCode + containerized TaskForge CLI | Easy editor integration | Host still has agent process | Recommended MVP |
| OpenCode inside runtime container | Stronger runtime consistency | More complex TTY/editor integration | Later |

## Recommendation

For MVP, use:

```text
Host OpenCode -> taskforge launcher -> TaskForge runtime container
```

OpenCode config should deny direct unsafe operations, while TaskForge launcher provides deterministic execution for TaskForge commands.

## Acceptance Criteria

- Architecture doc exists.
- Default MVP strategy is explicit.
- Future container-inside-OpenCode option is preserved.
- Agent framework adapter tasks reference this decision.

---

# TASK-089: Add smoke-test harness for containerized project conversion

## Type

Test

## Priority

P1

## Agent Role

QA Agent

## Risk Level

Medium

## Goal

Create an automated smoke test proving that a plain git repo can be converted into a TaskForge project using the containerized runtime.

## Test flow

In CI or local test harness:

```bash
mkdir sample-project
cd sample-project
git init
echo '# sample' > README.md
git add README.md
git commit -m 'Initial commit'
taskforge init --agent-framework opencode --policy managed --install-hooks --audit
taskforge doctor project
```

## Validate

Expected files/directories:

```text
AGENTS.md
.taskforge/config.json
.taskforge/hooks/pre-commit
.taskforge/hooks/pre-push
opencode.json
.opencode/agents/doctor.md
../task-state
../worktrees
```

## Acceptance Criteria

- Smoke test passes in native mode.
- Smoke test passes in container mode where Docker is available.
- Test does not require network unless image pull is explicitly part of the test.
- Failures print useful diagnostics.

---

# TASK-090: Add minimal runtime bootstrap command

## Type

Feature

## Priority

P2

## Agent Role

Implementer Agent

## Risk Level

Medium

## Goal

Add a command that guides users through deploying TaskForge on a system and initializing the current project.

## Command

```bash
taskforge bootstrap
```

Options:

```bash
taskforge bootstrap --runtime container --agent-framework opencode --policy managed
taskforge bootstrap --check-only
taskforge bootstrap --project-only
taskforge bootstrap --system-only
```

## Behavior

The command should:

1. Run `doctor system`.
2. Explain missing prerequisites.
3. If inside a git repo, run or propose `taskforge init`.
4. Run `doctor project` after init.
5. Print next commands.

## Acceptance Criteria

- Bootstrap does not hide failures.
- Bootstrap can be run repeatedly.
- Bootstrap does not mutate project unless explicitly allowed or confirmed.
- `--check-only` performs diagnostics only.
- Tests cover command orchestration with mocked doctor/init calls.

---

# TASK-091: Update existing init tasks to include deployment/runtime assumptions

## Type

Refactor / Documentation

## Priority

P2

## Agent Role

Planner Agent

## Risk Level

Low

## Goal

Ensure prior agent-framework initialization work is consistent with the container-first deployment model.

## Requirements

Review and update the earlier TaskForge agent-framework tasks and docs to ensure they account for:

- Containerized TaskForge CLI execution.
- Host OpenCode invoking TaskForge launcher commands.
- Runtime config in `.taskforge/config.json`.
- Doctor checks for system/project readiness.
- Path mapping under `/workspace`.

## Acceptance Criteria

- No docs assume only native TaskForge execution.
- OpenCode generated policy works with the launcher command.
- Agent instructions tell agents to run `taskforge ...`, not direct node/npm internals unless appropriate.
- Relevant docs link to container runtime deployment guide.

---

# Suggested implementation order

1. TASK-077 — deployment docs baseline.
2. TASK-078 — runtime image.
3. TASK-084 — path mapping utilities.
4. TASK-087 — runtime config schema.
5. TASK-079 — host launcher.
6. TASK-080 — system doctor.
7. TASK-081 — project doctor.
8. TASK-083 — credential strategy.
9. TASK-089 — smoke-test harness.
10. TASK-086 — release workflow.
11. TASK-088 — OpenCode execution strategy.
12. TASK-085 — install script.
13. TASK-090 — bootstrap command.
14. TASK-091 — reconcile prior init/agent tasks.

# MVP cut

The smallest useful deployment slice is:

1. TASK-077
2. TASK-078
3. TASK-079
4. TASK-080
5. TASK-081
6. TASK-084
7. TASK-087
8. TASK-089

This provides:

- Documented reliable install/deploy procedure.
- Reproducible runtime image.
- Host launcher.
- Container-aware paths.
- System/project diagnostics.
- Basic proof that an existing repo can be converted with `taskforge init`.
