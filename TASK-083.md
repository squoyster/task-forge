---
id: TASK-083
type: Feature
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-083: Add container-aware path mapping utilities

## Goal

Centralize host/container path mapping in src/core/runtime-paths.ts. Detect git root, project parent, map to /workspace/<project>. Support native and container modes. Handle nested dirs, spaces, symlinks. Existing path logic unchanged in native mode.

## Acceptance Criteria

- [ ]

## Agent Notes
