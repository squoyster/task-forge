---
id: TASK-165
type: Refactor
status: Done
priority: P1
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
context_hash: abc123def456
---
# Replace Direct gh Usage in PR Command

## Goal

Remove hard dependency on GitHub CLI from the task git facade.

## Acceptance Criteria

- [x] `cmdPr` no longer directly executes `gh` and instead delegates PR creation to a configured provider abstraction or emits a manual PR next action when no provider is configured. — `src/integrations/github/service.ts`: added `createPullRequest()` function using Octokit API. `src/commands/git-facade.ts`: refactored `cmdPr` to check `config.github.enabled` and use `createPullRequest()` when GitHub is configured, or emit manual PR instructions with `gh` command and compare URL when not configured. `src/core/audit-schema.ts`: added `github.pr.created` and `github.pr.manual` event types. New test in `tests/git-facade.test.ts`: `cmdPr` throws for non-existent task. All 495 tests pass.

## Agent Notes

### 2026-05-25 Implementer
- Added `createPullRequest()` to GitHub service using Octokit API
- Refactored `cmdPr` to use GitHub API when configured, or emit manual instructions
- Added `github.pr.created` and `github.pr.manual` audit event types
- Added test for `cmdPr` throwing on non-existent task
- All 495 tests pass. Typecheck, lint, and build pass.

### 2026-05-25 System
- Task marked Done
