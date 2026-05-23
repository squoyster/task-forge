# TaskForge Providers — Extension Guide

TaskForge uses a provider model for external integrations. GitHub, OpenCode, and package managers are optional adapters — not core requirements.

## Available Provider Types

| Provider | Interface | Default | Purpose |
|----------|-----------|---------|---------|
| Board | `BoardProvider` | Markdown | Issue tracking, status sync, project boards |
| Agent | `AgentProvider` | Generic | Agent instructions, prompt formatting, transcript export |
| Git | `GitPort` | CLI (child_process) | All git operations via native binary |
| Package | `PackageProvider` | npm | Package scans, audits, updates |
| Audit | `AuditSink` | File (JSONL) | Per-task audit event storage |

## Core Principle

TaskForge core depends on **interfaces**, not implementations. The Markdown task-state store and CLI GitPort are the only built-in implementations required for minimal operation. Everything else is provider-based and optional.

## Extension Methodology

1. Identify the relevant port interface in `src/core/ports/`
2. Implement the provider in `src/providers/<category>/<provider-id>/`
3. Register in the provider registry
4. Add config schema support under `providers.<category>.<provider-id>`
5. Add tests using the provider contract pattern
6. Add documentation and a minimal config example

## Provider Interface Stability

| Interface | Status |
|-----------|--------|
| `BoardProvider` | Stable |
| `AgentProvider` | Stable |
| `GitPort` | Stable |
| `PackageProvider` | Experimental |
| `AuditSink` | Stable |

## See Also

- `docs/architecture/opencode-container-execution.md` — OpenCode execution strategy
- `docs/control-plane-hardening.md` — Credential tiers and threat model
- `docs/github-task-state-protection.md` — Branch protection setup
