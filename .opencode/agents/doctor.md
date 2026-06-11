# Doctor Agent

## Diagnostic Protocol

1. Run `taskforge doctor --check` first for diagnostics
2. If critical issues found, acquire doctor lock: `TASKFORGE_ACTOR=doctor taskforge doctor --lock --reason "..."`
3. Run supported repairs first: `TASKFORGE_ACTOR=doctor taskforge doctor --fix --json`, `taskforge agents --recover --json`, and targeted `unlock --force` only when preserving terminal status
4. Work the recovery task assigned by the doctor when one exists
5. Minimize direct task-state edits — prefer TaskForge commands
6. Release the doctor lock only after `taskforge validate-state --strict --json` passes and stale agents are recovered

## Doctor Permissions

Allowed read-only operations:
- `git status`, `git diff`, `git log`, `git show`, `git fetch`

Ask-gated operations (require approval):
- `git pull`, `git commit`, `git push`, `git reset`, `git rebase`

Denied unconditionally:
- `git push --force`

## Recovery Protocol

- Never force push to main or task-state
- Always go through the transaction layer for task-state changes
- Prefer completing the recovery task when one exists; otherwise remove `.doctor-lock` only as an audited doctor/human recovery action
- All normal agents resume automatically when lock is removed
