# TaskForge Agent Compact Guide

## Control Plane

- Use TaskForge for workflow.
- Do not invent steps.
- After each TaskForge command, pick exactly one returned `validNextCommands`.
- If no valid agent action exists: stop, follow recovery.
- `docs/workflow.md` is the canonical workflow contract.

## Startup

```bash
taskforge doctor --json
taskforge validate-state --json
taskforge next --json
```

If blocked:
- doctor issue: `taskforge doctor --json`
- state issue: `taskforge doctor` or create bug
- outstanding task: finish/release current task

## Hard Rules

Never:
- use `--force`
- edit task-state files directly
- use deprecated `main/tasks/` as truth
- work on `main`
- bypass TaskForge with workflow git
- carry hidden context between tasks
- skip ACs
- mark Done without evidence

## Workflow

```bash
taskforge start <TASK-ID>
taskforge resume <TASK-ID>
taskforge diff <TASK-ID>
taskforge gates
taskforge checkpoint <TASK-ID> -m "..."
taskforge submit <TASK-ID>
taskforge pr <TASK-ID>
taskforge report <TASK-ID> --complete
taskforge done <TASK-ID>
```

If gates fail: fix, rerun gates, checkpoint.

Use `taskforge start` only for Ready tasks. For `In Progress`, `Review`, and `Verify`, use `taskforge resume`; `taskforge next --json` will return the correct command.

## Forbidden Workflow Git

| Do not use | Use |
|---|---|
| `git commit` | `taskforge checkpoint` |
| `git push` | `taskforge submit` |
| `git worktree add` | `taskforge start` |
| `git worktree remove` | `taskforge cleanup` / `done --cleanup` |
| `git branch -D` | `taskforge done --delete-branch` |
| `git checkout` / `git switch` | assigned worktree |
| `gh pr create` | `taskforge pr` |

Read-only git is OK when needed. Do not mutate task-state with git.

## Acceptance Criteria

Before coding:
- read task
- extract every `- [ ]` AC
- block if ACs missing/ambiguous
- map ACs to files/modules

Before Done:
- every AC must be `[x]`
- every AC needs evidence:

```md
- [x] AC text — `src/file.ts` `symbolName`: rationale
```

Gates prove no breakage. AC evidence proves completion.

## Deliverables

Update when applicable:
- AC checklist with evidence
- `CHANGELOG.md` under `## [Unreleased]`
- task notes via TaskForge/task-store API
- `README.md` for CLI changes

## Unknown State

If no valid next action or unclear state:

```bash
taskforge new "Handle unclosed TaskForge state: <summary>" --type Bug --priority P1 --status Ready --body "<details>"
taskforge block <TASK-ID> "Unhandled state requires human triage: <details>" --category unsafe_operation --blocked-by human
```

Do not guess.

## Code Rules

- TypeScript strict
- ESM `.js` relative imports
- no `any`; use `unknown` + narrowing
- no unused vars; prefix `_`
- no unnecessary comments
- no `console.log`; use logging utilities
- Zod for runtime validation
- tests in `tests/`
- npm only

## Verification

```bash
npm run typecheck
npm run lint
npm run build
npm test -- --run
```

## File Discovery

Use indexes before broad search:

1. `.agent/tf.ctx`
2. `.agent/file.idx`
3. `.agent/symbol.idx`
4. `.agent/spec.idx`
5. `.agent/task.idx`

Avoid by default:
- `session-ses_*.md`
- `specs/session-ses_*.md`
- `docs/archive/`
- `.opencode/node_modules/`
- `node_modules/`
- broad `Volumes/`

## Task Source

Authoritative task state is TaskForge task-state worktree, not deprecated `main/tasks/`.

Do not manually edit task files. Use TaskForge commands or task-store APIs where explicitly required by implementation code.
