# TaskForge Gap Analysis and Agent Definition Implementation Tasks

## Context

TaskForge already defines several conceptual agent roles and already uses task frontmatter fields such as `agentRole`, `status`, `priority`, `riskLevel`, and `humanInterventionRequired`.

The missing capability is a first-class **agent definition system**:

- Agents should be explicit project-level entities.
- Each agent type should have configurable model preferences.
- Tasks should be routed to appropriate agents based on lifecycle stage, task type, risk, and required capability.
- Framework-specific implementations should be generated from a generic TaskForge agent model.
- OpenCode should be the default adapter, but the TaskForge model should not depend on OpenCode.

This document defines the gap analysis and a new set of agentic implementation tasks.

## Numbering Assumption

The previous generated task set occupied `TASK-046` through `TASK-060`.

This new set starts at:

```text
TASK-061
```

---

# Gap Analysis

## Current Known Capabilities

TaskForge already has or describes:

- Task files stored on the dedicated `task-state` branch.
- Task lifecycle statuses:
  - `Inbox`
  - `Needs Spec`
  - `Ready`
  - `In Progress`
  - `Blocked`
  - `Review`
  - `Verify`
  - `Done`
  - `Rejected`
  - `Deferred`
- Conceptual agent roles:
  - Intake Agent
  - Planner Agent
  - Implementer Agent
  - QA Agent
  - Reviewer Agent
  - Continuation Agent
  - Release/Summary Agent
  - Dependency Steward Agent
- Additional role concepts now needed:
  - Doctor Agent
  - Documentation Agent
  - Security Agent
  - Framework Adapter Agent
  - Audit/Transcript Agent
- Task frontmatter can already include `agentRole`.
- Work execution already uses worktrees and task branches.
- Earlier proposed tasks define OpenCode policy generation, hooks, audit, and guard plugins.

## Gaps

| Gap | Impact | Required Fix |
|---|---:|---|
| No canonical agent definition schema | Agent roles remain documentation-only | Add `.taskforge/agents/*.json` or `.taskforge/agents.yaml` |
| No per-agent model preferences | Cannot optimize model selection by role | Add model routing fields to agent definitions |
| No generic agent abstraction | OpenCode integration risks becoming hardcoded | Add framework-neutral agent definition model |
| No adapter rendering pipeline | Cannot generate OpenCode/Codex/Claude configs from same source | Add agent framework adapter interface |
| No lifecycle-to-agent routing | Tasks may be picked by wrong agent type | Add lifecycle routing matrix |
| No task creation integration | `taskforge new` cannot select/validate appropriate agent | Extend task creation and task schema |
| No scheduler awareness of agents | `next/start` cannot route work intelligently | Extend scheduler with agent capability matching |
| No doctor validation of agent definitions | Misconfigured agents may silently break workflows | Add `taskforge doctor agents` |
| No role-specific templates/prompts | Agents may behave generically | Generate role prompts/instructions |
| No model fallback/escalation strategy | Expensive models may be overused or weak models misapplied | Add model tiers/fallback policy |
| No OpenCode-specific implementation for role/model mapping | Cannot materialize roles in OpenCode | Generate `.opencode/agents/*.md` and config entries |
| No framework extension contract | Future framework support will be ad hoc | Add generic adapter API and tests |

## Target Architecture

```text
.taskforge/
  config.json
  agents/
    intake.json
    planner.json
    implementer.json
    qa.json
    reviewer.json
    continuation.json
    release-summary.json
    dependency-steward.json
    doctor.json
    documentation.json
    security.json
    framework-adapter.json
    audit-transcript.json

TaskForge Core
  ├─ Agent Definition Schema
  ├─ Agent Registry
  ├─ Model Routing Policy
  ├─ Lifecycle Routing Matrix
  ├─ Scheduler Integration
  ├─ taskforge new Integration
  └─ Doctor Validation

Framework Adapters
  ├─ generic
  └─ opencode
       ├─ opencode.json
       ├─ .opencode/agents/*.md
       ├─ .opencode/plugins/*
       └─ model/provider mapping
```

## Canonical Agent Types

| Agent Type | Primary Lifecycle Stage | Typical Model Tier |
|---|---|---|
| Intake Agent | `Inbox` → `Needs Spec` / `Ready` | cheap/fast |
| Planner Agent | `Needs Spec` → `Ready` | mid/high reasoning |
| Implementer Agent | `Ready` → `In Progress` | coding-capable |
| QA Agent | `Verify` | test/reasoning |
| Reviewer Agent | `Review` | high reasoning |
| Continuation Agent | `In Progress` maintenance | cheap/mid |
| Release/Summary Agent | `Done` / project reporting | cheap/mid |
| Dependency Steward Agent | maintenance/dependency tasks | tool-capable mid |
| Doctor Agent | recovery/repair | high reasoning, restricted |
| Documentation Agent | docs tasks | cheap/mid writer |
| Security Agent | security/risk review | high reasoning |
| Framework Adapter Agent | framework integration tasks | high coding/reasoning |
| Audit/Transcript Agent | audit/session summarization | cheap/mid long-context |

---

# TASK-061: Add canonical agent definition schema

## Type

Feature

## Priority

P1

## Agent Role

Framework Adapter Agent

## Risk Level

Medium

## Goal

Create a framework-neutral schema for defining TaskForge agent types, capabilities, model preferences, permissions, and lifecycle routing metadata.

## Background

TaskForge currently treats agent roles mostly as strings in task frontmatter and documentation. This prevents reliable routing, model selection, validation, and framework-specific config generation.

## Requirements

Add a canonical agent definition schema.

Suggested files:

```text
src/core/agents/
  agent-definition.ts
  agent-registry.ts
  agent-schema.ts
```

Support serialized definitions under:

```text
.taskforge/agents/*.json
```

or:

```text
.taskforge/agents.yaml
```

The schema must support:

```ts
type AgentDefinition = {
  id: string;
  displayName: string;
  description: string;
  lifecycleStages: TaskStatus[];
  taskTypes: TaskType[];
  defaultPriority?: Priority;
  capabilities: string[];
  disallowedCapabilities?: string[];
  modelPolicy: AgentModelPolicy;
  permissionProfile: string;
  frameworkHints?: Record<string, unknown>;
  promptTemplate?: string;
  enabled: boolean;
};
```

Add model policy support:

```ts
type AgentModelPolicy = {
  preferredModel?: string;
  fallbackModels?: string[];
  modelClass?: "cheap" | "balanced" | "reasoning" | "coding" | "review" | "long-context";
  maxCostTier?: "low" | "medium" | "high";
  requiresToolUse?: boolean;
  requiresLongContext?: boolean;
};
```

## Acceptance Criteria

- Agent definitions validate with zod.
- Invalid definitions produce actionable errors.
- Agent IDs are stable kebab-case values.
- Agent display names are human-readable.
- Definitions can be loaded from `.taskforge/agents/*.json`.
- Missing definitions can be generated from built-in defaults.
- Unit tests cover valid definitions, invalid definitions, default loading, and duplicate ID detection.

---

# TASK-062: Define built-in default TaskForge agents

## Type

Feature

## Priority

P1

## Agent Role

Planner Agent

## Risk Level

Low

## Goal

Add built-in default definitions for all canonical TaskForge agent types.

## Required Agent Definitions

Create built-in definitions for:

```text
intake
planner
implementer
qa
reviewer
continuation
release-summary
dependency-steward
doctor
documentation
security
framework-adapter
audit-transcript
```

## Required Fields Per Agent

Each built-in agent must define:

- `id`
- `displayName`
- `description`
- `lifecycleStages`
- `taskTypes`
- `capabilities`
- `modelPolicy`
- `permissionProfile`
- `enabled`

## Suggested Agent Mapping

### Intake Agent

- Lifecycle:
  - `Inbox`
  - `Needs Spec`
- Capabilities:
  - task-normalization
  - ambiguity-detection
  - acceptance-criteria-drafting
- Model class:
  - `cheap` or `balanced`

### Planner Agent

- Lifecycle:
  - `Needs Spec`
  - `Ready`
- Capabilities:
  - decomposition
  - dependency-analysis
  - risk-classification
- Model class:
  - `reasoning`

### Implementer Agent

- Lifecycle:
  - `Ready`
  - `In Progress`
- Capabilities:
  - code-editing
  - test-authoring
  - local-verification
- Model class:
  - `coding`

### QA Agent

- Lifecycle:
  - `Verify`
- Capabilities:
  - test-execution
  - regression-analysis
  - acceptance-validation
- Model class:
  - `balanced`

### Reviewer Agent

- Lifecycle:
  - `Review`
- Capabilities:
  - code-review
  - scope-review
  - correctness-review
- Model class:
  - `review` or `reasoning`

### Continuation Agent

- Lifecycle:
  - `In Progress`
  - `Blocked`
- Capabilities:
  - safe-continuation
  - heartbeat
  - stale-work-recovery
- Model class:
  - `cheap` or `balanced`

### Release/Summary Agent

- Lifecycle:
  - `Review`
  - `Verify`
  - `Done`
- Capabilities:
  - changelog
  - summary
  - release-notes
- Model class:
  - `cheap` or `balanced`

### Dependency Steward Agent

- Lifecycle:
  - `Ready`
  - `In Progress`
  - `Review`
- Task types:
  - `Dependency`
  - `Maintenance`
  - `Security`
- Capabilities:
  - dependency-audit
  - deprecated-package-detection
  - remediation-planning
- Model class:
  - `balanced`

### Doctor Agent

- Lifecycle:
  - `Blocked`
  - recovery-only
- Capabilities:
  - state-repair
  - hook-repair
  - worktree-repair
  - branch-repair
- Model class:
  - `reasoning`
- Permission profile:
  - `doctor`

### Documentation Agent

- Task types:
  - `Documentation`
- Capabilities:
  - docs-update
  - README-maintenance
  - runbook-maintenance
- Model class:
  - `cheap` or `balanced`

### Security Agent

- Task types:
  - `Security`
- Capabilities:
  - secret-review
  - permission-review
  - threat-model-review
  - dependency-risk-review
- Model class:
  - `reasoning`

### Framework Adapter Agent

- Task types:
  - `Infrastructure`
  - `Feature`
  - `Refactor`
- Capabilities:
  - framework-adapter-design
  - config-generation
  - plugin-generation
- Model class:
  - `coding` or `reasoning`

### Audit/Transcript Agent

- Task types:
  - `Maintenance`
  - `Documentation`
  - `Review`
- Capabilities:
  - transcript-summary
  - audit-log-analysis
  - task-timeline-generation
- Model class:
  - `long-context`

## Acceptance Criteria

- All canonical agents are defined.
- Defaults can be emitted by `taskforge init`.
- Agent definitions are stable and versioned.
- Unit tests confirm every canonical role has lifecycle stages, capabilities, model policy, and permission profile.
- Documentation table is generated or updated.

---

# TASK-063: Add model routing configuration for agents

## Type

Feature

## Priority

P1

## Agent Role

Framework Adapter Agent

## Risk Level

Medium

## Goal

Allow users to assign specific models to each TaskForge agent type while retaining generic model-class fallback behavior.

## Background

Users need to optimize price/performance. Some agents should use cheap models; others require stronger reasoning or coding models.

## Requirements

Extend `.taskforge/config.json`:

```json
{
  "models": {
    "classes": {
      "cheap": {
        "provider": "openrouter",
        "model": "qwen/qwen3-coder-mini"
      },
      "balanced": {
        "provider": "openrouter",
        "model": "anthropic/claude-sonnet"
      },
      "reasoning": {
        "provider": "openai",
        "model": "gpt-5.5-thinking"
      },
      "coding": {
        "provider": "anthropic",
        "model": "claude-sonnet-4.5"
      },
      "review": {
        "provider": "openai",
        "model": "gpt-5.5-thinking"
      },
      "long-context": {
        "provider": "google",
        "model": "gemini-long-context"
      }
    },
    "agents": {
      "implementer": {
        "provider": "anthropic",
        "model": "claude-sonnet-4.5"
      },
      "doctor": {
        "provider": "openai",
        "model": "gpt-5.5-thinking"
      }
    }
  }
}
```

Do not hardcode the example models as defaults unless they are user-provided. Use placeholders or project defaults.

Resolution order:

1. Explicit task override.
2. Explicit agent model.
3. Agent model class.
4. Project default model.
5. Framework default.

Add resolver:

```ts
resolveModelForAgent(agentId: string, task?: Task): ResolvedModelPolicy
```

## CLI

Add:

```bash
taskforge agents models
taskforge agents set-model implementer --provider anthropic --model claude-sonnet-4.5
taskforge agents set-model doctor --provider openai --model gpt-5.5-thinking
taskforge agents clear-model implementer
```

## Acceptance Criteria

- Model config validates.
- Per-agent model override works.
- Model class fallback works.
- Missing model config produces a warning, not a crash.
- CLI can list resolved model for every agent.
- Tests cover resolution order and invalid config.

---

# TASK-064: Add lifecycle-to-agent routing matrix

## Type

Feature

## Priority

P1

## Agent Role

Planner Agent

## Risk Level

Medium

## Goal

Define which agent types are eligible to operate at each task lifecycle stage.

## Requirements

Add routing matrix support.

Suggested config:

```json
{
  "routing": {
    "byStatus": {
      "Inbox": ["intake"],
      "Needs Spec": ["planner"],
      "Ready": ["implementer", "dependency-steward", "documentation", "security"],
      "In Progress": ["implementer", "continuation"],
      "Blocked": ["continuation", "doctor"],
      "Review": ["reviewer", "security", "release-summary"],
      "Verify": ["qa"],
      "Done": ["release-summary", "audit-transcript"],
      "Rejected": ["release-summary"],
      "Deferred": ["planner"]
    },
    "byTaskType": {
      "Dependency": ["dependency-steward"],
      "Documentation": ["documentation"],
      "Security": ["security"],
      "Infrastructure": ["framework-adapter", "implementer"],
      "Bug": ["implementer", "qa", "reviewer"],
      "Feature": ["planner", "implementer", "reviewer"]
    }
  }
}
```

Implement:

```ts
getEligibleAgentsForTask(task: Task): AgentDefinition[]
validateTaskAgentAssignment(task: Task): Diagnostic[]
```

## Routing Rules

- Status-based routing is primary.
- Task type narrows or boosts eligible agents.
- Explicit `agentRole` in task frontmatter must be validated.
- Doctor agent is only eligible for doctor/recovery tasks unless forced.
- Security agent is eligible for `Security` tasks and high-risk review.
- Dependency Steward is eligible for dependency and maintenance tasks.

## Acceptance Criteria

- Task with `status: Ready` and `type: Feature` routes to Implementer by default.
- Task with `type: Dependency` routes to Dependency Steward.
- Task with `status: Verify` routes to QA.
- Task with `status: Review` routes to Reviewer.
- Invalid `agentRole` is detected.
- Doctor agent is not selected for normal implementation tasks.
- Tests cover status/type/risk routing.

---

# TASK-065: Integrate agent routing into scheduler and task selection

## Type

Feature

## Priority

P1

## Agent Role

Implementer Agent

## Risk Level

High

## Goal

Make `taskforge next`, `taskforge claim`, and `taskforge start` agent-aware.

## Requirements

Extend scheduler behavior so callers can request work for a specific agent type:

```bash
taskforge next --agent implementer
taskforge next --agent reviewer
taskforge next --agent qa
taskforge start TASK-123 --agent implementer
```

If no agent is specified:

- Use configured default agent.
- Or infer from current framework agent name if available.
- Or return the highest-priority task with its recommended agent.

Task selection must consider:

- Status.
- Task type.
- Priority.
- `agentRole`.
- Required capabilities.
- Risk level.
- Human intervention flag.
- Existing assignee/session ownership.
- Doctor lock.

## Output

`taskforge next --json` should include:

```json
{
  "taskId": "TASK-123",
  "recommendedAgent": "implementer",
  "eligibleAgents": ["implementer"],
  "recommendedModel": {
    "provider": "anthropic",
    "model": "claude-sonnet-4.5"
  },
  "reason": "Ready Feature task eligible for Implementer Agent"
}
```

## Acceptance Criteria

- `taskforge next --agent qa` only returns verification-eligible tasks.
- `taskforge next --agent reviewer` only returns review-eligible tasks.
- Explicitly mismatched `agentRole` is skipped unless `--allow-mismatch`.
- Start records the selected agent type in task state.
- Tests cover scheduler filtering by agent, status, type, and priority.

---

# TASK-066: Extend task schema/frontmatter for agent assignment

## Type

Feature

## Priority

P1

## Agent Role

Implementer Agent

## Risk Level

Medium

## Goal

Make agent assignment and model resolution first-class task-state fields.

## Requirements

Extend task frontmatter schema.

Add or formalize:

```yaml
agentRole: Implementer
agentId: implementer
requiredCapabilities:
  - code-editing
  - test-authoring
modelClass: coding
modelOverride:
  provider: anthropic
  model: claude-sonnet-4.5
assignedAgentSession: abc123
```

Rules:

- `agentRole` is display/backward-compatible.
- `agentId` is canonical.
- `requiredCapabilities` constrain eligible agents.
- `modelClass` can override default class.
- `modelOverride` can override agent model policy.
- `assignedAgentSession` is runtime/session metadata.

## Migration

Existing tasks using only `agentRole` must continue to work.

Add mapping:

```text
Implementer -> implementer
QA -> qa
Reviewer -> reviewer
Dependency Steward -> dependency-steward
Doctor -> doctor
```

## Acceptance Criteria

- Existing tasks still parse.
- New fields validate.
- Invalid `agentId` fails validation or yields doctor diagnostic.
- `agentRole` and `agentId` mismatch is detected.
- Tests cover backward compatibility and new schema fields.

---

# TASK-067: Extend `taskforge new` with agent-aware task creation

## Type

Feature

## Priority

P1

## Agent Role

Implementer Agent

## Risk Level

Medium

## Goal

Allow task creation to assign appropriate agent metadata automatically or explicitly.

## Requirements

Add:

```bash
taskforge new "Fix OpenCode policy generation" --type Bug --agent implementer
taskforge new "Review task-state guardrails" --type Security
taskforge new "Update README" --type Documentation
taskforge new "Investigate model routing" --type Research --agent planner
```

If `--agent` is omitted:

- Infer from task type/status.
- Add `agentId`.
- Add display `agentRole`.
- Add required capabilities if obvious.
- Add model class from agent definition.

Add:

```bash
taskforge new --interactive
taskforge new --from-template dependency
taskforge new --from-template security
taskforge new --from-template documentation
```

## Generated task frontmatter

Example:

```yaml
id: TASK-123
type: Feature
status: Ready
priority: P1
agentId: implementer
agentRole: Implementer Agent
modelClass: coding
requiredCapabilities:
  - code-editing
  - test-authoring
riskLevel: Medium
humanInterventionRequired: false
```

## Acceptance Criteria

- `taskforge new` creates agent-aware task files.
- `--agent` validates against agent registry.
- Task type inference selects correct default agent.
- `--json` output includes selected agent and model policy.
- Tests cover explicit agent, inferred agent, invalid agent, and templates.

---

# TASK-068: Add generic framework adapter API for agent definitions

## Type

Feature

## Priority

P1

## Agent Role

Framework Adapter Agent

## Risk Level

High

## Goal

Create a generic adapter API that can render TaskForge agent definitions into specific framework configurations.

## Requirements

Build on earlier agent framework initialization architecture.

Add explicit agent rendering methods:

```ts
interface AgentFrameworkAdapter {
  id: string;
  displayName: string;

  detect(projectRoot: string): Promise<AgentFrameworkDetection>;

  renderAgentDefinitions(ctx: AgentRenderContext): Promise<GeneratedFile[]>;
  renderModelRouting(ctx: AgentRenderContext): Promise<GeneratedFile[]>;
  renderPermissions(ctx: AgentRenderContext): Promise<GeneratedFile[]>;
  renderCommands(ctx: AgentRenderContext): Promise<GeneratedFile[]>;
  renderPlugins(ctx: AgentRenderContext): Promise<GeneratedFile[]>;

  validate(ctx: AgentFrameworkDoctorContext): Promise<Diagnostic[]>;
}
```

Context must include:

- project root
- TaskForge config
- agent definitions
- model routing config
- policy profile
- framework-specific user config
- dry-run flag

## Acceptance Criteria

- Generic adapter renders documentation-only agent policy.
- OpenCode adapter can be implemented using the same interface.
- Adapter outputs are represented as generated file plans before writing.
- Tests cover adapter output planning and no-write dry run.
- No OpenCode-specific assumptions leak into core agent schema.

---

# TASK-069: Implement OpenCode adapter for TaskForge agents and model routing

## Type

Feature

## Priority

P1

## Agent Role

Framework Adapter Agent

## Risk Level

High

## Goal

Render TaskForge agent definitions into OpenCode-specific files and config.

## Requirements

Generate:

```text
opencode.json
.opencode/agents/intake.md
.opencode/agents/planner.md
.opencode/agents/implementer.md
.opencode/agents/qa.md
.opencode/agents/reviewer.md
.opencode/agents/continuation.md
.opencode/agents/release-summary.md
.opencode/agents/dependency-steward.md
.opencode/agents/doctor.md
.opencode/agents/documentation.md
.opencode/agents/security.md
.opencode/agents/framework-adapter.md
.opencode/agents/audit-transcript.md
```

Each OpenCode agent file must include:

- Role description.
- Lifecycle stages.
- Allowed task types.
- Required capabilities.
- TaskForge workflow instructions.
- Permission profile.
- Model hint if representable by OpenCode.
- Guardrails:
  - no direct git for normal agents
  - no direct task-state editing
  - doctor-mode exception only for doctor

Update `opencode.json` with:

- per-agent permissions
- model/provider mapping if supported by OpenCode config
- project-level denial rules
- doctor exception rules

## Model Mapping

If OpenCode supports explicit per-agent model config in project config, render it.

If not, render model hints into agent files and include a clear diagnostic:

```text
OpenCode adapter could not enforce per-agent model mapping directly. Agent files include model preference hints. Configure OpenCode model routing manually or via provider config.
```

## Acceptance Criteria

- All canonical agents generate OpenCode files.
- `opencode.json` preserves unrelated user config.
- Normal agents deny `git *`.
- Doctor agent has elevated ask-gated permissions.
- Agent files include resolved model policy.
- Tests cover generated file list, content, merge behavior, and disabled agents.

---

# TASK-070: Add `taskforge agents` CLI

## Type

Feature

## Priority

P1

## Agent Role

Implementer Agent

## Risk Level

Medium

## Goal

Add CLI commands to inspect, validate, and manage TaskForge agent definitions.

## Commands

Add:

```bash
taskforge agents list
taskforge agents show implementer
taskforge agents validate
taskforge agents models
taskforge agents route TASK-123
taskforge agents emit --framework opencode
taskforge agents set-model implementer --provider PROVIDER --model MODEL
taskforge agents clear-model implementer
taskforge agents enable security
taskforge agents disable security
```

## Output

`taskforge agents list`:

```text
ID                  Enabled  Model Class  Lifecycle
implementer         yes      coding       Ready, In Progress
reviewer            yes      review       Review
qa                  yes      balanced     Verify
doctor              yes      reasoning    Blocked/recovery
```

`taskforge agents route TASK-123 --json`:

```json
{
  "taskId": "TASK-123",
  "eligibleAgents": ["implementer"],
  "recommendedAgent": "implementer",
  "resolvedModel": {
    "provider": "anthropic",
    "model": "claude-sonnet-4.5"
  },
  "explanation": "Ready Feature task routes to Implementer Agent"
}
```

## Acceptance Criteria

- CLI commands exist and are documented.
- `--json` is supported for list/show/route/models.
- Invalid agent IDs fail clearly.
- Disabled agents are not selected by routing.
- Tests cover all commands.

---

# TASK-071: Add doctor diagnostics for agents and routing

## Type

Feature

## Priority

P1

## Agent Role

Doctor Agent

## Risk Level

Medium

## Goal

Extend doctor checks to validate agent definitions, routing, model policy, and framework emissions.

## Commands

Add:

```bash
taskforge doctor agents
taskforge doctor routing
taskforge doctor models
taskforge doctor framework-adapters
```

## Checks

### `doctor agents`

Validate:

- All enabled agents have valid definitions.
- Canonical required agents exist.
- No duplicate IDs.
- Disabled agents are not referenced by routing.
- Permission profiles exist.

### `doctor routing`

Validate:

- Every lifecycle status has at least one eligible agent.
- Every task type has at least one eligible agent or fallback.
- Every task with `agentId` references a valid enabled agent.
- Every task with `requiredCapabilities` has at least one eligible agent.

### `doctor models`

Validate:

- Every enabled agent resolves to a model policy.
- Unknown providers are warned.
- Missing model for high-risk agents is warned.
- Doctor/security/reviewer agents are not assigned obviously cheap model classes unless explicitly overridden.

### `doctor framework-adapters`

Validate:

- Active framework adapter exists.
- Generated files are present.
- Generated files match policy version.
- OpenCode files exist when framework is OpenCode.

## Fix Behavior

With `--fix`:

- Regenerate missing built-in agent definitions.
- Remove routing references to disabled agents only if safe.
- Regenerate framework files from current definitions.
- Do not overwrite user model choices.

## Acceptance Criteria

- Diagnostics have pass/warn/fail severity.
- `--json` is supported.
- `--fix` repairs missing generated agent files.
- Tests cover invalid agent, invalid routing, missing model, and stale OpenCode output.

---

# TASK-072: Integrate agents into task lifecycle transitions

## Type

Feature

## Priority

P1

## Agent Role

Implementer Agent

## Risk Level

High

## Goal

Use agent definitions to validate and guide lifecycle transitions.

## Requirements

When transitioning task status:

- Verify the transition is compatible with the acting agent.
- Record acting `agentId` and session ID in task notes/audit.
- Recommend next agent for the next lifecycle stage.
- Optionally create follow-up tasks for next-stage agents.

Examples:

```bash
taskforge done TASK-123
```

If task moves from `In Progress` to `Review`, output:

```text
Next recommended agent: reviewer
Suggested command: taskforge next --agent reviewer
```

For `taskforge block`:

- If block reason indicates state corruption, recommend doctor.
- If block reason indicates missing spec, recommend planner.
- If block reason indicates test failure, recommend QA or implementer depending on status.

## Acceptance Criteria

- Status transitions validate acting agent when agent context is known.
- Transitions emit next-agent recommendation.
- Audit log includes acting agent and next recommended agent.
- Tests cover implementation-to-review, review-to-verify, verify-to-done, blocked-to-doctor, and needs-spec-to-planner.

---

# TASK-073: Add role-specific task templates

## Type

Feature

## Priority

P2

## Agent Role

Planner Agent

## Risk Level

Low

## Goal

Create task templates aligned with agent types so `taskforge new` can generate higher-quality task specs.

## Templates

Add templates for:

```text
intake
planning
implementation
qa
review
dependency
doctor-recovery
documentation
security
framework-adapter
audit-transcript
```

## Requirements

Each template should include:

- Goal.
- Background.
- Scope.
- Out of scope.
- Required agent.
- Required capabilities.
- Acceptance criteria.
- Verification strategy.
- Human intervention conditions.
- Suggested model class.

## CLI

Add:

```bash
taskforge new --template security "Review OpenCode guard plugin"
taskforge new --template framework-adapter "Add Claude Code adapter"
taskforge new --template doctor-recovery "Repair stale task-state lock"
```

## Acceptance Criteria

- Templates create valid task files.
- Templates set `agentId`.
- Templates set `requiredCapabilities`.
- Templates set `modelClass`.
- Tests cover every template.

---

# TASK-074: Add audit support for agent and model selection

## Type

Feature

## Priority

P2

## Agent Role

Audit/Transcript Agent

## Risk Level

Medium

## Goal

Record which agent and model were selected for every task lifecycle event and execution session.

## Requirements

Extend audit events to include:

```json
{
  "agentId": "implementer",
  "agentDisplayName": "Implementer Agent",
  "modelPolicy": {
    "provider": "anthropic",
    "model": "claude-sonnet-4.5",
    "source": "agentOverride"
  },
  "routingReason": "Ready Feature task eligible for Implementer Agent"
}
```

Emit events for:

- `taskforge new`
- `taskforge next`
- `taskforge start`
- `taskforge checkpoint`
- `taskforge submit`
- `taskforge done`
- lifecycle transitions
- OpenCode session start if plugin integration exists

## CLI

Extend:

```bash
taskforge audit TASK-ID
taskforge transcript TASK-ID
taskforge timeline TASK-ID
```

to show:

- acting agent
- selected model
- model source
- routing decision
- lifecycle stage

## Acceptance Criteria

- Audit events include agent/model metadata.
- Timeline output shows agent handoff.
- Transcript output can filter by agent:

```bash
taskforge transcript TASK-123 --agent reviewer
```

- Tests cover audit event shape and filtering.

---

# TASK-075: Add documentation for agents, routing, and model policy

## Type

Documentation

## Priority

P2

## Agent Role

Documentation Agent

## Risk Level

Low

## Goal

Document the TaskForge agent definition and model routing system.

## Files

Update:

```text
README.md
TASKFORGE.md
AGENTS.md
docs/agent-framework-integration.md
```

Add:

```text
docs/agents.md
docs/model-routing.md
docs/lifecycle-routing.md
```

## Documentation Must Cover

- Canonical agent types.
- Agent definition files.
- Model policy and fallback resolution.
- Lifecycle-to-agent routing.
- Task creation with agent assignment.
- OpenCode adapter behavior.
- How to manually set models per agent.
- How to validate with doctor.
- How to add a future framework adapter.
- How agents hand off across lifecycle stages.

## Acceptance Criteria

- Docs include command examples.
- Docs explain OpenCode is default but not required.
- Docs explain model routing is framework-neutral.
- Docs explain how to override per-agent models.
- Docs include lifecycle routing table.
- Docs include troubleshooting section.

---

# TASK-076: Add tests for end-to-end agent lifecycle routing

## Type

Test

## Priority

P1

## Agent Role

QA Agent

## Risk Level

Medium

## Goal

Add integration tests proving that agent definitions, routing, task creation, scheduler, and lifecycle transitions work together.

## Test Scenario

Create temp TaskForge project.

Run:

```bash
taskforge init --agent-framework opencode --policy managed
taskforge new "Implement config merge" --type Feature --priority P1
taskforge next --agent implementer --json
taskforge start TASK-001 --agent implementer
taskforge done TASK-001 --next-status Review
taskforge next --agent reviewer --json
```

Verify:

- New task gets `agentId: implementer`.
- `next --agent implementer` selects the task.
- `start` records acting agent/session.
- Transition to `Review` recommends reviewer.
- `next --agent reviewer` selects review-eligible task.
- OpenCode files are generated.
- Model policy resolves at each stage.

## Additional Test Cases

- Dependency task routes to Dependency Steward.
- Documentation task routes to Documentation Agent.
- Security task routes to Security Agent.
- Verify status routes to QA.
- Doctor task routes only to Doctor.
- Disabled agent is not selected.
- Missing model policy warns but does not crash.

## Acceptance Criteria

- Tests require no network.
- Tests do not require OpenCode binary.
- Tests use temp directories.
- Tests pass in CI.
- Tests cover both JSON and human-readable command output.

---

# Suggested Implementation Order

1. `TASK-061` — canonical agent schema.
2. `TASK-062` — built-in default agents.
3. `TASK-063` — model routing config.
4. `TASK-064` — lifecycle routing matrix.
5. `TASK-066` — task schema/frontmatter agent fields.
6. `TASK-070` — `taskforge agents` CLI.
7. `TASK-067` — `taskforge new` integration.
8. `TASK-065` — scheduler integration.
9. `TASK-068` — generic framework adapter API.
10. `TASK-069` — OpenCode adapter.
11. `TASK-071` — doctor diagnostics.
12. `TASK-072` — lifecycle transition integration.
13. `TASK-073` — role-specific templates.
14. `TASK-074` — audit metadata.
15. `TASK-076` — end-to-end tests.
16. `TASK-075` — docs.

# MVP Cut

The smallest useful implementation slice:

1. `TASK-061`
2. `TASK-062`
3. `TASK-063`
4. `TASK-064`
5. `TASK-066`
6. `TASK-067`
7. `TASK-065`
8. `TASK-069`
9. `TASK-071`

This gives TaskForge:

- Explicit agent definitions.
- Per-agent model policy.
- Agent-aware task creation.
- Agent-aware scheduler.
- OpenCode agent file generation.
- Doctor validation.

# Non-Goals

These tasks do not require:

- Implementing a full autonomous multi-agent runtime.
- Running models directly inside TaskForge.
- Supporting every agentic framework immediately.
- Hardcoding OpenCode as the permanent abstraction.
- Enforcing remote GitHub branch protection.
- Building a cloud control plane.

# Architectural Principle

TaskForge should own the **generic project agent model**.

Agentic frameworks should be adapters.

```text
TaskForge Agent Definition
  → Generic lifecycle/routing/model policy
    → Framework adapter
      → OpenCode / Claude Code / Codex / future runtime
```

OpenCode is the default implementation target, not the core abstraction.
