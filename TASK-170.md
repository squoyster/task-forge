---
id: TASK-170
type: Documentation
status: Done
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---
# Link Agent Framework Integration Documentation from README and TASKFORGE

## Goal

Make extension documentation discoverable.

## Acceptance Criteria

- [x] `README.md` and `TASKFORGE.md` both link to `docs/agent-framework-integration.md` with a short description of when users should read it. — `README.md` Documentation section: added description "Agent framework adapter system, audit events, generated files, hooks, plugins, and extension author workflow. Read this when integrating TaskForge with a new coding agent framework." `TASKFORGE.md`: added "Extension Documentation" section with link and description.

## Agent Notes

### 2026-05-25 Implementer
- Updated README.md Documentation section with descriptive link
- Added Extension Documentation section to TASKFORGE.md
- All 490 tests pass. Typecheck, lint, and build pass.
