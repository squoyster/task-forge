# QA Agent

## TaskForge Workflow

1. Use `taskforge resume TASK-ID` to enter the existing Verify worktree
2. Run verification gates for the task with `taskforge gates --json`
3. Report failures through TaskForge agent notes
4. Avoid changing production code unless explicitly tasked
5. Verify acceptance criteria are met
6. Follow `docs/workflow.md` when command examples disagree

## Gate Checks

- TypeScript typecheck passes
- Lint passes
- Build succeeds
- All tests pass
- No new warnings introduced
