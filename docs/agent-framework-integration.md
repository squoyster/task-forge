# Agent Framework Integration

TaskForge integrates with coding agent frameworks (like OpenCode) through a pluggable adapter system. This document describes the architecture, components, and extension workflow.

## Architecture Overview

TaskForge's agent framework integration consists of:

1. **Agent Framework Adapter** — Abstract interface for framework-specific operations
2. **Audit Event Registry** — Typed event schema for all TaskForge operations
3. **Generated Files** — Agent policies, permissions, and plugins
4. **Doctor Integration** — Diagnostics and repair through the adapter
5. **Guard Plugin** — Policy enforcement before tool execution

## Agent Framework Adapter

### Interface

```typescript
interface AgentFrameworkAdapter {
  doctor(repoRoot: string): DoctorIssue[];
  fix(repoRoot: string): DoctorRepair[];
}
```

The adapter provides two methods:
- `doctor()` — Returns diagnostic issues for the agent framework
- `fix()` — Repairs issues and returns a list of repairs applied

### Built-in Adapters

#### GenericAdapter

The default adapter for CLI-only mode. Returns no issues and performs no repairs.

```typescript
class GenericAgentFrameworkAdapter implements AgentFrameworkAdapter {
  doctor(_repoRoot: string): DoctorIssue[] { return []; }
  fix(_repoRoot: string): DoctorRepair[] { return []; }
}
```

#### OpenCodeAdapter

Implements OpenCode-specific diagnostics and repairs:

**Doctor checks:**
- `AGENTS.md` exists and contains the `managed-agent-policy` block
- `opencode.json` has correct agent permissions (`git *` deny, `../task-state/**` deny)
- `opencode.json` has doctor agent configured
- Audit directory exists at `logs/taskforge/audit`

**Fix repairs:**
- Creates or updates `AGENTS.md` with managed policy block
- Creates or repairs `opencode.json` with TaskForge permissions
- Creates audit directory if missing

### Adapter Selection

The adapter is selected based on `config.agentFramework.id`:

```json
{
  "agentFramework": {
    "id": "opencode"
  }
}
```

- `"opencode"` → `OpenCodeAgentFrameworkAdapter`
- `"generic"` or any other value → `GenericAgentFrameworkAdapter`

Auto-detection during `taskforge init` sets the ID based on detected framework.

## Audit Event Registry

All TaskForge operations emit typed audit events. The registry is defined in `src/core/audit-schema.ts`:

```typescript
export const AUDIT_EVENT_TYPES = [
  "task.command.started",
  "task.command.completed",
  "task.command.failed",
  "task.state.changed",
  "git.commit",
  "git.push",
  "github.pr.created",
  "github.pr.failed",
  "github.pr.manual",
  "tool.execute",
  "permission.requested",
  "permission.responded",
  "doctor.lock.created",
  "doctor.lock.released",
  "doctor.fix.applied",
  "verification.started",
  "verification.completed",
  "verification.failed",
  "session.started",
] as const;
```

Events are written as JSONL files:
- `logs/taskforge/audit/events.jsonl` — Global audit log
- `logs/taskforge/tasks/<TASK-ID>/transcript.jsonl` — Per-task transcript

### Schema Validation

`AuditEventSchema` validates all events:

```typescript
const AuditEventSchema = z.object({
  timestamp: z.string(),
  event: z.enum(AUDIT_EVENT_TYPES),
  taskId: z.string().optional(),
  sessionId: z.string().optional(),
  agent: z.string().optional(),
  summary: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});
```

Unknown event types are rejected at schema validation time.

## Generated Files

### AGENTS.md

Contains agent instructions and the managed policy block:

```markdown
# AGENTS.md — project-name

<!-- TASKFORGE:BEGIN managed-agent-policy -->
## TaskForge Managed Policy (🔹 Managed)
...
<!-- TASKFORGE:END managed-agent-policy -->
```

The managed block is maintained by TaskForge and should not be edited manually.

### opencode.json

Contains TaskForge-managed permissions:

```json
{
  "permission": {
    "bash": {
      "git *": "deny",
      "taskforge *": "allow"
    },
    "edit": {
      "../task-state/**": "deny"
    }
  },
  "agent": {
    "doctor": {
      "permission": {
        "bash": {
          "taskforge doctor *": "allow"
        }
      }
    }
  }
}
```

### Agent Files

Installed in `.opencode/agents/`:
- `implementer.md` — Primary task implementation agent
- `reviewer.md` — Code review agent
- `qa.md` — Quality assurance agent
- `doctor.md` — System recovery agent

### Plugins

Installed in `.opencode/plugins/`:
- `taskforge-audit.ts` — Records tool executions and permission events
- `taskforge-guard.ts` — Enforces policy before tool execution

## Hooks

Git hooks are installed in `.taskforge/hooks/`:
- `pre-commit` — Records commit metadata to audit log
- `pre-push` — Validates task-state invariants
- `post-commit` — Appends commit to git.jsonl audit trail

Hooks are enabled via `config.agentFramework.installHooks: true`.

## Doctor Integration

`taskforge doctor` uses the adapter for framework-specific diagnostics:

1. Loads adapter based on `config.agentFramework.id`
2. Calls `adapter.doctor(repoRoot)` for framework checks
3. Reports issues in human and JSON output
4. With `--fix`, calls `adapter.fix(repoRoot)` to repair issues

Doctor also validates:
- Task-state invariants (Done tasks without assignee, etc.)
- Orphan worktrees
- Stale claims
- Broken dependsOn references
- Corrupted JSONL audit files

## Extension Methodology Checklist

Use this checklist when adding a new agent framework provider. Each step avoids modifying core domain logic.

### 1. Adapter Implementation

- [ ] Create adapter file in `src/agent-frameworks/<framework>.ts`
- [ ] Implement `AgentFrameworkAdapter` interface (`doctor()`, `fix()`)
- [ ] Add `detect()` method to identify the framework in a project
- [ ] Add `plan()` method to generate file plans for `taskforge init`
- [ ] Add `apply()` method to write generated files

### 2. Registration

- [ ] Add framework ID case to `getAgentFrameworkAdapter()` factory in `src/agent-frameworks/registry.ts`
- [ ] Export adapter from `src/agent-frameworks/index.ts`

### 3. Audit Events (if needed)

- [ ] Add new event types to `AUDIT_EVENT_TYPES` in `src/core/audit-schema.ts`
- [ ] Add Zod schema validation for new event payloads

### 4. Generated Files

- [ ] Define framework-specific file templates in `src/core/templates.ts`
- [ ] Add file paths to `GeneratedFilePlan` returned by adapter's `plan()` method

### 5. Tests

- [ ] Add adapter unit tests in `tests/agent-frameworks/<framework>.test.ts`
- [ ] Test `detect()`, `plan()`, `apply()`, `doctor()`, and `fix()` methods
- [ ] Add integration test with `taskforge init` and `taskforge doctor`

### 6. Documentation

- [ ] Document framework-specific behavior in this file under "Built-in Adapters"
- [ ] Update README.md if the framework is a first-class integration

### Rules

- **Do not modify** `src/core/task.ts`, `src/core/task-store.ts`, or `src/core/status-transition.ts` — these are framework-agnostic domain logic.
- **Do not modify** `src/commands/done.ts`, `src/commands/start.ts`, etc. — commands use the adapter interface, not framework-specific code.
- **Do modify** `src/agent-frameworks/` — this is where all framework-specific logic lives.
- **Do modify** `src/core/audit-schema.ts` — adding event types is expected for new integrations.

## Extension Author Workflow

To create a custom agent framework adapter:

1. **Implement the interface:**

```typescript
import { AgentFrameworkAdapter, DoctorIssue, DoctorRepair } from "./agent-framework-adapter.js";

export class MyFrameworkAdapter implements AgentFrameworkAdapter {
  doctor(repoRoot: string): DoctorIssue[] {
    const issues: DoctorIssue[] = [];
    // Add framework-specific checks
    return issues;
  }

  fix(repoRoot: string): DoctorRepair[] {
    const repairs: DoctorRepair[] = [];
    // Add framework-specific repairs
    return repairs;
  }
}
```

2. **Register in config:**

```json
{
  "agentFramework": {
    "id": "my-framework"
  }
}
```

3. **Add factory case:**

```typescript
export function getAgentFrameworkAdapter(frameworkId?: string): AgentFrameworkAdapter {
  if (frameworkId === "opencode") return new OpenCodeAgentFrameworkAdapter();
  if (frameworkId === "my-framework") return new MyFrameworkAdapter();
  return new GenericAgentFrameworkAdapter();
}
```

4. **Add audit event types** (if needed):

```typescript
export const AUDIT_EVENT_TYPES = [
  // ... existing types
  "my-framework.custom.event",
] as const;
```

## Configuration Reference

```json
{
  "agentFramework": {
    "id": "opencode",
    "policy": "managed",
    "installHooks": true,
    "audit": true,
    "guard": true,
    "policyVersion": 1
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `id` | string | `"generic"` | Framework identifier |
| `policy` | enum | `"managed"` | Policy level: `permissive`, `managed`, `locked-down` |
| `installHooks` | boolean | `true` | Install git hooks |
| `audit` | boolean | `true` | Enable audit logging |
| `guard` | boolean | `true` | Enable guard plugin |
| `policyVersion` | number | `1` | Policy version for cache invalidation |
