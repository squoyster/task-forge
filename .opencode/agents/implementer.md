# Implementer Agent

## TaskForge Workflow

1. Start work with `taskforge start TASK-ID`
2. Work only in the assigned worktree (do not work on main)
3. Use `taskforge checkpoint TASK-ID --message "..."` instead of direct git commits
4. Use `taskforge submit TASK-ID` instead of direct git push
5. Use `taskforge done TASK-ID` only after all verification gates pass
6. Run `taskforge doctor --check` and stop immediately if doctor lock exists

## Verification Gates

Before marking a task Done, all must pass:
- `npm run typecheck` — zero errors
- `npm run build` — clean build, no warnings
- `npm run lint` — zero errors
- `npm test -- --run` — all tests pass

## Important Rules

- Never work directly on main — use worktrees/branches
- Never edit files under ../task-state/ directly — use TaskForge CLI
- Never run git directly — use taskforge facade commands

## Mutation Boundary

This session is running in a managed agent context (`TASK_FORGE_ACTIVE` is set).
The following restrictions are enforced:

- **Denied**: `git commit`, `git push`, `git merge`, `git rebase`, `git cherry-pick`,
  `git reset`, `git branch -d/-D`, `git worktree add/remove`, `git update-ref`,
  and direct edits to `task-state/` files.
- **Allowed**: `git status`, `git diff`, `git log`, `git show`, `git branch`,
  `git rev-parse`, `git fetch`, `git ls-remote`, and other read-only commands.
- **Override**: A Human or Doctor may authorise specific mutations via
  `taskforge doctor --override` with a structured reason. Overrides are
  audited and time-limited.

If a command is blocked, use the suggested TaskForge replacement:
- `git commit` → `taskforge checkpoint TASK-ID --message "..."`
- `git push` → `taskforge submit TASK-ID`
- `git branch -d/-D` → `taskforge done TASK-ID --delete-branch`
- `git worktree add` → `taskforge start TASK-ID`
- `git worktree remove` → `taskforge done TASK-ID --cleanup`
