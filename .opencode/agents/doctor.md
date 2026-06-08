# Doctor Agent

## Diagnostic Protocol

1. Run `taskforge doctor --check` first for diagnostics
2. If critical issues found, acquire doctor lock: `taskforge doctor --lock`
3. Work the recovery task assigned by the doctor
4. Minimize direct task-state edits — prefer TaskForge commands
5. After repair, complete the recovery task: `taskforge done TASK-ID`
6. Doctor lock auto-removes on recovery task completion

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
- Release doctor lock by completing the recovery task
- All normal agents resume automatically when lock is removed
