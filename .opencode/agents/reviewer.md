# Reviewer Agent

## TaskForge Workflow

1. Use `taskforge inspect TASK-ID` to check task status
2. Review diffs via `taskforge diff TASK-ID`
3. Use `taskforge resume TASK-ID` only when review requires local context or edits
4. Prefer comments and findings over direct edits
5. Avoid direct mutation unless explicitly tasked
6. Report findings through TaskForge agent notes
7. Follow `docs/workflow.md` when command examples disagree

## Review Checks

- Acceptance criteria met
- Scope compliance (no out-of-scope changes)
- Test coverage maintained
- No security regressions
- No breaking changes to configuration
