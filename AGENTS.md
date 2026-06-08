# Agent Instructions
You're an agent using 'npx taskforge' and it's subcommands to work with project tasks.  Using git is forbidden when an
equivalent taskforge command exists.  

Run 'npx taskforge' to know which commands are available. 
Run 'npx taskforge help [command]' to know what command does.
If no taskforge command for task management exists, ask.
You run 'npx taskforge ...' using bash. 

Read compact routing indexes before broad file discovery:
1. `.agent/tf.ctx`
2. `.agent/file.idx`
3. `.agent/symbol.idx`
4. `.agent/flow.idx`
5. `.agent/doc.idx`
6. `.agent/task.idx`

Use indexes to choose files before glob/grep/read.

Do not load by default:
- `session-ses_*.md`
- `specs/session-ses_*.md`
- `docs/archive/`
- `.opencode/node_modules/`
- `Volumes/`
- `node_modules/`

For routine work, read only:
1. compact indexes
2. changed files
3. directly referenced source/tests
4. directly relevant docs

If a needed file is not in the index, use grep/glob narrowly and then update `.agent/index.overrides` or regenerate indexes.

<!-- TASKFORGE:BEGIN managed-agent-policy -->
## TaskForge Managed Policy (🔹 Managed)

This repository is managed by TaskForge. All agents operating in this repository must follow these policies.

### Normal Agent Rules

- Use TaskForge lifecycle commands: `taskforge start`, `taskforge done`, `taskforge checkpoint`, `taskforge submit`
- Never run `git` directly (use `taskforge diff`, `taskforge checkpoint`, `taskforge submit` instead)
- Never edit files under `../task-state/*.md` directly
- Never edit legacy `tasks/*.md` files
- All task-state changes must flow through TaskForge CLI commands
- Do not edit `.opencode/**` or `.taskforge/**` unless role is doctor
- Stop all normal operations when `.doctor-lock` exists

### Doctor Mode Protocol

Doctor agents operate under elevated but constrained permissions:

- Run `taskforge doctor --check` first for diagnostics
- Acquire doctor lock: `taskforge doctor --lock`
- Minimize direct task-state edits — prefer TaskForge commands
- Release doctor lock after repair: `taskforge done` on recovery task
- Never force push to main or task-state branches

### Allowed Normal Agent Commands

```bash
taskforge next
taskforge start TASK-ID
taskforge heartbeat TASK-ID
taskforge inspect TASK-ID
taskforge diff TASK-ID
taskforge checkpoint TASK-ID --message "..."
taskforge submit TASK-ID
taskforge done TASK-ID
taskforge block TASK-ID "reason"
taskforge release TASK-ID
taskforge doctor --check
```
<!-- TASKFORGE:END managed-agent-policy -->
