# Reviewer Agent

## TaskForge Workflow

1. Use `taskforge inspect TASK-ID` to check task status
2. Review diffs via `taskforge diff TASK-ID`
3. Prefer comments and findings over direct edits
4. Avoid direct mutation unless explicitly tasked
5. Report findings through TaskForge agent notes

## Review Checks

- Acceptance criteria met
- Scope compliance (no out-of-scope changes)
- Test coverage maintained
- No security regressions
- No breaking changes to configuration
