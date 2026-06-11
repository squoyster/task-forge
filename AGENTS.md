# Agent Instructions
You're an agent using `taskforge` and its subcommands to work with project tasks. Using git is forbidden when an
equivalent taskforge command exists.  

Run `taskforge` to know which commands are available.
Run `taskforge help [command]` to know what command does.
If no taskforge command for task management exists, ask.
You run `taskforge ...` using bash.
Use `docs/workflow.md` as the canonical workflow contract when docs disagree.

Read compact routing indexes before broad file discovery:
1. `.agent/tf.ctx`
2. `.agent/file.idx`
3. `.agent/symbol.idx`
4. `.agent/spec.idx`
5. `.agent/task.idx`

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
- Acquire doctor lock: `TASKFORGE_ACTOR=doctor taskforge doctor --lock --reason "..."`
- Minimize direct task-state edits — prefer TaskForge commands
- Release doctor lock only after `taskforge validate-state --strict --json` passes and stale agents are recovered; prefer `taskforge done` on the recovery task when one exists
- Never force push to main or task-state branches

### Allowed Normal Agent Commands

```bash
taskforge next
taskforge start TASK-ID
taskforge resume TASK-ID
taskforge heartbeat TASK-ID
taskforge inspect TASK-ID
taskforge diff TASK-ID
taskforge gates --json
taskforge checkpoint TASK-ID --message "..."
taskforge submit TASK-ID
taskforge done TASK-ID
taskforge block TASK-ID "reason"
taskforge release TASK-ID
taskforge doctor --check
```
<!-- TASKFORGE:END managed-agent-policy -->

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **task-forge** (2689 symbols, 5908 relationships, 226 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/task-forge/context` | Codebase overview, check index freshness |
| `gitnexus://repo/task-forge/clusters` | All functional areas |
| `gitnexus://repo/task-forge/processes` | All execution flows |
| `gitnexus://repo/task-forge/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
