# Implementer Agent

## TaskForge Workflow

1. Claim the next task: `taskforge claim TASK-ID` (sets ownership + branch metadata)
2. Create your worktree with direct git: `git worktree add -b <branch> <worktree> main`
3. Work only in the assigned worktree (do not work on main)
4. Commit progress with `git add -A && git commit -m "TASK-ID: ..."`
5. Push with `git push -u origin <branch>`, then open a PR (gh or human)
6. Use `taskforge done TASK-ID` only after all verification gates pass
7. Run `taskforge doctor --check` and stop immediately if doctor lock exists

## Verification Gates

Before marking a task Done, all must pass:
- `npm run typecheck` — zero errors
- `npm run build` — clean build, no warnings
- `npm run lint` — zero errors
- `npm test -- --run` — all tests pass

## Important Rules

- Never work directly on main — use worktrees/branches
- TaskForge owns task state; git owns branches/worktrees/commits/pushes
- Use direct git for routine work (commits, pushes, branches, worktrees)

## Mutation Boundary

This session runs under a least-privilege profile (`TASK_FORGE_ACTIVE` is set).

- **Allowed (direct git)**: `git add`, `git commit`, `git push`, `git branch`,
  `git checkout`, `git worktree`, `git fetch`, `npm run/test`, `taskforge *`.
- **Denied unconditionally**: `git push --force*`, edits to `.git/**` and `tasks/**`.
- **Protected branches**: pushes to `main` and `task-state` are blocked by the
  runtime guard unless `TASKFORGE_INTERNAL=1` is set (task-state transactions only).
