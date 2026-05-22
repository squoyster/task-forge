---
id: TASK-039
type: Feature
status: In Progress
priority: P2
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
assignee: dcb1b97102
claimed_at: '2026-05-22 08:24:27'
---

# TASK-039: Control-File Change Detection — Prevent Stale-Context Work

## Goal

Detect when control-plane files (AGENTS.md, TASKFORGE.md, configs, shared schemas, etc.) change while a task is in progress — flagging potential staleness so agents don't waste time implementing against obsolete conventions or specs.

## Background

When an agent starts a task and reads AGENTS.md, another agent may merge a change to AGENTS.md before the first agent finishes. The first agent then delivers work based on stale conventions. Without detection, this failure mode is silent.

The fix: hash control files on `start`, re-check on `done`/`report`/`block`. If hashes changed, flag for human review before accepting the work.

## Methodology: Three-Layer Control File Discovery

### Layer 1 — Default set (always watched)

Hardcoded universal control-plane files:

```
AGENTS.md, TASKFORGE.md, README.md, CHANGELOG.md
package.json, tsconfig.json, tsup.config.ts
.taskforge/config.json
```

### Layer 2 — Repo-configured (extensible)

Let each repo declare additional control files in `.taskforge/config.json`:

```json
{
  "controlFiles": [
    "src/core/task.ts",
    "src/core/errors.ts",
    "src/util/status-constants.ts",
    ".opencode/agent/implementer.md"
  ]
}
```

### Layer 3 — Automatic discovery via `doctor`

`taskforge doctor --detect-control-files` scans the repo for files that look like control files but aren't in the watch list, suggesting the repo owner add them:

| Pattern | Why |
|---------|-----|
| `**/AGENTS.md`, `**/TASKFORGE.md` | Agent instructions |
| `**/config*.{json,yaml,ts}` | Configuration |
| `**/schema*.ts`, `**/types.ts` | Shared schema/types |
| `**/templates.ts` | Task/file templates |
| `.opencode/**/*.md` | Custom agent instructions |
| `src/**/errors.ts`, `src/**/constants.ts` | Shared foundation |
| `package.json`, `tsconfig*.json` | Build/dependency contracts |

## Scope

### New files:

- `src/core/control-files.ts` — `getControlFiles()`, `hashControlFiles()`, `detectControlFileCandidates()`
- `tests/control-files.test.ts`

### Modified files:

- `src/core/task.ts` — add optional `context_hash` field to Task schema
- `src/core/config.ts` — add `controlFiles: string[]` to config schema
- `src/commands/start.ts` — compute and store control-file hashes on claim
- `src/commands/done.ts` — re-hash and warn if changed; refuse if mismatch detected
- `src/commands/report.ts` — same
- `src/commands/block.ts` — same
- `src/commands/doctor.ts` — add `--detect-control-files` flag; report hash mismatches on active tasks

## Behavior

### On `taskforge start`
1. Compute `context_hash` from all control files
2. Store in task frontmatter: `context_hash: abc123def456...`

### On `taskforge done` / `report` / `block`
1. Re-compute `context_hash`
2. If it matches the stored hash → proceed normally
3. If it differs → warn with the list of files that changed; refuse unless `--force`

### On `taskforge doctor`
- Report any active tasks whose `context_hash` doesn't match current control files
- `--detect-control-files` shows un-configured but matching files

## Acceptance Criteria

- [ ] `controlFiles` config section with Layer 1 defaults auto-merged with Layer 2 overrides
- [ ] `hashControlFiles()` computes a single hash from all control-file content
- [ ] `taskforge start` stores `context_hash` in task frontmatter
- [ ] `taskforge done` warns and refuses if control files changed since start (unless `--force`)
- [ ] `taskforge report --complete` same behavior
- [ ] `taskforge doctor` reports active tasks with stale context
- [ ] `taskforge doctor --detect-control-files` suggests un-configured candidates
- [ ] Tests cover: hash stability, detection of changes, force override, doctor integration

## Test / Verification Command

```bash
npm run typecheck && npm run lint && npm run build && npm test -- --run
```

## Dependencies

TASK-025 (block schema changes), TASK-032 (doctor)

## Risk Level

Medium — adds a new refusal condition to `done`/`report`/`block`, but `--force` always overrides.

## Continuation Policy

Auto-continue.

## Agent Notes

### 2026-05-22 System
- Task started via taskforge start TASK-039
- Session: dcb1b97102
- Branch: agent/TASK-039-control-file-change-detection-prevent-st--dcb1b97102
- Worktree: /Volumes/Transcend/devel/worktrees/TASK-039
