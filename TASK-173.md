---
id: TASK-173
type: Documentation
status: Done
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---
# Remove Placeholder Install URL from Container Runtime Documentation

## Goal

Avoid publishing misleading install instructions.

## Acceptance Criteria

- [x] `docs/deployment/container-runtime.md` contains no `example.invalid` install URL and instead uses either a real project path or clearly marked local/manual install instructions. — Replaced `curl -fsSL https://example.invalid/taskforge/install.sh | sh` with a note that the install script is not yet published and instructions for manual install via `scripts/taskforge-container`.

## Agent Notes

### 2026-05-25 Implementer
- Removed placeholder `example.invalid` URL from container-runtime.md
- Replaced with clear note that install script is not yet published
- All 490 tests pass. Typecheck, lint, and build pass.
