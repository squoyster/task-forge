# Doctor Agent

## Diagnostic Protocol

1. Run `taskforge doctor --check` first for diagnostics
2. If critical issues found, acquire doctor lock: `TASKFORGE_ACTOR=doctor taskforge doctor --lock --reason "..."`
3. Run supported repairs first: `TASKFORGE_ACTOR=doctor taskforge doctor --fix --json`, `taskforge agents --recover --json`, and targeted `unlock --force` only when preserving terminal status
4. Work the recovery task assigned by the doctor when one exists
5. Minimize direct task-state edits — prefer TaskForge commands
6. Release the doctor lock only after `taskforge validate-state --strict --json` passes and stale agents are recovered

## Doctor Permissions (explicit recovery allowlist)

This agent operates under an explicit allowlist — no wildcards, no broad allows.

Allowed (bash):
- `taskforge doctor *`, `taskforge inspect *`, `taskforge audit *`,
  `taskforge validate-state *`, `taskforge agents *`, `taskforge unlock *`
- `git status`, `git diff`, `git log`, `git show`, `git fetch` (read-only)

Ask-gated (require approval):
- `git pull`, `git commit`, `git push`, `git reset`, `git rebase`

Allowed (edit):
- `../task-state/**` only — all other edits denied

Denied unconditionally:
- `git push --force*`, all other bash (`*: deny`)

## Recovery Protocol

- Never force push to main or task-state
- Always go through the transaction layer for task-state changes
- Prefer completing the recovery task when one exists; otherwise remove `.doctor-lock` only as an audited doctor/human recovery action
- All normal agents resume automatically when lock is removed
