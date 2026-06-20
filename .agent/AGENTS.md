# Agent Routing — TaskForge

## Purpose

Compact routing indices that enable agents to navigate the codebase efficiently without broad file discovery. These indices are the first thing agents should consult before reading files or searching with grep/glob.

## Ownership

| File | Kind | Purpose |
|---|---|---|
| `tf.ctx` | Context | Project context, priorities, entities, state machine invariants, review criteria, context budget |
| `file.idx` | File index | All project files with paths, types, sizes, and read-guidance |
| `symbol.idx` | Symbol index | Key exported symbols with file/line locations |
| `spec.idx` | Spec index | Key specification documents and their use-cases |
| `task.idx` | Task index | Current task routing (minimal — delegates to `taskforge help`) |
| `index.overrides` | Overrides | Manual overrides to the automatic indices |

## Local Contracts

- **Discovery order** (from `AGENTS.md` root): `tf.ctx` → `file.idx` → `symbol.idx` → `spec.idx` → `task.idx`
- Indices are generated semi-automatically. If a needed file is not indexed, use narrow grep/glob and then update `.agent/index.overrides`.
- Do not store source code, task state, or runtime data in `.agent/`.
- The `skills/` subdirectory may contain skill definitions for agent tool use.

## Work Guidance

- Read all 5 index files before broad file discovery.
- Use `file.idx` to find files by name/type without expensive globs.
- Use `spec.idx` to find which spec document to read for a given concept.
- If an index is stale, update it or regenerate after project changes.

## Verification

N/A — agent routing is operational data. Validate by checking file paths exist on read.

## Child DOX Index

No children — this is a leaf directory.
